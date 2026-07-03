import {
  AutoScalingClient,
  type AutoScalingGroup,
  CreateAutoScalingGroupCommand,
  DeletePolicyCommand,
  DeleteScheduledActionCommand,
  DescribeAutoScalingGroupsCommand,
  DescribeInstanceRefreshesCommand,
  DescribePoliciesCommand,
  DescribeScheduledActionsCommand,
  type Instance,
  PutScalingPolicyCommand,
  PutScheduledUpdateGroupActionCommand,
  StartInstanceRefreshCommand,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./autoscaling-api";

const asg = mockClient(AutoScalingClient);

beforeEach(() => asg.reset());

describe("listAutoScalingGroups mapping", () => {
  it("maps capacity, instance count, launch-template label (from LaunchTemplate name)", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "web-asg",
          AutoScalingGroupARN: "arn:asg",
          MinSize: 1,
          MaxSize: 4,
          DesiredCapacity: 2,
          Instances: [{ InstanceId: "i-1" }, { InstanceId: "i-2" }] as unknown as Instance[],
          HealthCheckType: "EC2",
          LaunchTemplate: { LaunchTemplateName: "web-lt", LaunchTemplateId: "lt-1" },
          AvailabilityZones: ["us-east-1a"],
          TargetGroupARNs: ["arn:tg"],
          CreatedTime: new Date("2024-01-01T00:00:00Z"),
        },
      ] as unknown as AutoScalingGroup[],
    });
    const r = await api.listAutoScalingGroups();
    expect(r[0]).toMatchObject({
      name: "web-asg",
      minSize: 1,
      maxSize: 4,
      desiredCapacity: 2,
      instanceCount: 2,
      healthCheckType: "EC2",
      launchTemplate: "web-lt",
      availabilityZones: ["us-east-1a"],
      targetGroupArns: ["arn:tg"],
      createdTime: "2024-01-01T00:00:00.000Z",
    });
  });

  it("launchTemplateLabel falls back through MixedInstancesPolicy then LaunchConfiguration", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "mixed",
          MinSize: 0,
          MaxSize: 1,
          DesiredCapacity: 0,
          MixedInstancesPolicy: {
            LaunchTemplate: {
              LaunchTemplateSpecification: { LaunchTemplateName: "mixed-lt" },
            },
          },
        },
        {
          AutoScalingGroupName: "legacy",
          MinSize: 0,
          MaxSize: 1,
          DesiredCapacity: 0,
          LaunchConfigurationName: "legacy-lc",
        },
      ] as unknown as AutoScalingGroup[],
    });
    const r = await api.listAutoScalingGroups();
    expect(r[0]?.launchTemplate).toBe("mixed-lt");
    expect(r[1]?.launchTemplate).toBe("legacy-lc");
  });

  it("returns [] when empty", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({});
    await expect(api.listAutoScalingGroups()).resolves.toEqual([]);
  });
});

describe("getAutoScalingGroupDetail mapping", () => {
  it("maps instances, target-tracking policy metric, and scheduled actions", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "web-asg",
          MinSize: 1,
          MaxSize: 4,
          DesiredCapacity: 2,
          Instances: [
            {
              InstanceId: "i-1",
              LifecycleState: "InService",
              HealthStatus: "Healthy",
              AvailabilityZone: "us-east-1a",
            },
          ] as unknown as Instance[],
        },
      ] as unknown as AutoScalingGroup[],
    });
    asg.on(DescribePoliciesCommand).resolves({
      ScalingPolicies: [
        {
          PolicyName: "cpu",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingConfiguration: {
            PredefinedMetricSpecification: { PredefinedMetricType: "ASGAverageCPUUtilization" },
            TargetValue: 50,
          },
        },
        {
          PolicyName: "custom",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingConfiguration: {
            CustomizedMetricSpecification: {
              MetricName: "x",
              Namespace: "y",
              Statistic: "Average",
            },
            TargetValue: 10,
          },
        },
      ],
    });
    asg.on(DescribeScheduledActionsCommand).resolves({
      ScheduledUpdateGroupActions: [
        {
          ScheduledActionName: "scale-up",
          Recurrence: "0 9 * * *",
          MinSize: 2,
          MaxSize: 6,
          DesiredCapacity: 4,
          StartTime: new Date("2024-05-05T00:00:00Z"),
        },
      ],
    });
    const d = await api.getAutoScalingGroupDetail("web-asg");
    expect(d.instances[0]).toEqual({
      instanceId: "i-1",
      lifecycleState: "InService",
      healthStatus: "Healthy",
      availabilityZone: "us-east-1a",
    });
    expect(d.policies[0]).toMatchObject({
      name: "cpu",
      metric: "ASGAverageCPUUtilization",
      targetValue: 50,
    });
    expect(d.policies[1]?.metric).toBe("Custom");
    expect(d.scheduledActions[0]).toMatchObject({
      name: "scale-up",
      recurrence: "0 9 * * *",
      desiredCapacity: 4,
      startTime: "2024-05-05T00:00:00.000Z",
    });
  });

  it("maps instance refreshes (best-effort) and stays empty when the API rejects", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        { AutoScalingGroupName: "web-asg", MinSize: 1, MaxSize: 2, DesiredCapacity: 1 },
      ] as unknown as AutoScalingGroup[],
    });
    asg.on(DescribePoliciesCommand).resolves({});
    asg.on(DescribeScheduledActionsCommand).resolves({});
    asg.on(DescribeInstanceRefreshesCommand).resolves({
      InstanceRefreshes: [
        {
          InstanceRefreshId: "ir-1",
          Status: "InProgress",
          PercentageComplete: 40,
          InstancesToUpdate: 3,
          StartTime: new Date("2024-06-01T00:00:00Z"),
        },
      ],
    });
    const d = await api.getAutoScalingGroupDetail("web-asg");
    expect(d.instanceRefreshes[0]).toMatchObject({
      id: "ir-1",
      status: "InProgress",
      percentageComplete: 40,
      instancesToUpdate: 3,
      startTime: "2024-06-01T00:00:00.000Z",
    });

    asg.reset();
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        { AutoScalingGroupName: "web-asg", MinSize: 1, MaxSize: 2, DesiredCapacity: 1 },
      ] as unknown as AutoScalingGroup[],
    });
    asg.on(DescribePoliciesCommand).resolves({});
    asg.on(DescribeScheduledActionsCommand).resolves({});
    asg.on(DescribeInstanceRefreshesCommand).rejects(new Error("not supported"));
    const d2 = await api.getAutoScalingGroupDetail("web-asg");
    expect(d2.instanceRefreshes).toEqual([]);
  });

  it("throws when the group is not found", async () => {
    asg
      .on(DescribeAutoScalingGroupsCommand)
      .resolves({ AutoScalingGroups: [] })
      .on(DescribePoliciesCommand)
      .resolves({})
      .on(DescribeScheduledActionsCommand)
      .resolves({});
    await expect(api.getAutoScalingGroupDetail("missing")).rejects.toThrow(/not found/);
  });
});

describe("write/command shapes", () => {
  it("createAutoScalingGroup uses $Default version + joins subnets into VPCZoneIdentifier", async () => {
    asg.on(CreateAutoScalingGroupCommand).resolves({});
    await api.createAutoScalingGroup({
      name: "web-asg",
      launchTemplateId: "lt-1",
      minSize: 1,
      maxSize: 4,
      desiredCapacity: 2,
      subnetIds: ["subnet-1", "subnet-2"],
      targetGroupArns: ["arn:tg"],
    });
    expect(asg.commandCalls(CreateAutoScalingGroupCommand)[0]?.args[0].input).toMatchObject({
      AutoScalingGroupName: "web-asg",
      LaunchTemplate: { LaunchTemplateId: "lt-1", Version: "$Default" },
      MinSize: 1,
      MaxSize: 4,
      DesiredCapacity: 2,
      VPCZoneIdentifier: "subnet-1,subnet-2",
      TargetGroupARNs: ["arn:tg"],
    });
  });

  it("createAutoScalingGroup omits VPCZoneIdentifier/TargetGroupARNs when empty", async () => {
    asg.on(CreateAutoScalingGroupCommand).resolves({});
    await api.createAutoScalingGroup({
      name: "web-asg",
      launchTemplateId: "lt-1",
      minSize: 1,
      maxSize: 1,
      desiredCapacity: 1,
      subnetIds: [],
      targetGroupArns: [],
    });
    const input = asg.commandCalls(CreateAutoScalingGroupCommand)[0]?.args[0].input;
    expect(input).not.toHaveProperty("VPCZoneIdentifier");
    expect(input).not.toHaveProperty("TargetGroupARNs");
  });

  it("updateCapacity sends min/max/desired", async () => {
    asg.on(UpdateAutoScalingGroupCommand).resolves({});
    await api.updateCapacity("web-asg", { minSize: 2, maxSize: 8, desiredCapacity: 4 });
    expect(asg.commandCalls(UpdateAutoScalingGroupCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      MinSize: 2,
      MaxSize: 8,
      DesiredCapacity: 4,
    });
  });

  it("putScalingPolicy maps the CPU predefined metric (no resource label)", async () => {
    asg.on(PutScalingPolicyCommand).resolves({});
    await api.putScalingPolicy({
      asgName: "web-asg",
      policyName: "cpu",
      metricType: "ASGAverageCPUUtilization",
      targetValue: 50,
    });
    expect(asg.commandCalls(PutScalingPolicyCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      PolicyName: "cpu",
      PolicyType: "TargetTrackingScaling",
      TargetTrackingConfiguration: {
        PredefinedMetricSpecification: { PredefinedMetricType: "ASGAverageCPUUtilization" },
        TargetValue: 50,
      },
    });
  });

  it("putScalingPolicy includes ResourceLabel for ALBRequestCountPerTarget", async () => {
    asg.on(PutScalingPolicyCommand).resolves({});
    await api.putScalingPolicy({
      asgName: "web-asg",
      policyName: "alb",
      metricType: "ALBRequestCountPerTarget",
      targetValue: 1000,
      resourceLabel: "app/my-lb/abc/targetgroup/my-tg/def",
    });
    const spec =
      asg.commandCalls(PutScalingPolicyCommand)[0]?.args[0].input?.TargetTrackingConfiguration
        ?.PredefinedMetricSpecification;
    expect(spec).toEqual({
      PredefinedMetricType: "ALBRequestCountPerTarget",
      ResourceLabel: "app/my-lb/abc/targetgroup/my-tg/def",
    });
  });

  it("putScheduledAction sends recurrence + capacity; omits unset capacity", async () => {
    asg.on(PutScheduledUpdateGroupActionCommand).resolves({});
    await api.putScheduledAction({
      asgName: "web-asg",
      name: "scale-up",
      recurrence: "0 9 * * *",
      minSize: 2,
      maxSize: 6,
      desiredCapacity: 4,
    });
    expect(asg.commandCalls(PutScheduledUpdateGroupActionCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      ScheduledActionName: "scale-up",
      Recurrence: "0 9 * * *",
      MinSize: 2,
      MaxSize: 6,
      DesiredCapacity: 4,
    });

    asg.reset();
    asg.on(PutScheduledUpdateGroupActionCommand).resolves({});
    await api.putScheduledAction({ asgName: "web-asg", name: "x", recurrence: "0 0 * * *" });
    const input = asg.commandCalls(PutScheduledUpdateGroupActionCommand)[0]?.args[0].input;
    expect(input).not.toHaveProperty("MinSize");
    expect(input).not.toHaveProperty("DesiredCapacity");
  });

  it("startInstanceRefresh sends preferences; omits InstanceWarmup when unset", async () => {
    asg.on(StartInstanceRefreshCommand).resolves({});
    await api.startInstanceRefresh({
      asgName: "web-asg",
      minHealthyPercentage: 90,
      instanceWarmupSeconds: 120,
    });
    expect(asg.commandCalls(StartInstanceRefreshCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      Preferences: { MinHealthyPercentage: 90, InstanceWarmup: 120 },
    });

    asg.reset();
    asg.on(StartInstanceRefreshCommand).resolves({});
    await api.startInstanceRefresh({
      asgName: "web-asg",
      minHealthyPercentage: 100,
      instanceWarmupSeconds: null,
    });
    const input = asg.commandCalls(StartInstanceRefreshCommand)[0]?.args[0].input;
    expect(input?.Preferences).not.toHaveProperty("InstanceWarmup");
  });

  it("deletePolicy / deleteScheduledAction send the right names", async () => {
    asg.on(DeletePolicyCommand).resolves({}).on(DeleteScheduledActionCommand).resolves({});
    await api.deletePolicy("web-asg", "cpu");
    await api.deleteScheduledAction("web-asg", "scale-up");
    expect(asg.commandCalls(DeletePolicyCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      PolicyName: "cpu",
    });
    expect(asg.commandCalls(DeleteScheduledActionCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      ScheduledActionName: "scale-up",
    });
  });
});

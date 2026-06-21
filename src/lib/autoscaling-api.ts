import {
  type AutoScalingGroup,
  CreateAutoScalingGroupCommand,
  DeleteAutoScalingGroupCommand,
  DescribeAutoScalingGroupsCommand,
  DescribePoliciesCommand,
  DescribeScheduledActionsCommand,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "./autoscaling-client";
import type { AsgCapacityInput, AsgDetail, AsgSummary, CreateAsgInput } from "./types";

function launchTemplateLabel(g: AutoScalingGroup): string | null {
  return (
    g.LaunchTemplate?.LaunchTemplateName ??
    g.LaunchTemplate?.LaunchTemplateId ??
    g.MixedInstancesPolicy?.LaunchTemplate?.LaunchTemplateSpecification?.LaunchTemplateName ??
    g.LaunchConfigurationName ??
    null
  );
}

function toSummary(g: AutoScalingGroup): AsgSummary {
  return {
    name: g.AutoScalingGroupName ?? "",
    arn: g.AutoScalingGroupARN ?? null,
    minSize: g.MinSize ?? 0,
    maxSize: g.MaxSize ?? 0,
    desiredCapacity: g.DesiredCapacity ?? 0,
    instanceCount: g.Instances?.length ?? 0,
    healthCheckType: g.HealthCheckType ?? null,
    launchTemplate: launchTemplateLabel(g),
    availabilityZones: g.AvailabilityZones ?? [],
    targetGroupArns: g.TargetGroupARNs ?? [],
    createdTime: g.CreatedTime ? g.CreatedTime.toISOString() : null,
  };
}

export const api = {
  listAutoScalingGroups: async (): Promise<AsgSummary[]> => {
    const out = await getAutoScalingClient().send(new DescribeAutoScalingGroupsCommand({}));
    return (out.AutoScalingGroups ?? []).map(toSummary);
  },

  getAutoScalingGroupDetail: async (name: string): Promise<AsgDetail> => {
    const client = getAutoScalingClient();
    const [groupsOut, policiesOut, scheduledOut] = await Promise.all([
      client.send(new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [name] })),
      client.send(new DescribePoliciesCommand({ AutoScalingGroupName: name })),
      client.send(new DescribeScheduledActionsCommand({ AutoScalingGroupName: name })),
    ]);

    const g = groupsOut.AutoScalingGroups?.[0];
    if (!g) throw new Error(`Auto Scaling group ${name} not found`);

    return {
      ...toSummary(g),
      instances: (g.Instances ?? []).map((i) => ({
        instanceId: i.InstanceId ?? "",
        lifecycleState: i.LifecycleState ?? null,
        healthStatus: i.HealthStatus ?? null,
        availabilityZone: i.AvailabilityZone ?? null,
      })),
      policies: (policiesOut.ScalingPolicies ?? []).map((p) => ({
        name: p.PolicyName ?? "",
        type: p.PolicyType ?? null,
        metric:
          p.TargetTrackingConfiguration?.PredefinedMetricSpecification?.PredefinedMetricType ??
          (p.TargetTrackingConfiguration?.CustomizedMetricSpecification ? "Custom" : null),
        targetValue: p.TargetTrackingConfiguration?.TargetValue ?? null,
      })),
      scheduledActions: (scheduledOut.ScheduledUpdateGroupActions ?? []).map((s) => ({
        name: s.ScheduledActionName ?? "",
        recurrence: s.Recurrence ?? null,
        minSize: s.MinSize ?? null,
        maxSize: s.MaxSize ?? null,
        desiredCapacity: s.DesiredCapacity ?? null,
        startTime: s.StartTime ? s.StartTime.toISOString() : null,
      })),
    };
  },

  createAutoScalingGroup: async (input: CreateAsgInput): Promise<void> => {
    await getAutoScalingClient().send(
      new CreateAutoScalingGroupCommand({
        AutoScalingGroupName: input.name,
        LaunchTemplate: { LaunchTemplateId: input.launchTemplateId, Version: "$Default" },
        MinSize: input.minSize,
        MaxSize: input.maxSize,
        DesiredCapacity: input.desiredCapacity,
        ...(input.subnetIds.length ? { VPCZoneIdentifier: input.subnetIds.join(",") } : {}),
        ...(input.targetGroupArns.length ? { TargetGroupARNs: input.targetGroupArns } : {}),
      }),
    );
  },

  updateCapacity: async (name: string, cap: AsgCapacityInput): Promise<void> => {
    await getAutoScalingClient().send(
      new UpdateAutoScalingGroupCommand({
        AutoScalingGroupName: name,
        MinSize: cap.minSize,
        MaxSize: cap.maxSize,
        DesiredCapacity: cap.desiredCapacity,
      }),
    );
  },

  deleteAutoScalingGroup: async (name: string, force: boolean): Promise<void> => {
    await getAutoScalingClient().send(
      new DeleteAutoScalingGroupCommand({ AutoScalingGroupName: name, ForceDelete: force }),
    );
  },
};

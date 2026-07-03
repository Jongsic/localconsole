import {
  type Action,
  AddTagsCommand,
  CreateListenerCommand,
  type CreateListenerCommandInput,
  CreateLoadBalancerCommand,
  type CreateLoadBalancerCommandInput,
  CreateRuleCommand,
  CreateTargetGroupCommand,
  type CreateTargetGroupCommandInput,
  DeleteListenerCommand,
  DeleteLoadBalancerCommand,
  DeleteRuleCommand,
  DeleteTargetGroupCommand,
  DeregisterTargetsCommand,
  DescribeListenersCommand,
  DescribeLoadBalancerAttributesCommand,
  DescribeLoadBalancersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  DescribeTargetGroupAttributesCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ModifyLoadBalancerAttributesCommand,
  ModifyTargetGroupAttributesCommand,
  ModifyTargetGroupCommand,
  RegisterTargetsCommand,
  RemoveTagsCommand,
  type RuleCondition,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { getElbv2Client } from "./elbv2-client";
import type {
  AlbAttributes,
  AlbListenerDetail,
  AlbRuleSummary,
  AlbSummary,
  CreateAlbInput,
  CreateListenerInput,
  CreateRuleInput,
  CreateTargetGroupInput,
  Tag,
  TargetGroupAttributes,
  TargetGroupSummary,
  TargetHealthEntry,
  TgHealthCheckInput,
} from "./types";

/** Short target-group name from its ARN (arn:...:targetgroup/NAME/id) */
function tgName(arn: string): string {
  return arn.match(/targetgroup\/([^/]+)/)?.[1] ?? arn;
}

function conditionText(c: RuleCondition): string {
  const values =
    c.Values && c.Values.length > 0
      ? c.Values
      : (c.HostHeaderConfig?.Values ??
        c.PathPatternConfig?.Values ??
        c.HttpRequestMethodConfig?.Values ??
        []);
  return `${c.Field ?? "?"}: ${values.join(", ")}`;
}

function actionText(a: Action): string {
  switch (a.Type) {
    case "forward": {
      const groups = a.ForwardConfig?.TargetGroups;
      if (groups && groups.length > 0) {
        return `forward → ${groups
          .map(
            (g) => `${tgName(g.TargetGroupArn ?? "")}${g.Weight != null ? ` (${g.Weight})` : ""}`,
          )
          .join(", ")}`;
      }
      return a.TargetGroupArn ? `forward → ${tgName(a.TargetGroupArn)}` : "forward";
    }
    case "redirect":
      return `redirect → ${a.RedirectConfig?.Host ?? ""}${a.RedirectConfig?.Path ?? ""}`;
    case "fixed-response":
      return `fixed-response ${a.FixedResponseConfig?.StatusCode ?? ""}`;
    default:
      return a.Type ?? "—";
  }
}

export const api = {
  listLoadBalancers: async (): Promise<AlbSummary[]> => {
    const out = await getElbv2Client().send(new DescribeLoadBalancersCommand({}));
    return (out.LoadBalancers ?? []).map((lb) => ({
      arn: lb.LoadBalancerArn ?? "",
      name: lb.LoadBalancerName ?? "",
      type: lb.Type ?? null,
      scheme: lb.Scheme ?? null,
      state: lb.State?.Code ?? null,
      dnsName: lb.DNSName ?? null,
      vpcId: lb.VpcId ?? null,
      availabilityZones: (lb.AvailabilityZones ?? []).map((z) => z.ZoneName ?? "").filter(Boolean),
      createdTime: lb.CreatedTime ? lb.CreatedTime.toISOString() : null,
    }));
  },

  getListeners: async (loadBalancerArn: string): Promise<AlbListenerDetail[]> => {
    const client = getElbv2Client();
    const out = await client.send(
      new DescribeListenersCommand({ LoadBalancerArn: loadBalancerArn }),
    );
    const listeners = out.Listeners ?? [];

    return Promise.all(
      listeners.map(async (l) => {
        const rulesOut = await client.send(
          new DescribeRulesCommand({ ListenerArn: l.ListenerArn }),
        );
        const rules: AlbRuleSummary[] = (rulesOut.Rules ?? []).map((r) => ({
          arn: r.RuleArn ?? "",
          isDefault: r.IsDefault ?? false,
          priority: r.Priority ?? "—",
          conditions: (r.Conditions ?? []).map(conditionText),
          actions: (r.Actions ?? []).map(actionText),
        }));
        return {
          arn: l.ListenerArn ?? "",
          port: l.Port ?? null,
          protocol: l.Protocol ?? null,
          defaultActionType: l.DefaultActions?.[0]?.Type ?? null,
          rules,
        };
      }),
    );
  },

  listTargetGroups: async (): Promise<TargetGroupSummary[]> => {
    const out = await getElbv2Client().send(new DescribeTargetGroupsCommand({}));
    return (out.TargetGroups ?? []).map((tg) => ({
      arn: tg.TargetGroupArn ?? "",
      name: tg.TargetGroupName ?? "",
      protocol: tg.Protocol ?? null,
      port: tg.Port ?? null,
      targetType: tg.TargetType ?? null,
      vpcId: tg.VpcId ?? null,
      healthCheckPath: tg.HealthCheckPath ?? null,
      healthCheckProtocol: tg.HealthCheckProtocol ?? null,
      healthCheckIntervalSeconds: tg.HealthCheckIntervalSeconds ?? null,
      healthCheckTimeoutSeconds: tg.HealthCheckTimeoutSeconds ?? null,
      healthyThreshold: tg.HealthyThresholdCount ?? null,
      unhealthyThreshold: tg.UnhealthyThresholdCount ?? null,
      matcherHttpCode: tg.Matcher?.HttpCode ?? null,
      loadBalancerArns: tg.LoadBalancerArns ?? [],
    }));
  },

  modifyHealthCheck: async (targetGroupArn: string, hc: TgHealthCheckInput): Promise<void> => {
    await getElbv2Client().send(
      new ModifyTargetGroupCommand({
        TargetGroupArn: targetGroupArn,
        ...(hc.path ? { HealthCheckPath: hc.path } : {}),
        HealthCheckIntervalSeconds: hc.intervalSeconds,
        HealthCheckTimeoutSeconds: hc.timeoutSeconds,
        HealthyThresholdCount: hc.healthyThreshold,
        UnhealthyThresholdCount: hc.unhealthyThreshold,
        ...(hc.matcherHttpCode ? { Matcher: { HttpCode: hc.matcherHttpCode } } : {}),
      }),
    );
  },

  getTargetGroupAttributes: async (targetGroupArn: string): Promise<TargetGroupAttributes> => {
    const out = await getElbv2Client().send(
      new DescribeTargetGroupAttributesCommand({ TargetGroupArn: targetGroupArn }),
    );
    const m = new Map((out.Attributes ?? []).map((a) => [a.Key ?? "", a.Value ?? ""]));
    return {
      stickinessEnabled: m.get("stickiness.enabled") === "true",
      stickinessType: m.get("stickiness.type") ?? "lb_cookie",
      stickinessDurationSeconds: Number(m.get("stickiness.lb_cookie.duration_seconds") ?? "86400"),
      deregistrationDelaySeconds: Number(m.get("deregistration_delay.timeout_seconds") ?? "300"),
      loadBalancingAlgorithm: m.get("load_balancing.algorithm.type") ?? "round_robin",
    };
  },

  modifyTargetGroupAttributes: async (
    targetGroupArn: string,
    attrs: TargetGroupAttributes,
  ): Promise<void> => {
    await getElbv2Client().send(
      new ModifyTargetGroupAttributesCommand({
        TargetGroupArn: targetGroupArn,
        Attributes: [
          { Key: "stickiness.enabled", Value: String(attrs.stickinessEnabled) },
          { Key: "stickiness.type", Value: attrs.stickinessType },
          {
            Key: "stickiness.lb_cookie.duration_seconds",
            Value: String(attrs.stickinessDurationSeconds),
          },
          {
            Key: "deregistration_delay.timeout_seconds",
            Value: String(attrs.deregistrationDelaySeconds),
          },
          { Key: "load_balancing.algorithm.type", Value: attrs.loadBalancingAlgorithm },
        ],
      }),
    );
  },

  getTargetHealth: async (targetGroupArn: string): Promise<TargetHealthEntry[]> => {
    const out = await getElbv2Client().send(
      new DescribeTargetHealthCommand({ TargetGroupArn: targetGroupArn }),
    );
    return (out.TargetHealthDescriptions ?? []).map((d) => ({
      id: d.Target?.Id ?? "",
      port: d.Target?.Port ?? null,
      state: d.TargetHealth?.State ?? null,
      reason: d.TargetHealth?.Reason ?? null,
      description: d.TargetHealth?.Description ?? null,
    }));
  },

  createTargetGroup: async (input: CreateTargetGroupInput): Promise<void> => {
    await getElbv2Client().send(
      new CreateTargetGroupCommand({
        Name: input.name,
        Protocol: input.protocol as CreateTargetGroupCommandInput["Protocol"],
        Port: input.port,
        TargetType: input.targetType as CreateTargetGroupCommandInput["TargetType"],
        ...(input.vpcId ? { VpcId: input.vpcId } : {}),
        ...(input.healthCheckPath ? { HealthCheckPath: input.healthCheckPath } : {}),
      }),
    );
  },

  deleteTargetGroup: async (targetGroupArn: string): Promise<void> => {
    await getElbv2Client().send(new DeleteTargetGroupCommand({ TargetGroupArn: targetGroupArn }));
  },

  registerTarget: async (
    targetGroupArn: string,
    id: string,
    port: number | null,
  ): Promise<void> => {
    await getElbv2Client().send(
      new RegisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: [{ Id: id, ...(port != null ? { Port: port } : {}) }],
      }),
    );
  },

  deregisterTarget: async (
    targetGroupArn: string,
    id: string,
    port: number | null,
  ): Promise<void> => {
    await getElbv2Client().send(
      new DeregisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: [{ Id: id, ...(port != null ? { Port: port } : {}) }],
      }),
    );
  },

  createLoadBalancer: async (input: CreateAlbInput): Promise<void> => {
    await getElbv2Client().send(
      new CreateLoadBalancerCommand({
        Name: input.name,
        Scheme: input.scheme as CreateLoadBalancerCommandInput["Scheme"],
        Type: input.type as CreateLoadBalancerCommandInput["Type"],
        Subnets: input.subnetIds,
        ...(input.securityGroupIds.length ? { SecurityGroups: input.securityGroupIds } : {}),
      }),
    );
  },

  deleteLoadBalancer: async (loadBalancerArn: string): Promise<void> => {
    await getElbv2Client().send(
      new DeleteLoadBalancerCommand({ LoadBalancerArn: loadBalancerArn }),
    );
  },

  createListener: async (input: CreateListenerInput): Promise<void> => {
    const defaultAction: NonNullable<CreateListenerCommandInput["DefaultActions"]>[number] =
      input.action.type === "forward"
        ? { Type: "forward", TargetGroupArn: input.action.targetGroupArn }
        : {
            Type: "fixed-response",
            FixedResponseConfig: {
              StatusCode: input.action.statusCode,
              ContentType: input.action.contentType || "text/plain",
              MessageBody: input.action.body,
            },
          };
    await getElbv2Client().send(
      new CreateListenerCommand({
        LoadBalancerArn: input.loadBalancerArn,
        Protocol: input.protocol as CreateListenerCommandInput["Protocol"],
        Port: input.port,
        DefaultActions: [defaultAction],
      }),
    );
  },

  deleteListener: async (listenerArn: string): Promise<void> => {
    await getElbv2Client().send(new DeleteListenerCommand({ ListenerArn: listenerArn }));
  },

  createRule: async (input: CreateRuleInput): Promise<void> => {
    const values = input.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const targets = input.targets.filter((tg) => tg.targetGroupArn);
    // A single target is a plain forward; multiple targets become a weighted forward.
    const action: Action =
      targets.length === 1
        ? { Type: "forward", TargetGroupArn: targets[0]?.targetGroupArn }
        : {
            Type: "forward",
            ForwardConfig: {
              TargetGroups: targets.map((tg) => ({
                TargetGroupArn: tg.targetGroupArn,
                Weight: tg.weight,
              })),
            },
          };
    await getElbv2Client().send(
      new CreateRuleCommand({
        ListenerArn: input.listenerArn,
        Priority: input.priority,
        Conditions: [
          input.conditionField === "path-pattern"
            ? { Field: "path-pattern", PathPatternConfig: { Values: values } }
            : { Field: "host-header", HostHeaderConfig: { Values: values } },
        ],
        Actions: [action],
      }),
    );
  },

  deleteRule: async (ruleArn: string): Promise<void> => {
    await getElbv2Client().send(new DeleteRuleCommand({ RuleArn: ruleArn }));
  },

  getLoadBalancerAttributes: async (loadBalancerArn: string): Promise<AlbAttributes> => {
    const out = await getElbv2Client().send(
      new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: loadBalancerArn }),
    );
    const m = new Map((out.Attributes ?? []).map((a) => [a.Key ?? "", a.Value ?? ""]));
    return {
      idleTimeoutSeconds: Number(m.get("idle_timeout.timeout_seconds") ?? "60"),
      deletionProtection: m.get("deletion_protection.enabled") === "true",
      http2Enabled: m.get("routing.http2.enabled") !== "false",
    };
  },

  modifyLoadBalancerAttributes: async (
    loadBalancerArn: string,
    attrs: AlbAttributes,
  ): Promise<void> => {
    await getElbv2Client().send(
      new ModifyLoadBalancerAttributesCommand({
        LoadBalancerArn: loadBalancerArn,
        Attributes: [
          { Key: "idle_timeout.timeout_seconds", Value: String(attrs.idleTimeoutSeconds) },
          { Key: "deletion_protection.enabled", Value: String(attrs.deletionProtection) },
          { Key: "routing.http2.enabled", Value: String(attrs.http2Enabled) },
        ],
      }),
    );
  },

  /** Tags for any ELBv2 resource (load balancer, target group, listener, rule). */
  getTags: async (resourceArn: string): Promise<Tag[]> => {
    const out = await getElbv2Client().send(
      new DescribeTagsCommand({ ResourceArns: [resourceArn] }),
    );
    return (out.TagDescriptions?.[0]?.Tags ?? []).map((tg) => ({
      key: tg.Key ?? "",
      value: tg.Value ?? "",
    }));
  },

  saveTags: async (resourceArn: string, tags: Tag[], removedKeys: string[]): Promise<void> => {
    const client = getElbv2Client();
    if (removedKeys.length > 0) {
      await client.send(
        new RemoveTagsCommand({ ResourceArns: [resourceArn], TagKeys: removedKeys }),
      );
    }
    const upserts = tags.filter((tg) => tg.key.trim() !== "");
    if (upserts.length > 0) {
      await client.send(
        new AddTagsCommand({
          ResourceArns: [resourceArn],
          Tags: upserts.map((tg) => ({ Key: tg.key, Value: tg.value })),
        }),
      );
    }
  },
};

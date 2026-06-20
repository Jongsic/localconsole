import {
  type Action,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeRulesCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  type RuleCondition,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { getElbv2Client } from "./elbv2-client";
import type {
  AlbListenerDetail,
  AlbRuleSummary,
  AlbSummary,
  TargetGroupSummary,
  TargetHealthEntry,
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
      loadBalancerArns: tg.LoadBalancerArns ?? [],
    }));
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
};

import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an ELBv2 client from settings. An empty endpoint uses the real AWS default. */
export function elbv2ClientFromSettings(s: ConnectionSettings): ElasticLoadBalancingV2Client {
  return new ElasticLoadBalancingV2Client({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: ElasticLoadBalancingV2Client } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getElbv2Client(): ElasticLoadBalancingV2Client {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = elbv2ClientFromSettings(s);
  cached = { key, client };
  return client;
}

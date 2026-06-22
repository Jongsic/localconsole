import { ElastiCacheClient } from "@aws-sdk/client-elasticache";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an ElastiCache client from settings. An empty endpoint uses the real AWS default. */
export function elastiCacheClientFromSettings(s: ConnectionSettings): ElastiCacheClient {
  return new ElastiCacheClient({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: ElastiCacheClient } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getElastiCacheClient(): ElastiCacheClient {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = elastiCacheClientFromSettings(s);
  cached = { key, client };
  return client;
}

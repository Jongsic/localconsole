import { RDSClient } from "@aws-sdk/client-rds";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an RDS client from settings. An empty endpoint uses the real AWS default. */
export function rdsClientFromSettings(s: ConnectionSettings): RDSClient {
  return new RDSClient({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: RDSClient } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getRdsClient(): RDSClient {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = rdsClientFromSettings(s);
  cached = { key, client };
  return client;
}

import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an Auto Scaling client from settings. An empty endpoint uses the real AWS default. */
export function autoScalingClientFromSettings(s: ConnectionSettings): AutoScalingClient {
  return new AutoScalingClient({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: AutoScalingClient } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getAutoScalingClient(): AutoScalingClient {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = autoScalingClientFromSettings(s);
  cached = { key, client };
  return client;
}

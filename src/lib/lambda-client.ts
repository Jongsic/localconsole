import { LambdaClient } from "@aws-sdk/client-lambda";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build a Lambda client from settings. An empty endpoint uses the real AWS default. */
export function lambdaClientFromSettings(s: ConnectionSettings): LambdaClient {
  return new LambdaClient({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: LambdaClient } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getLambdaClient(): LambdaClient {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = lambdaClientFromSettings(s);
  cached = { key, client };
  return client;
}

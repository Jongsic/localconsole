import { IAMClient } from "@aws-sdk/client-iam";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/**
 * Build an IAM client from settings. IAM is a global service, but we reuse the
 * configured endpoint/region/credentials anyway so it works against LocalStack /
 * Floci / moto exactly like the EC2 client. An empty endpoint uses real AWS.
 */
export function iamClientFromSettings(s: ConnectionSettings): IAMClient {
  return new IAMClient({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: IAMClient } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getIamClient(): IAMClient {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = iamClientFromSettings(s);
  cached = { key, client };
  return client;
}

import { EC2Client } from "@aws-sdk/client-ec2";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an EC2 client from settings. An empty endpoint uses the real AWS default. */
export function ec2ClientFromSettings(s: ConnectionSettings): EC2Client {
  return new EC2Client({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
  });
}

let cached: { key: string; client: EC2Client } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getEc2Client(): EC2Client {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = ec2ClientFromSettings(s);
  cached = { key, client };
  return client;
}

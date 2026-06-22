import {
  DeleteBucketLifecycleCommand,
  GetBucketCorsCommand,
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketPolicyCommand,
  GetBucketTaggingCommand,
  GetBucketVersioningCommand,
  GetBucketWebsiteCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./s3-api";

// mockClient intercepts the SDK at the client layer, so it works regardless of
// the module-level client cache in s3-client.ts. These tests exercise the
// lifecycle response→our-type mapping (and command-input shape) entirely offline.
const s3 = mockClient(S3Client);

// Reject the other property reads so getProperties' safe(...) wrappers fall back
// to defaults; we only assert on lifecycle here.
beforeEach(() => {
  s3.reset();
  s3.on(GetBucketVersioningCommand).rejects(new Error("nope"));
  s3.on(GetBucketTaggingCommand).rejects(new Error("nope"));
  s3.on(GetBucketEncryptionCommand).rejects(new Error("nope"));
  s3.on(GetBucketCorsCommand).rejects(new Error("nope"));
  s3.on(GetBucketPolicyCommand).rejects(new Error("nope"));
  s3.on(GetBucketWebsiteCommand).rejects(new Error("nope"));
});

describe("getProperties lifecycle mapping", () => {
  it("maps Rules into pretty JSON", async () => {
    const rules = [
      {
        ID: "expire-temp",
        Filter: { Prefix: "temp/" },
        Status: "Enabled" as const,
        Expiration: { Days: 1 },
      },
    ];
    s3.on(GetBucketLifecycleConfigurationCommand).resolves({ Rules: rules });

    const props = await api.getProperties("my-bucket");
    expect(props.lifecycle.json).toBe(JSON.stringify(rules, null, 2));
    // round-trips back to the same Rules
    expect(JSON.parse(props.lifecycle.json as string)).toEqual(rules);
  });

  it("returns null when there are no rules", async () => {
    s3.on(GetBucketLifecycleConfigurationCommand).resolves({ Rules: [] });
    const props = await api.getProperties("my-bucket");
    expect(props.lifecycle.json).toBeNull();
  });

  it("safe(...) swallows a rejected lifecycle call and returns null", async () => {
    s3.on(GetBucketLifecycleConfigurationCommand).rejects(
      new Error("NoSuchLifecycleConfiguration"),
    );
    const props = await api.getProperties("my-bucket");
    expect(props.lifecycle.json).toBeNull();
  });
});

describe("updateProperty lifecycle", () => {
  it("Puts parsed Rules from a bare JSON array", async () => {
    s3.on(PutBucketLifecycleConfigurationCommand).resolves({});
    const rules = [{ ID: "abort-mpu", Filter: { Prefix: "" }, Status: "Enabled" as const }];
    await api.updateProperty("my-bucket", {
      section: "lifecycle",
      value: { json: JSON.stringify(rules) },
    });

    const calls = s3.commandCalls(PutBucketLifecycleConfigurationCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toEqual({
      Bucket: "my-bucket",
      LifecycleConfiguration: { Rules: rules },
    });
  });

  it("accepts a { Rules: [...] } wrapper", async () => {
    s3.on(PutBucketLifecycleConfigurationCommand).resolves({});
    const rules = [{ ID: "r1", Filter: { Prefix: "" }, Status: "Enabled" as const }];
    await api.updateProperty("my-bucket", {
      section: "lifecycle",
      value: { json: JSON.stringify({ Rules: rules }) },
    });

    const calls = s3.commandCalls(PutBucketLifecycleConfigurationCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.LifecycleConfiguration?.Rules).toEqual(rules);
  });

  it("Deletes lifecycle when the JSON is blank", async () => {
    s3.on(DeleteBucketLifecycleCommand).resolves({});
    await api.updateProperty("my-bucket", {
      section: "lifecycle",
      value: { json: "   " },
    });

    const del = s3.commandCalls(DeleteBucketLifecycleCommand);
    expect(del).toHaveLength(1);
    expect(del[0]?.args[0].input).toEqual({ Bucket: "my-bucket" });
    expect(s3.commandCalls(PutBucketLifecycleConfigurationCommand)).toHaveLength(0);
  });
});

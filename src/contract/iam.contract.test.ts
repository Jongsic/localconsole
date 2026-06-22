// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/iam-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

// Loose shapes: assert keys/types we map to, never values. Backends differ in
// which fields they populate — nullable/optional reflects that.
const role = z.object({
  roleName: z.string(),
  arn: z.string(),
  path: z.string(),
  createDate: z.string().nullable(),
  description: z.string().nullable(),
  assumeRolePolicyDocument: z.string().nullable(),
});
const instanceProfile = z.object({
  instanceProfileName: z.string(),
  arn: z.string(),
  path: z.string(),
  roleNames: z.array(z.string()),
});
const policy = z.object({
  policyName: z.string(),
  arn: z.string(),
  path: z.string(),
  attachmentCount: z.number(),
  isAwsManaged: z.boolean(),
  createDate: z.string().nullable(),
});

contractDescribe("IAM api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listRoles", () => assertContract(api.listRoles, z.array(role)));
  it("listInstanceProfiles", () =>
    assertContract(api.listInstanceProfiles, z.array(instanceProfile)));
  it("listPolicies", () => assertContract(() => api.listPolicies("Local"), z.array(policy)));
});

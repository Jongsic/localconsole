// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/lambda-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

// Loose shapes: assert keys/types we map to, never values.
const fn = z.object({
  functionName: z.string(),
  runtime: z.string().nullable(),
  handler: z.string().nullable(),
  memorySize: z.number().nullable(),
  timeout: z.number().nullable(),
  codeSize: z.number().nullable(),
  lastModified: z.string().nullable(),
  architectures: z.array(z.string()),
  packageType: z.string().nullable(),
});
const layer = z.object({
  layerName: z.string(),
  latestVersion: z.number().nullable(),
  latestVersionArn: z.string().nullable(),
  compatibleRuntimes: z.array(z.string()),
  createdDate: z.string().nullable(),
});

contractDescribe("Lambda api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listFunctions", () => assertContract(api.listFunctions, z.array(fn)));
  it("listLayers", () => assertContract(api.listLayers, z.array(layer)));
});

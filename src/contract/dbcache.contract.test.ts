// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api as elasticacheApi } from "@/lib/elasticache-api";
import { api as rdsApi } from "@/lib/rds-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

// Loose shapes: assert keys/types we map to, never values. Backends differ in
// which fields they populate — nullable/optional reflects that.
const dbCluster = z.object({
  dbClusterIdentifier: z.string(),
  engine: z.string().nullable(),
  engineVersion: z.string().nullable(),
  status: z.string().nullable(),
  endpoint: z.string().nullable(),
  multiAZ: z.boolean(),
});
const dbInstance = z.object({
  dbInstanceIdentifier: z.string(),
  engine: z.string().nullable(),
  dbInstanceClass: z.string().nullable(),
  status: z.string().nullable(),
  endpoint: z.string().nullable(),
  allocatedStorage: z.number().nullable(),
  multiAZ: z.boolean(),
  availabilityZone: z.string().nullable(),
});
const cacheCluster = z.object({
  cacheClusterId: z.string(),
  engine: z.string().nullable(),
  engineVersion: z.string().nullable(),
  status: z.string().nullable(),
  nodeType: z.string().nullable(),
  numCacheNodes: z.number().nullable(),
  endpoint: z.string().nullable(),
});
const cacheNode = z.object({
  cacheClusterId: z.string(),
  cacheNodeId: z.string(),
  status: z.string().nullable(),
  address: z.string().nullable(),
  port: z.number().nullable(),
  availabilityZone: z.string().nullable(),
});

contractDescribe("DB/Cache api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listDbClusters", () => assertContract(rdsApi.listDbClusters, z.array(dbCluster)));
  it("listDbInstances", () => assertContract(rdsApi.listDbInstances, z.array(dbInstance)));
  it("listCacheClusters", () =>
    assertContract(elasticacheApi.listCacheClusters, z.array(cacheCluster)));
  it("listCacheNodes", () => assertContract(elasticacheApi.listCacheNodes, z.array(cacheNode)));
});

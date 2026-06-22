// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/vpc-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

// Loose shapes: assert keys/types we map to, never values. Backends differ in
// which fields they populate — nullable/optional reflects that.
const tags = z.array(z.object({ key: z.string(), value: z.string() }));
const vpc = z.object({
  vpcId: z.string(),
  cidrBlock: z.string().nullable(),
  state: z.string().nullable(),
  isDefault: z.boolean(),
  name: z.string().nullable(),
  tags,
});
const subnet = z.object({
  subnetId: z.string(),
  vpcId: z.string().nullable(),
  cidrBlock: z.string().nullable(),
  availabilityZone: z.string().nullable(),
  availableIpCount: z.number().nullable(),
  state: z.string().nullable(),
  name: z.string().nullable(),
  tags,
});
const routeTable = z.object({
  routeTableId: z.string(),
  vpcId: z.string().nullable(),
  main: z.boolean(),
  associationCount: z.number(),
  routes: z.array(
    z.object({
      destination: z.string(),
      target: z.string(),
      state: z.string().nullable(),
    }),
  ),
  name: z.string().nullable(),
  tags,
});
const internetGateway = z.object({
  internetGatewayId: z.string(),
  attachments: z.array(z.object({ vpcId: z.string(), state: z.string().nullable() })),
  name: z.string().nullable(),
  tags,
});
const natGateway = z.object({
  natGatewayId: z.string(),
  subnetId: z.string().nullable(),
  vpcId: z.string().nullable(),
  state: z.string().nullable(),
  type: z.string().nullable(),
  publicIp: z.string().nullable(),
  name: z.string().nullable(),
  tags,
});
const elasticIp = z.object({
  allocationId: z.string(),
  publicIp: z.string().nullable(),
  domain: z.string().nullable(),
  association: z
    .object({
      instanceId: z.string().nullable(),
      networkInterfaceId: z.string().nullable(),
    })
    .nullable(),
  name: z.string().nullable(),
  tags,
});

contractDescribe("VPC api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listVpcs", () => assertContract(api.listVpcs, z.array(vpc)));
  it("listSubnets", () => assertContract(api.listSubnets, z.array(subnet)));
  it("listRouteTables", () => assertContract(api.listRouteTables, z.array(routeTable)));
  it("listInternetGateways", () =>
    assertContract(api.listInternetGateways, z.array(internetGateway)));
  it("listNatGateways", () => assertContract(api.listNatGateways, z.array(natGateway)));
  it("listAddresses", () => assertContract(api.listAddresses, z.array(elasticIp)));
});

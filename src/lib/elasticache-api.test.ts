import {
  AddTagsToResourceCommand,
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DeleteCacheClusterCommand,
  DescribeCacheClustersCommand,
  ElastiCacheClient,
  ListTagsForResourceCommand,
  RemoveTagsFromResourceCommand,
} from "@aws-sdk/client-elasticache";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./elasticache-api";

const ec = mockClient(ElastiCacheClient);

beforeEach(() => ec.reset());

describe("listCacheClusters mapping", () => {
  it("maps fields + node count + endpoint + arn + attributes", async () => {
    ec.on(DescribeCacheClustersCommand).resolves({
      CacheClusters: [
        {
          CacheClusterId: "cache-1",
          Engine: "redis",
          EngineVersion: "7.1",
          CacheClusterStatus: "available",
          CacheNodeType: "cache.t3.micro",
          NumCacheNodes: 1,
          ConfigurationEndpoint: { Address: "cache-1.example.com", Port: 6379 },
          ARN: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
          CacheParameterGroup: { CacheParameterGroupName: "default.redis7" },
          CacheSubnetGroupName: "default",
          SecurityGroups: [{ SecurityGroupId: "sg-123" }],
          PreferredMaintenanceWindow: "sun:05:00-sun:06:00",
          SnapshotRetentionLimit: 3,
          SnapshotWindow: "03:00-04:00",
          PreferredAvailabilityZone: "us-east-1a",
          CacheClusterCreateTime: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });
    const r = await api.listCacheClusters();
    expect(r[0]).toEqual({
      cacheClusterId: "cache-1",
      engine: "redis",
      engineVersion: "7.1",
      status: "available",
      nodeType: "cache.t3.micro",
      numCacheNodes: 1,
      endpoint: "cache-1.example.com",
      port: 6379,
      arn: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
      parameterGroup: "default.redis7",
      subnetGroup: "default",
      securityGroups: ["sg-123"],
      preferredMaintenanceWindow: "sun:05:00-sun:06:00",
      snapshotRetentionLimit: 3,
      snapshotWindow: "03:00-04:00",
      availabilityZone: "us-east-1a",
      createdTime: "2026-01-01T00:00:00.000Z",
    });
  });

  it("requests node info and returns [] on empty response", async () => {
    ec.on(DescribeCacheClustersCommand).resolves({});
    await expect(api.listCacheClusters()).resolves.toEqual([]);
    expect(ec.commandCalls(DescribeCacheClustersCommand)[0]?.args[0].input).toEqual({
      ShowCacheNodeInfo: true,
    });
  });
});

describe("listCacheNodes mapping", () => {
  it("flattens nodes across clusters", async () => {
    ec.on(DescribeCacheClustersCommand).resolves({
      CacheClusters: [
        {
          CacheClusterId: "cache-1",
          CacheNodes: [
            {
              CacheNodeId: "0001",
              CacheNodeStatus: "available",
              Endpoint: { Address: "node-1.example.com", Port: 6379 },
              CustomerAvailabilityZone: "us-east-1a",
            },
            {
              CacheNodeId: "0002",
              CacheNodeStatus: "creating",
              Endpoint: { Address: "node-2.example.com", Port: 6379 },
              CustomerAvailabilityZone: "us-east-1b",
            },
          ],
        },
      ],
    });
    const r = await api.listCacheNodes();
    expect(r).toEqual([
      {
        cacheClusterId: "cache-1",
        cacheNodeId: "0001",
        status: "available",
        address: "node-1.example.com",
        port: 6379,
        availabilityZone: "us-east-1a",
      },
      {
        cacheClusterId: "cache-1",
        cacheNodeId: "0002",
        status: "creating",
        address: "node-2.example.com",
        port: 6379,
        availabilityZone: "us-east-1b",
      },
    ]);
  });

  it("requests node info and returns [] on empty response", async () => {
    ec.on(DescribeCacheClustersCommand).resolves({});
    await expect(api.listCacheNodes()).resolves.toEqual([]);
    expect(ec.commandCalls(DescribeCacheClustersCommand)[0]?.args[0].input).toEqual({
      ShowCacheNodeInfo: true,
    });
  });
});

describe("write/command shapes", () => {
  it("createCacheCluster → CreateCacheCluster for memcached", async () => {
    ec.on(CreateCacheClusterCommand).resolves({});
    await api.createCacheCluster({
      cacheClusterId: "cache-1",
      engine: "memcached",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 2,
    });
    expect(ec.commandCalls(CreateCacheClusterCommand)[0]?.args[0].input).toEqual({
      CacheClusterId: "cache-1",
      Engine: "memcached",
      CacheNodeType: "cache.t3.micro",
      NumCacheNodes: 2,
    });
    expect(ec.commandCalls(CreateReplicationGroupCommand)).toHaveLength(0);
  });

  it("createCacheCluster → CreateReplicationGroup for redis", async () => {
    ec.on(CreateReplicationGroupCommand).resolves({});
    await api.createCacheCluster({
      cacheClusterId: "cache-redis",
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
    });
    expect(ec.commandCalls(CreateReplicationGroupCommand)[0]?.args[0].input).toEqual({
      ReplicationGroupId: "cache-redis",
      ReplicationGroupDescription: "cache-redis",
      Engine: "redis",
      CacheNodeType: "cache.t3.micro",
      NumCacheClusters: 1,
    });
    expect(ec.commandCalls(CreateCacheClusterCommand)).toHaveLength(0);
  });

  it("createCacheCluster → CreateReplicationGroup for valkey", async () => {
    ec.on(CreateReplicationGroupCommand).resolves({});
    await api.createCacheCluster({
      cacheClusterId: "cache-valkey",
      engine: "valkey",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 3,
    });
    expect(ec.commandCalls(CreateReplicationGroupCommand)[0]?.args[0].input).toEqual({
      ReplicationGroupId: "cache-valkey",
      ReplicationGroupDescription: "cache-valkey",
      Engine: "valkey",
      CacheNodeType: "cache.t3.micro",
      NumCacheClusters: 3,
    });
    expect(ec.commandCalls(CreateCacheClusterCommand)).toHaveLength(0);
  });

  it("deleteCacheCluster sends the id", async () => {
    ec.on(DeleteCacheClusterCommand).resolves({});
    await api.deleteCacheCluster("cache-1");
    expect(ec.commandCalls(DeleteCacheClusterCommand)[0]?.args[0].input).toEqual({
      CacheClusterId: "cache-1",
    });
  });
});

describe("tags", () => {
  it("getTags maps ListTagsForResource by ARN", async () => {
    ec.on(ListTagsForResourceCommand).resolves({
      TagList: [{ Key: "env", Value: "prod" }],
    });
    const r = await api.getTags("arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1");
    expect(ec.commandCalls(ListTagsForResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
    });
    expect(r).toEqual([{ key: "env", value: "prod" }]);
  });

  it("saveTags removes dropped keys then upserts the rest", async () => {
    ec.on(RemoveTagsFromResourceCommand).resolves({});
    ec.on(AddTagsToResourceCommand).resolves({});
    await api.saveTags(
      "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
      [{ key: "env", value: "prod" }],
      ["old"],
    );
    expect(ec.commandCalls(RemoveTagsFromResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
      TagKeys: ["old"],
    });
    expect(ec.commandCalls(AddTagsToResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
      Tags: [{ Key: "env", Value: "prod" }],
    });
  });
});

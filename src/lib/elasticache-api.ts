import {
  AddTagsToResourceCommand,
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DeleteCacheClusterCommand,
  DescribeCacheClustersCommand,
  ListTagsForResourceCommand,
  RemoveTagsFromResourceCommand,
} from "@aws-sdk/client-elasticache";
import { getElastiCacheClient } from "./elasticache-client";
import type { CacheClusterSummary, CacheNodeSummary, CreateCacheClusterInput, Tag } from "./types";

export const api = {
  listCacheClusters: async (): Promise<CacheClusterSummary[]> => {
    const out = await getElastiCacheClient().send(
      new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true }),
    );
    return (out.CacheClusters ?? []).map((c) => ({
      cacheClusterId: c.CacheClusterId ?? "",
      engine: c.Engine ?? null,
      engineVersion: c.EngineVersion ?? null,
      status: c.CacheClusterStatus ?? null,
      nodeType: c.CacheNodeType ?? null,
      numCacheNodes: c.NumCacheNodes ?? null,
      endpoint: c.ConfigurationEndpoint?.Address ?? c.CacheNodes?.[0]?.Endpoint?.Address ?? null,
      port: c.ConfigurationEndpoint?.Port ?? c.CacheNodes?.[0]?.Endpoint?.Port ?? null,
      arn: c.ARN ?? null,
      parameterGroup: c.CacheParameterGroup?.CacheParameterGroupName ?? null,
      subnetGroup: c.CacheSubnetGroupName ?? null,
      securityGroups: (c.SecurityGroups ?? []).map((s) => s.SecurityGroupId ?? "").filter(Boolean),
      preferredMaintenanceWindow: c.PreferredMaintenanceWindow ?? null,
      snapshotRetentionLimit: c.SnapshotRetentionLimit ?? null,
      snapshotWindow: c.SnapshotWindow ?? null,
      availabilityZone: c.PreferredAvailabilityZone ?? null,
      createdTime: c.CacheClusterCreateTime?.toISOString() ?? null,
    }));
  },

  /**
   * Create a cache. ElastiCache splits this by engine: Memcached uses the plain
   * CreateCacheCluster API, while Redis/Valkey must go through a replication group
   * (CreateCacheCluster rejects them with "Engine must be 'memcached'").
   */
  createCacheCluster: async (input: CreateCacheClusterInput): Promise<void> => {
    const client = getElastiCacheClient();
    if (input.engine === "redis" || input.engine === "valkey") {
      await client.send(
        new CreateReplicationGroupCommand({
          ReplicationGroupId: input.cacheClusterId,
          ReplicationGroupDescription: input.cacheClusterId,
          Engine: input.engine,
          CacheNodeType: input.cacheNodeType,
          NumCacheClusters: input.numCacheNodes,
        }),
      );
      return;
    }
    await client.send(
      new CreateCacheClusterCommand({
        CacheClusterId: input.cacheClusterId,
        Engine: input.engine,
        CacheNodeType: input.cacheNodeType,
        NumCacheNodes: input.numCacheNodes,
      }),
    );
  },

  deleteCacheCluster: async (cacheClusterId: string): Promise<void> => {
    await getElastiCacheClient().send(
      new DeleteCacheClusterCommand({ CacheClusterId: cacheClusterId }),
    );
  },

  listCacheNodes: async (): Promise<CacheNodeSummary[]> => {
    const out = await getElastiCacheClient().send(
      new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true }),
    );
    return (out.CacheClusters ?? []).flatMap((c) =>
      (c.CacheNodes ?? []).map((n) => ({
        cacheClusterId: c.CacheClusterId ?? "",
        cacheNodeId: n.CacheNodeId ?? "",
        status: n.CacheNodeStatus ?? null,
        address: n.Endpoint?.Address ?? null,
        port: n.Endpoint?.Port ?? null,
        availabilityZone: n.CustomerAvailabilityZone ?? null,
      })),
    );
  },

  /** Read the tag set for a cache resource by ARN (ListTagsForResource). */
  getTags: async (arn: string): Promise<Tag[]> => {
    const out = await getElastiCacheClient().send(
      new ListTagsForResourceCommand({ ResourceName: arn }),
    );
    return (out.TagList ?? []).map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" }));
  },

  /** Apply a desired tag set: remove the dropped keys, then upsert the rest. */
  saveTags: async (arn: string, tags: Tag[], removedKeys: string[]): Promise<void> => {
    const client = getElastiCacheClient();
    if (removedKeys.length > 0) {
      await client.send(
        new RemoveTagsFromResourceCommand({ ResourceName: arn, TagKeys: removedKeys }),
      );
    }
    const upserts = tags.filter((t) => t.key.trim() !== "");
    if (upserts.length > 0) {
      await client.send(
        new AddTagsToResourceCommand({
          ResourceName: arn,
          Tags: upserts.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      );
    }
  },
};

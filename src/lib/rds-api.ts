import {
  AddTagsToResourceCommand,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  DeleteDBClusterCommand,
  DeleteDBInstanceCommand,
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand,
  RemoveTagsFromResourceCommand,
} from "@aws-sdk/client-rds";
import { getRdsClient } from "./rds-client";
import type {
  CreateDbClusterInput,
  CreateDbInstanceInput,
  DbClusterSummary,
  DbInstanceSummary,
  Tag,
} from "./types";

export const api = {
  listDbClusters: async (): Promise<DbClusterSummary[]> => {
    const out = await getRdsClient().send(new DescribeDBClustersCommand({}));
    return (out.DBClusters ?? []).map((c) => ({
      dbClusterIdentifier: c.DBClusterIdentifier ?? "",
      engine: c.Engine ?? null,
      engineVersion: c.EngineVersion ?? null,
      status: c.Status ?? null,
      endpoint: c.Endpoint ?? null,
      multiAZ: c.MultiAZ ?? false,
      arn: c.DBClusterArn ?? null,
      readerEndpoint: c.ReaderEndpoint ?? null,
      port: c.Port ?? null,
      availabilityZones: c.AvailabilityZones ?? [],
      storageEncrypted: c.StorageEncrypted ?? false,
      parameterGroup: c.DBClusterParameterGroup ?? null,
      backupRetentionPeriod: c.BackupRetentionPeriod ?? null,
      preferredBackupWindow: c.PreferredBackupWindow ?? null,
      preferredMaintenanceWindow: c.PreferredMaintenanceWindow ?? null,
      createdTime: c.ClusterCreateTime?.toISOString() ?? null,
      members: (c.DBClusterMembers ?? []).map((m) => ({
        dbInstanceIdentifier: m.DBInstanceIdentifier ?? "",
        isWriter: m.IsClusterWriter ?? false,
      })),
    }));
  },

  createDbCluster: async (input: CreateDbClusterInput): Promise<void> => {
    await getRdsClient().send(
      new CreateDBClusterCommand({
        DBClusterIdentifier: input.dbClusterIdentifier,
        Engine: input.engine,
        ...(input.engineVersion ? { EngineVersion: input.engineVersion } : {}),
        MasterUsername: input.masterUsername,
        MasterUserPassword: input.masterUserPassword,
      }),
    );
  },

  deleteDbCluster: async (dbClusterIdentifier: string): Promise<void> => {
    await getRdsClient().send(
      new DeleteDBClusterCommand({
        DBClusterIdentifier: dbClusterIdentifier,
        SkipFinalSnapshot: true,
      }),
    );
  },

  listDbInstances: async (): Promise<DbInstanceSummary[]> => {
    const out = await getRdsClient().send(new DescribeDBInstancesCommand({}));
    return (out.DBInstances ?? []).map((i) => ({
      dbInstanceIdentifier: i.DBInstanceIdentifier ?? "",
      engine: i.Engine ?? null,
      engineVersion: i.EngineVersion ?? null,
      dbInstanceClass: i.DBInstanceClass ?? null,
      status: i.DBInstanceStatus ?? null,
      endpoint: i.Endpoint?.Address ?? null,
      port: i.Endpoint?.Port ?? null,
      allocatedStorage: i.AllocatedStorage ?? null,
      storageType: i.StorageType ?? null,
      storageEncrypted: i.StorageEncrypted ?? false,
      multiAZ: i.MultiAZ ?? false,
      availabilityZone: i.AvailabilityZone ?? null,
      publiclyAccessible: i.PubliclyAccessible ?? false,
      parameterGroup: i.DBParameterGroups?.[0]?.DBParameterGroupName ?? null,
      backupRetentionPeriod: i.BackupRetentionPeriod ?? null,
      preferredBackupWindow: i.PreferredBackupWindow ?? null,
      preferredMaintenanceWindow: i.PreferredMaintenanceWindow ?? null,
      createdTime: i.InstanceCreateTime?.toISOString() ?? null,
      arn: i.DBInstanceArn ?? null,
    }));
  },

  createDbInstance: async (input: CreateDbInstanceInput): Promise<void> => {
    await getRdsClient().send(
      new CreateDBInstanceCommand({
        DBInstanceIdentifier: input.dbInstanceIdentifier,
        Engine: input.engine,
        DBInstanceClass: input.dbInstanceClass,
        AllocatedStorage: input.allocatedStorage,
        MasterUsername: input.masterUsername,
        MasterUserPassword: input.masterUserPassword,
      }),
    );
  },

  deleteDbInstance: async (dbInstanceIdentifier: string): Promise<void> => {
    await getRdsClient().send(
      new DeleteDBInstanceCommand({
        DBInstanceIdentifier: dbInstanceIdentifier,
        SkipFinalSnapshot: true,
      }),
    );
  },

  /** Read the tag set for a DB cluster/instance by ARN (ListTagsForResource). */
  getTags: async (arn: string): Promise<Tag[]> => {
    const out = await getRdsClient().send(new ListTagsForResourceCommand({ ResourceName: arn }));
    return (out.TagList ?? []).map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" }));
  },

  /** Apply a desired tag set: remove the dropped keys, then upsert the rest. */
  saveTags: async (arn: string, tags: Tag[], removedKeys: string[]): Promise<void> => {
    const rds = getRdsClient();
    if (removedKeys.length > 0) {
      await rds.send(
        new RemoveTagsFromResourceCommand({ ResourceName: arn, TagKeys: removedKeys }),
      );
    }
    const upserts = tags.filter((t) => t.key.trim() !== "");
    if (upserts.length > 0) {
      await rds.send(
        new AddTagsToResourceCommand({
          ResourceName: arn,
          Tags: upserts.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      );
    }
  },
};

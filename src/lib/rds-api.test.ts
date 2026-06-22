import {
  AddTagsToResourceCommand,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  DeleteDBClusterCommand,
  DeleteDBInstanceCommand,
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand,
  RDSClient,
  RemoveTagsFromResourceCommand,
} from "@aws-sdk/client-rds";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./rds-api";

const rds = mockClient(RDSClient);

beforeEach(() => rds.reset());

describe("listDbClusters mapping", () => {
  it("maps fields + multiAZ + endpoint + arn + members", async () => {
    rds.on(DescribeDBClustersCommand).resolves({
      DBClusters: [
        {
          DBClusterIdentifier: "db-cluster-1",
          Engine: "aurora-postgresql",
          EngineVersion: "15.4",
          Status: "available",
          Endpoint: "db-cluster-1.cluster.example.com",
          ReaderEndpoint: "db-cluster-1.cluster-ro.example.com",
          Port: 5432,
          MultiAZ: true,
          DBClusterArn: "arn:aws:rds:us-east-1:000000000000:cluster:db-cluster-1",
          AvailabilityZones: ["us-east-1a", "us-east-1b"],
          StorageEncrypted: true,
          DBClusterParameterGroup: "default.aurora-postgresql15",
          BackupRetentionPeriod: 7,
          PreferredBackupWindow: "03:00-04:00",
          PreferredMaintenanceWindow: "sun:05:00-sun:06:00",
          ClusterCreateTime: new Date("2026-01-01T00:00:00Z"),
          DBClusterMembers: [
            { DBInstanceIdentifier: "db-cluster-1-writer", IsClusterWriter: true },
            { DBInstanceIdentifier: "db-cluster-1-reader", IsClusterWriter: false },
          ],
        },
      ],
    });
    const r = await api.listDbClusters();
    expect(r[0]).toEqual({
      dbClusterIdentifier: "db-cluster-1",
      engine: "aurora-postgresql",
      engineVersion: "15.4",
      status: "available",
      endpoint: "db-cluster-1.cluster.example.com",
      readerEndpoint: "db-cluster-1.cluster-ro.example.com",
      port: 5432,
      multiAZ: true,
      arn: "arn:aws:rds:us-east-1:000000000000:cluster:db-cluster-1",
      availabilityZones: ["us-east-1a", "us-east-1b"],
      storageEncrypted: true,
      parameterGroup: "default.aurora-postgresql15",
      backupRetentionPeriod: 7,
      preferredBackupWindow: "03:00-04:00",
      preferredMaintenanceWindow: "sun:05:00-sun:06:00",
      createdTime: "2026-01-01T00:00:00.000Z",
      members: [
        { dbInstanceIdentifier: "db-cluster-1-writer", isWriter: true },
        { dbInstanceIdentifier: "db-cluster-1-reader", isWriter: false },
      ],
    });
  });

  it("returns [] on empty response", async () => {
    rds.on(DescribeDBClustersCommand).resolves({});
    await expect(api.listDbClusters()).resolves.toEqual([]);
  });
});

describe("listDbInstances mapping", () => {
  it("maps fields + endpoint address + storage + az + arn + attributes", async () => {
    rds.on(DescribeDBInstancesCommand).resolves({
      DBInstances: [
        {
          DBInstanceIdentifier: "db-1",
          Engine: "postgres",
          EngineVersion: "15.4",
          DBInstanceClass: "db.t3.micro",
          DBInstanceStatus: "available",
          Endpoint: { Address: "db-1.example.com", Port: 5432 },
          AllocatedStorage: 20,
          StorageType: "gp3",
          StorageEncrypted: true,
          MultiAZ: false,
          AvailabilityZone: "us-east-1a",
          PubliclyAccessible: false,
          DBParameterGroups: [{ DBParameterGroupName: "default.postgres15" }],
          BackupRetentionPeriod: 7,
          PreferredBackupWindow: "03:00-04:00",
          PreferredMaintenanceWindow: "sun:05:00-sun:06:00",
          InstanceCreateTime: new Date("2026-01-01T00:00:00Z"),
          DBInstanceArn: "arn:aws:rds:us-east-1:000000000000:db:db-1",
        },
      ],
    });
    const r = await api.listDbInstances();
    expect(r[0]).toEqual({
      dbInstanceIdentifier: "db-1",
      engine: "postgres",
      engineVersion: "15.4",
      dbInstanceClass: "db.t3.micro",
      status: "available",
      endpoint: "db-1.example.com",
      port: 5432,
      allocatedStorage: 20,
      storageType: "gp3",
      storageEncrypted: true,
      multiAZ: false,
      availabilityZone: "us-east-1a",
      publiclyAccessible: false,
      parameterGroup: "default.postgres15",
      backupRetentionPeriod: 7,
      preferredBackupWindow: "03:00-04:00",
      preferredMaintenanceWindow: "sun:05:00-sun:06:00",
      createdTime: "2026-01-01T00:00:00.000Z",
      arn: "arn:aws:rds:us-east-1:000000000000:db:db-1",
    });
  });

  it("returns [] on empty response", async () => {
    rds.on(DescribeDBInstancesCommand).resolves({});
    await expect(api.listDbInstances()).resolves.toEqual([]);
  });
});

describe("write/command shapes", () => {
  it("createDbInstance maps the input fields", async () => {
    rds.on(CreateDBInstanceCommand).resolves({});
    await api.createDbInstance({
      dbInstanceIdentifier: "db-1",
      engine: "postgres",
      dbInstanceClass: "db.t3.micro",
      allocatedStorage: 20,
      masterUsername: "admin",
      masterUserPassword: "secret123",
    });
    expect(rds.commandCalls(CreateDBInstanceCommand)[0]?.args[0].input).toEqual({
      DBInstanceIdentifier: "db-1",
      Engine: "postgres",
      DBInstanceClass: "db.t3.micro",
      AllocatedStorage: 20,
      MasterUsername: "admin",
      MasterUserPassword: "secret123",
    });
  });

  it("deleteDbInstance sends the id and skips the final snapshot", async () => {
    rds.on(DeleteDBInstanceCommand).resolves({});
    await api.deleteDbInstance("db-1");
    expect(rds.commandCalls(DeleteDBInstanceCommand)[0]?.args[0].input).toEqual({
      DBInstanceIdentifier: "db-1",
      SkipFinalSnapshot: true,
    });
  });

  it("deleteDbCluster sends the id and skips the final snapshot", async () => {
    rds.on(DeleteDBClusterCommand).resolves({});
    await api.deleteDbCluster("db-cluster-1");
    expect(rds.commandCalls(DeleteDBClusterCommand)[0]?.args[0].input).toEqual({
      DBClusterIdentifier: "db-cluster-1",
      SkipFinalSnapshot: true,
    });
  });

  it("createDbCluster maps the input fields (with optional version)", async () => {
    rds.on(CreateDBClusterCommand).resolves({});
    await api.createDbCluster({
      dbClusterIdentifier: "db-cluster-1",
      engine: "aurora-postgresql",
      engineVersion: "15.4",
      masterUsername: "admin",
      masterUserPassword: "secret123",
    });
    expect(rds.commandCalls(CreateDBClusterCommand)[0]?.args[0].input).toEqual({
      DBClusterIdentifier: "db-cluster-1",
      Engine: "aurora-postgresql",
      EngineVersion: "15.4",
      MasterUsername: "admin",
      MasterUserPassword: "secret123",
    });
  });

  it("createDbCluster omits EngineVersion when not provided", async () => {
    rds.on(CreateDBClusterCommand).resolves({});
    await api.createDbCluster({
      dbClusterIdentifier: "db-cluster-2",
      engine: "aurora-mysql",
      masterUsername: "admin",
      masterUserPassword: "secret123",
    });
    expect(rds.commandCalls(CreateDBClusterCommand)[0]?.args[0].input).toEqual({
      DBClusterIdentifier: "db-cluster-2",
      Engine: "aurora-mysql",
      MasterUsername: "admin",
      MasterUserPassword: "secret123",
    });
  });
});

describe("tags", () => {
  it("getTags maps ListTagsForResource by ARN", async () => {
    rds.on(ListTagsForResourceCommand).resolves({
      TagList: [
        { Key: "env", Value: "prod" },
        { Key: "team", Value: "data" },
      ],
    });
    const r = await api.getTags("arn:aws:rds:us-east-1:000000000000:db:db-1");
    expect(rds.commandCalls(ListTagsForResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:rds:us-east-1:000000000000:db:db-1",
    });
    expect(r).toEqual([
      { key: "env", value: "prod" },
      { key: "team", value: "data" },
    ]);
  });

  it("saveTags removes dropped keys then upserts the rest", async () => {
    rds.on(RemoveTagsFromResourceCommand).resolves({});
    rds.on(AddTagsToResourceCommand).resolves({});
    await api.saveTags(
      "arn:aws:rds:us-east-1:000000000000:db:db-1",
      [
        { key: "env", value: "prod" },
        { key: "", value: "ignored" },
      ],
      ["old"],
    );
    expect(rds.commandCalls(RemoveTagsFromResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:rds:us-east-1:000000000000:db:db-1",
      TagKeys: ["old"],
    });
    expect(rds.commandCalls(AddTagsToResourceCommand)[0]?.args[0].input).toEqual({
      ResourceName: "arn:aws:rds:us-east-1:000000000000:db:db-1",
      Tags: [{ Key: "env", Value: "prod" }],
    });
  });

  it("saveTags skips Remove when nothing was dropped", async () => {
    rds.on(AddTagsToResourceCommand).resolves({});
    await api.saveTags(
      "arn:aws:rds:us-east-1:000000000000:db:db-1",
      [{ key: "a", value: "b" }],
      [],
    );
    expect(rds.commandCalls(RemoveTagsFromResourceCommand)).toHaveLength(0);
    expect(rds.commandCalls(AddTagsToResourceCommand)).toHaveLength(1);
  });
});

import {
  AttachVolumeCommand,
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateKeyPairCommand,
  CreateLaunchTemplateCommand,
  type CreateLaunchTemplateCommandInput,
  CreateSecurityGroupCommand,
  CreateTagsCommand,
  CreateVolumeCommand,
  type CreateVolumeCommandInput,
  DeleteKeyPairCommand,
  DeleteLaunchTemplateCommand,
  DeleteSecurityGroupCommand,
  DeleteTagsCommand,
  DeleteVolumeCommand,
  DescribeInstanceAttributeCommand,
  DescribeInstancesCommand,
  DescribeKeyPairsCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVolumesCommand,
  DetachVolumeCommand,
  ImportKeyPairCommand,
  type Instance,
  type IpPermission,
  ModifyInstanceAttributeCommand,
  RebootInstancesCommand,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupIngressCommand,
  RunInstancesCommand,
  type RunInstancesCommandInput,
  type SecurityGroup,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import { getEc2Client } from "./ec2-client";
import type {
  CreateLaunchTemplateInput,
  CreateSecurityGroupInput,
  CreateVolumeInput,
  Ec2InstanceAction,
  Ec2InstanceDetail,
  Ec2InstanceState,
  Ec2InstanceSummary,
  Ec2KeyPairSummary,
  Ec2LaunchInput,
  Ec2LaunchTemplateSummary,
  Ec2LaunchTemplateVersionDetail,
  Ec2NetworkInterface,
  Ec2SecurityGroup,
  Ec2SgRule,
  Ec2SubnetSummary,
  Ec2Volume,
  Ec2VolumeSummary,
  SgRuleInput,
  Tag,
} from "./types";

/** "Name" tag value, if present */
function nameTag(instance: Instance): string | null {
  return instance.Tags?.find((t) => t.Key === "Name")?.Value ?? null;
}

function toTags(tags: Instance["Tags"]): Tag[] {
  return (tags ?? [])
    .filter((t) => t.Key !== undefined)
    .map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" }));
}

/**
 * Effective security groups for an instance. Some backends (e.g. LocalStack) report groups only on
 * the network interface rather than at the instance top level, so merge both sources, deduped.
 */
function mergeSecurityGroups(
  instanceGroups: Instance["SecurityGroups"],
  nics: Ec2NetworkInterface[],
): { groupId: string; groupName: string }[] {
  const map = new Map<string, { groupId: string; groupName: string }>();
  for (const g of instanceGroups ?? []) {
    if (g.GroupId) map.set(g.GroupId, { groupId: g.GroupId, groupName: g.GroupName ?? "" });
  }
  for (const ni of nics) {
    for (const g of ni.groups) {
      if (g.groupId && !map.has(g.groupId)) map.set(g.groupId, g);
    }
  }
  return Array.from(map.values());
}

/** Flatten an SDK IpPermission into one row per CIDR / referenced group */
function flattenRules(perms: IpPermission[] | undefined): Ec2SgRule[] {
  const rules: Ec2SgRule[] = [];
  for (const p of perms ?? []) {
    const protocol = p.IpProtocol ?? "-1";
    const fromPort = p.FromPort ?? null;
    const toPort = p.ToPort ?? null;
    const sources = [
      ...(p.IpRanges ?? []).map((r) => r.CidrIp ?? ""),
      ...(p.Ipv6Ranges ?? []).map((r) => r.CidrIpv6 ?? ""),
      ...(p.UserIdGroupPairs ?? []).map((g) => g.GroupId ?? ""),
    ].filter(Boolean);
    if (sources.length === 0) {
      rules.push({ protocol, fromPort, toPort, source: "—" });
    } else {
      for (const source of sources) rules.push({ protocol, fromPort, toPort, source });
    }
  }
  return rules;
}

function mapSecurityGroup(g: SecurityGroup): Ec2SecurityGroup {
  return {
    groupId: g.GroupId ?? "",
    groupName: g.GroupName ?? "",
    description: g.Description ?? null,
    vpcId: g.VpcId ?? null,
    inbound: flattenRules(g.IpPermissions),
    outbound: flattenRules(g.IpPermissionsEgress),
  };
}

export const api = {
  listInstances: async (): Promise<Ec2InstanceSummary[]> => {
    const out = await getEc2Client().send(new DescribeInstancesCommand({}));
    const instances: Ec2InstanceSummary[] = [];
    for (const reservation of out.Reservations ?? []) {
      for (const i of reservation.Instances ?? []) {
        instances.push({
          instanceId: i.InstanceId ?? "",
          name: nameTag(i),
          instanceType: i.InstanceType ?? null,
          state: (i.State?.Name as Ec2InstanceState) ?? "pending",
          availabilityZone: i.Placement?.AvailabilityZone ?? null,
          publicIp: i.PublicIpAddress ?? null,
          privateIp: i.PrivateIpAddress ?? null,
          launchTime: i.LaunchTime ? i.LaunchTime.toISOString() : null,
        });
      }
    }
    return instances;
  },

  getInstanceDetail: async (instanceId: string): Promise<Ec2InstanceDetail> => {
    const out = await getEc2Client().send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
    );
    const i = out.Reservations?.[0]?.Instances?.[0];
    if (!i) throw new Error(`Instance ${instanceId} not found`);

    const networkInterfaces: Ec2NetworkInterface[] = (i.NetworkInterfaces ?? []).map((ni) => ({
      networkInterfaceId: ni.NetworkInterfaceId ?? "",
      subnetId: ni.SubnetId ?? null,
      vpcId: ni.VpcId ?? null,
      privateIp: ni.PrivateIpAddress ?? null,
      privateDns: ni.PrivateDnsName ?? null,
      publicIp: ni.Association?.PublicIp ?? null,
      macAddress: ni.MacAddress ?? null,
      status: ni.Status ?? null,
      groups: (ni.Groups ?? []).map((g) => ({
        groupId: g.GroupId ?? "",
        groupName: g.GroupName ?? "",
      })),
    }));

    return {
      instanceId: i.InstanceId ?? "",
      name: nameTag(i),
      instanceType: i.InstanceType ?? null,
      state: (i.State?.Name as Ec2InstanceState) ?? "pending",
      imageId: i.ImageId ?? null,
      keyName: i.KeyName ?? null,
      launchTime: i.LaunchTime ? i.LaunchTime.toISOString() : null,
      availabilityZone: i.Placement?.AvailabilityZone ?? null,
      vpcId: i.VpcId ?? null,
      subnetId: i.SubnetId ?? null,
      architecture: i.Architecture ?? null,
      platform: i.PlatformDetails ?? i.Platform ?? null,
      rootDeviceName: i.RootDeviceName ?? null,
      rootDeviceType: i.RootDeviceType ?? null,
      monitoring: i.Monitoring?.State ?? null,
      iamInstanceProfileArn: i.IamInstanceProfile?.Arn ?? null,
      metadataHttpTokens: i.MetadataOptions?.HttpTokens ?? null,
      metadataHopLimit: i.MetadataOptions?.HttpPutResponseHopLimit ?? null,
      publicIp: i.PublicIpAddress ?? null,
      publicDns: i.PublicDnsName ?? null,
      privateIp: i.PrivateIpAddress ?? null,
      privateDns: i.PrivateDnsName ?? null,
      securityGroups: mergeSecurityGroups(i.SecurityGroups, networkInterfaces),
      networkInterfaces,
      tags: toTags(i.Tags),
    };
  },

  listSecurityGroups: async (): Promise<Ec2SecurityGroup[]> => {
    const out = await getEc2Client().send(new DescribeSecurityGroupsCommand({}));
    return (out.SecurityGroups ?? []).map(mapSecurityGroup);
  },

  createSecurityGroup: async (input: CreateSecurityGroupInput): Promise<void> => {
    await getEc2Client().send(
      new CreateSecurityGroupCommand({
        GroupName: input.groupName,
        Description: input.description || input.groupName,
        ...(input.vpcId ? { VpcId: input.vpcId } : {}),
      }),
    );
  },

  deleteSecurityGroup: async (groupId: string): Promise<void> => {
    await getEc2Client().send(new DeleteSecurityGroupCommand({ GroupId: groupId }));
  },

  authorizeRule: async (groupId: string, rule: SgRuleInput): Promise<void> => {
    const permission: IpPermission = {
      IpProtocol: rule.protocol,
      ...(rule.protocol === "-1"
        ? {}
        : { FromPort: rule.fromPort ?? 0, ToPort: rule.toPort ?? rule.fromPort ?? 0 }),
      IpRanges: [{ CidrIp: rule.cidr }],
    };
    const ec2 = getEc2Client();
    if (rule.direction === "ingress") {
      await ec2.send(
        new AuthorizeSecurityGroupIngressCommand({ GroupId: groupId, IpPermissions: [permission] }),
      );
    } else {
      await ec2.send(
        new AuthorizeSecurityGroupEgressCommand({ GroupId: groupId, IpPermissions: [permission] }),
      );
    }
  },

  revokeRule: async (groupId: string, rule: SgRuleInput): Promise<void> => {
    const permission: IpPermission = {
      IpProtocol: rule.protocol,
      ...(rule.protocol === "-1"
        ? {}
        : { FromPort: rule.fromPort ?? 0, ToPort: rule.toPort ?? rule.fromPort ?? 0 }),
      IpRanges: [{ CidrIp: rule.cidr }],
    };
    const ec2 = getEc2Client();
    if (rule.direction === "ingress") {
      await ec2.send(
        new RevokeSecurityGroupIngressCommand({ GroupId: groupId, IpPermissions: [permission] }),
      );
    } else {
      await ec2.send(
        new RevokeSecurityGroupEgressCommand({ GroupId: groupId, IpPermissions: [permission] }),
      );
    }
  },

  getSecurityGroups: async (groupIds: string[]): Promise<Ec2SecurityGroup[]> => {
    if (groupIds.length === 0) return [];
    const out = await getEc2Client().send(
      new DescribeSecurityGroupsCommand({ GroupIds: groupIds }),
    );
    return (out.SecurityGroups ?? []).map(mapSecurityGroup);
  },

  getVolumes: async (instanceId: string): Promise<Ec2Volume[]> => {
    const out = await getEc2Client().send(
      new DescribeVolumesCommand({
        Filters: [{ Name: "attachment.instance-id", Values: [instanceId] }],
      }),
    );
    return (out.Volumes ?? []).map((v) => {
      const attachment = v.Attachments?.find((a) => a.InstanceId === instanceId);
      return {
        volumeId: v.VolumeId ?? "",
        deviceName: attachment?.Device ?? null,
        size: v.Size ?? 0,
        volumeType: v.VolumeType ?? null,
        iops: v.Iops ?? null,
        throughput: v.Throughput ?? null,
        encrypted: v.Encrypted ?? false,
        state: v.State ?? null,
        deleteOnTermination: attachment?.DeleteOnTermination ?? null,
        attachState: attachment?.State ?? null,
      };
    });
  },

  listVolumes: async (): Promise<Ec2VolumeSummary[]> => {
    const out = await getEc2Client().send(new DescribeVolumesCommand({}));
    return (out.Volumes ?? []).map((v) => ({
      volumeId: v.VolumeId ?? "",
      size: v.Size ?? 0,
      volumeType: v.VolumeType ?? null,
      iops: v.Iops ?? null,
      throughput: v.Throughput ?? null,
      state: v.State ?? null,
      encrypted: v.Encrypted ?? false,
      availabilityZone: v.AvailabilityZone ?? null,
      createTime: v.CreateTime ? v.CreateTime.toISOString() : null,
      attachments: (v.Attachments ?? []).map((a) => ({
        instanceId: a.InstanceId ?? "",
        device: a.Device ?? null,
        state: a.State ?? null,
      })),
    }));
  },

  listLaunchTemplates: async (): Promise<Ec2LaunchTemplateSummary[]> => {
    const out = await getEc2Client().send(new DescribeLaunchTemplatesCommand({}));
    return (out.LaunchTemplates ?? []).map((lt) => ({
      launchTemplateId: lt.LaunchTemplateId ?? "",
      launchTemplateName: lt.LaunchTemplateName ?? "",
      defaultVersionNumber: lt.DefaultVersionNumber ?? null,
      latestVersionNumber: lt.LatestVersionNumber ?? null,
      createTime: lt.CreateTime ? lt.CreateTime.toISOString() : null,
    }));
  },

  /** Default version data of a launch template */
  getLaunchTemplateVersion: async (
    launchTemplateId: string,
  ): Promise<Ec2LaunchTemplateVersionDetail> => {
    const out = await getEc2Client().send(
      new DescribeLaunchTemplateVersionsCommand({
        LaunchTemplateId: launchTemplateId,
        Versions: ["$Default"],
      }),
    );
    const v = out.LaunchTemplateVersions?.[0];
    const d = v?.LaunchTemplateData;
    return {
      versionNumber: v?.VersionNumber ?? null,
      imageId: d?.ImageId ?? null,
      instanceType: d?.InstanceType ?? null,
      keyName: d?.KeyName ?? null,
      securityGroupIds: d?.SecurityGroupIds ?? [],
      securityGroups: d?.SecurityGroups ?? [],
      iamInstanceProfileArn: d?.IamInstanceProfile?.Arn ?? null,
      metadataHttpTokens: d?.MetadataOptions?.HttpTokens ?? null,
      metadataHopLimit: d?.MetadataOptions?.HttpPutResponseHopLimit ?? null,
      userDataPresent: Boolean(d?.UserData),
      blockDevices: (d?.BlockDeviceMappings ?? []).map((b) => ({
        deviceName: b.DeviceName ?? null,
        size: b.Ebs?.VolumeSize ?? null,
        volumeType: b.Ebs?.VolumeType ?? null,
        encrypted: b.Ebs?.Encrypted ?? null,
      })),
    };
  },

  createLaunchTemplate: async (input: CreateLaunchTemplateInput): Promise<void> => {
    const params: CreateLaunchTemplateCommandInput = {
      LaunchTemplateName: input.name,
      LaunchTemplateData: {
        ImageId: input.imageId,
        InstanceType: input.instanceType as NonNullable<
          CreateLaunchTemplateCommandInput["LaunchTemplateData"]
        >["InstanceType"],
        ...(input.keyName ? { KeyName: input.keyName } : {}),
        ...(input.securityGroupIds?.length ? { SecurityGroupIds: input.securityGroupIds } : {}),
      },
    };
    await getEc2Client().send(new CreateLaunchTemplateCommand(params));
  },

  deleteLaunchTemplate: async (launchTemplateId: string): Promise<void> => {
    await getEc2Client().send(
      new DeleteLaunchTemplateCommand({ LaunchTemplateId: launchTemplateId }),
    );
  },

  createVolume: async (input: CreateVolumeInput): Promise<void> => {
    const params: CreateVolumeCommandInput = {
      AvailabilityZone: input.availabilityZone,
      Size: input.size,
      VolumeType: input.volumeType as CreateVolumeCommandInput["VolumeType"],
      Encrypted: input.encrypted,
      ...(input.iops ? { Iops: input.iops } : {}),
    };
    await getEc2Client().send(new CreateVolumeCommand(params));
  },

  deleteVolume: async (volumeId: string): Promise<void> => {
    await getEc2Client().send(new DeleteVolumeCommand({ VolumeId: volumeId }));
  },

  attachVolume: async (volumeId: string, instanceId: string, device: string): Promise<void> => {
    await getEc2Client().send(
      new AttachVolumeCommand({ VolumeId: volumeId, InstanceId: instanceId, Device: device }),
    );
  },

  detachVolume: async (volumeId: string): Promise<void> => {
    await getEc2Client().send(new DetachVolumeCommand({ VolumeId: volumeId }));
  },

  /** Termination + stop protection flags (DescribeInstanceAttribute). */
  getInstanceProtection: async (
    instanceId: string,
  ): Promise<{ terminationProtection: boolean; stopProtection: boolean }> => {
    const ec2 = getEc2Client();
    const [term, stop] = await Promise.all([
      ec2.send(
        new DescribeInstanceAttributeCommand({
          InstanceId: instanceId,
          Attribute: "disableApiTermination",
        }),
      ),
      ec2.send(
        new DescribeInstanceAttributeCommand({
          InstanceId: instanceId,
          Attribute: "disableApiStop",
        }),
      ),
    ]);
    return {
      terminationProtection: term.DisableApiTermination?.Value ?? false,
      stopProtection: stop.DisableApiStop?.Value ?? false,
    };
  },

  setTerminationProtection: async (instanceId: string, enabled: boolean): Promise<void> => {
    await getEc2Client().send(
      new ModifyInstanceAttributeCommand({
        InstanceId: instanceId,
        DisableApiTermination: { Value: enabled },
      }),
    );
  },

  setStopProtection: async (instanceId: string, enabled: boolean): Promise<void> => {
    await getEc2Client().send(
      new ModifyInstanceAttributeCommand({
        InstanceId: instanceId,
        DisableApiStop: { Value: enabled },
      }),
    );
  },

  /** Instance user data, base64-decoded (empty string if none). */
  getUserData: async (instanceId: string): Promise<string> => {
    const out = await getEc2Client().send(
      new DescribeInstanceAttributeCommand({ InstanceId: instanceId, Attribute: "userData" }),
    );
    const b64 = out.UserData?.Value;
    if (!b64) return "";
    try {
      return atob(b64);
    } catch {
      return b64;
    }
  },

  listKeyPairs: async (): Promise<Ec2KeyPairSummary[]> => {
    const out = await getEc2Client().send(new DescribeKeyPairsCommand({}));
    return (out.KeyPairs ?? []).map((k) => ({
      keyPairId: k.KeyPairId ?? "",
      keyName: k.KeyName ?? "",
      keyType: k.KeyType ?? null,
      fingerprint: k.KeyFingerprint ?? null,
      createTime: k.CreateTime ? k.CreateTime.toISOString() : null,
    }));
  },

  /** Create a key pair; returns the private key material (PEM) for the caller to download. */
  createKeyPair: async (
    keyName: string,
    keyType: "rsa" | "ed25519",
  ): Promise<{ keyName: string; keyMaterial: string }> => {
    const out = await getEc2Client().send(
      new CreateKeyPairCommand({ KeyName: keyName, KeyType: keyType }),
    );
    return { keyName: out.KeyName ?? keyName, keyMaterial: out.KeyMaterial ?? "" };
  },

  importKeyPair: async (keyName: string, publicKeyMaterial: string): Promise<void> => {
    await getEc2Client().send(
      new ImportKeyPairCommand({
        KeyName: keyName,
        PublicKeyMaterial: new TextEncoder().encode(publicKeyMaterial),
      }),
    );
  },

  deleteKeyPair: async (keyName: string): Promise<void> => {
    await getEc2Client().send(new DeleteKeyPairCommand({ KeyName: keyName }));
  },

  listSubnets: async (): Promise<Ec2SubnetSummary[]> => {
    const out = await getEc2Client().send(new DescribeSubnetsCommand({}));
    return (out.Subnets ?? []).map((s) => ({
      subnetId: s.SubnetId ?? "",
      vpcId: s.VpcId ?? null,
      cidrBlock: s.CidrBlock ?? null,
      availabilityZone: s.AvailabilityZone ?? null,
      availableIpCount: s.AvailableIpAddressCount ?? null,
      name: s.Tags?.find((t) => t.Key === "Name")?.Value ?? null,
    }));
  },

  launchInstances: async (input: Ec2LaunchInput): Promise<void> => {
    const params: RunInstancesCommandInput = {
      ImageId: input.imageId,
      InstanceType: input.instanceType as RunInstancesCommandInput["InstanceType"],
      MinCount: input.count,
      MaxCount: input.count,
      ...(input.keyName ? { KeyName: input.keyName } : {}),
      ...(input.securityGroupIds?.length ? { SecurityGroupIds: input.securityGroupIds } : {}),
      ...(input.subnetId ? { SubnetId: input.subnetId } : {}),
      ...(input.iamInstanceProfileName
        ? { IamInstanceProfile: { Name: input.iamInstanceProfileName } }
        : {}),
      ...(input.name
        ? {
            TagSpecifications: [
              { ResourceType: "instance", Tags: [{ Key: "Name", Value: input.name }] },
            ],
          }
        : {}),
    };
    await getEc2Client().send(new RunInstancesCommand(params));
  },

  /** Apply a desired tag set to a resource: upsert current tags, delete the removed keys. */
  saveTags: async (resourceId: string, tags: Tag[], removedKeys: string[]): Promise<void> => {
    const ec2 = getEc2Client();
    if (removedKeys.length > 0) {
      await ec2.send(
        new DeleteTagsCommand({
          Resources: [resourceId],
          Tags: removedKeys.map((Key) => ({ Key })),
        }),
      );
    }
    const upserts = tags.filter((t) => t.key.trim() !== "");
    if (upserts.length > 0) {
      await ec2.send(
        new CreateTagsCommand({
          Resources: [resourceId],
          Tags: upserts.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      );
    }
  },

  modifyInstanceType: async (instanceId: string, instanceType: string): Promise<void> => {
    await getEc2Client().send(
      new ModifyInstanceAttributeCommand({
        InstanceId: instanceId,
        InstanceType: { Value: instanceType },
      }),
    );
  },

  modifyInstanceSecurityGroups: async (instanceId: string, groupIds: string[]): Promise<void> => {
    await getEc2Client().send(
      new ModifyInstanceAttributeCommand({ InstanceId: instanceId, Groups: groupIds }),
    );
  },

  runAction: async (action: Ec2InstanceAction, instanceId: string): Promise<void> => {
    const ec2 = getEc2Client();
    const InstanceIds = [instanceId];
    switch (action) {
      case "start":
        await ec2.send(new StartInstancesCommand({ InstanceIds }));
        break;
      case "stop":
        await ec2.send(new StopInstancesCommand({ InstanceIds }));
        break;
      case "reboot":
        await ec2.send(new RebootInstancesCommand({ InstanceIds }));
        break;
      case "terminate":
        await ec2.send(new TerminateInstancesCommand({ InstanceIds }));
        break;
    }
  },
};

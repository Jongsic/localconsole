import {
  DescribeInstancesCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeSecurityGroupsCommand,
  DescribeVolumesCommand,
  type Instance,
  type IpPermission,
  RebootInstancesCommand,
  RunInstancesCommand,
  type RunInstancesCommandInput,
  type SecurityGroup,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import { getEc2Client } from "./ec2-client";
import type {
  Ec2InstanceAction,
  Ec2InstanceDetail,
  Ec2InstanceState,
  Ec2InstanceSummary,
  Ec2LaunchInput,
  Ec2LaunchTemplateSummary,
  Ec2LaunchTemplateVersionDetail,
  Ec2NetworkInterface,
  Ec2SecurityGroup,
  Ec2SgRule,
  Ec2Volume,
  Ec2VolumeSummary,
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

  launchInstances: async (input: Ec2LaunchInput): Promise<void> => {
    const params: RunInstancesCommandInput = {
      ImageId: input.imageId,
      InstanceType: input.instanceType as RunInstancesCommandInput["InstanceType"],
      MinCount: input.count,
      MaxCount: input.count,
      ...(input.keyName ? { KeyName: input.keyName } : {}),
      ...(input.securityGroupIds?.length ? { SecurityGroupIds: input.securityGroupIds } : {}),
      ...(input.subnetId ? { SubnetId: input.subnetId } : {}),
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

import {
  AllocateAddressCommand,
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateNatGatewayCommand,
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateSubnetCommand,
  type CreateSubnetCommandInput,
  CreateVpcCommand,
  DeleteInternetGatewayCommand,
  DeleteNatGatewayCommand,
  DeleteRouteCommand,
  DeleteRouteTableCommand,
  DeleteSubnetCommand,
  DeleteVpcCommand,
  DescribeAddressesCommand,
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeRouteTablesCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  DetachInternetGatewayCommand,
  ReleaseAddressCommand,
  type Route,
  type Tag as SdkTag,
} from "@aws-sdk/client-ec2";
import { getEc2Client } from "./ec2-client";
import type {
  CreateNatGatewayInput,
  CreateRouteInput,
  CreateSubnetInput,
  ElasticIpSummary,
  InternetGatewaySummary,
  NatGatewaySummary,
  RouteEntry,
  RouteTableSummary,
  SubnetSummary,
  Tag,
  VpcSummary,
} from "./types";

/** "Name" tag value, if present */
function nameTag(tags: SdkTag[] | undefined): string | null {
  return tags?.find((t) => t.Key === "Name")?.Value ?? null;
}

/** Surface raw SDK tags as the editor's {key,value}[] shape, dropping keyless entries. */
function toTags(tags: SdkTag[] | undefined): Tag[] {
  return (tags ?? [])
    .filter((t) => t.Key !== undefined)
    .map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" }));
}

/** Resolve a route's target to the single id the backend populated. */
function routeTarget(r: Route): string {
  return (
    r.GatewayId ??
    r.NatGatewayId ??
    r.NetworkInterfaceId ??
    r.InstanceId ??
    r.TransitGatewayId ??
    r.VpcPeeringConnectionId ??
    r.EgressOnlyInternetGatewayId ??
    "—"
  );
}

function routeDestination(r: Route): string {
  return r.DestinationCidrBlock ?? r.DestinationIpv6CidrBlock ?? r.DestinationPrefixListId ?? "—";
}

export const api = {
  listVpcs: async (): Promise<VpcSummary[]> => {
    const out = await getEc2Client().send(new DescribeVpcsCommand({}));
    return (out.Vpcs ?? []).map((v) => ({
      vpcId: v.VpcId ?? "",
      cidrBlock: v.CidrBlock ?? null,
      state: v.State ?? null,
      isDefault: v.IsDefault ?? false,
      name: nameTag(v.Tags),
      tags: toTags(v.Tags),
      ownerId: v.OwnerId ?? null,
      instanceTenancy: v.InstanceTenancy ?? null,
      dhcpOptionsId: v.DhcpOptionsId ?? null,
      cidrAssociations: (v.CidrBlockAssociationSet ?? [])
        .filter((c) => c.CidrBlock)
        .map((c) => ({ cidrBlock: c.CidrBlock ?? "", state: c.CidrBlockState?.State ?? null })),
      ipv6CidrAssociations: (v.Ipv6CidrBlockAssociationSet ?? [])
        .filter((c) => c.Ipv6CidrBlock)
        .map((c) => ({
          ipv6CidrBlock: c.Ipv6CidrBlock ?? "",
          state: c.Ipv6CidrBlockState?.State ?? null,
        })),
    }));
  },

  createVpc: async (cidrBlock: string): Promise<void> => {
    await getEc2Client().send(new CreateVpcCommand({ CidrBlock: cidrBlock }));
  },

  deleteVpc: async (vpcId: string): Promise<void> => {
    await getEc2Client().send(new DeleteVpcCommand({ VpcId: vpcId }));
  },

  listSubnets: async (): Promise<SubnetSummary[]> => {
    const out = await getEc2Client().send(new DescribeSubnetsCommand({}));
    return (out.Subnets ?? []).map((s) => ({
      subnetId: s.SubnetId ?? "",
      vpcId: s.VpcId ?? null,
      cidrBlock: s.CidrBlock ?? null,
      availabilityZone: s.AvailabilityZone ?? null,
      availableIpCount: s.AvailableIpAddressCount ?? null,
      state: s.State ?? null,
      name: nameTag(s.Tags),
      tags: toTags(s.Tags),
      ownerId: s.OwnerId ?? null,
      availabilityZoneId: s.AvailabilityZoneId ?? null,
      defaultForAz: s.DefaultForAz ?? false,
      mapPublicIpOnLaunch: s.MapPublicIpOnLaunch ?? false,
      assignIpv6AddressOnCreation: s.AssignIpv6AddressOnCreation ?? false,
      ipv6CidrBlocks: (s.Ipv6CidrBlockAssociationSet ?? [])
        .map((c) => c.Ipv6CidrBlock)
        .filter((c): c is string => Boolean(c)),
      enableDns64: s.EnableDns64 ?? false,
    }));
  },

  createSubnet: async (input: CreateSubnetInput): Promise<void> => {
    const params: CreateSubnetCommandInput = {
      VpcId: input.vpcId,
      CidrBlock: input.cidrBlock,
      ...(input.availabilityZone ? { AvailabilityZone: input.availabilityZone } : {}),
    };
    await getEc2Client().send(new CreateSubnetCommand(params));
  },

  deleteSubnet: async (subnetId: string): Promise<void> => {
    await getEc2Client().send(new DeleteSubnetCommand({ SubnetId: subnetId }));
  },

  listRouteTables: async (): Promise<RouteTableSummary[]> => {
    const out = await getEc2Client().send(new DescribeRouteTablesCommand({}));
    return (out.RouteTables ?? []).map((rt) => {
      const associations = rt.Associations ?? [];
      const routes: RouteEntry[] = (rt.Routes ?? []).map((r) => ({
        destination: routeDestination(r),
        target: routeTarget(r),
        state: r.State ?? null,
      }));
      return {
        routeTableId: rt.RouteTableId ?? "",
        vpcId: rt.VpcId ?? null,
        main: associations.some((a) => a.Main === true),
        associationCount: associations.length,
        routes,
        name: nameTag(rt.Tags),
        tags: toTags(rt.Tags),
        ownerId: rt.OwnerId ?? null,
        associations: associations.map((a) => ({
          subnetId: a.SubnetId ?? null,
          main: a.Main ?? false,
          state: a.AssociationState?.State ?? null,
        })),
        propagatingVgws: (rt.PropagatingVgws ?? [])
          .map((v) => v.GatewayId)
          .filter((v): v is string => Boolean(v)),
      };
    });
  },

  createRouteTable: async (vpcId: string): Promise<void> => {
    await getEc2Client().send(new CreateRouteTableCommand({ VpcId: vpcId }));
  },

  deleteRouteTable: async (routeTableId: string): Promise<void> => {
    await getEc2Client().send(new DeleteRouteTableCommand({ RouteTableId: routeTableId }));
  },

  createRoute: async (input: CreateRouteInput): Promise<void> => {
    await getEc2Client().send(
      new CreateRouteCommand({
        RouteTableId: input.routeTableId,
        DestinationCidrBlock: input.destinationCidrBlock,
        GatewayId: input.gatewayId,
      }),
    );
  },

  deleteRoute: async (routeTableId: string, destinationCidrBlock: string): Promise<void> => {
    await getEc2Client().send(
      new DeleteRouteCommand({
        RouteTableId: routeTableId,
        DestinationCidrBlock: destinationCidrBlock,
      }),
    );
  },

  listInternetGateways: async (): Promise<InternetGatewaySummary[]> => {
    const out = await getEc2Client().send(new DescribeInternetGatewaysCommand({}));
    return (out.InternetGateways ?? []).map((igw) => ({
      internetGatewayId: igw.InternetGatewayId ?? "",
      attachments: (igw.Attachments ?? []).map((a) => ({
        vpcId: a.VpcId ?? "",
        state: a.State ?? null,
      })),
      name: nameTag(igw.Tags),
      tags: toTags(igw.Tags),
      ownerId: igw.OwnerId ?? null,
    }));
  },

  createInternetGateway: async (): Promise<void> => {
    await getEc2Client().send(new CreateInternetGatewayCommand({}));
  },

  attachInternetGateway: async (internetGatewayId: string, vpcId: string): Promise<void> => {
    await getEc2Client().send(
      new AttachInternetGatewayCommand({ InternetGatewayId: internetGatewayId, VpcId: vpcId }),
    );
  },

  detachInternetGateway: async (internetGatewayId: string, vpcId: string): Promise<void> => {
    await getEc2Client().send(
      new DetachInternetGatewayCommand({ InternetGatewayId: internetGatewayId, VpcId: vpcId }),
    );
  },

  deleteInternetGateway: async (internetGatewayId: string): Promise<void> => {
    await getEc2Client().send(
      new DeleteInternetGatewayCommand({ InternetGatewayId: internetGatewayId }),
    );
  },

  listNatGateways: async (): Promise<NatGatewaySummary[]> => {
    const out = await getEc2Client().send(new DescribeNatGatewaysCommand({}));
    return (out.NatGateways ?? []).map((nat) => ({
      natGatewayId: nat.NatGatewayId ?? "",
      subnetId: nat.SubnetId ?? null,
      vpcId: nat.VpcId ?? null,
      state: nat.State ?? null,
      type: nat.ConnectivityType ?? null,
      publicIp: nat.NatGatewayAddresses?.[0]?.PublicIp ?? null,
      name: nameTag(nat.Tags),
      tags: toTags(nat.Tags),
      createdTime: nat.CreateTime?.toISOString() ?? null,
      deleteTime: nat.DeleteTime?.toISOString() ?? null,
      failureMessage: nat.FailureMessage ?? null,
      addresses: (nat.NatGatewayAddresses ?? []).map((a) => ({
        publicIp: a.PublicIp ?? null,
        privateIp: a.PrivateIp ?? null,
        allocationId: a.AllocationId ?? null,
        networkInterfaceId: a.NetworkInterfaceId ?? null,
      })),
    }));
  },

  createNatGateway: async (input: CreateNatGatewayInput): Promise<void> => {
    await getEc2Client().send(
      new CreateNatGatewayCommand({
        SubnetId: input.subnetId,
        ConnectivityType: input.connectivityType,
        // Public NAT gateways need an Elastic IP; private ones must not have one.
        ...(input.connectivityType === "public" && input.allocationId
          ? { AllocationId: input.allocationId }
          : {}),
      }),
    );
  },

  deleteNatGateway: async (natGatewayId: string): Promise<void> => {
    await getEc2Client().send(new DeleteNatGatewayCommand({ NatGatewayId: natGatewayId }));
  },

  listAddresses: async (): Promise<ElasticIpSummary[]> => {
    const out = await getEc2Client().send(new DescribeAddressesCommand({}));
    return (out.Addresses ?? []).map((a) => ({
      allocationId: a.AllocationId ?? "",
      publicIp: a.PublicIp ?? null,
      domain: a.Domain ?? null,
      association:
        a.InstanceId || a.NetworkInterfaceId
          ? {
              instanceId: a.InstanceId ?? null,
              networkInterfaceId: a.NetworkInterfaceId ?? null,
              privateIpAddress: a.PrivateIpAddress ?? null,
            }
          : null,
      name: nameTag(a.Tags),
      tags: toTags(a.Tags),
      networkBorderGroup: a.NetworkBorderGroup ?? null,
      publicIpv4Pool: a.PublicIpv4Pool ?? null,
    }));
  },

  allocateAddress: async (): Promise<void> => {
    await getEc2Client().send(new AllocateAddressCommand({ Domain: "vpc" }));
  },

  releaseAddress: async (allocationId: string): Promise<void> => {
    await getEc2Client().send(new ReleaseAddressCommand({ AllocationId: allocationId }));
  },
};

import {
  AllocateAddressCommand,
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateNatGatewayCommand,
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateSubnetCommand,
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
  EC2Client,
  ReleaseAddressCommand,
} from "@aws-sdk/client-ec2";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./vpc-api";

const ec2 = mockClient(EC2Client);

beforeEach(() => ec2.reset());

describe("listVpcs mapping", () => {
  it("maps fields + Name tag + isDefault + detail fields", async () => {
    ec2.on(DescribeVpcsCommand).resolves({
      Vpcs: [
        {
          VpcId: "vpc-1",
          CidrBlock: "10.0.0.0/16",
          State: "available",
          IsDefault: true,
          Tags: [{ Key: "Name", Value: "main" }],
          OwnerId: "111122223333",
          InstanceTenancy: "default",
          DhcpOptionsId: "dopt-1",
          CidrBlockAssociationSet: [
            { CidrBlock: "10.0.0.0/16", CidrBlockState: { State: "associated" } },
            { CidrBlock: "10.1.0.0/16", CidrBlockState: { State: "associating" } },
          ],
          Ipv6CidrBlockAssociationSet: [
            { Ipv6CidrBlock: "2600:1f18::/56", Ipv6CidrBlockState: { State: "associated" } },
          ],
        },
      ],
    });
    const r = await api.listVpcs();
    expect(r[0]).toEqual({
      vpcId: "vpc-1",
      cidrBlock: "10.0.0.0/16",
      state: "available",
      isDefault: true,
      name: "main",
      tags: [{ key: "Name", value: "main" }],
      ownerId: "111122223333",
      instanceTenancy: "default",
      dhcpOptionsId: "dopt-1",
      cidrAssociations: [
        { cidrBlock: "10.0.0.0/16", state: "associated" },
        { cidrBlock: "10.1.0.0/16", state: "associating" },
      ],
      ipv6CidrAssociations: [{ ipv6CidrBlock: "2600:1f18::/56", state: "associated" }],
    });
  });

  it("leaves detail fields null/empty when the response omits them", async () => {
    ec2.on(DescribeVpcsCommand).resolves({ Vpcs: [{ VpcId: "vpc-2" }] });
    const r = await api.listVpcs();
    expect(r[0]).toMatchObject({
      ownerId: null,
      instanceTenancy: null,
      dhcpOptionsId: null,
      cidrAssociations: [],
      ipv6CidrAssociations: [],
    });
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeVpcsCommand).resolves({});
    await expect(api.listVpcs()).resolves.toEqual([]);
  });
});

describe("listSubnets mapping", () => {
  it("maps fields + Name tag + availableIpCount + state + detail fields", async () => {
    ec2.on(DescribeSubnetsCommand).resolves({
      Subnets: [
        {
          SubnetId: "subnet-1",
          VpcId: "vpc-1",
          CidrBlock: "10.0.1.0/24",
          AvailabilityZone: "us-east-1a",
          AvailableIpAddressCount: 250,
          State: "available",
          Tags: [{ Key: "Name", Value: "public" }],
          OwnerId: "111122223333",
          AvailabilityZoneId: "use1-az1",
          DefaultForAz: true,
          MapPublicIpOnLaunch: true,
          AssignIpv6AddressOnCreation: true,
          EnableDns64: true,
          Ipv6CidrBlockAssociationSet: [{ Ipv6CidrBlock: "2600:1f18::/64" }],
        },
      ],
    });
    const r = await api.listSubnets();
    expect(r[0]).toEqual({
      subnetId: "subnet-1",
      vpcId: "vpc-1",
      cidrBlock: "10.0.1.0/24",
      availabilityZone: "us-east-1a",
      availableIpCount: 250,
      state: "available",
      name: "public",
      tags: [{ key: "Name", value: "public" }],
      ownerId: "111122223333",
      availabilityZoneId: "use1-az1",
      defaultForAz: true,
      mapPublicIpOnLaunch: true,
      assignIpv6AddressOnCreation: true,
      enableDns64: true,
      ipv6CidrBlocks: ["2600:1f18::/64"],
    });
  });

  it("defaults detail booleans to false / empty when omitted", async () => {
    ec2.on(DescribeSubnetsCommand).resolves({ Subnets: [{ SubnetId: "subnet-2" }] });
    const r = await api.listSubnets();
    expect(r[0]).toMatchObject({
      ownerId: null,
      availabilityZoneId: null,
      defaultForAz: false,
      mapPublicIpOnLaunch: false,
      assignIpv6AddressOnCreation: false,
      enableDns64: false,
      ipv6CidrBlocks: [],
    });
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeSubnetsCommand).resolves({});
    await expect(api.listSubnets()).resolves.toEqual([]);
  });
});

describe("listRouteTables mapping", () => {
  it("maps routes (resolving target), main flag, association count, Name", async () => {
    ec2.on(DescribeRouteTablesCommand).resolves({
      RouteTables: [
        {
          RouteTableId: "rtb-1",
          VpcId: "vpc-1",
          Tags: [{ Key: "Name", Value: "rt" }],
          OwnerId: "111122223333",
          PropagatingVgws: [{ GatewayId: "vgw-1" }],
          Associations: [
            { Main: true, AssociationState: { State: "associated" } },
            { SubnetId: "subnet-1", AssociationState: { State: "associated" } },
          ],
          Routes: [
            { DestinationCidrBlock: "10.0.0.0/16", GatewayId: "local", State: "active" },
            { DestinationCidrBlock: "0.0.0.0/0", GatewayId: "igw-1", State: "active" },
            { DestinationCidrBlock: "10.1.0.0/16", NatGatewayId: "nat-1", State: "blackhole" },
          ],
        },
      ],
    });
    const r = await api.listRouteTables();
    expect(r[0]).toMatchObject({
      routeTableId: "rtb-1",
      vpcId: "vpc-1",
      main: true,
      associationCount: 2,
      name: "rt",
      tags: [{ key: "Name", value: "rt" }],
      ownerId: "111122223333",
      propagatingVgws: ["vgw-1"],
    });
    expect(r[0]?.associations).toEqual([
      { subnetId: null, main: true, state: "associated" },
      { subnetId: "subnet-1", main: false, state: "associated" },
    ]);
    expect(r[0]?.routes).toEqual([
      { destination: "10.0.0.0/16", target: "local", state: "active" },
      { destination: "0.0.0.0/0", target: "igw-1", state: "active" },
      { destination: "10.1.0.0/16", target: "nat-1", state: "blackhole" },
    ]);
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeRouteTablesCommand).resolves({});
    await expect(api.listRouteTables()).resolves.toEqual([]);
  });
});

describe("listInternetGateways mapping", () => {
  it("maps attachments + Name", async () => {
    ec2.on(DescribeInternetGatewaysCommand).resolves({
      InternetGateways: [
        {
          InternetGatewayId: "igw-1",
          Tags: [{ Key: "Name", Value: "edge" }],
          Attachments: [{ VpcId: "vpc-1", State: "attached" }],
          OwnerId: "111122223333",
        },
      ],
    });
    const r = await api.listInternetGateways();
    expect(r[0]).toEqual({
      internetGatewayId: "igw-1",
      name: "edge",
      attachments: [{ vpcId: "vpc-1", state: "attached" }],
      tags: [{ key: "Name", value: "edge" }],
      ownerId: "111122223333",
    });
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeInternetGatewaysCommand).resolves({});
    await expect(api.listInternetGateways()).resolves.toEqual([]);
  });
});

describe("listNatGateways mapping", () => {
  it("maps fields + connectivity type + first public IP + address detail", async () => {
    ec2.on(DescribeNatGatewaysCommand).resolves({
      NatGateways: [
        {
          NatGatewayId: "nat-1",
          SubnetId: "subnet-1",
          VpcId: "vpc-1",
          State: "available",
          ConnectivityType: "public",
          CreateTime: new Date("2024-01-02T03:04:05.000Z"),
          NatGatewayAddresses: [
            {
              PublicIp: "1.2.3.4",
              PrivateIp: "10.0.0.5",
              AllocationId: "eipalloc-1",
              NetworkInterfaceId: "eni-1",
            },
          ],
          Tags: [{ Key: "Name", Value: "nat" }],
        },
      ],
    });
    const r = await api.listNatGateways();
    expect(r[0]).toEqual({
      natGatewayId: "nat-1",
      subnetId: "subnet-1",
      vpcId: "vpc-1",
      state: "available",
      type: "public",
      publicIp: "1.2.3.4",
      name: "nat",
      tags: [{ key: "Name", value: "nat" }],
      createdTime: "2024-01-02T03:04:05.000Z",
      deleteTime: null,
      failureMessage: null,
      addresses: [
        {
          publicIp: "1.2.3.4",
          privateIp: "10.0.0.5",
          allocationId: "eipalloc-1",
          networkInterfaceId: "eni-1",
        },
      ],
    });
  });

  it("surfaces a failure message and leaves address list empty when omitted", async () => {
    ec2.on(DescribeNatGatewaysCommand).resolves({
      NatGateways: [{ NatGatewayId: "nat-2", State: "failed", FailureMessage: "boom" }],
    });
    const r = await api.listNatGateways();
    expect(r[0]).toMatchObject({
      failureMessage: "boom",
      createdTime: null,
      deleteTime: null,
      addresses: [],
    });
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeNatGatewaysCommand).resolves({});
    await expect(api.listNatGateways()).resolves.toEqual([]);
  });
});

describe("listAddresses mapping", () => {
  it("maps allocation/public IP, association, domain + tags", async () => {
    ec2.on(DescribeAddressesCommand).resolves({
      Addresses: [
        {
          AllocationId: "eipalloc-1",
          PublicIp: "52.0.0.1",
          Domain: "vpc",
          InstanceId: "i-123",
          PrivateIpAddress: "10.0.0.9",
          NetworkBorderGroup: "us-east-1",
          PublicIpv4Pool: "amazon",
          Tags: [{ Key: "Name", Value: "web-eip" }],
        },
        {
          AllocationId: "eipalloc-2",
          PublicIp: "52.0.0.2",
          Domain: "vpc",
        },
      ],
    });
    const r = await api.listAddresses();
    expect(r[0]).toEqual({
      allocationId: "eipalloc-1",
      publicIp: "52.0.0.1",
      domain: "vpc",
      association: { instanceId: "i-123", networkInterfaceId: null, privateIpAddress: "10.0.0.9" },
      name: "web-eip",
      tags: [{ key: "Name", value: "web-eip" }],
      networkBorderGroup: "us-east-1",
      publicIpv4Pool: "amazon",
    });
    // Unassociated EIP → association null, no tags, detail fields null.
    expect(r[1]).toEqual({
      allocationId: "eipalloc-2",
      publicIp: "52.0.0.2",
      domain: "vpc",
      association: null,
      name: null,
      tags: [],
      networkBorderGroup: null,
      publicIpv4Pool: null,
    });
  });

  it("maps a network-interface association", async () => {
    ec2.on(DescribeAddressesCommand).resolves({
      Addresses: [{ AllocationId: "eipalloc-3", NetworkInterfaceId: "eni-9" }],
    });
    const r = await api.listAddresses();
    expect(r[0]?.association).toEqual({
      instanceId: null,
      networkInterfaceId: "eni-9",
      privateIpAddress: null,
    });
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeAddressesCommand).resolves({});
    await expect(api.listAddresses()).resolves.toEqual([]);
  });
});

describe("write/command shapes", () => {
  it("createVpc sends the CIDR block", async () => {
    ec2.on(CreateVpcCommand).resolves({});
    await api.createVpc("10.0.0.0/16");
    expect(ec2.commandCalls(CreateVpcCommand)[0]?.args[0].input).toEqual({
      CidrBlock: "10.0.0.0/16",
    });
  });

  it("deleteVpc sends the id", async () => {
    ec2.on(DeleteVpcCommand).resolves({});
    await api.deleteVpc("vpc-1");
    expect(ec2.commandCalls(DeleteVpcCommand)[0]?.args[0].input).toEqual({ VpcId: "vpc-1" });
  });

  it("createSubnet maps fields and omits AZ when not provided", async () => {
    ec2.on(CreateSubnetCommand).resolves({});
    await api.createSubnet({ vpcId: "vpc-1", cidrBlock: "10.0.1.0/24" });
    expect(ec2.commandCalls(CreateSubnetCommand)[0]?.args[0].input).toEqual({
      VpcId: "vpc-1",
      CidrBlock: "10.0.1.0/24",
    });

    ec2.reset();
    ec2.on(CreateSubnetCommand).resolves({});
    await api.createSubnet({
      vpcId: "vpc-1",
      cidrBlock: "10.0.1.0/24",
      availabilityZone: "us-east-1a",
    });
    expect(ec2.commandCalls(CreateSubnetCommand)[0]?.args[0].input).toMatchObject({
      AvailabilityZone: "us-east-1a",
    });
  });

  it("deleteSubnet sends the id", async () => {
    ec2.on(DeleteSubnetCommand).resolves({});
    await api.deleteSubnet("subnet-1");
    expect(ec2.commandCalls(DeleteSubnetCommand)[0]?.args[0].input).toEqual({
      SubnetId: "subnet-1",
    });
  });

  it("createRouteTable + deleteRouteTable send the right inputs", async () => {
    ec2.on(CreateRouteTableCommand).resolves({}).on(DeleteRouteTableCommand).resolves({});
    await api.createRouteTable("vpc-1");
    await api.deleteRouteTable("rtb-1");
    expect(ec2.commandCalls(CreateRouteTableCommand)[0]?.args[0].input).toEqual({ VpcId: "vpc-1" });
    expect(ec2.commandCalls(DeleteRouteTableCommand)[0]?.args[0].input).toEqual({
      RouteTableId: "rtb-1",
    });
  });

  it("createRoute + deleteRoute build the expected inputs", async () => {
    ec2.on(CreateRouteCommand).resolves({}).on(DeleteRouteCommand).resolves({});
    await api.createRoute({
      routeTableId: "rtb-1",
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: "igw-1",
    });
    await api.deleteRoute("rtb-1", "0.0.0.0/0");
    expect(ec2.commandCalls(CreateRouteCommand)[0]?.args[0].input).toEqual({
      RouteTableId: "rtb-1",
      DestinationCidrBlock: "0.0.0.0/0",
      GatewayId: "igw-1",
    });
    expect(ec2.commandCalls(DeleteRouteCommand)[0]?.args[0].input).toEqual({
      RouteTableId: "rtb-1",
      DestinationCidrBlock: "0.0.0.0/0",
    });
  });

  it("createInternetGateway + attach/detach/delete send the right inputs", async () => {
    ec2
      .on(CreateInternetGatewayCommand)
      .resolves({})
      .on(AttachInternetGatewayCommand)
      .resolves({})
      .on(DetachInternetGatewayCommand)
      .resolves({})
      .on(DeleteInternetGatewayCommand)
      .resolves({});
    await api.createInternetGateway();
    await api.attachInternetGateway("igw-1", "vpc-1");
    await api.detachInternetGateway("igw-1", "vpc-1");
    await api.deleteInternetGateway("igw-1");
    expect(ec2.commandCalls(CreateInternetGatewayCommand)).toHaveLength(1);
    expect(ec2.commandCalls(AttachInternetGatewayCommand)[0]?.args[0].input).toEqual({
      InternetGatewayId: "igw-1",
      VpcId: "vpc-1",
    });
    expect(ec2.commandCalls(DetachInternetGatewayCommand)[0]?.args[0].input).toEqual({
      InternetGatewayId: "igw-1",
      VpcId: "vpc-1",
    });
    expect(ec2.commandCalls(DeleteInternetGatewayCommand)[0]?.args[0].input).toEqual({
      InternetGatewayId: "igw-1",
    });
  });

  it("createNatGateway (public) + deleteNatGateway send the right inputs", async () => {
    ec2.on(CreateNatGatewayCommand).resolves({}).on(DeleteNatGatewayCommand).resolves({});
    await api.createNatGateway({
      subnetId: "subnet-1",
      connectivityType: "public",
      allocationId: "eipalloc-1",
    });
    await api.deleteNatGateway("nat-1");
    expect(ec2.commandCalls(CreateNatGatewayCommand)[0]?.args[0].input).toEqual({
      SubnetId: "subnet-1",
      ConnectivityType: "public",
      AllocationId: "eipalloc-1",
    });
    expect(ec2.commandCalls(DeleteNatGatewayCommand)[0]?.args[0].input).toEqual({
      NatGatewayId: "nat-1",
    });
  });

  it("createNatGateway (private) omits the Elastic IP allocation", async () => {
    ec2.on(CreateNatGatewayCommand).resolves({});
    await api.createNatGateway({ subnetId: "subnet-1", connectivityType: "private" });
    expect(ec2.commandCalls(CreateNatGatewayCommand)[0]?.args[0].input).toEqual({
      SubnetId: "subnet-1",
      ConnectivityType: "private",
    });
  });

  it("allocateAddress requests a vpc-domain address", async () => {
    ec2.on(AllocateAddressCommand).resolves({});
    await api.allocateAddress();
    expect(ec2.commandCalls(AllocateAddressCommand)[0]?.args[0].input).toEqual({ Domain: "vpc" });
  });

  it("releaseAddress sends the allocation id", async () => {
    ec2.on(ReleaseAddressCommand).resolves({});
    await api.releaseAddress("eipalloc-1");
    expect(ec2.commandCalls(ReleaseAddressCommand)[0]?.args[0].input).toEqual({
      AllocationId: "eipalloc-1",
    });
  });
});

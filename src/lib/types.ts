import { z } from "zod";

/* ── Connection settings ── */

export const settingsSchema = z.object({
  /** Empty = use the real AWS default endpoint */
  endpoint: z.string(),
  region: z.string().min(1),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  forcePathStyle: z.boolean(),
  /** Static website hosting host (with port) */
  websiteHost: z.string(),
});

export type ConnectionSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: ConnectionSettings = {
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  accessKeyId: "test",
  secretAccessKey: "test",
  forcePathStyle: true,
  websiteHost: "s3-website.localhost.localstack.cloud:4566",
};

export type BackendKind = "localstack" | "floci" | "minio" | "moto" | "aws" | "unknown" | "none";

/** Top-level navigation sections, gated per backend (see config/backends.json) */
export type Section = "s3" | "compute" | "vpc" | "db" | "function" | "iam";

/* ── S3 domain types ── */

export const bucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);

export type BucketSummary = { name: string; creationDate: string | null };

export type ObjectSummary = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  storageClass: string | null;
};

export type FolderSummary = { prefix: string; name: string };

export type ObjectDetails = {
  key: string;
  contentType: string | null;
  contentLength: number;
  lastModified: string | null;
  etag: string | null;
  /** User-defined metadata (x-amz-meta-*) */
  metadata: Record<string, string>;
  tags: Tag[];
  /** Direct object URL (opens only if public) */
  url: string;
};

export type ListObjectsResponse = {
  bucket: string;
  prefix: string;
  folders: FolderSummary[];
  objects: ObjectSummary[];
};

/* ── Bucket properties ── */

export type VersioningStatus = "Enabled" | "Suspended" | "Disabled";
export type Tag = { key: string; value: string };

export type WebsiteConfig = {
  enabled: boolean;
  indexDocument: string;
  errorDocument: string;
  endpoint: string | null;
};

export type BucketProperties = {
  arn: string;
  versioning: { status: VersioningStatus };
  tagging: { tags: Tag[] };
  encryption: { enabled: boolean; algorithm: "AES256" | "aws:kms" | null };
  cors: { json: string | null };
  policy: { document: string | null };
  lifecycle: { json: string | null };
  website: WebsiteConfig;
};

export type UpdatePropertyInput =
  | { section: "versioning"; value: { status: "Enabled" | "Suspended" } }
  | { section: "tagging"; value: { tags: Tag[] } }
  | { section: "encryption"; value: { enabled: boolean; algorithm?: "AES256" | "aws:kms" | null } }
  | { section: "cors"; value: { json: string | null } }
  | { section: "policy"; value: { document: string | null } }
  | { section: "lifecycle"; value: { json: string | null } }
  | {
      section: "website";
      value: { enabled: boolean; indexDocument?: string; errorDocument?: string };
    };

/* ── EC2 domain types ── */

/** Instance lifecycle states reported by EC2 (State.Name) */
export type Ec2InstanceState =
  | "pending"
  | "running"
  | "shutting-down"
  | "terminated"
  | "stopping"
  | "stopped";

/** Row in the instance table */
export type Ec2InstanceSummary = {
  instanceId: string;
  /** Value of the "Name" tag, if any */
  name: string | null;
  instanceType: string | null;
  state: Ec2InstanceState;
  availabilityZone: string | null;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
};

export type Ec2NetworkInterface = {
  networkInterfaceId: string;
  subnetId: string | null;
  vpcId: string | null;
  privateIp: string | null;
  privateDns: string | null;
  publicIp: string | null;
  macAddress: string | null;
  status: string | null;
  groups: { groupId: string; groupName: string }[];
};

/** Detail shown across the Details / Networking / Tags tabs (one DescribeInstances call) */
export type Ec2InstanceDetail = {
  instanceId: string;
  name: string | null;
  instanceType: string | null;
  state: Ec2InstanceState;
  imageId: string | null;
  keyName: string | null;
  launchTime: string | null;
  availabilityZone: string | null;
  vpcId: string | null;
  subnetId: string | null;
  architecture: string | null;
  platform: string | null;
  rootDeviceName: string | null;
  rootDeviceType: string | null;
  monitoring: string | null;
  iamInstanceProfileArn: string | null;
  /** IMDSv2 enforcement: HttpTokens (required/optional) */
  metadataHttpTokens: string | null;
  metadataHopLimit: number | null;
  publicIp: string | null;
  publicDns: string | null;
  privateIp: string | null;
  privateDns: string | null;
  securityGroups: { groupId: string; groupName: string }[];
  networkInterfaces: Ec2NetworkInterface[];
  tags: Tag[];
};

export type Ec2SgRule = {
  /** IP protocol; "-1" means all */
  protocol: string;
  fromPort: number | null;
  toPort: number | null;
  /** CIDR or referenced security group id */
  source: string;
};

export type Ec2SecurityGroup = {
  groupId: string;
  groupName: string;
  description: string | null;
  vpcId: string | null;
  inbound: Ec2SgRule[];
  outbound: Ec2SgRule[];
};

/** Input for adding/removing a security-group rule */
export type SgRuleInput = {
  direction: "ingress" | "egress";
  /** "-1" = all protocols */
  protocol: string;
  fromPort: number | null;
  toPort: number | null;
  /** CIDR (e.g. 0.0.0.0/0) */
  cidr: string;
};

export type CreateSecurityGroupInput = {
  groupName: string;
  description: string;
  vpcId?: string;
};

export type Ec2Volume = {
  volumeId: string;
  deviceName: string | null;
  /** Size in GiB */
  size: number;
  volumeType: string | null;
  iops: number | null;
  throughput: number | null;
  encrypted: boolean;
  state: string | null;
  deleteOnTermination: boolean | null;
  attachState: string | null;
};

/** Row in the standalone Volumes list (not scoped to a single instance) */
export type Ec2VolumeSummary = {
  volumeId: string;
  /** Size in GiB */
  size: number;
  volumeType: string | null;
  iops: number | null;
  throughput: number | null;
  state: string | null;
  encrypted: boolean;
  availabilityZone: string | null;
  createTime: string | null;
  attachments: { instanceId: string; device: string | null; state: string | null }[];
};

/** Instance lifecycle action triggered from the UI */
export type Ec2InstanceAction = "start" | "stop" | "reboot" | "terminate";

export type Ec2KeyPairSummary = {
  keyPairId: string;
  keyName: string;
  keyType: string | null;
  fingerprint: string | null;
  createTime: string | null;
};

export type Ec2SubnetSummary = {
  subnetId: string;
  vpcId: string | null;
  cidrBlock: string | null;
  availabilityZone: string | null;
  availableIpCount: number | null;
  name: string | null;
};

/* ── ELBv2 (ALB/NLB) domain types ── */

export type AlbSummary = {
  arn: string;
  name: string;
  type: string | null;
  scheme: string | null;
  state: string | null;
  dnsName: string | null;
  vpcId: string | null;
  availabilityZones: string[];
  createdTime: string | null;
};

/** Editable load-balancer attributes (Describe/ModifyLoadBalancerAttributes) */
export type AlbAttributes = {
  idleTimeoutSeconds: number;
  deletionProtection: boolean;
  http2Enabled: boolean;
};

export type AlbRuleSummary = {
  arn: string;
  isDefault: boolean;
  /** "default" or a numeric priority string */
  priority: string;
  conditions: string[];
  actions: string[];
};

export type CreateRuleInput = {
  listenerArn: string;
  priority: number;
  /** path-pattern | host-header */
  conditionField: "path-pattern" | "host-header";
  /** comma-separated values, e.g. "/api/*" or "api.example.com" */
  values: string;
  targetGroupArn: string;
};

export type AlbListenerDetail = {
  arn: string;
  port: number | null;
  protocol: string | null;
  defaultActionType: string | null;
  rules: AlbRuleSummary[];
};

export type TargetGroupSummary = {
  arn: string;
  name: string;
  protocol: string | null;
  port: number | null;
  targetType: string | null;
  vpcId: string | null;
  healthCheckPath: string | null;
  healthCheckProtocol: string | null;
  healthCheckIntervalSeconds: number | null;
  healthCheckTimeoutSeconds: number | null;
  healthyThreshold: number | null;
  unhealthyThreshold: number | null;
  /** Success matcher HTTP codes (e.g. "200" or "200-299") */
  matcherHttpCode: string | null;
  loadBalancerArns: string[];
};

/** Editable health-check config (ModifyTargetGroup) */
export type TgHealthCheckInput = {
  path: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  /** Success codes, e.g. "200" or "200,302" */
  matcherHttpCode: string;
};

/** Editable target-group attributes (DescribeTargetGroupAttributes key/values) */
export type TargetGroupAttributes = {
  stickinessEnabled: boolean;
  /** lb_cookie | app_cookie | source_ip */
  stickinessType: string;
  stickinessDurationSeconds: number;
  deregistrationDelaySeconds: number;
  /** round_robin | least_outstanding_requests */
  loadBalancingAlgorithm: string;
};

export type TargetHealthEntry = {
  id: string;
  port: number | null;
  state: string | null;
  reason: string | null;
  description: string | null;
};

export type CreateTargetGroupInput = {
  name: string;
  protocol: string;
  port: number;
  targetType: "instance" | "ip";
  vpcId?: string;
  healthCheckPath?: string;
};

export type CreateAlbInput = {
  name: string;
  scheme: "internet-facing" | "internal";
  type: "application" | "network";
  subnetIds: string[];
  securityGroupIds: string[];
};

/** A listener's default action: forward to a target group, or return a fixed response. */
export type ListenerDefaultAction =
  | { type: "forward"; targetGroupArn: string }
  | { type: "fixed-response"; statusCode: string; contentType: string; body: string };

export type CreateListenerInput = {
  loadBalancerArn: string;
  protocol: string;
  port: number;
  action: ListenerDefaultAction;
};

/* ── Auto Scaling domain types ── */

export type AsgSummary = {
  name: string;
  arn: string | null;
  minSize: number;
  maxSize: number;
  desiredCapacity: number;
  instanceCount: number;
  healthCheckType: string | null;
  launchTemplate: string | null;
  availabilityZones: string[];
  targetGroupArns: string[];
  createdTime: string | null;
};

export type AsgInstance = {
  instanceId: string;
  lifecycleState: string | null;
  healthStatus: string | null;
  availabilityZone: string | null;
};

export type AsgPolicy = {
  name: string;
  type: string | null;
  metric: string | null;
  targetValue: number | null;
};

export type AsgScheduledAction = {
  name: string;
  recurrence: string | null;
  minSize: number | null;
  maxSize: number | null;
  desiredCapacity: number | null;
  startTime: string | null;
};

export type AsgDetail = AsgSummary & {
  instances: AsgInstance[];
  policies: AsgPolicy[];
  scheduledActions: AsgScheduledAction[];
};

export type CreateAsgInput = {
  name: string;
  launchTemplateId: string;
  minSize: number;
  maxSize: number;
  desiredCapacity: number;
  /** Subnet IDs (VPCZoneIdentifier) */
  subnetIds: string[];
  targetGroupArns: string[];
};

export type AsgCapacityInput = {
  minSize: number;
  maxSize: number;
  desiredCapacity: number;
};

/** Target-tracking predefined metric supported by the policy form */
export type AsgPredefinedMetric = "ASGAverageCPUUtilization" | "ALBRequestCountPerTarget";

/** Input for a target-tracking scaling policy (PutScalingPolicy) */
export type PutScalingPolicyInput = {
  asgName: string;
  policyName: string;
  metricType: AsgPredefinedMetric;
  targetValue: number;
  /** Required by AWS for ALBRequestCountPerTarget; optional in the UI */
  resourceLabel?: string;
};

/** Input for a scheduled action (PutScheduledUpdateGroupAction) */
export type PutScheduledActionInput = {
  asgName: string;
  name: string;
  recurrence: string;
  minSize?: number;
  maxSize?: number;
  desiredCapacity?: number;
};

/* ── Launch templates ── */

export type Ec2LaunchTemplateSummary = {
  launchTemplateId: string;
  launchTemplateName: string;
  defaultVersionNumber: number | null;
  latestVersionNumber: number | null;
  createTime: string | null;
};

export type Ec2LaunchTemplateVersionDetail = {
  versionNumber: number | null;
  imageId: string | null;
  instanceType: string | null;
  keyName: string | null;
  securityGroupIds: string[];
  securityGroups: string[];
  iamInstanceProfileArn: string | null;
  /** IMDSv2 enforcement (HttpTokens: required/optional) */
  metadataHttpTokens: string | null;
  metadataHopLimit: number | null;
  userDataPresent: boolean;
  blockDevices: {
    deviceName: string | null;
    size: number | null;
    volumeType: string | null;
    encrypted: boolean | null;
  }[];
};

/** Input for creating a launch template (CreateLaunchTemplate, minimal LaunchTemplateData) */
export type CreateLaunchTemplateInput = {
  name: string;
  imageId: string;
  instanceType: string;
  keyName?: string;
  securityGroupIds?: string[];
};

/** Input for creating an EBS volume (CreateVolume) */
export type CreateVolumeInput = {
  availabilityZone: string;
  /** Size in GiB */
  size: number;
  volumeType: string;
  iops?: number;
  encrypted: boolean;
};

/** Input for launching new instances (RunInstances) */
export type Ec2LaunchInput = {
  imageId: string;
  instanceType: string;
  count: number;
  /** Applied as the "Name" tag */
  name?: string;
  keyName?: string;
  securityGroupIds?: string[];
  subnetId?: string;
  /** IAM instance profile name to attach (IamInstanceProfile.Name) */
  iamInstanceProfileName?: string;
};

/* ── VPC domain types ── */

/** An IPv4 CIDR block associated with a VPC (CidrBlockAssociationSet) */
export type VpcCidrAssociation = { cidrBlock: string; state: string | null };

/** An IPv6 CIDR block associated with a VPC (Ipv6CidrBlockAssociationSet) */
export type VpcIpv6CidrAssociation = { ipv6CidrBlock: string; state: string | null };

/** Row in the VPCs table */
export type VpcSummary = {
  vpcId: string;
  cidrBlock: string | null;
  state: string | null;
  isDefault: boolean;
  /** Value of the "Name" tag, if any */
  name: string | null;
  /** Raw tags, for the detail-panel editor */
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  ownerId: string | null;
  /** default | dedicated | host */
  instanceTenancy: string | null;
  dhcpOptionsId: string | null;
  /** All IPv4 CIDR associations (includes the primary cidrBlock) */
  cidrAssociations: VpcCidrAssociation[];
  ipv6CidrAssociations: VpcIpv6CidrAssociation[];
};

/** Row in the Subnets table */
export type SubnetSummary = {
  subnetId: string;
  vpcId: string | null;
  cidrBlock: string | null;
  availabilityZone: string | null;
  availableIpCount: number | null;
  state: string | null;
  name: string | null;
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  ownerId: string | null;
  availabilityZoneId: string | null;
  defaultForAz: boolean;
  mapPublicIpOnLaunch: boolean;
  assignIpv6AddressOnCreation: boolean;
  /** IPv6 CIDR blocks associated with the subnet */
  ipv6CidrBlocks: string[];
  enableDns64: boolean;
};

export type CreateSubnetInput = {
  vpcId: string;
  cidrBlock: string;
  availabilityZone?: string;
};

/** A subnet/gateway association within a route table (RouteTable.Associations) */
export type RouteTableAssociation = {
  subnetId: string | null;
  main: boolean;
  state: string | null;
};

/** A single route within a route table */
export type RouteEntry = {
  /** Destination CIDR (IPv4/IPv6) or prefix-list id */
  destination: string;
  /** Resolved target (gateway / nat / instance / eni / "local" …) */
  target: string;
  state: string | null;
};

/** Row in the Route tables table */
export type RouteTableSummary = {
  routeTableId: string;
  vpcId: string | null;
  /** True when this is the VPC's main route table */
  main: boolean;
  /** Number of subnet/gateway associations */
  associationCount: number;
  routes: RouteEntry[];
  name: string | null;
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  ownerId: string | null;
  /** Subnet/gateway associations (detail of the count) */
  associations: RouteTableAssociation[];
  /** Propagating virtual private gateway ids */
  propagatingVgws: string[];
};

export type CreateRouteInput = {
  routeTableId: string;
  destinationCidrBlock: string;
  gatewayId: string;
};

/** Row in the Internet gateways table */
export type InternetGatewaySummary = {
  internetGatewayId: string;
  attachments: { vpcId: string; state: string | null }[];
  name: string | null;
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  ownerId: string | null;
};

/** A NAT gateway address binding (NatGateway.NatGatewayAddresses) */
export type NatGatewayAddress = {
  publicIp: string | null;
  privateIp: string | null;
  allocationId: string | null;
  networkInterfaceId: string | null;
};

/** Row in the NAT gateways table */
export type NatGatewaySummary = {
  natGatewayId: string;
  subnetId: string | null;
  vpcId: string | null;
  state: string | null;
  /** public | private */
  type: string | null;
  publicIp: string | null;
  name: string | null;
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  createdTime: string | null;
  deleteTime: string | null;
  failureMessage: string | null;
  /** All address bindings (the list shows only the first public IP) */
  addresses: NatGatewayAddress[];
};

export type CreateNatGatewayInput = {
  subnetId: string;
  connectivityType: "public" | "private";
  /** Required for public NAT gateways; omitted for private */
  allocationId?: string;
};

/** Row in the Elastic IPs table (DescribeAddresses) */
export type ElasticIpSummary = {
  allocationId: string;
  publicIp: string | null;
  /** vpc | standard */
  domain: string | null;
  /** Resource the EIP is associated with, or null when unassociated */
  association: {
    instanceId: string | null;
    networkInterfaceId: string | null;
    privateIpAddress: string | null;
  } | null;
  name: string | null;
  tags: Tag[];
  /* ── detail-panel-only fields (not shown in the list) ── */
  networkBorderGroup: string | null;
  publicIpv4Pool: string | null;
};

/* ── IAM domain types ── */

/** Row in the IAM roles table */
export type IamRoleSummary = {
  roleName: string;
  arn: string;
  path: string;
  createDate: string | null;
  description: string | null;
  /** Trust policy (assume-role) document, URL-decoded; null when absent */
  assumeRolePolicyDocument: string | null;
};

/** Input for creating an IAM role (AssumeRolePolicyDocument is required) */
export type CreateRoleInput = {
  roleName: string;
  path?: string;
  /** Trust policy document (JSON string) */
  assumeRolePolicyDocument: string;
};

/** Row in the IAM instance profiles table */
export type IamInstanceProfileSummary = {
  instanceProfileName: string;
  arn: string;
  path: string;
  createDate: string | null;
  roleNames: string[];
};

/** Input for creating an instance profile */
export type CreateInstanceProfileInput = {
  instanceProfileName: string;
  path?: string;
};

/** A managed policy attached to a role (ListAttachedRolePolicies) */
export type AttachedPolicy = {
  policyName: string;
  policyArn: string;
};

/** An inline policy document fetched for a role (GetRolePolicy) */
export type InlinePolicyDocument = {
  policyName: string;
  /** Policy document (JSON string, URL-decoded if the backend returns it encoded) */
  document: string;
};

/** Row in the managed policies table (ListPolicies) */
export type IamPolicySummary = {
  policyName: string;
  arn: string;
  path: string;
  attachmentCount: number;
  /** True when the ARN is under aws: (an AWS-managed policy) */
  isAwsManaged: boolean;
  createDate: string | null;
};

/** Scope filter for ListPolicies */
export type PolicyScope = "Local" | "AWS" | "All";

/** Input for creating a managed policy (CreatePolicy) */
export type CreatePolicyInput = {
  policyName: string;
  path?: string;
  /** Policy document (JSON string) */
  document: string;
};

/** A managed policy's default-version document (GetPolicy + GetPolicyVersion) */
export type IamPolicyDetail = {
  policyName: string;
  arn: string;
  path: string;
  defaultVersionId: string | null;
  attachmentCount: number;
  isAwsManaged: boolean;
  createDate: string | null;
  updateDate: string | null;
  /** Default-version policy document (JSON string, URL-decoded), or null */
  document: string | null;
};

/* ── RDS ── */

/** Row in the DB clusters table (DescribeDBClusters) */
export type DbClusterSummary = {
  dbClusterIdentifier: string;
  engine: string | null;
  engineVersion: string | null;
  status: string | null;
  endpoint: string | null;
  multiAZ: boolean;
  /** ARN, needed for the tagging APIs */
  arn: string | null;
  /** Reader endpoint (Aurora) */
  readerEndpoint: string | null;
  port: number | null;
  availabilityZones: string[];
  storageEncrypted: boolean;
  parameterGroup: string | null;
  backupRetentionPeriod: number | null;
  preferredBackupWindow: string | null;
  preferredMaintenanceWindow: string | null;
  createdTime: string | null;
  /** Member DB instance identifiers, with role flag */
  members: { dbInstanceIdentifier: string; isWriter: boolean }[];
};

/** Input for creating a DB cluster (CreateDBCluster) */
export type CreateDbClusterInput = {
  dbClusterIdentifier: string;
  engine: string;
  engineVersion?: string;
  masterUsername: string;
  masterUserPassword: string;
};

/** Row in the DB instances table (DescribeDBInstances) */
export type DbInstanceSummary = {
  dbInstanceIdentifier: string;
  engine: string | null;
  engineVersion: string | null;
  dbInstanceClass: string | null;
  status: string | null;
  endpoint: string | null;
  port: number | null;
  allocatedStorage: number | null;
  storageType: string | null;
  storageEncrypted: boolean;
  multiAZ: boolean;
  availabilityZone: string | null;
  publiclyAccessible: boolean;
  parameterGroup: string | null;
  backupRetentionPeriod: number | null;
  preferredBackupWindow: string | null;
  preferredMaintenanceWindow: string | null;
  createdTime: string | null;
  /** ARN, needed for the tagging APIs */
  arn: string | null;
};

/** Input for creating a DB instance (CreateDBInstance) */
export type CreateDbInstanceInput = {
  dbInstanceIdentifier: string;
  engine: string;
  dbInstanceClass: string;
  allocatedStorage: number;
  masterUsername: string;
  masterUserPassword: string;
};

/* ── ElastiCache ── */

/** Row in the cache clusters table (DescribeCacheClusters) */
export type CacheClusterSummary = {
  cacheClusterId: string;
  engine: string | null;
  engineVersion: string | null;
  status: string | null;
  nodeType: string | null;
  numCacheNodes: number | null;
  endpoint: string | null;
  port: number | null;
  /** ARN, needed for the tagging APIs */
  arn: string | null;
  parameterGroup: string | null;
  subnetGroup: string | null;
  securityGroups: string[];
  preferredMaintenanceWindow: string | null;
  snapshotRetentionLimit: number | null;
  snapshotWindow: string | null;
  availabilityZone: string | null;
  createdTime: string | null;
};

/** Input for creating a cache cluster (CreateCacheCluster) */
export type CreateCacheClusterInput = {
  cacheClusterId: string;
  engine: string;
  cacheNodeType: string;
  numCacheNodes: number;
};

/** Flattened cache node across clusters (DescribeCacheClusters ShowCacheNodeInfo) */
export type CacheNodeSummary = {
  cacheClusterId: string;
  cacheNodeId: string;
  status: string | null;
  address: string | null;
  port: number | null;
  availabilityZone: string | null;
};

/* ── Lambda ── */

/** Row in the functions table (ListFunctions) */
export type LambdaFunctionSummary = {
  functionName: string;
  runtime: string | null;
  handler: string | null;
  memorySize: number | null;
  timeout: number | null;
  /** Deployment package size in bytes */
  codeSize: number | null;
  lastModified: string | null;
  architectures: string[];
  /** Zip | Image */
  packageType: string | null;
};

/** Function configuration detail (GetFunctionConfiguration, plus optional code URL) */
export type LambdaFunctionDetail = {
  functionName: string;
  runtime: string | null;
  handler: string | null;
  memorySize: number | null;
  timeout: number | null;
  codeSize: number | null;
  lastModified: string | null;
  architectures: string[];
  packageType: string | null;
  role: string | null;
  description: string | null;
  /** Function lifecycle State (Active/Pending/Failed/Inactive) */
  state: string | null;
  /** Status of the last update (Successful/Failed/InProgress) */
  lastUpdateStatus: string | null;
  /** Environment variables, as a flat record */
  environment: Record<string, string>;
  /** Pre-signed deployment package URL (Code.Location), when available */
  codeLocation: string | null;
};

/** Input for creating a function (CreateFunction). `code` is a raw zip's bytes. */
export type CreateFunctionInput = {
  functionName: string;
  runtime: string;
  handler: string;
  /** Execution role ARN */
  role: string;
  /** Deployment package bytes (a zip), passed as Code.ZipFile */
  code: Uint8Array;
  memorySize?: number;
  timeout?: number;
  description?: string;
  environment?: Record<string, string>;
};

/** Editable configuration fields (UpdateFunctionConfiguration) */
export type UpdateFunctionConfigInput = {
  functionName: string;
  memorySize?: number;
  timeout?: number;
  handler?: string;
  description?: string;
};

/** Row in the layers table (ListLayers) */
export type LambdaLayerSummary = {
  layerName: string;
  latestVersion: number | null;
  latestVersionArn: string | null;
  compatibleRuntimes: string[];
  createdDate: string | null;
};

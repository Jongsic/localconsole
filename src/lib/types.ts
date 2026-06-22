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
  website: WebsiteConfig;
};

export type UpdatePropertyInput =
  | { section: "versioning"; value: { status: "Enabled" | "Suspended" } }
  | { section: "tagging"; value: { tags: Tag[] } }
  | { section: "encryption"; value: { enabled: boolean; algorithm?: "AES256" | "aws:kms" | null } }
  | { section: "cors"; value: { json: string | null } }
  | { section: "policy"; value: { document: string | null } }
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

import {
  Boxes,
  Cpu,
  Database,
  Globe,
  HardDrive,
  IdCard,
  KeyRound,
  Layers,
  LayoutTemplate,
  MapPin,
  Network,
  Route,
  ScrollText,
  Server,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCog,
  Waypoints,
  Zap,
} from "lucide-react";
import type { SubNavItem } from "@/components/section-layout";

export const COMPUTE_ITEMS: SubNavItem[] = [
  { path: "instances", labelKey: "compute.instances", icon: Server, comingSoon: false },
  {
    path: "security-groups",
    labelKey: "compute.securityGroups",
    icon: ShieldCheck,
    comingSoon: false,
  },
  { path: "volumes", labelKey: "compute.volumes", icon: HardDrive, comingSoon: false },
  { path: "key-pairs", labelKey: "compute.keyPairs", icon: KeyRound, comingSoon: false },
  {
    path: "launch-templates",
    labelKey: "compute.launchTemplates",
    icon: LayoutTemplate,
    comingSoon: false,
  },
  { path: "load-balancers", labelKey: "compute.loadBalancers", icon: Network, comingSoon: false },
  { path: "target-groups", labelKey: "compute.targetGroups", icon: Target, comingSoon: false },
  { path: "asg", labelKey: "compute.asg", icon: TrendingUp, comingSoon: false },
];

export const VPC_ITEMS: SubNavItem[] = [
  { path: "vpcs", labelKey: "vpc.vpcs", icon: Network, comingSoon: false },
  { path: "subnets", labelKey: "vpc.subnets", icon: Boxes, comingSoon: false },
  { path: "route-tables", labelKey: "vpc.routeTables", icon: Route, comingSoon: false },
  {
    path: "internet-gateways",
    labelKey: "vpc.internetGateways",
    icon: Globe,
    comingSoon: false,
  },
  { path: "nat-gateways", labelKey: "vpc.natGateways", icon: Waypoints, comingSoon: false },
  { path: "elastic-ips", labelKey: "vpc.elasticIps", icon: MapPin, comingSoon: false },
];

export const DBCACHE_ITEMS: SubNavItem[] = [
  {
    path: "db-clusters",
    labelKey: "dbcache.dbClusters",
    icon: Database,
    comingSoon: false,
    group: "dbcache.rds",
  },
  {
    path: "db-instances",
    labelKey: "dbcache.dbInstances",
    icon: Server,
    comingSoon: false,
    group: "dbcache.rds",
  },
  {
    path: "cache-clusters",
    labelKey: "dbcache.cacheClusters",
    icon: Layers,
    comingSoon: false,
    group: "dbcache.cache",
  },
  {
    path: "cache-nodes",
    labelKey: "dbcache.cacheNodes",
    icon: Cpu,
    comingSoon: false,
    group: "dbcache.cache",
  },
];

export const IAM_ITEMS: SubNavItem[] = [
  { path: "roles", labelKey: "iam.roles", icon: UserCog, comingSoon: false },
  {
    path: "instance-profiles",
    labelKey: "iam.instanceProfiles",
    icon: IdCard,
    comingSoon: false,
  },
  { path: "policies", labelKey: "iam.policies", icon: ScrollText, comingSoon: false },
];

export const FUNCTION_ITEMS: SubNavItem[] = [
  { path: "functions", labelKey: "function.functions", icon: Zap, comingSoon: false },
  { path: "layers", labelKey: "function.layers", icon: Layers, comingSoon: false },
];

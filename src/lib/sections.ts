import {
  Boxes,
  Cpu,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  LayoutTemplate,
  Network,
  Route,
  Server,
  ShieldCheck,
  Target,
  TrendingUp,
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
  { path: "vpcs", labelKey: "vpc.vpcs", icon: Network, comingSoon: true },
  { path: "subnets", labelKey: "vpc.subnets", icon: Boxes, comingSoon: true },
  { path: "route-tables", labelKey: "vpc.routeTables", icon: Route, comingSoon: true },
  {
    path: "internet-gateways",
    labelKey: "vpc.internetGateways",
    icon: Globe,
    comingSoon: true,
  },
  { path: "nat-gateways", labelKey: "vpc.natGateways", icon: Waypoints, comingSoon: true },
];

export const DBCACHE_ITEMS: SubNavItem[] = [
  {
    path: "db-clusters",
    labelKey: "dbcache.dbClusters",
    icon: Database,
    comingSoon: true,
    group: "dbcache.rds",
  },
  {
    path: "db-instances",
    labelKey: "dbcache.dbInstances",
    icon: Server,
    comingSoon: true,
    group: "dbcache.rds",
  },
  {
    path: "cache-clusters",
    labelKey: "dbcache.cacheClusters",
    icon: Layers,
    comingSoon: true,
    group: "dbcache.cache",
  },
  {
    path: "cache-nodes",
    labelKey: "dbcache.cacheNodes",
    icon: Cpu,
    comingSoon: true,
    group: "dbcache.cache",
  },
];

export const FUNCTION_ITEMS: SubNavItem[] = [
  { path: "functions", labelKey: "function.functions", icon: Zap, comingSoon: true },
  { path: "layers", labelKey: "function.layers", icon: Layers, comingSoon: true },
];

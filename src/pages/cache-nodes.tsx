import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PageHeader,
  ResourceTable,
  StatusBadge,
  type StatusTone,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { api } from "@/lib/elasticache-api";
import type { CacheNodeSummary } from "@/lib/types";

/** ElastiCache node statuses that resolve on their own → worth polling for. */
const TRANSITIONAL_STATES = new Set(["creating", "modifying", "deleting", "rebooting"]);

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  creating: "amber",
  modifying: "amber",
  rebooting: "amber",
  deleting: "neutral",
};

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <>—</>;
  return <StatusBadge tone={STATE_TONES[status] ?? "neutral"}>{status}</StatusBadge>;
}

export function CacheNodesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const nodes = useQuery({
    queryKey: ["cache-nodes"],
    queryFn: api.listCacheNodes,
    refetchInterval: (q) =>
      q.state.data?.some((n) => n.status && TRANSITIONAL_STATES.has(n.status)) ? 4000 : false,
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Cpu}
        title={t("dbcache.cacheNode.heading")}
        subtitle={t("dbcache.cacheNode.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["cache-nodes"] })}
        refreshing={nodes.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={nodes.isLoading}
          isError={nodes.isError}
          error={nodes.error}
          service="ElastiCache"
          data={nodes.data}
          getKey={(n) => `${n.cacheClusterId}/${n.cacheNodeId}`}
          empty={{ icon: Cpu, message: t("dbcache.cacheNode.none") }}
          head={
            <tr>
              <Th>{t("dbcache.cacheNode.col.cluster")}</Th>
              <Th>{t("dbcache.cacheNode.col.id")}</Th>
              <Th>{t("dbcache.cacheNode.col.status")}</Th>
              <Th>{t("dbcache.cacheNode.col.address")}</Th>
              <Th>{t("dbcache.cacheNode.col.port")}</Th>
              <Th>{t("dbcache.cacheNode.col.az")}</Th>
            </tr>
          }
          row={(n: CacheNodeSummary) => (
            <Tr key={`${n.cacheClusterId}/${n.cacheNodeId}`}>
              <Td className="font-medium text-slate-700">{n.cacheClusterId}</Td>
              <Td mono>{n.cacheNodeId}</Td>
              <Td>
                <StatusCell status={n.status} />
              </Td>
              <Td mono>{n.address ?? "—"}</Td>
              <Td>{n.port ?? "—"}</Td>
              <Td>{n.availabilityZone ?? "—"}</Td>
            </Tr>
          )}
        />
      </div>
    </div>
  );
}

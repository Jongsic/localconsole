import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DefinitionGrid,
  KV,
  PageHeader,
  PanelHeader,
  ResourceTable,
  StatusBadge,
  type StatusTone,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { ResourceTagsCard } from "@/components/resource-tags-card";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/elasticache-api";
import type { CacheClusterSummary } from "@/lib/types";

const ENGINES = ["redis", "valkey", "memcached"];

/** ElastiCache statuses that resolve on their own → worth polling for. */
const TRANSITIONAL_STATES = new Set(["creating", "deleting", "modifying", "rebooting"]);

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  creating: "amber",
  modifying: "amber",
  rebooting: "amber",
  deleting: "neutral",
  "delete-failed": "red",
};

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <>—</>;
  return <StatusBadge tone={STATE_TONES[status] ?? "neutral"}>{status}</StatusBadge>;
}

export function CacheClustersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CacheClusterSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const clusters = useQuery({
    queryKey: ["cache-clusters"],
    queryFn: api.listCacheClusters,
    refetchInterval: (q) =>
      q.state.data?.some((c) => c.status && TRANSITIONAL_STATES.has(c.status)) ? 4000 : false,
  });
  const current = clusters.data?.find((c) => c.cacheClusterId === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteCacheCluster(id),
    onSuccess: (_d, id) => {
      toast.success(t("dbcache.cacheCluster.deleted", { id }));
      qc.invalidateQueries({ queryKey: ["cache-clusters"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Layers}
        title={t("dbcache.cacheCluster.heading")}
        subtitle={t("dbcache.cacheCluster.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["cache-clusters"] })}
        refreshing={clusters.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("dbcache.cacheCluster.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={clusters.isLoading}
          isError={clusters.isError}
          error={clusters.error}
          service="ElastiCache"
          data={clusters.data}
          getKey={(c) => c.cacheClusterId}
          empty={{ icon: Layers, message: t("dbcache.cacheCluster.none") }}
          head={
            <tr>
              <Th>{t("dbcache.cacheCluster.col.id")}</Th>
              <Th>{t("dbcache.cacheCluster.col.engine")}</Th>
              <Th>{t("dbcache.cacheCluster.col.version")}</Th>
              <Th>{t("dbcache.cacheCluster.col.status")}</Th>
              <Th>{t("dbcache.cacheCluster.col.nodeType")}</Th>
              <Th>{t("dbcache.cacheCluster.col.nodes")}</Th>
              <Th>{t("dbcache.cacheCluster.col.endpoint")}</Th>
              <Th />
            </tr>
          }
          row={(c: CacheClusterSummary) => (
            <Tr
              key={c.cacheClusterId}
              onClick={() => setSelected(c.cacheClusterId)}
              selected={selected === c.cacheClusterId}
            >
              <Td className="font-medium text-slate-700">{c.cacheClusterId}</Td>
              <Td>{c.engine ?? "—"}</Td>
              <Td>{c.engineVersion ?? "—"}</Td>
              <Td>
                <StatusCell status={c.status} />
              </Td>
              <Td mono>{c.nodeType ?? "—"}</Td>
              <Td>{c.numCacheNodes ?? "—"}</Td>
              <Td mono>{c.endpoint ?? "—"}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(c);
                  }}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      {current && (
        <CacheClusterDetailPanel
          key={current.cacheClusterId}
          cluster={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateCacheClusterModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("dbcache.cacheCluster.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("dbcache.cacheCluster.deleteConfirm", { id: deleteTarget?.cacheClusterId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.cacheClusterId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CacheClusterDetailPanel({
  cluster,
  onClose,
}: {
  cluster: CacheClusterSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_cachecluster">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-semibold text-slate-900">{cluster.cacheClusterId}</span>
        <StatusCell status={cluster.status} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("dbcache.cacheCluster.col.engine")} value={cluster.engine} />
          <KV label={t("dbcache.cacheCluster.col.version")} value={cluster.engineVersion} />
          <KV label={t("dbcache.cacheCluster.col.status")}>
            <StatusCell status={cluster.status} />
          </KV>
          <KV label={t("dbcache.cacheCluster.col.nodeType")} value={cluster.nodeType} mono />
          <KV
            label={t("dbcache.cacheCluster.col.nodes")}
            value={cluster.numCacheNodes != null ? String(cluster.numCacheNodes) : null}
          />
          <KV label={t("dbcache.cacheCluster.col.endpoint")} value={cluster.endpoint} mono />
          <KV
            label={t("dbcache.cacheCluster.detail.port")}
            value={cluster.port != null ? String(cluster.port) : null}
          />
          <KV
            label={t("dbcache.cacheCluster.detail.parameterGroup")}
            value={cluster.parameterGroup}
          />
          <KV label={t("dbcache.cacheCluster.detail.subnetGroup")} value={cluster.subnetGroup} />
          <KV
            label={t("dbcache.cacheCluster.detail.securityGroups")}
            value={cluster.securityGroups.join(", ") || null}
          />
          <KV
            label={t("dbcache.cacheCluster.detail.maintenanceWindow")}
            value={cluster.preferredMaintenanceWindow}
          />
          <KV
            label={t("dbcache.cacheCluster.detail.snapshotRetention")}
            value={
              cluster.snapshotRetentionLimit != null ? String(cluster.snapshotRetentionLimit) : null
            }
          />
          <KV
            label={t("dbcache.cacheCluster.detail.snapshotWindow")}
            value={cluster.snapshotWindow}
          />
          <KV label={t("dbcache.cacheCluster.detail.az")} value={cluster.availabilityZone} />
          <KV label={t("dbcache.cacheCluster.detail.created")} value={cluster.createdTime} />
          <KV label={t("dbcache.cacheCluster.detail.arn")} value={cluster.arn} mono />
        </DefinitionGrid>

        {cluster.arn && (
          <ResourceTagsCard arn={cluster.arn} getTags={api.getTags} saveTags={api.saveTags} />
        )}
      </div>
    </ResizableBottomPanel>
  );
}

function CreateCacheClusterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [cacheClusterId, setCacheClusterId] = useState("");
  const [engine, setEngine] = useState("redis");
  const [cacheNodeType, setCacheNodeType] = useState("cache.t3.micro");
  const [numCacheNodes, setNumCacheNodes] = useState(1);

  const create = useMutation({
    mutationFn: () =>
      api.createCacheCluster({
        cacheClusterId: cacheClusterId.trim(),
        engine,
        cacheNodeType: cacheNodeType.trim(),
        numCacheNodes,
      }),
    onSuccess: () => {
      toast.success(t("dbcache.cacheCluster.created", { id: cacheClusterId }));
      qc.invalidateQueries({ queryKey: ["cache-clusters"] });
      setCacheClusterId("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid = cacheClusterId.trim() !== "" && cacheNodeType.trim() !== "" && numCacheNodes >= 1;

  return (
    <Modal open={open} onClose={onClose} title={t("dbcache.cacheCluster.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("dbcache.cacheCluster.col.id")}>
          <TextInput
            value={cacheClusterId}
            onChange={(e) => setCacheClusterId(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("dbcache.cacheCluster.engine")}>
          <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
            {ENGINES.map((en) => (
              <option key={en} value={en}>
                {en}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dbcache.cacheCluster.nodeType")}>
          <TextInput
            value={cacheNodeType}
            onChange={(e) => setCacheNodeType(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t("dbcache.cacheCluster.numNodes")}>
          <TextInput
            type="number"
            min={1}
            value={numCacheNodes}
            onChange={(e) => setNumCacheNodes(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

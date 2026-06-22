import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
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
import { api } from "@/lib/rds-api";
import type { DbClusterSummary } from "@/lib/types";

const ENGINES = ["aurora-mysql", "aurora-postgresql"];

/** RDS statuses that resolve on their own → worth polling for. */
const TRANSITIONAL_STATES = new Set(["creating", "deleting", "modifying", "backing-up"]);

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  creating: "amber",
  modifying: "amber",
  "backing-up": "amber",
  deleting: "neutral",
  stopped: "neutral",
  failed: "red",
};

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <>—</>;
  return <StatusBadge tone={STATE_TONES[status] ?? "neutral"}>{status}</StatusBadge>;
}

export function RdsClustersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbClusterSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const clusters = useQuery({
    queryKey: ["db-clusters"],
    queryFn: api.listDbClusters,
    refetchInterval: (q) =>
      q.state.data?.some((c) => c.status && TRANSITIONAL_STATES.has(c.status)) ? 4000 : false,
  });
  const current = clusters.data?.find((c) => c.dbClusterIdentifier === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteDbCluster(id),
    onSuccess: (_d, id) => {
      toast.success(t("dbcache.cluster.deleted", { id }));
      qc.invalidateQueries({ queryKey: ["db-clusters"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Database}
        title={t("dbcache.cluster.heading")}
        subtitle={t("dbcache.cluster.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["db-clusters"] })}
        refreshing={clusters.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("dbcache.cluster.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={clusters.isLoading}
          isError={clusters.isError}
          error={clusters.error}
          service="RDS"
          data={clusters.data}
          getKey={(c) => c.dbClusterIdentifier}
          empty={{ icon: Database, message: t("dbcache.cluster.none") }}
          head={
            <tr>
              <Th>{t("dbcache.cluster.col.id")}</Th>
              <Th>{t("dbcache.cluster.col.engine")}</Th>
              <Th>{t("dbcache.cluster.col.version")}</Th>
              <Th>{t("dbcache.cluster.col.status")}</Th>
              <Th>{t("dbcache.cluster.col.endpoint")}</Th>
              <Th>{t("dbcache.cluster.col.multiAZ")}</Th>
              <Th />
            </tr>
          }
          row={(c: DbClusterSummary) => (
            <Tr
              key={c.dbClusterIdentifier}
              onClick={() => setSelected(c.dbClusterIdentifier)}
              selected={selected === c.dbClusterIdentifier}
            >
              <Td className="font-medium text-slate-700">{c.dbClusterIdentifier}</Td>
              <Td>{c.engine ?? "—"}</Td>
              <Td>{c.engineVersion ?? "—"}</Td>
              <Td>
                <StatusCell status={c.status} />
              </Td>
              <Td mono>{c.endpoint ?? "—"}</Td>
              <Td>{c.multiAZ ? "✓" : "—"}</Td>
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
        <ClusterDetailPanel
          key={current.dbClusterIdentifier}
          cluster={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateClusterModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("dbcache.cluster.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("dbcache.cluster.deleteConfirm", { id: deleteTarget?.dbClusterIdentifier })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.dbClusterIdentifier)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClusterDetailPanel({
  cluster,
  onClose,
}: {
  cluster: DbClusterSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_dbcluster">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-semibold text-slate-900">{cluster.dbClusterIdentifier}</span>
        <StatusCell status={cluster.status} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("dbcache.cluster.col.engine")} value={cluster.engine} />
          <KV label={t("dbcache.cluster.col.version")} value={cluster.engineVersion} />
          <KV label={t("dbcache.cluster.col.status")}>
            <StatusCell status={cluster.status} />
          </KV>
          <KV label={t("dbcache.cluster.col.endpoint")} value={cluster.endpoint} mono />
          <KV
            label={t("dbcache.cluster.detail.readerEndpoint")}
            value={cluster.readerEndpoint}
            mono
          />
          <KV
            label={t("dbcache.cluster.detail.port")}
            value={cluster.port != null ? String(cluster.port) : null}
          />
          <KV
            label={t("dbcache.cluster.col.multiAZ")}
            value={cluster.multiAZ ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("dbcache.cluster.detail.availabilityZones")}
            value={cluster.availabilityZones.join(", ") || null}
          />
          <KV
            label={t("dbcache.cluster.detail.storageEncrypted")}
            value={cluster.storageEncrypted ? t("common.yes") : t("common.no")}
          />
          <KV label={t("dbcache.cluster.detail.parameterGroup")} value={cluster.parameterGroup} />
          <KV
            label={t("dbcache.cluster.detail.backupRetention")}
            value={
              cluster.backupRetentionPeriod != null ? String(cluster.backupRetentionPeriod) : null
            }
          />
          <KV
            label={t("dbcache.cluster.detail.backupWindow")}
            value={cluster.preferredBackupWindow}
          />
          <KV
            label={t("dbcache.cluster.detail.maintenanceWindow")}
            value={cluster.preferredMaintenanceWindow}
          />
          <KV label={t("dbcache.cluster.detail.created")} value={cluster.createdTime} />
          <KV label={t("dbcache.cluster.detail.arn")} value={cluster.arn} mono />
        </DefinitionGrid>

        <Card title={t("dbcache.cluster.members")}>
          {cluster.members.length === 0 ? (
            <p className="text-sm text-slate-500">{t("dbcache.cluster.noMembers")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {cluster.members.map((m) => (
                <li key={m.dbInstanceIdentifier} className="flex items-center gap-2">
                  <span className="font-mono text-slate-700">{m.dbInstanceIdentifier}</span>
                  <StatusBadge tone={m.isWriter ? "green" : "neutral"}>
                    {m.isWriter ? t("dbcache.cluster.writer") : t("dbcache.cluster.reader")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {cluster.arn && (
          <ResourceTagsCard arn={cluster.arn} getTags={api.getTags} saveTags={api.saveTags} />
        )}
      </div>
    </ResizableBottomPanel>
  );
}

function CreateClusterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [dbClusterIdentifier, setDbClusterIdentifier] = useState("");
  const [engine, setEngine] = useState("aurora-postgresql");
  const [engineVersion, setEngineVersion] = useState("");
  const [masterUsername, setMasterUsername] = useState("admin");
  const [masterUserPassword, setMasterUserPassword] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createDbCluster({
        dbClusterIdentifier: dbClusterIdentifier.trim(),
        engine,
        engineVersion: engineVersion.trim() || undefined,
        masterUsername: masterUsername.trim(),
        masterUserPassword,
      }),
    onSuccess: () => {
      toast.success(t("dbcache.cluster.created", { id: dbClusterIdentifier }));
      qc.invalidateQueries({ queryKey: ["db-clusters"] });
      setDbClusterIdentifier("");
      setMasterUserPassword("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid =
    dbClusterIdentifier.trim() !== "" && masterUsername.trim() !== "" && masterUserPassword !== "";

  return (
    <Modal open={open} onClose={onClose} title={t("dbcache.cluster.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("dbcache.cluster.col.id")}>
          <TextInput
            value={dbClusterIdentifier}
            onChange={(e) => setDbClusterIdentifier(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("dbcache.cluster.engine")}>
          <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
            {ENGINES.map((en) => (
              <option key={en} value={en}>
                {en}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dbcache.cluster.engineVersion")}>
          <TextInput
            value={engineVersion}
            onChange={(e) => setEngineVersion(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t("dbcache.cluster.masterUsername")}>
          <TextInput
            value={masterUsername}
            onChange={(e) => setMasterUsername(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("dbcache.cluster.masterPassword")}>
          <TextInput
            type="password"
            value={masterUserPassword}
            onChange={(e) => setMasterUserPassword(e.target.value)}
            autoComplete="off"
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

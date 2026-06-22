import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Server, Trash2 } from "lucide-react";
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
import { api } from "@/lib/rds-api";
import type { DbInstanceSummary } from "@/lib/types";

const ENGINES = ["postgres", "mysql", "mariadb"];

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

export function RdsInstancesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbInstanceSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const instances = useQuery({
    queryKey: ["db-instances"],
    queryFn: api.listDbInstances,
    refetchInterval: (q) =>
      q.state.data?.some((i) => i.status && TRANSITIONAL_STATES.has(i.status)) ? 4000 : false,
  });
  const current = instances.data?.find((i) => i.dbInstanceIdentifier === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteDbInstance(id),
    onSuccess: (_d, id) => {
      toast.success(t("dbcache.instance.deleted", { id }));
      qc.invalidateQueries({ queryKey: ["db-instances"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Server}
        title={t("dbcache.instance.heading")}
        subtitle={t("dbcache.instance.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["db-instances"] })}
        refreshing={instances.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("dbcache.instance.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={instances.isLoading}
          isError={instances.isError}
          error={instances.error}
          service="RDS"
          data={instances.data}
          getKey={(i) => i.dbInstanceIdentifier}
          empty={{ icon: Server, message: t("dbcache.instance.none") }}
          head={
            <tr>
              <Th>{t("dbcache.instance.col.id")}</Th>
              <Th>{t("dbcache.instance.col.engine")}</Th>
              <Th>{t("dbcache.instance.col.class")}</Th>
              <Th>{t("dbcache.instance.col.status")}</Th>
              <Th>{t("dbcache.instance.col.endpoint")}</Th>
              <Th>{t("dbcache.instance.col.storage")}</Th>
              <Th>{t("dbcache.instance.col.multiAZ")}</Th>
              <Th>{t("dbcache.instance.col.az")}</Th>
              <Th />
            </tr>
          }
          row={(i: DbInstanceSummary) => (
            <Tr
              key={i.dbInstanceIdentifier}
              onClick={() => setSelected(i.dbInstanceIdentifier)}
              selected={selected === i.dbInstanceIdentifier}
            >
              <Td className="font-medium text-slate-700">{i.dbInstanceIdentifier}</Td>
              <Td>{i.engine ?? "—"}</Td>
              <Td>{i.dbInstanceClass ?? "—"}</Td>
              <Td>
                <StatusCell status={i.status} />
              </Td>
              <Td mono>{i.endpoint ?? "—"}</Td>
              <Td>{i.allocatedStorage != null ? `${i.allocatedStorage} GiB` : "—"}</Td>
              <Td>{i.multiAZ ? "✓" : "—"}</Td>
              <Td>{i.availabilityZone ?? "—"}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(i);
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
        <InstanceDetailPanel
          key={current.dbInstanceIdentifier}
          instance={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateInstanceModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("dbcache.instance.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("dbcache.instance.deleteConfirm", { id: deleteTarget?.dbInstanceIdentifier })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.dbInstanceIdentifier)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InstanceDetailPanel({
  instance,
  onClose,
}: {
  instance: DbInstanceSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_dbinstance">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-semibold text-slate-900">
          {instance.dbInstanceIdentifier}
        </span>
        <StatusCell status={instance.status} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("dbcache.instance.col.engine")} value={instance.engine} />
          <KV label={t("dbcache.instance.detail.version")} value={instance.engineVersion} />
          <KV label={t("dbcache.instance.col.class")} value={instance.dbInstanceClass} mono />
          <KV label={t("dbcache.instance.col.status")}>
            <StatusCell status={instance.status} />
          </KV>
          <KV label={t("dbcache.instance.col.endpoint")} value={instance.endpoint} mono />
          <KV
            label={t("dbcache.instance.detail.port")}
            value={instance.port != null ? String(instance.port) : null}
          />
          <KV
            label={t("dbcache.instance.col.storage")}
            value={instance.allocatedStorage != null ? `${instance.allocatedStorage} GiB` : null}
          />
          <KV label={t("dbcache.instance.detail.storageType")} value={instance.storageType} />
          <KV
            label={t("dbcache.instance.detail.storageEncrypted")}
            value={instance.storageEncrypted ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("dbcache.instance.col.multiAZ")}
            value={instance.multiAZ ? t("common.yes") : t("common.no")}
          />
          <KV label={t("dbcache.instance.col.az")} value={instance.availabilityZone} />
          <KV
            label={t("dbcache.instance.detail.publiclyAccessible")}
            value={instance.publiclyAccessible ? t("common.yes") : t("common.no")}
          />
          <KV label={t("dbcache.instance.detail.parameterGroup")} value={instance.parameterGroup} />
          <KV
            label={t("dbcache.instance.detail.backupRetention")}
            value={
              instance.backupRetentionPeriod != null ? String(instance.backupRetentionPeriod) : null
            }
          />
          <KV
            label={t("dbcache.instance.detail.backupWindow")}
            value={instance.preferredBackupWindow}
          />
          <KV
            label={t("dbcache.instance.detail.maintenanceWindow")}
            value={instance.preferredMaintenanceWindow}
          />
          <KV label={t("dbcache.instance.detail.created")} value={instance.createdTime} />
          <KV label={t("dbcache.instance.detail.arn")} value={instance.arn} mono />
        </DefinitionGrid>

        {instance.arn && (
          <ResourceTagsCard arn={instance.arn} getTags={api.getTags} saveTags={api.saveTags} />
        )}
      </div>
    </ResizableBottomPanel>
  );
}

function CreateInstanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [dbInstanceIdentifier, setDbInstanceIdentifier] = useState("");
  const [engine, setEngine] = useState("postgres");
  const [dbInstanceClass, setDbInstanceClass] = useState("db.t3.micro");
  const [allocatedStorage, setAllocatedStorage] = useState(20);
  const [masterUsername, setMasterUsername] = useState("admin");
  const [masterUserPassword, setMasterUserPassword] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createDbInstance({
        dbInstanceIdentifier: dbInstanceIdentifier.trim(),
        engine,
        dbInstanceClass: dbInstanceClass.trim(),
        allocatedStorage,
        masterUsername: masterUsername.trim(),
        masterUserPassword,
      }),
    onSuccess: () => {
      toast.success(t("dbcache.instance.created", { id: dbInstanceIdentifier }));
      qc.invalidateQueries({ queryKey: ["db-instances"] });
      setDbInstanceIdentifier("");
      setMasterUserPassword("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid =
    dbInstanceIdentifier.trim() !== "" &&
    dbInstanceClass.trim() !== "" &&
    masterUsername.trim() !== "" &&
    masterUserPassword !== "" &&
    allocatedStorage >= 1;

  return (
    <Modal open={open} onClose={onClose} title={t("dbcache.instance.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("dbcache.instance.col.id")}>
          <TextInput
            value={dbInstanceIdentifier}
            onChange={(e) => setDbInstanceIdentifier(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("dbcache.instance.engine")}>
          <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
            {ENGINES.map((en) => (
              <option key={en} value={en}>
                {en}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dbcache.instance.class")}>
          <TextInput
            value={dbInstanceClass}
            onChange={(e) => setDbInstanceClass(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t("dbcache.instance.storage")}>
          <TextInput
            type="number"
            min={1}
            value={allocatedStorage}
            onChange={(e) => setAllocatedStorage(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <Field label={t("dbcache.instance.masterUsername")}>
          <TextInput
            value={masterUsername}
            onChange={(e) => setMasterUsername(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={t("dbcache.instance.masterPassword")}>
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

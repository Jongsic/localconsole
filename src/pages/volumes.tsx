import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Link2, Plus, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
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
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2VolumeSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const VOLUME_TYPES = ["gp3", "gp2", "io1", "io2", "st1", "sc1"];

/** Volume states that resolve on their own → worth polling for. */
const TRANSITIONAL_STATES = new Set(["creating", "attaching", "detaching", "deleting"]);

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  "in-use": "blue",
  creating: "amber",
  attaching: "amber",
  detaching: "amber",
  deleting: "amber",
  deleted: "neutral",
  error: "red",
};

function StateBadge({ state }: { state: string | null }) {
  if (!state) return <>—</>;
  return <StatusBadge tone={STATE_TONES[state] ?? "neutral"}>{state}</StatusBadge>;
}

export function VolumesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const volumes = useQuery({
    queryKey: ["volumes"],
    queryFn: api.listVolumes,
    // Poll while any volume is mid-transition (creating/attaching/detaching) so the
    // result of a create/attach/detach shows up without a manual refresh.
    refetchInterval: (q) =>
      q.state.data?.some((v) => v.state && TRANSITIONAL_STATES.has(v.state)) ? 3000 : false,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteVolume(id),
    onSuccess: () => {
      toast.success(t("volume.deleted"));
      qc.invalidateQueries({ queryKey: ["volumes"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detach = useMutation({
    mutationFn: (id: string) => api.detachVolume(id),
    onSuccess: () => {
      toast.success(t("volume.detached"));
      qc.invalidateQueries({ queryKey: ["volumes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const attachedTo = (v: Ec2VolumeSummary) =>
    v.attachments.length === 0
      ? "—"
      : v.attachments.map((a) => `${a.instanceId}${a.device ? ` (${a.device})` : ""}`).join(", ");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={HardDrive}
        title={t("volume.heading")}
        subtitle={t("volume.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["volumes"] })}
        refreshing={volumes.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("volume.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={volumes.isLoading}
          isError={volumes.isError}
          error={volumes.error}
          service="EBS"
          data={volumes.data}
          getKey={(v) => v.volumeId}
          empty={{ icon: HardDrive, message: t("volume.none") }}
          head={
            <tr>
              <Th>{t("volume.col.id")}</Th>
              <Th>{t("volume.col.size")}</Th>
              <Th>{t("volume.col.type")}</Th>
              <Th>{t("volume.col.iops")}</Th>
              <Th>{t("volume.col.state")}</Th>
              <Th>{t("volume.col.encrypted")}</Th>
              <Th>{t("volume.col.az")}</Th>
              <Th>{t("volume.col.attachedTo")}</Th>
              <Th>{t("volume.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(v) => (
            <Tr key={v.volumeId}>
              <Td mono>{v.volumeId}</Td>
              <Td>{v.size} GiB</Td>
              <Td>{v.volumeType ?? "—"}</Td>
              <Td>{v.iops ?? "—"}</Td>
              <Td>
                <StateBadge state={v.state} />
              </Td>
              <Td>{v.encrypted ? "✓" : "—"}</Td>
              <Td>{v.availabilityZone ?? "—"}</Td>
              <Td mono>{attachedTo(v)}</Td>
              <Td muted>{formatDate(v.createTime, i18n.language)}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {v.state === "available" && (
                    <button
                      type="button"
                      title={t("volume.attach")}
                      onClick={() => setAttachTarget(v.volumeId)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  )}
                  {v.state === "in-use" && (
                    <button
                      type="button"
                      title={t("volume.detach")}
                      disabled={detach.isPending}
                      onClick={() => detach.mutate(v.volumeId)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-600"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  )}
                  {v.state === "available" && (
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={() => setDeleteTarget(v.volumeId)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreateVolumeModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AttachVolumeModal
        volumeId={attachTarget}
        onClose={() => setAttachTarget(null)}
        onAttached={() => {
          qc.invalidateQueries({ queryKey: ["volumes"] });
          setAttachTarget(null);
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("volume.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("volume.deleteConfirm", { id: deleteTarget })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CreateVolumeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [availabilityZone, setAvailabilityZone] = useState("");
  const [size, setSize] = useState(8);
  const [volumeType, setVolumeType] = useState("gp3");
  const [encrypted, setEncrypted] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.createVolume({
        availabilityZone: availabilityZone.trim(),
        size,
        volumeType,
        encrypted,
      }),
    onSuccess: () => {
      toast.success(t("volume.created"));
      qc.invalidateQueries({ queryKey: ["volumes"] });
      setAvailabilityZone("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("volume.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("volume.az")}>
          <TextInput
            value={availabilityZone}
            onChange={(e) => setAvailabilityZone(e.target.value)}
            placeholder="us-east-1a"
            autoComplete="off"
          />
        </Field>
        <Field label={t("volume.size")}>
          <TextInput
            type="number"
            min={1}
            value={size}
            onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <Field label={t("volume.type")}>
          <Select value={volumeType} onChange={(e) => setVolumeType(e.target.value)}>
            {VOLUME_TYPES.map((vt) => (
              <option key={vt} value={vt}>
                {vt}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={encrypted}
            onChange={(e) => setEncrypted(e.target.checked)}
          />
          {t("volume.encrypted")}
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!availabilityZone.trim() || size < 1}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AttachVolumeModal({
  volumeId,
  onClose,
  onAttached,
}: {
  volumeId: string | null;
  onClose: () => void;
  onAttached: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const open = volumeId !== null;
  const [instanceId, setInstanceId] = useState("");
  const [device, setDevice] = useState("/dev/sdf");

  const instances = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: api.listInstances,
    enabled: open,
  });

  const attach = useMutation({
    mutationFn: () => api.attachVolume(volumeId ?? "", instanceId, device.trim()),
    onSuccess: () => {
      toast.success(t("volume.attached"));
      setInstanceId("");
      setDevice("/dev/sdf");
      onAttached();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("volume.attachTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("volume.instance")}>
          <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
            <option value="">{t("volume.pickInstance")}</option>
            {(instances.data ?? []).map((i) => (
              <option key={i.instanceId} value={i.instanceId}>
                {i.instanceId}
                {i.name ? ` (${i.name})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("volume.device")}>
          <TextInput
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={attach.isPending}
            disabled={!instanceId || !device.trim()}
            onClick={() => attach.mutate()}
          >
            {t("volume.attach")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

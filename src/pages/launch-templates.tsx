import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DefinitionGrid,
  KV,
  PageHeader,
  PanelHeader,
  ResourceTable,
  StatusBadge,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2LaunchTemplateSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "m5.large",
  "c5.large",
];

export function LaunchTemplatesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ec2LaunchTemplateSummary | null>(null);

  const templates = useQuery({ queryKey: ["launch-templates"], queryFn: api.listLaunchTemplates });
  const current = templates.data?.find((lt) => lt.launchTemplateId === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteLaunchTemplate(id),
    onSuccess: (_d, id) => {
      toast.success(t("lt.deleted"));
      qc.invalidateQueries({ queryKey: ["launch-templates"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={LayoutTemplate}
        title={t("lt.heading")}
        subtitle={t("lt.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["launch-templates"] })}
        refreshing={templates.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("lt.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={templates.isLoading}
          isError={templates.isError}
          error={templates.error}
          service="EC2 launch templates"
          data={templates.data}
          getKey={(lt) => lt.launchTemplateId}
          empty={{ icon: LayoutTemplate, message: t("lt.none") }}
          head={
            <tr>
              <Th>{t("lt.col.name")}</Th>
              <Th>{t("lt.col.id")}</Th>
              <Th>{t("lt.col.default")}</Th>
              <Th>{t("lt.col.latest")}</Th>
              <Th>{t("lt.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(lt: Ec2LaunchTemplateSummary) => (
            <Tr
              key={lt.launchTemplateId}
              onClick={() => setSelected(lt.launchTemplateId)}
              selected={selected === lt.launchTemplateId}
            >
              <Td className="font-medium text-slate-700">{lt.launchTemplateName || "—"}</Td>
              <Td mono>{lt.launchTemplateId}</Td>
              <Td>{lt.defaultVersionNumber ?? "—"}</Td>
              <Td>{lt.latestVersionNumber ?? "—"}</Td>
              <Td muted>{formatDate(lt.createTime, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(lt);
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
        <TemplateDetail
          key={current.launchTemplateId}
          launchTemplateId={current.launchTemplateId}
          name={current.launchTemplateName}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("lt.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("lt.deleteConfirm", { name: deleteTarget?.launchTemplateName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.launchTemplateId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CreateTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [imageId, setImageId] = useState("ami-0abcdef1234567890");
  const [instanceType, setInstanceType] = useState("t3.micro");
  const [keyName, setKeyName] = useState("");
  const [securityGroupIds, setSecurityGroupIds] = useState<string[]>([]);

  const keyPairs = useQuery({ queryKey: ["key-pairs"], queryFn: api.listKeyPairs, enabled: open });
  const sgs = useQuery({
    queryKey: ["security-groups"],
    queryFn: api.listSecurityGroups,
    enabled: open,
  });

  const toggleSg = (id: string) =>
    setSecurityGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const create = useMutation({
    mutationFn: () =>
      api.createLaunchTemplate({
        name: name.trim(),
        imageId: imageId.trim(),
        instanceType: instanceType.trim(),
        keyName: keyName.trim() || undefined,
        securityGroupIds,
      }),
    onSuccess: () => {
      toast.success(t("lt.created", { name }));
      qc.invalidateQueries({ queryKey: ["launch-templates"] });
      setName("");
      setSecurityGroupIds([]);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("lt.createTitle")} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t("lt.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-template"
            autoComplete="off"
          />
        </Field>
        <Field label={t("lt.field.ami")}>
          <TextInput value={imageId} onChange={(e) => setImageId(e.target.value)} />
        </Field>
        <Field label={t("lt.field.instanceType")}>
          <Select value={instanceType} onChange={(e) => setInstanceType(e.target.value)}>
            {INSTANCE_TYPES.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("lt.field.keyName")}>
          <Select value={keyName} onChange={(e) => setKeyName(e.target.value)}>
            <option value="">{t("ec2.launch.none")}</option>
            {(keyPairs.data ?? []).map((k) => (
              <option key={k.keyName} value={k.keyName}>
                {k.keyName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("lt.field.securityGroups")}>
          <div className="max-h-32 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
            {(sgs.data ?? []).length === 0 ? (
              <p className="px-1 py-1 text-xs text-slate-500">{t("lt.noSecurityGroups")}</p>
            ) : (
              (sgs.data ?? []).map((g) => (
                <label
                  key={g.groupId}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
                    securityGroupIds.includes(g.groupId) && "bg-brand-fg hover:bg-brand-tint",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={securityGroupIds.includes(g.groupId)}
                    onChange={() => toggleSg(g.groupId)}
                  />
                  <span className="font-medium text-slate-800">{g.groupName}</span>
                  <span className="font-mono text-slate-500">{g.groupId}</span>
                </label>
              ))
            )}
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || !imageId.trim() || !instanceType.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TemplateDetail({
  launchTemplateId,
  name,
  onClose,
}: {
  launchTemplateId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const version = useQuery({
    queryKey: ["launch-template-version", launchTemplateId],
    queryFn: () => api.getLaunchTemplateVersion(launchTemplateId),
  });

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_lt">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="font-mono text-xs text-slate-500">{launchTemplateId}</span>
        {version.data?.versionNumber != null && (
          <StatusBadge tone="neutral">
            {t("lt.defaultVersion", { n: version.data.versionNumber })}
          </StatusBadge>
        )}
      </PanelHeader>

      <div className="flex-1 overflow-auto p-4">
        {version.isLoading ? (
          <TableLoading />
        ) : version.isError ? (
          <p className="text-sm text-red-600">{(version.error as Error).message}</p>
        ) : version.data ? (
          <DefinitionGrid>
            <KV label={t("lt.field.ami")} value={version.data.imageId} mono />
            <KV label={t("lt.field.instanceType")} value={version.data.instanceType} />
            <KV label={t("lt.field.keyName")} value={version.data.keyName} />
            <KV
              label={t("lt.field.securityGroups")}
              value={
                [...version.data.securityGroupIds, ...version.data.securityGroups].join(", ") ||
                null
              }
              mono
            />
            <KV label={t("lt.field.iamRole")} value={version.data.iamInstanceProfileArn} mono />
            <KV
              label={t("lt.field.imdsv2")}
              value={
                version.data.metadataHttpTokens
                  ? `${version.data.metadataHttpTokens}${
                      version.data.metadataHopLimit != null
                        ? ` (hop ${version.data.metadataHopLimit})`
                        : ""
                    }`
                  : null
              }
            />
            <KV
              label={t("lt.field.userData")}
              value={version.data.userDataPresent ? t("common.yes") : t("common.no")}
            />
            <KV
              label={t("lt.field.blockDevices")}
              value={
                version.data.blockDevices
                  .map((b) =>
                    `${b.deviceName ?? "?"}: ${b.size ?? "?"}GiB ${b.volumeType ?? ""}${
                      b.encrypted ? " 🔒" : ""
                    }`.trim(),
                  )
                  .join("  ·  ") || null
              }
              mono
            />
          </DefinitionGrid>
        ) : null}
      </div>
    </ResizableBottomPanel>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, Plus, Trash2 } from "lucide-react";
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
import { useToast } from "@/components/toast";
import { Button, Field, Modal, TextInput } from "@/components/ui";
import { VpcTagsCard } from "@/components/vpc-tags-card";
import type { VpcSummary } from "@/lib/types";
import { api } from "@/lib/vpc-api";

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  pending: "amber",
};

function StateBadge({ state }: { state: string | null }) {
  if (!state) return <>—</>;
  return <StatusBadge tone={STATE_TONES[state] ?? "neutral"}>{state}</StatusBadge>;
}

export function VpcVpcsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VpcSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const vpcs = useQuery({ queryKey: ["vpcs"], queryFn: api.listVpcs });
  const current = vpcs.data?.find((v) => v.vpcId === selected) ?? null;

  const del = useMutation({
    mutationFn: (vpcId: string) => api.deleteVpc(vpcId),
    onSuccess: (_d, vpcId) => {
      toast.success(t("vpc.vpc.deleted"));
      qc.invalidateQueries({ queryKey: ["vpcs"] });
      if (selected === vpcId) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Network}
        title={t("vpc.vpc.heading")}
        subtitle={t("vpc.section")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["vpcs"] })}
        refreshing={vpcs.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("vpc.vpc.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={vpcs.isLoading}
          isError={vpcs.isError}
          error={vpcs.error}
          service="VPC"
          data={vpcs.data}
          getKey={(v) => v.vpcId}
          empty={{ icon: Network, message: t("vpc.vpc.none") }}
          head={
            <tr>
              <Th>{t("vpc.vpc.col.name")}</Th>
              <Th>{t("vpc.vpc.col.id")}</Th>
              <Th>{t("vpc.vpc.col.cidr")}</Th>
              <Th>{t("vpc.vpc.col.state")}</Th>
              <Th>{t("vpc.vpc.col.default")}</Th>
              <Th />
            </tr>
          }
          row={(v: VpcSummary) => (
            <Tr key={v.vpcId} onClick={() => setSelected(v.vpcId)} selected={selected === v.vpcId}>
              <Td className="font-medium text-slate-700">{v.name || "—"}</Td>
              <Td mono>{v.vpcId}</Td>
              <Td mono>{v.cidrBlock ?? "—"}</Td>
              <Td>
                <StateBadge state={v.state} />
              </Td>
              <Td>{v.isDefault ? "✓" : "—"}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  disabled={v.isDefault}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(v);
                  }}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      {current && (
        <VpcDetailPanel key={current.vpcId} vpc={current} onClose={() => setSelected(null)} />
      )}

      <CreateVpcModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vpc.vpc.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.vpc.deleteConfirm", { id: deleteTarget?.vpcId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.vpcId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function VpcDetailPanel({ vpc, onClose }: { vpc: VpcSummary; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_vpc">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{vpc.vpcId}</span>
        {vpc.name && <span className="text-sm font-semibold text-slate-900">{vpc.name}</span>}
        <StateBadge state={vpc.state} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.vpc.col.id")} value={vpc.vpcId} mono />
          <KV label={t("vpc.vpc.col.cidr")} value={vpc.cidrBlock} mono />
          <KV label={t("vpc.vpc.col.state")}>
            <StateBadge state={vpc.state} />
          </KV>
          <KV
            label={t("vpc.vpc.col.default")}
            value={vpc.isDefault ? t("common.yes") : t("common.no")}
          />
          <KV label={t("vpc.vpc.detail.ownerId")} value={vpc.ownerId} mono />
          <KV label={t("vpc.vpc.detail.tenancy")} value={vpc.instanceTenancy} />
          <KV label={t("vpc.vpc.detail.dhcpOptions")} value={vpc.dhcpOptionsId} mono />
          <KV label={t("vpc.vpc.detail.cidrAssociations")}>
            {vpc.cidrAssociations.length > 0 ? (
              <ul className="space-y-0.5">
                {vpc.cidrAssociations.map((c) => (
                  <li key={c.cidrBlock} className="break-all font-mono text-xs text-slate-800">
                    {c.cidrBlock}
                    {c.state ? <span className="text-slate-400"> ({c.state})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-slate-800">{t("vpc.vpc.detail.none")}</span>
            )}
          </KV>
          <KV label={t("vpc.vpc.detail.ipv6CidrAssociations")}>
            {vpc.ipv6CidrAssociations.length > 0 ? (
              <ul className="space-y-0.5">
                {vpc.ipv6CidrAssociations.map((c) => (
                  <li key={c.ipv6CidrBlock} className="break-all font-mono text-xs text-slate-800">
                    {c.ipv6CidrBlock}
                    {c.state ? <span className="text-slate-400"> ({c.state})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-slate-800">{t("vpc.vpc.detail.none")}</span>
            )}
          </KV>
        </DefinitionGrid>
        <VpcTagsCard resourceId={vpc.vpcId} tags={vpc.tags} invalidateKey={["vpcs"]} />
      </div>
    </ResizableBottomPanel>
  );
}

function CreateVpcModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [cidrBlock, setCidrBlock] = useState("10.0.0.0/16");

  const create = useMutation({
    mutationFn: () => api.createVpc(cidrBlock.trim()),
    onSuccess: () => {
      toast.success(t("vpc.vpc.created"));
      qc.invalidateQueries({ queryKey: ["vpcs"] });
      setCidrBlock("10.0.0.0/16");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("vpc.vpc.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("vpc.vpc.col.cidr")}>
          <TextInput
            value={cidrBlock}
            onChange={(e) => setCidrBlock(e.target.value)}
            placeholder="10.0.0.0/16"
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!cidrBlock.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

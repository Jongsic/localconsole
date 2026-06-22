import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Trash2 } from "lucide-react";
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
import { Button, Field, Modal, Select, TextInput } from "@/components/ui";
import { VpcTagsCard } from "@/components/vpc-tags-card";
import { cidrContains } from "@/lib/inputs";
import type { SubnetSummary } from "@/lib/types";
import { api } from "@/lib/vpc-api";

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  pending: "amber",
};

function StateBadge({ state }: { state: string | null }) {
  if (!state) return <>—</>;
  return <StatusBadge tone={STATE_TONES[state] ?? "neutral"}>{state}</StatusBadge>;
}

export function VpcSubnetsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubnetSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const subnets = useQuery({ queryKey: ["vpc-subnets"], queryFn: api.listSubnets });
  const current = subnets.data?.find((s) => s.subnetId === selected) ?? null;

  const del = useMutation({
    mutationFn: (subnetId: string) => api.deleteSubnet(subnetId),
    onSuccess: (_d, subnetId) => {
      toast.success(t("vpc.subnet.deleted"));
      qc.invalidateQueries({ queryKey: ["vpc-subnets"] });
      if (selected === subnetId) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Boxes}
        title={t("vpc.subnet.heading")}
        subtitle={t("vpc.section")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["vpc-subnets"] })}
        refreshing={subnets.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("vpc.subnet.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={subnets.isLoading}
          isError={subnets.isError}
          error={subnets.error}
          service="VPC subnets"
          data={subnets.data}
          getKey={(s) => s.subnetId}
          empty={{ icon: Boxes, message: t("vpc.subnet.none") }}
          head={
            <tr>
              <Th>{t("vpc.subnet.col.name")}</Th>
              <Th>{t("vpc.subnet.col.id")}</Th>
              <Th>{t("vpc.subnet.col.vpc")}</Th>
              <Th>{t("vpc.subnet.col.cidr")}</Th>
              <Th>{t("vpc.subnet.col.az")}</Th>
              <Th>{t("vpc.subnet.col.availableIps")}</Th>
              <Th>{t("vpc.subnet.col.state")}</Th>
              <Th />
            </tr>
          }
          row={(s: SubnetSummary) => (
            <Tr
              key={s.subnetId}
              onClick={() => setSelected(s.subnetId)}
              selected={selected === s.subnetId}
            >
              <Td className="font-medium text-slate-700">{s.name || "—"}</Td>
              <Td mono>{s.subnetId}</Td>
              <Td mono>{s.vpcId ?? "—"}</Td>
              <Td mono>{s.cidrBlock ?? "—"}</Td>
              <Td>{s.availabilityZone ?? "—"}</Td>
              <Td>{s.availableIpCount ?? "—"}</Td>
              <Td>
                <StateBadge state={s.state} />
              </Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(s);
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
        <SubnetDetailPanel
          key={current.subnetId}
          subnet={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateSubnetModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vpc.subnet.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.subnet.deleteConfirm", { id: deleteTarget?.subnetId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.subnetId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SubnetDetailPanel({ subnet, onClose }: { subnet: SubnetSummary; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_subnet">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{subnet.subnetId}</span>
        {subnet.name && <span className="text-sm font-semibold text-slate-900">{subnet.name}</span>}
        <StateBadge state={subnet.state} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.subnet.col.id")} value={subnet.subnetId} mono />
          <KV label={t("vpc.subnet.col.vpc")} value={subnet.vpcId} mono />
          <KV label={t("vpc.subnet.col.cidr")} value={subnet.cidrBlock} mono />
          <KV label={t("vpc.subnet.col.az")} value={subnet.availabilityZone} />
          <KV
            label={t("vpc.subnet.col.availableIps")}
            value={subnet.availableIpCount != null ? String(subnet.availableIpCount) : null}
          />
          <KV label={t("vpc.subnet.col.state")}>
            <StateBadge state={subnet.state} />
          </KV>
          <KV label={t("vpc.subnet.detail.ownerId")} value={subnet.ownerId} mono />
          <KV label={t("vpc.subnet.detail.azId")} value={subnet.availabilityZoneId} />
          <KV
            label={t("vpc.subnet.detail.defaultForAz")}
            value={subnet.defaultForAz ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("vpc.subnet.detail.mapPublicIp")}
            value={subnet.mapPublicIpOnLaunch ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("vpc.subnet.detail.assignIpv6")}
            value={subnet.assignIpv6AddressOnCreation ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("vpc.subnet.detail.enableDns64")}
            value={subnet.enableDns64 ? t("common.yes") : t("common.no")}
          />
          <KV
            label={t("vpc.subnet.detail.ipv6Cidr")}
            value={subnet.ipv6CidrBlocks.length > 0 ? subnet.ipv6CidrBlocks.join(", ") : null}
            mono
          />
        </DefinitionGrid>
        <VpcTagsCard
          resourceId={subnet.subnetId}
          tags={subnet.tags}
          invalidateKey={["vpc-subnets"]}
        />
      </div>
    </ResizableBottomPanel>
  );
}

function CreateSubnetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [vpcId, setVpcId] = useState("");
  const [cidrBlock, setCidrBlock] = useState("10.0.0.0/24");
  const [availabilityZone, setAvailabilityZone] = useState("");

  const vpcs = useQuery({ queryKey: ["vpcs"], queryFn: api.listVpcs, enabled: open });
  const selectedVpc = (vpcs.data ?? []).find((v) => v.vpcId === vpcId) ?? null;
  const vpcCidr = selectedVpc?.cidrBlock ?? null;
  // Block the obvious invalid case: a CIDR outside the chosen VPC. We still let the
  // API surface other errors. Only flag once both a VPC CIDR and a subnet CIDR exist.
  const cidr = cidrBlock.trim();
  const outOfRange = Boolean(vpcCidr && cidr && !cidrContains(vpcCidr, cidr));

  const create = useMutation({
    mutationFn: () =>
      api.createSubnet({
        vpcId: vpcId.trim(),
        cidrBlock: cidr,
        availabilityZone: availabilityZone.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("vpc.subnet.created"));
      qc.invalidateQueries({ queryKey: ["vpc-subnets"] });
      setVpcId("");
      setAvailabilityZone("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("vpc.subnet.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("vpc.subnet.col.vpc")}>
          <Select value={vpcId} onChange={(e) => setVpcId(e.target.value)}>
            <option value="">{t("vpc.subnet.pickVpc")}</option>
            {(vpcs.data ?? []).map((v) => (
              <option key={v.vpcId} value={v.vpcId}>
                {v.vpcId}
                {v.name ? ` (${v.name})` : ""}
                {v.cidrBlock ? ` — ${v.cidrBlock}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("vpc.subnet.col.cidr")}>
          <TextInput
            value={cidrBlock}
            onChange={(e) => setCidrBlock(e.target.value)}
            placeholder="10.0.0.0/24"
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        {vpcCidr && (
          <p className="-mt-1.5 text-xs text-slate-500">
            {t("vpc.subnet.vpcCidr")}: <span className="font-mono">{vpcCidr}</span>
          </p>
        )}
        {outOfRange && (
          <p className="-mt-1.5 text-xs text-red-600">
            {t("vpc.subnet.cidrOutOfRange", { cidr: vpcCidr })}
          </p>
        )}
        <Field label={t("vpc.subnet.azOptional")}>
          <TextInput
            value={availabilityZone}
            onChange={(e) => setAvailabilityZone(e.target.value)}
            placeholder="us-east-1a"
            autoComplete="off"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!vpcId.trim() || !cidr || outOfRange}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

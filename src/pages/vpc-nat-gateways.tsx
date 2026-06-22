import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Waypoints } from "lucide-react";
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
import { Button, Field, Modal, Select } from "@/components/ui";
import { VpcTagsCard } from "@/components/vpc-tags-card";
import type { NatGatewaySummary } from "@/lib/types";
import { api } from "@/lib/vpc-api";

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  pending: "amber",
  deleting: "amber",
  deleted: "neutral",
  failed: "red",
};

/** States that resolve on their own → worth polling for. */
const TRANSITIONAL_STATES = new Set(["pending", "deleting"]);

function StateBadge({ state }: { state: string | null }) {
  if (!state) return <>—</>;
  return <StatusBadge tone={STATE_TONES[state] ?? "neutral"}>{state}</StatusBadge>;
}

export function VpcNatGatewaysPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NatGatewaySummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const nats = useQuery({
    queryKey: ["nat-gateways"],
    queryFn: api.listNatGateways,
    refetchInterval: (q) =>
      q.state.data?.some((n) => n.state && TRANSITIONAL_STATES.has(n.state)) ? 5000 : false,
  });
  const current = nats.data?.find((n) => n.natGatewayId === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteNatGateway(id),
    onSuccess: (_d, id) => {
      toast.success(t("vpc.nat.deleted"));
      qc.invalidateQueries({ queryKey: ["nat-gateways"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Waypoints}
        title={t("vpc.nat.heading")}
        subtitle={t("vpc.section")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["nat-gateways"] })}
        refreshing={nats.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("vpc.nat.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={nats.isLoading}
          isError={nats.isError}
          error={nats.error}
          service="VPC NAT gateways"
          data={nats.data}
          getKey={(n) => n.natGatewayId}
          empty={{ icon: Waypoints, message: t("vpc.nat.none") }}
          head={
            <tr>
              <Th>{t("vpc.nat.col.name")}</Th>
              <Th>{t("vpc.nat.col.id")}</Th>
              <Th>{t("vpc.nat.col.subnet")}</Th>
              <Th>{t("vpc.nat.col.vpc")}</Th>
              <Th>{t("vpc.nat.col.type")}</Th>
              <Th>{t("vpc.nat.col.publicIp")}</Th>
              <Th>{t("vpc.nat.col.state")}</Th>
              <Th />
            </tr>
          }
          row={(n: NatGatewaySummary) => (
            <Tr
              key={n.natGatewayId}
              onClick={() => setSelected(n.natGatewayId)}
              selected={selected === n.natGatewayId}
            >
              <Td className="font-medium text-slate-700">{n.name || "—"}</Td>
              <Td mono>{n.natGatewayId}</Td>
              <Td mono>{n.subnetId ?? "—"}</Td>
              <Td mono>{n.vpcId ?? "—"}</Td>
              <Td>{n.type ?? "—"}</Td>
              <Td mono>{n.publicIp ?? "—"}</Td>
              <Td>
                <StateBadge state={n.state} />
              </Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  disabled={n.state === "deleted" || n.state === "deleting"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(n);
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
        <NatDetailPanel
          key={current.natGatewayId}
          nat={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateNatModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vpc.nat.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.nat.deleteConfirm", { id: deleteTarget?.natGatewayId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.natGatewayId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NatDetailPanel({ nat, onClose }: { nat: NatGatewaySummary; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_nat">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{nat.natGatewayId}</span>
        {nat.name && <span className="text-sm font-semibold text-slate-900">{nat.name}</span>}
        <StateBadge state={nat.state} />
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.nat.col.id")} value={nat.natGatewayId} mono />
          <KV label={t("vpc.nat.col.subnet")} value={nat.subnetId} mono />
          <KV label={t("vpc.nat.col.vpc")} value={nat.vpcId} mono />
          <KV label={t("vpc.nat.col.type")} value={nat.type} />
          <KV label={t("vpc.nat.col.publicIp")} value={nat.publicIp} mono />
          <KV label={t("vpc.nat.col.state")}>
            <StateBadge state={nat.state} />
          </KV>
          <KV label={t("vpc.nat.detail.created")} value={nat.createdTime} />
          {nat.deleteTime && <KV label={t("vpc.nat.detail.deleted")} value={nat.deleteTime} />}
          {nat.failureMessage && (
            <KV label={t("vpc.nat.detail.failureMessage")} value={nat.failureMessage} />
          )}
          {nat.addresses.length > 0 && (
            <KV label={t("vpc.nat.detail.addresses")} className="col-span-2 md:col-span-3">
              <ul className="space-y-1">
                {nat.addresses.map((a) => (
                  <li
                    key={a.allocationId ?? a.networkInterfaceId ?? a.privateIp ?? a.publicIp}
                    className="flex flex-wrap gap-x-4 gap-y-0.5 break-all font-mono text-xs text-slate-800"
                  >
                    {a.publicIp && <span>{a.publicIp}</span>}
                    {a.privateIp && (
                      <span className="text-slate-500">
                        {t("vpc.nat.detail.privateIp")}: {a.privateIp}
                      </span>
                    )}
                    {a.allocationId && (
                      <span className="text-slate-500">
                        {t("vpc.nat.detail.allocationId")}: {a.allocationId}
                      </span>
                    )}
                    {a.networkInterfaceId && (
                      <span className="text-slate-500">
                        {t("vpc.nat.detail.networkInterface")}: {a.networkInterfaceId}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </KV>
          )}
        </DefinitionGrid>
        <VpcTagsCard
          resourceId={nat.natGatewayId}
          tags={nat.tags}
          invalidateKey={["nat-gateways"]}
        />
      </div>
    </ResizableBottomPanel>
  );
}

function CreateNatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [subnetId, setSubnetId] = useState("");
  const [connectivityType, setConnectivityType] = useState<"public" | "private">("public");
  const [allocationId, setAllocationId] = useState("");

  const subnets = useQuery({ queryKey: ["vpc-subnets"], queryFn: api.listSubnets, enabled: open });
  const addresses = useQuery({
    queryKey: ["vpc-addresses"],
    queryFn: api.listAddresses,
    enabled: open && connectivityType === "public",
  });
  // Only unassociated EIPs can back a public NAT gateway.
  const freeAddresses = (addresses.data ?? []).filter((a) => a.association === null);
  const isPublic = connectivityType === "public";

  const create = useMutation({
    mutationFn: () =>
      api.createNatGateway({
        subnetId: subnetId.trim(),
        connectivityType,
        allocationId: isPublic ? allocationId.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success(t("vpc.nat.created"));
      qc.invalidateQueries({ queryKey: ["nat-gateways"] });
      setSubnetId("");
      setAllocationId("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("vpc.nat.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("vpc.nat.col.subnet")}>
          <Select value={subnetId} onChange={(e) => setSubnetId(e.target.value)}>
            <option value="">{t("vpc.nat.pickSubnet")}</option>
            {(subnets.data ?? []).map((s) => (
              <option key={s.subnetId} value={s.subnetId}>
                {s.subnetId}
                {s.name ? ` (${s.name})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("vpc.nat.connectivity")}>
          <Select
            value={connectivityType}
            onChange={(e) => setConnectivityType(e.target.value as "public" | "private")}
          >
            <option value="public">{t("vpc.nat.public")}</option>
            <option value="private">{t("vpc.nat.private")}</option>
          </Select>
        </Field>
        {isPublic && (
          <Field label={t("vpc.nat.allocationId")}>
            <Select value={allocationId} onChange={(e) => setAllocationId(e.target.value)}>
              <option value="">{t("vpc.nat.pickAllocation")}</option>
              {freeAddresses.map((a) => (
                <option key={a.allocationId} value={a.allocationId}>
                  {a.allocationId}
                  {a.publicIp ? ` (${a.publicIp})` : ""}
                </option>
              ))}
            </Select>
            <span className="text-xs text-slate-500">
              {freeAddresses.length === 0
                ? t("vpc.nat.noAllocations")
                : t("vpc.nat.allocationHint")}
            </span>
          </Field>
        )}
        {!isPublic && <p className="text-xs text-slate-500">{t("vpc.nat.privateHint")}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!subnetId.trim() || (isPublic && !allocationId.trim())}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

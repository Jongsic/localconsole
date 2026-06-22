import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Link2, Plus, Trash2, Unlink } from "lucide-react";
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
import type { InternetGatewaySummary } from "@/lib/types";
import { api } from "@/lib/vpc-api";

const STATE_TONES: Record<string, StatusTone> = {
  available: "green",
  attached: "green",
  attaching: "amber",
  detaching: "amber",
  detached: "neutral",
};

export function VpcInternetGatewaysPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [attachTarget, setAttachTarget] = useState<InternetGatewaySummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InternetGatewaySummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const igws = useQuery({ queryKey: ["internet-gateways"], queryFn: api.listInternetGateways });
  const current = igws.data?.find((g) => g.internetGatewayId === selected) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["internet-gateways"] });

  const create = useMutation({
    mutationFn: () => api.createInternetGateway(),
    onSuccess: () => {
      toast.success(t("vpc.igw.created"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detach = useMutation({
    mutationFn: ({ id, vpcId }: { id: string; vpcId: string }) =>
      api.detachInternetGateway(id, vpcId),
    onSuccess: () => {
      toast.success(t("vpc.igw.detached"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteInternetGateway(id),
    onSuccess: (_d, id) => {
      toast.success(t("vpc.igw.deleted"));
      refresh();
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Globe}
        title={t("vpc.igw.heading")}
        subtitle={t("vpc.section")}
        onRefresh={refresh}
        refreshing={igws.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            <Plus className="h-4 w-4" /> {t("vpc.igw.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={igws.isLoading}
          isError={igws.isError}
          error={igws.error}
          service="VPC internet gateways"
          data={igws.data}
          getKey={(g) => g.internetGatewayId}
          empty={{ icon: Globe, message: t("vpc.igw.none") }}
          head={
            <tr>
              <Th>{t("vpc.igw.col.name")}</Th>
              <Th>{t("vpc.igw.col.id")}</Th>
              <Th>{t("vpc.igw.col.attachedVpc")}</Th>
              <Th>{t("vpc.igw.col.state")}</Th>
              <Th />
            </tr>
          }
          row={(g: InternetGatewaySummary) => {
            const attachment = g.attachments[0] ?? null;
            return (
              <Tr
                key={g.internetGatewayId}
                onClick={() => setSelected(g.internetGatewayId)}
                selected={selected === g.internetGatewayId}
              >
                <Td className="font-medium text-slate-700">{g.name || "—"}</Td>
                <Td mono>{g.internetGatewayId}</Td>
                <Td mono>{attachment?.vpcId ?? "—"}</Td>
                <Td>
                  {attachment?.state ? (
                    <StatusBadge tone={STATE_TONES[attachment.state] ?? "neutral"}>
                      {attachment.state}
                    </StatusBadge>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {attachment ? (
                      <button
                        type="button"
                        title={t("vpc.igw.detach")}
                        disabled={detach.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          detach.mutate({ id: g.internetGatewayId, vpcId: attachment.vpcId });
                        }}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-600"
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={t("vpc.igw.attach")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachTarget(g);
                        }}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      title={t("common.delete")}
                      disabled={attachment != null}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(g);
                      }}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          }}
        />
      </div>

      {current && (
        <IgwDetailPanel
          key={current.internetGatewayId}
          igw={current}
          onClose={() => setSelected(null)}
        />
      )}

      <AttachIgwModal
        igw={attachTarget}
        onClose={() => setAttachTarget(null)}
        onAttached={() => {
          refresh();
          setAttachTarget(null);
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vpc.igw.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.igw.deleteConfirm", { id: deleteTarget?.internetGatewayId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.internetGatewayId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IgwDetailPanel({ igw, onClose }: { igw: InternetGatewaySummary; onClose: () => void }) {
  const { t } = useTranslation();
  const attachment = igw.attachments[0] ?? null;
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_igw">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{igw.internetGatewayId}</span>
        {igw.name && <span className="text-sm font-semibold text-slate-900">{igw.name}</span>}
        {attachment?.state && (
          <StatusBadge tone={STATE_TONES[attachment.state] ?? "neutral"}>
            {attachment.state}
          </StatusBadge>
        )}
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.igw.col.id")} value={igw.internetGatewayId} mono />
          <KV label={t("vpc.igw.col.attachedVpc")} value={attachment?.vpcId ?? null} mono />
          <KV label={t("vpc.igw.col.state")} value={attachment?.state ?? null} />
          <KV label={t("vpc.igw.detail.ownerId")} value={igw.ownerId} mono />
        </DefinitionGrid>
        <VpcTagsCard
          resourceId={igw.internetGatewayId}
          tags={igw.tags}
          invalidateKey={["internet-gateways"]}
        />
      </div>
    </ResizableBottomPanel>
  );
}

function AttachIgwModal({
  igw,
  onClose,
  onAttached,
}: {
  igw: InternetGatewaySummary | null;
  onClose: () => void;
  onAttached: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const open = igw !== null;
  const [vpcId, setVpcId] = useState("");

  const vpcs = useQuery({ queryKey: ["vpcs"], queryFn: api.listVpcs, enabled: open });

  const attach = useMutation({
    mutationFn: () => api.attachInternetGateway(igw?.internetGatewayId ?? "", vpcId.trim()),
    onSuccess: () => {
      toast.success(t("vpc.igw.attached"));
      setVpcId("");
      onAttached();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("vpc.igw.attachTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("vpc.igw.col.attachedVpc")}>
          <Select value={vpcId} onChange={(e) => setVpcId(e.target.value)}>
            <option value="">{t("vpc.igw.pickVpc")}</option>
            {(vpcs.data ?? []).map((v) => (
              <option key={v.vpcId} value={v.vpcId}>
                {v.vpcId}
                {v.name ? ` (${v.name})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={attach.isPending}
            disabled={!vpcId.trim()}
            onClick={() => attach.mutate()}
          >
            {t("vpc.igw.attach")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { useToast } from "@/components/toast";
import { Button, Modal } from "@/components/ui";
import { VpcTagsCard } from "@/components/vpc-tags-card";
import type { ElasticIpSummary } from "@/lib/types";
import { api } from "@/lib/vpc-api";

/** The id (instance or ENI) an EIP is associated with, or null when free. */
function associationId(eip: ElasticIpSummary): string | null {
  if (!eip.association) return null;
  return eip.association.instanceId ?? eip.association.networkInterfaceId ?? null;
}

export function VpcElasticIpsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [releaseTarget, setReleaseTarget] = useState<ElasticIpSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const addresses = useQuery({ queryKey: ["vpc-addresses"], queryFn: api.listAddresses });
  const current = addresses.data?.find((a) => a.allocationId === selected) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["vpc-addresses"] });

  const allocate = useMutation({
    mutationFn: () => api.allocateAddress(),
    onSuccess: () => {
      toast.success(t("vpc.eip.allocated"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const release = useMutation({
    mutationFn: (allocationId: string) => api.releaseAddress(allocationId),
    onSuccess: (_d, allocationId) => {
      toast.success(t("vpc.eip.released"));
      refresh();
      if (selected === allocationId) setSelected(null);
      setReleaseTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Network}
        title={t("vpc.eip.heading")}
        subtitle={t("vpc.section")}
        onRefresh={refresh}
        refreshing={addresses.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button loading={allocate.isPending} onClick={() => allocate.mutate()}>
            <Plus className="h-4 w-4" /> {t("vpc.eip.allocate")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={addresses.isLoading}
          isError={addresses.isError}
          error={addresses.error}
          service="VPC Elastic IPs"
          data={addresses.data}
          getKey={(a) => a.allocationId}
          empty={{ icon: Network, message: t("vpc.eip.none") }}
          head={
            <tr>
              <Th>{t("vpc.eip.col.name")}</Th>
              <Th>{t("vpc.eip.col.publicIp")}</Th>
              <Th>{t("vpc.eip.col.allocationId")}</Th>
              <Th>{t("vpc.eip.col.association")}</Th>
              <Th>{t("vpc.eip.col.domain")}</Th>
              <Th />
            </tr>
          }
          row={(a: ElasticIpSummary) => {
            const assoc = associationId(a);
            return (
              <Tr
                key={a.allocationId}
                onClick={() => setSelected(a.allocationId)}
                selected={selected === a.allocationId}
              >
                <Td className="font-medium text-slate-700">{a.name || "—"}</Td>
                <Td mono>{a.publicIp ?? "—"}</Td>
                <Td mono>{a.allocationId}</Td>
                <Td mono>{assoc ?? t("vpc.eip.unassociated")}</Td>
                <Td>{a.domain ?? "—"}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    title={t("vpc.eip.release")}
                    disabled={assoc != null}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReleaseTarget(a);
                    }}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Td>
              </Tr>
            );
          }}
        />
      </div>

      {current && (
        <EipDetailPanel
          key={current.allocationId}
          eip={current}
          onClose={() => setSelected(null)}
        />
      )}

      <Modal
        open={releaseTarget !== null}
        onClose={() => setReleaseTarget(null)}
        title={t("vpc.eip.releaseTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.eip.releaseConfirm", { id: releaseTarget?.allocationId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReleaseTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={release.isPending}
              onClick={() => releaseTarget && release.mutate(releaseTarget.allocationId)}
            >
              {t("vpc.eip.release")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EipDetailPanel({ eip, onClose }: { eip: ElasticIpSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const assoc = associationId(eip);
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_eip">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{eip.allocationId}</span>
        {eip.name && <span className="text-sm font-semibold text-slate-900">{eip.name}</span>}
        {eip.publicIp && <span className="font-mono text-xs text-slate-700">{eip.publicIp}</span>}
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.eip.col.allocationId")} value={eip.allocationId} mono />
          <KV label={t("vpc.eip.col.publicIp")} value={eip.publicIp} mono />
          <KV
            label={t("vpc.eip.col.association")}
            value={assoc ?? t("vpc.eip.unassociated")}
            mono
          />
          <KV label={t("vpc.eip.col.domain")} value={eip.domain} />
          <KV label={t("vpc.eip.detail.networkBorderGroup")} value={eip.networkBorderGroup} />
          <KV label={t("vpc.eip.detail.publicIpv4Pool")} value={eip.publicIpv4Pool} mono />
          {eip.association?.instanceId && (
            <KV label={t("vpc.eip.detail.instanceId")} value={eip.association.instanceId} mono />
          )}
          {eip.association?.networkInterfaceId && (
            <KV
              label={t("vpc.eip.detail.networkInterface")}
              value={eip.association.networkInterfaceId}
              mono
            />
          )}
          {eip.association?.privateIpAddress && (
            <KV
              label={t("vpc.eip.detail.privateIp")}
              value={eip.association.privateIpAddress}
              mono
            />
          )}
        </DefinitionGrid>
        <VpcTagsCard
          resourceId={eip.allocationId}
          tags={eip.tags}
          invalidateKey={["vpc-addresses"]}
        />
      </div>
    </ResizableBottomPanel>
  );
}

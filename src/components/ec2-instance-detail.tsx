import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/ec2-api";
import type {
  Ec2InstanceDetail,
  Ec2NetworkInterface,
  Ec2SecurityGroup,
  Ec2Volume,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { StateBadge } from "@/pages/ec2";
import { SecurityGroupCard } from "./sg-rules";
import { Spinner } from "./ui";

type Tab = "details" | "security" | "networking" | "storage" | "tags";
const TABS: Tab[] = ["details", "security", "networking", "storage", "tags"];

export function Ec2DetailPanel({
  instanceId,
  onClose,
}: {
  instanceId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("details");

  const detail = useQuery({
    queryKey: ["ec2-detail", instanceId],
    queryFn: () => api.getInstanceDetail(instanceId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ec2-detail", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-sg", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] });
  };

  return (
    <div className="flex h-80 shrink-0 flex-col border-t bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="font-mono text-xs text-slate-500">{instanceId}</span>
        {detail.data?.name && (
          <span className="text-sm font-medium text-slate-700">{detail.data.name}</span>
        )}
        {detail.data && <StateBadge state={detail.data.state} />}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            title={t("common.refresh")}
            onClick={refresh}
            className="text-slate-400 hover:text-slate-600"
          >
            <RefreshCw className={cn("h-4 w-4", detail.isFetching && "animate-spin")} />
          </button>
          <button
            type="button"
            title={t("common.close")}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex gap-1 border-b px-3">
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={cn(
              "relative px-3 py-2 text-sm font-medium",
              tab === tb ? "text-brand" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t(`ec2.tabs.${tb}`)}
            {tab === tb && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-4">
        {detail.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : detail.isError ? (
          <p className="text-sm text-red-600">{(detail.error as Error).message}</p>
        ) : detail.data ? (
          <TabBody tab={tab} instanceId={instanceId} detail={detail.data} active={tab} />
        ) : null}
      </div>
    </div>
  );
}

function TabBody({
  tab,
  instanceId,
  detail,
  active,
}: {
  tab: Tab;
  instanceId: string;
  detail: Ec2InstanceDetail;
  active: Tab;
}) {
  switch (tab) {
    case "details":
      return <DetailsTab detail={detail} />;
    case "networking":
      return <NetworkingTab detail={detail} />;
    case "tags":
      return <TagsTab detail={detail} />;
    case "security":
      return <SecurityTab detail={detail} enabled={active === "security"} />;
    case "storage":
      return <StorageTab instanceId={instanceId} enabled={active === "storage"} />;
  }
}

/* ── Key/value grid ── */

function KV({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">{label}</div>
      <div className={cn("text-sm text-slate-700", mono && "font-mono text-xs")}>
        {value || "—"}
      </div>
    </div>
  );
}

function DetailsTab({ detail }: { detail: Ec2InstanceDetail }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
      <KV label={t("ec2.detail.instanceType")} value={detail.instanceType} />
      <KV label={t("ec2.detail.ami")} value={detail.imageId} mono />
      <KV label={t("ec2.detail.keyName")} value={detail.keyName} />
      <KV label={t("ec2.detail.launchTime")} value={formatDate(detail.launchTime, i18n.language)} />
      <KV label={t("ec2.detail.az")} value={detail.availabilityZone} />
      <KV label={t("ec2.detail.monitoring")} value={detail.monitoring} />
      <KV label={t("ec2.detail.architecture")} value={detail.architecture} />
      <KV label={t("ec2.detail.platform")} value={detail.platform} />
      <KV label={t("ec2.detail.rootDevice")} value={detail.rootDeviceName} mono />
      <KV label={t("ec2.detail.iamRole")} value={detail.iamInstanceProfileArn} mono />
    </div>
  );
}

function NetworkingTab({ detail }: { detail: Ec2InstanceDetail }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
        <KV label={t("ec2.detail.vpc")} value={detail.vpcId} mono />
        <KV label={t("ec2.detail.subnet")} value={detail.subnetId} mono />
        <KV label={t("ec2.detail.publicIp")} value={detail.publicIp} mono />
        <KV label={t("ec2.detail.publicDns")} value={detail.publicDns} mono />
        <KV label={t("ec2.detail.privateIp")} value={detail.privateIp} mono />
        <KV label={t("ec2.detail.privateDns")} value={detail.privateDns} mono />
      </div>

      <div>
        <div className="mb-2 text-[11px] font-medium uppercase text-slate-400">
          {t("ec2.networking.interfaces")}
        </div>
        {detail.networkInterfaces.length === 0 ? (
          <p className="text-sm text-slate-400">{t("ec2.networking.none")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-1 pr-4 font-medium">{t("ec2.networking.eni")}</th>
                <th className="py-1 pr-4 font-medium">{t("ec2.networking.status")}</th>
                <th className="py-1 pr-4 font-medium">{t("ec2.detail.privateIp")}</th>
                <th className="py-1 pr-4 font-medium">{t("ec2.networking.mac")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.networkInterfaces.map((ni: Ec2NetworkInterface) => (
                <tr key={ni.networkInterfaceId} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-600">
                    {ni.networkInterfaceId}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-600">{ni.status ?? "—"}</td>
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">
                    {ni.privateIp ?? "—"}
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">
                    {ni.macAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TagsTab({ detail }: { detail: Ec2InstanceDetail }) {
  const { t } = useTranslation();
  if (detail.tags.length === 0)
    return <p className="text-sm text-slate-400">{t("ec2.tags.none")}</p>;
  return (
    <table className="w-full max-w-2xl text-left text-sm">
      <thead className="text-[11px] uppercase text-slate-400">
        <tr>
          <th className="py-1 pr-4 font-medium">{t("common.name")}</th>
          <th className="py-1 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {detail.tags.map((tg) => (
          <tr key={tg.key} className="border-t border-slate-100">
            <td className="py-1.5 pr-4 font-medium text-slate-700">{tg.key}</td>
            <td className="py-1.5 text-slate-600">{tg.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SecurityTab({ detail, enabled }: { detail: Ec2InstanceDetail; enabled: boolean }) {
  const { t } = useTranslation();
  const groupIds = detail.securityGroups.map((g) => g.groupId);
  const sgs = useQuery({
    queryKey: ["ec2-sg", detail.instanceId, groupIds],
    queryFn: () => api.getSecurityGroups(groupIds),
    enabled: enabled && groupIds.length > 0,
  });

  if (groupIds.length === 0)
    return <p className="text-sm text-slate-400">{t("ec2.security.none")}</p>;
  if (sgs.isLoading)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  if (sgs.isError) return <p className="text-sm text-red-600">{(sgs.error as Error).message}</p>;

  return (
    <div className="flex flex-col gap-6">
      {(sgs.data ?? []).map((g: Ec2SecurityGroup) => (
        <SecurityGroupCard key={g.groupId} group={g} />
      ))}
    </div>
  );
}

function StorageTab({ instanceId, enabled }: { instanceId: string; enabled: boolean }) {
  const { t } = useTranslation();
  const volumes = useQuery({
    queryKey: ["ec2-volumes", instanceId],
    queryFn: () => api.getVolumes(instanceId),
    enabled,
  });

  if (volumes.isLoading)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  if (volumes.isError)
    return <p className="text-sm text-red-600">{(volumes.error as Error).message}</p>;
  if (!volumes.data || volumes.data.length === 0)
    return <p className="text-sm text-slate-400">{t("ec2.storage.none")}</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[11px] uppercase text-slate-400">
        <tr>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.volumeId")}</th>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.device")}</th>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.size")}</th>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.type")}</th>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.iops")}</th>
          <th className="py-1 pr-4 font-medium">{t("ec2.storage.encrypted")}</th>
          <th className="py-1 font-medium">{t("ec2.storage.state")}</th>
        </tr>
      </thead>
      <tbody>
        {volumes.data.map((v: Ec2Volume) => (
          <tr key={v.volumeId} className="border-t border-slate-100">
            <td className="py-1.5 pr-4 font-mono text-xs text-slate-600">{v.volumeId}</td>
            <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">{v.deviceName ?? "—"}</td>
            <td className="py-1.5 pr-4 text-slate-600">{v.size} GiB</td>
            <td className="py-1.5 pr-4 text-slate-600">{v.volumeType ?? "—"}</td>
            <td className="py-1.5 pr-4 text-slate-600">{v.iops ?? "—"}</td>
            <td className="py-1.5 pr-4 text-slate-600">{v.encrypted ? "✓" : "—"}</td>
            <td className="py-1.5 text-slate-600">{v.state ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "@/lib/ec2-api";
import type {
  Ec2InstanceDetail,
  Ec2NetworkInterface,
  Ec2SecurityGroup,
  Ec2Volume,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { StateBadge, TRANSITIONAL_STATES } from "@/pages/ec2";
import { ResizableBottomPanel } from "./resizable-bottom-panel";
import { SecurityGroupCard } from "./sg-rules";
import { TagsEditor } from "./tags-editor";
import { useToast } from "./toast";
import { Button, Spinner } from "./ui";

const INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "t4g.micro",
  "t4g.small",
  "t4g.medium",
  "m5.large",
  "c5.large",
];

/** Mutation that refreshes the instance detail + list after an edit. */
function useDetailEdit(instanceId: string, successMsg: string) {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ["ec2-detail", instanceId] });
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
      qc.invalidateQueries({ queryKey: ["ec2-sg", instanceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

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
    // Keep the header state badge live while the instance is mid-transition.
    refetchInterval: (q) =>
      q.state.data && TRANSITIONAL_STATES.has(q.state.data.state) ? 3000 : false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ec2-detail", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-sg", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] });
  };

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_ec2">
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
    </ResizableBottomPanel>
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
      return <DetailsTab instanceId={instanceId} detail={detail} />;
    case "networking":
      return <NetworkingTab detail={detail} />;
    case "tags":
      return <TagsTab instanceId={instanceId} detail={detail} />;
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

function DetailsTab({ instanceId, detail }: { instanceId: string; detail: Ec2InstanceDetail }) {
  const { t, i18n } = useTranslation();
  const edit = useDetailEdit(instanceId, t("ec2.edit.typeChanged"));
  const stopped = detail.state === "stopped";
  const [type, setType] = useState(detail.instanceType ?? "");
  useEffect(() => setType(detail.instanceType ?? ""), [detail.instanceType]);

  const typeOptions = Array.from(
    new Set([detail.instanceType, ...INSTANCE_TYPES].filter(Boolean) as string[]),
  );

  const imdsv2 = detail.metadataHttpTokens
    ? `${detail.metadataHttpTokens}${
        detail.metadataHopLimit != null ? ` (hop ${detail.metadataHopLimit})` : ""
      }`
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">
            {t("ec2.detail.instanceType")}
          </div>
          {stopped ? (
            <div className="flex items-center gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand"
              >
                {typeOptions.map((it) => (
                  <option key={it} value={it}>
                    {it}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                loading={edit.isPending}
                disabled={type === detail.instanceType}
                onClick={() => edit.mutate(() => api.modifyInstanceType(instanceId, type))}
              >
                {t("common.apply")}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-700">
              {detail.instanceType || "—"}
              <span className="ml-2 text-xs text-slate-400">{t("ec2.edit.typeStoppedHint")}</span>
            </div>
          )}
        </div>
        <KV label={t("ec2.detail.ami")} value={detail.imageId} mono />
        <KV label={t("ec2.detail.keyName")} value={detail.keyName} />
        <KV
          label={t("ec2.detail.launchTime")}
          value={formatDate(detail.launchTime, i18n.language)}
        />
        <KV label={t("ec2.detail.az")} value={detail.availabilityZone} />
        <KV label={t("ec2.detail.monitoring")} value={detail.monitoring} />
        <KV label={t("ec2.detail.architecture")} value={detail.architecture} />
        <KV label={t("ec2.detail.platform")} value={detail.platform} />
        <KV label={t("ec2.detail.rootDevice")} value={detail.rootDeviceName} mono />
        <KV label={t("ec2.detail.iamRole")} value={detail.iamInstanceProfileArn} mono />
        <KV label={t("ec2.detail.imdsv2")} value={imdsv2} />
      </div>
      <InstanceProtection instanceId={instanceId} />
      <UserDataView instanceId={instanceId} />
    </div>
  );
}

/** Termination + stop protection toggles. */
function InstanceProtection({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const prot = useQuery({
    queryKey: ["ec2-protection", instanceId],
    queryFn: () => api.getInstanceProtection(instanceId),
  });

  const mutate = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      toast.success(t("ec2.edit.protectionChanged"));
      qc.invalidateQueries({ queryKey: ["ec2-protection", instanceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">
        {t("ec2.detail.protection")}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={prot.isLoading || mutate.isPending}
            checked={prot.data?.terminationProtection ?? false}
            onChange={(e) =>
              mutate.mutate(() => api.setTerminationProtection(instanceId, e.target.checked))
            }
          />
          {t("ec2.detail.terminationProtection")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={prot.isLoading || mutate.isPending}
            checked={prot.data?.stopProtection ?? false}
            onChange={(e) =>
              mutate.mutate(() => api.setStopProtection(instanceId, e.target.checked))
            }
          />
          {t("ec2.detail.stopProtection")}
        </label>
      </div>
    </div>
  );
}

/** Lazily fetch + show the instance's user data (decoded). */
function UserDataView({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const ud = useQuery({
    queryKey: ["ec2-userdata", instanceId],
    queryFn: () => api.getUserData(instanceId),
  });
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">
        {t("ec2.detail.userData")}
      </div>
      {ud.isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : ud.data ? (
        <pre className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-700">
          {ud.data}
        </pre>
      ) : (
        <span className="text-sm text-slate-400">{t("ec2.detail.noUserData")}</span>
      )}
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

function TagsTab({ instanceId, detail }: { instanceId: string; detail: Ec2InstanceDetail }) {
  const { t } = useTranslation();
  const edit = useDetailEdit(instanceId, t("ec2.edit.tagsSaved"));
  return (
    <TagsEditor
      current={detail.tags}
      saving={edit.isPending}
      onSave={(tags, removed) => edit.mutate(() => api.saveTags(instanceId, tags, removed))}
    />
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

  return (
    <div className="flex flex-col gap-5">
      <SgEditor instanceId={detail.instanceId} current={groupIds} />

      {/* All attached groups as links into the Security groups page */}
      {detail.securityGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase text-slate-400">
            {t("ec2.security.attached")}
          </span>
          {detail.securityGroups.map((g) => (
            <Link
              key={g.groupId}
              to={`/compute/security-groups/${g.groupId}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs hover:border-brand hover:text-brand"
            >
              <span className="font-medium text-slate-700">{g.groupName || g.groupId}</span>
              <span className="font-mono text-slate-400">{g.groupId}</span>
            </Link>
          ))}
        </div>
      )}

      {groupIds.length === 0 ? (
        <p className="text-sm text-slate-400">{t("ec2.security.none")}</p>
      ) : sgs.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : sgs.isError ? (
        <p className="text-sm text-red-600">{(sgs.error as Error).message}</p>
      ) : (
        (sgs.data ?? []).map((g: Ec2SecurityGroup) => (
          <SecurityGroupCard key={g.groupId} group={g} />
        ))
      )}
    </div>
  );
}

/** Change which security groups are attached to the instance. */
function SgEditor({ instanceId, current }: { instanceId: string; current: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const edit = useDetailEdit(instanceId, t("ec2.edit.sgChanged"));
  const all = useQuery({
    queryKey: ["security-groups"],
    queryFn: api.listSecurityGroups,
    enabled: open,
  });
  const [selected, setSelected] = useState<string[]>(current);
  useEffect(() => setSelected(current), [current]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        {t("ec2.edit.changeSg")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase text-slate-400">
        {t("ec2.edit.changeSg")}
      </div>
      <div className="max-h-32 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
        {(all.data ?? []).map((g) => (
          <label
            key={g.groupId}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50",
              selected.includes(g.groupId) && "bg-brand-fg",
            )}
          >
            <input
              type="checkbox"
              checked={selected.includes(g.groupId)}
              onChange={() => toggle(g.groupId)}
            />
            <span className="font-medium text-slate-700">{g.groupName}</span>
            <span className="font-mono text-slate-400">{g.groupId}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          loading={edit.isPending}
          disabled={selected.length === 0}
          onClick={() =>
            edit.mutate(async () => {
              await api.modifyInstanceSecurityGroups(instanceId, selected);
              setOpen(false);
            })
          }
        >
          {t("common.apply")}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, RefreshCw, RotateCw, Server, Square, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Ec2DetailPanel } from "@/components/ec2-instance-detail";
import { Ec2LaunchModal } from "@/components/ec2-launch-modal";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2InstanceAction, Ec2InstanceState, Ec2InstanceSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useSettings } from "@/store/settings";

/** States that are mid-transition and will change on their own → worth polling for. */
export const TRANSITIONAL_STATES = new Set<Ec2InstanceState>([
  "pending",
  "stopping",
  "shutting-down",
]);

const STATE_STYLES: Record<Ec2InstanceState, string> = {
  running: "bg-green-100 text-green-700",
  stopped: "bg-slate-100 text-slate-500",
  pending: "bg-amber-100 text-amber-700",
  stopping: "bg-amber-100 text-amber-700",
  "shutting-down": "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-600",
};

export function StateBadge({ state }: { state: Ec2InstanceState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATE_STYLES[state] ?? "bg-slate-100 text-slate-500",
      )}
    >
      {state}
    </span>
  );
}

export function Ec2Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const backend = useSettings((s) => s.backend);
  const [selected, setSelected] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);

  /** Floci backs each instance with a Docker container named floci-ec2-<id>. */
  const copyExec = async (instanceId: string) => {
    const cmd = `docker exec -it floci-ec2-${instanceId} sh`;
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success(t("ec2.execCopied"));
    } catch {
      toast.error(cmd);
    }
  };

  const instances = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: api.listInstances,
    // Poll while any instance is mid-transition (pending → running, stopping → stopped, …)
    // so launch/start/stop results show up without a manual refresh; stop once all are stable.
    refetchInterval: (q) =>
      q.state.data?.some((i) => TRANSITIONAL_STATES.has(i.state)) ? 3000 : false,
  });
  const current = instances.data?.find((i) => i.instanceId === selected) ?? null;

  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: Ec2InstanceAction; id: string }) => api.runAction(kind, id),
    onSuccess: (_d, { kind }) => {
      toast.success(t("ec2.actionRequested", { action: t(`ec2.action.${kind}`) }));
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const can = (kind: Ec2InstanceAction): boolean => {
    if (!current) return false;
    switch (kind) {
      case "start":
        return current.state === "stopped";
      case "stop":
      case "reboot":
        return current.state === "running";
      case "terminate":
        return current.state !== "terminated";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <Server className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("ec2.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("ec2.subtitle")}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button onClick={() => setLaunchOpen(true)}>
            <Plus className="h-4 w-4" /> {t("ec2.launch.button")}
          </Button>
          <Button
            variant="secondary"
            disabled={!can("start") || action.isPending}
            onClick={() => current && action.mutate({ kind: "start", id: current.instanceId })}
          >
            <Play className="h-4 w-4" /> {t("ec2.action.start")}
          </Button>
          <Button
            variant="secondary"
            disabled={!can("stop") || action.isPending}
            onClick={() => current && action.mutate({ kind: "stop", id: current.instanceId })}
          >
            <Square className="h-4 w-4" /> {t("ec2.action.stop")}
          </Button>
          <Button
            variant="secondary"
            disabled={!can("reboot") || action.isPending}
            onClick={() => current && action.mutate({ kind: "reboot", id: current.instanceId })}
          >
            <RotateCw className="h-4 w-4" /> {t("ec2.action.reboot")}
          </Button>
          <Button
            variant="danger"
            disabled={!can("terminate") || action.isPending}
            onClick={() => current && setTerminateTarget(current.instanceId)}
          >
            <Trash2 className="h-4 w-4" /> {t("ec2.action.terminate")}
          </Button>
          <button
            type="button"
            title={t("common.refresh")}
            onClick={() => qc.invalidateQueries({ queryKey: ["ec2-instances"] })}
            className="ml-1 text-slate-400 hover:text-slate-600"
          >
            <RefreshCw className={cn("h-4 w-4", instances.isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {instances.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : instances.isError ? (
          <ResourceError error={instances.error} service="EC2" />
        ) : instances.data && instances.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("ec2.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.instanceId")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.state")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.type")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.az")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.publicIp")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.privateIp")}</th>
                <th className="px-4 py-2 font-medium">{t("ec2.col.launched")}</th>
                {backend === "floci" && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {instances.data.map((i: Ec2InstanceSummary) => (
                <tr
                  key={i.instanceId}
                  onClick={() => setSelected(i.instanceId)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === i.instanceId && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{i.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{i.instanceId}</td>
                  <td className="px-4 py-2">
                    <StateBadge state={i.state} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{i.instanceType ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{i.availabilityZone ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {i.publicIp ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {i.privateIp ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {formatDate(i.launchTime, i18n.language)}
                  </td>
                  {backend === "floci" && (
                    <td className="px-4 py-2 text-right">
                      {i.state === "running" && (
                        <button
                          type="button"
                          title={t("ec2.execHint")}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyExec(i.instanceId);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:border-brand hover:text-brand"
                        >
                          <Terminal className="h-3.5 w-3.5" /> {t("ec2.exec")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Server className="h-10 w-10" />
            <p className="text-sm">{t("ec2.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <Ec2DetailPanel
          key={current.instanceId}
          instanceId={current.instanceId}
          onClose={() => setSelected(null)}
        />
      )}

      <Ec2LaunchModal open={launchOpen} onClose={() => setLaunchOpen(false)} />

      <TerminateModal
        instanceId={terminateTarget}
        onClose={() => setTerminateTarget(null)}
        onConfirm={(id) => {
          action.mutate({ kind: "terminate", id });
          if (selected === id) setSelected(null);
          setTerminateTarget(null);
        }}
      />
    </div>
  );
}

function TerminateModal({
  instanceId,
  onClose,
  onConfirm,
}: {
  instanceId: string | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={instanceId !== null} onClose={onClose} title={t("ec2.terminateTitle")}>
      <div className="flex flex-col gap-3 text-sm">
        <p>{t("ec2.terminateConfirm", { id: instanceId })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => instanceId && onConfirm(instanceId)}>
            {t("ec2.action.terminate")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

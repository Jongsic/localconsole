import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/autoscaling-api";
import type { AsgSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AsgPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const asgs = useQuery({ queryKey: ["asgs"], queryFn: api.listAutoScalingGroups });
  const current = asgs.data?.find((g) => g.name === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <TrendingUp className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("asg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("asg.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["asgs"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", asgs.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {asgs.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : asgs.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(asgs.error as Error).message}
          </div>
        ) : asgs.data && asgs.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("asg.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("asg.col.capacity")}</th>
                <th className="px-4 py-2 font-medium">{t("asg.col.instances")}</th>
                <th className="px-4 py-2 font-medium">{t("asg.col.healthCheck")}</th>
                <th className="px-4 py-2 font-medium">{t("asg.col.launchTemplate")}</th>
                <th className="px-4 py-2 font-medium">{t("asg.col.azs")}</th>
              </tr>
            </thead>
            <tbody>
              {asgs.data.map((g: AsgSummary) => (
                <tr
                  key={g.name}
                  onClick={() => setSelected(g.name)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === g.name && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{g.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {t("asg.capacityFmt", {
                      min: g.minSize,
                      desired: g.desiredCapacity,
                      max: g.maxSize,
                    })}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{g.instanceCount}</td>
                  <td className="px-4 py-2 text-slate-600">{g.healthCheckType ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{g.launchTemplate ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {g.availabilityZones.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <TrendingUp className="h-10 w-10" />
            <p className="text-sm">{t("asg.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <AsgDetailPanel key={current.name} name={current.name} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}

function AsgDetailPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const detail = useQuery({
    queryKey: ["asg-detail", name],
    queryFn: () => api.getAutoScalingGroupDetail(name),
  });

  return (
    <div className="flex h-80 shrink-0 flex-col border-t bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <button
          type="button"
          title={t("common.close")}
          onClick={onClose}
          className="ml-auto text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {detail.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : detail.isError ? (
          <p className="text-sm text-red-600">{(detail.error as Error).message}</p>
        ) : detail.data ? (
          <div className="flex flex-col gap-6">
            <div>
              <SectionTitle>{t("asg.section.instances")}</SectionTitle>
              {detail.data.instances.length === 0 ? (
                <p className="text-sm text-slate-400">{t("asg.noInstances")}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="py-1 pr-4 font-medium">{t("asg.inst.id")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.inst.lifecycle")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.inst.health")}</th>
                      <th className="py-1 font-medium">{t("asg.inst.az")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.instances.map((i) => (
                      <tr key={i.instanceId} className="border-t border-slate-100">
                        <td className="py-1 pr-4 font-mono text-slate-600">{i.instanceId}</td>
                        <td className="py-1 pr-4 text-slate-600">{i.lifecycleState ?? "—"}</td>
                        <td className="py-1 pr-4 text-slate-600">{i.healthStatus ?? "—"}</td>
                        <td className="py-1 text-slate-600">{i.availabilityZone ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <SectionTitle>{t("asg.section.policies")}</SectionTitle>
              {detail.data.policies.length === 0 ? (
                <p className="text-sm text-slate-400">{t("asg.noPolicies")}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="py-1 pr-4 font-medium">{t("asg.pol.name")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.pol.type")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.pol.metric")}</th>
                      <th className="py-1 font-medium">{t("asg.pol.target")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.policies.map((p) => (
                      <tr key={p.name} className="border-t border-slate-100">
                        <td className="py-1 pr-4 text-slate-600">{p.name}</td>
                        <td className="py-1 pr-4 text-slate-600">{p.type ?? "—"}</td>
                        <td className="py-1 pr-4 text-slate-600">{p.metric ?? "—"}</td>
                        <td className="py-1 text-slate-600">{p.targetValue ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <SectionTitle>{t("asg.section.scheduled")}</SectionTitle>
              {detail.data.scheduledActions.length === 0 ? (
                <p className="text-sm text-slate-400">{t("asg.noScheduled")}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="py-1 pr-4 font-medium">{t("asg.sched.name")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.sched.recurrence")}</th>
                      <th className="py-1 pr-4 font-medium">{t("asg.sched.capacity")}</th>
                      <th className="py-1 font-medium">{t("asg.sched.start")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.scheduledActions.map((s) => (
                      <tr key={s.name} className="border-t border-slate-100">
                        <td className="py-1 pr-4 text-slate-600">{s.name}</td>
                        <td className="py-1 pr-4 font-mono text-slate-500">
                          {s.recurrence ?? "—"}
                        </td>
                        <td className="py-1 pr-4 text-slate-600">
                          {[s.minSize, s.desiredCapacity, s.maxSize]
                            .map((n) => (n == null ? "—" : n))
                            .join(" / ")}
                        </td>
                        <td className="py-1 text-slate-600">
                          {formatDate(s.startTime, i18n.language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

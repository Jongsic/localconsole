import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Target, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/elbv2-api";
import type { TargetGroupSummary, TargetHealthEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_STYLES: Record<string, string> = {
  healthy: "bg-green-100 text-green-700",
  unhealthy: "bg-red-100 text-red-600",
  initial: "bg-amber-100 text-amber-700",
  draining: "bg-slate-100 text-slate-500",
  unused: "bg-slate-100 text-slate-500",
};

export function TargetGroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const tgs = useQuery({ queryKey: ["target-groups"], queryFn: api.listTargetGroups });
  const current = tgs.data?.find((tg) => tg.arn === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <Target className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("tg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("tg.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["target-groups"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", tgs.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {tgs.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : tgs.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(tgs.error as Error).message}
          </div>
        ) : tgs.data && tgs.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("tg.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("tg.col.protocol")}</th>
                <th className="px-4 py-2 font-medium">{t("tg.col.targetType")}</th>
                <th className="px-4 py-2 font-medium">{t("tg.col.vpc")}</th>
                <th className="px-4 py-2 font-medium">{t("tg.col.healthCheck")}</th>
                <th className="px-4 py-2 font-medium">{t("tg.col.loadBalancers")}</th>
              </tr>
            </thead>
            <tbody>
              {tgs.data.map((tg: TargetGroupSummary) => (
                <tr
                  key={tg.arn}
                  onClick={() => setSelected(tg.arn)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === tg.arn && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{tg.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {tg.protocol ?? "—"}
                    {tg.port != null ? `:${tg.port}` : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{tg.targetType ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{tg.vpcId ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {tg.healthCheckProtocol ?? "—"} {tg.healthCheckPath ?? ""}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{tg.loadBalancerArns.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Target className="h-10 w-10" />
            <p className="text-sm">{t("tg.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <HealthPanel
          key={current.arn}
          tgArn={current.arn}
          name={current.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function HealthPanel({
  tgArn,
  name,
  onClose,
}: {
  tgArn: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ["target-health", tgArn],
    queryFn: () => api.getTargetHealth(tgArn),
  });

  return (
    <div className="flex h-72 shrink-0 flex-col border-t bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-400">{t("tg.targets")}</span>
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
        {health.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : health.isError ? (
          <p className="text-sm text-red-600">{(health.error as Error).message}</p>
        ) : health.data && health.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-1 pr-4 font-medium">{t("tg.health.target")}</th>
                <th className="py-1 pr-4 font-medium">{t("tg.health.port")}</th>
                <th className="py-1 pr-4 font-medium">{t("tg.health.state")}</th>
                <th className="py-1 font-medium">{t("tg.health.reason")}</th>
              </tr>
            </thead>
            <tbody>
              {health.data.map((h: TargetHealthEntry) => (
                <tr key={`${h.id}:${h.port}`} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-600">{h.id}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{h.port ?? "—"}</td>
                  <td className="py-1.5 pr-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        (h.state && HEALTH_STYLES[h.state]) ?? "bg-slate-100 text-slate-500",
                      )}
                    >
                      {h.state ?? "—"}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {h.reason ?? ""}
                    {h.description ? ` — ${h.description}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">{t("tg.noTargets")}</p>
        )}
      </div>
    </div>
  );
}

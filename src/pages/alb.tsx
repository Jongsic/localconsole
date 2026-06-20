import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/elbv2-api";
import type { AlbListenerDetail, AlbSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AlbPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const lbs = useQuery({ queryKey: ["load-balancers"], queryFn: api.listLoadBalancers });
  const current = lbs.data?.find((lb) => lb.arn === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <Network className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("alb.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("alb.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["load-balancers"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", lbs.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {lbs.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : lbs.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(lbs.error as Error).message}
          </div>
        ) : lbs.data && lbs.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("alb.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.type")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.scheme")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.state")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.dns")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.vpc")}</th>
                <th className="px-4 py-2 font-medium">{t("alb.col.created")}</th>
              </tr>
            </thead>
            <tbody>
              {lbs.data.map((lb: AlbSummary) => (
                <tr
                  key={lb.arn}
                  onClick={() => setSelected(lb.arn)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === lb.arn && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{lb.name}</td>
                  <td className="px-4 py-2 text-slate-600">{lb.type ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{lb.scheme ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{lb.state ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {lb.dnsName ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{lb.vpcId ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {formatDate(lb.createdTime, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Network className="h-10 w-10" />
            <p className="text-sm">{t("alb.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <ListenersPanel
          key={current.arn}
          lbArn={current.arn}
          name={current.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ListenersPanel({
  lbArn,
  name,
  onClose,
}: {
  lbArn: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const listeners = useQuery({
    queryKey: ["listeners", lbArn],
    queryFn: () => api.getListeners(lbArn),
  });

  return (
    <div className="flex h-80 shrink-0 flex-col border-t bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-400">{t("alb.listeners")}</span>
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
        {listeners.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : listeners.isError ? (
          <p className="text-sm text-red-600">{(listeners.error as Error).message}</p>
        ) : listeners.data && listeners.data.length > 0 ? (
          <div className="flex flex-col gap-5">
            {listeners.data.map((l: AlbListenerDetail) => (
              <div key={l.arn}>
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  {l.protocol}:{l.port}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {t("alb.defaultAction")}: {l.defaultActionType ?? "—"}
                  </span>
                </div>
                {l.rules.length === 0 ? (
                  <p className="text-sm text-slate-400">{t("alb.noRules")}</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="py-1 pr-3 font-medium">{t("alb.priority")}</th>
                        <th className="py-1 pr-3 font-medium">{t("alb.conditions")}</th>
                        <th className="py-1 font-medium">{t("alb.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.rules.map((r, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: rules ordered, no stable id
                        <tr key={i} className="border-t border-slate-100 align-top">
                          <td className="py-1 pr-3 text-slate-600">{r.priority}</td>
                          <td className="py-1 pr-3 font-mono text-slate-500">
                            {r.conditions.length ? r.conditions.join("; ") : "—"}
                          </td>
                          <td className="py-1 font-mono text-slate-500">
                            {r.actions.length ? r.actions.join("; ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("alb.noListeners")}</p>
        )}
      </div>
    </div>
  );
}

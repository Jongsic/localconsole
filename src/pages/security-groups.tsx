import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SecurityGroupCard } from "@/components/sg-rules";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2SecurityGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SecurityGroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const groups = useQuery({ queryKey: ["security-groups"], queryFn: api.listSecurityGroups });
  const current = groups.data?.find((g) => g.groupId === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("sg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("sg.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["security-groups"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", groups.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {groups.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : groups.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(groups.error as Error).message}
          </div>
        ) : groups.data && groups.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("sg.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.id")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.vpc")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.description")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.rules")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g: Ec2SecurityGroup) => (
                <tr
                  key={g.groupId}
                  onClick={() => setSelected(g.groupId)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === g.groupId && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{g.groupName || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{g.groupId}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{g.vpcId ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{g.description ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {t("sg.ruleCount", { in: g.inbound.length, out: g.outbound.length })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <ShieldCheck className="h-10 w-10" />
            <p className="text-sm">{t("sg.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <div className="flex h-72 shrink-0 flex-col border-t bg-white">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="text-sm font-medium text-slate-700">{current.groupName}</span>
            <span className="font-mono text-xs text-slate-500">{current.groupId}</span>
            <button
              type="button"
              title={t("common.close")}
              onClick={() => setSelected(null)}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <SecurityGroupCard group={current} />
          </div>
        </div>
      )}
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResourceError } from "@/components/resource-error";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2VolumeSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function VolumesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const volumes = useQuery({ queryKey: ["volumes"], queryFn: api.listVolumes });

  const attachedTo = (v: Ec2VolumeSummary) =>
    v.attachments.length === 0
      ? "—"
      : v.attachments.map((a) => `${a.instanceId}${a.device ? ` (${a.device})` : ""}`).join(", ");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <HardDrive className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("volume.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("volume.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["volumes"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", volumes.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {volumes.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : volumes.isError ? (
          <ResourceError error={volumes.error} service="EBS" />
        ) : volumes.data && volumes.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("volume.col.id")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.size")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.type")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.iops")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.state")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.encrypted")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.az")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.attachedTo")}</th>
                <th className="px-4 py-2 font-medium">{t("volume.col.created")}</th>
              </tr>
            </thead>
            <tbody>
              {volumes.data.map((v: Ec2VolumeSummary) => (
                <tr key={v.volumeId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{v.volumeId}</td>
                  <td className="px-4 py-2 text-slate-600">{v.size} GiB</td>
                  <td className="px-4 py-2 text-slate-600">{v.volumeType ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.iops ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.state ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.encrypted ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.availabilityZone ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{attachedTo(v)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {formatDate(v.createTime, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <HardDrive className="h-10 w-10" />
            <p className="text-sm">{t("volume.none")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

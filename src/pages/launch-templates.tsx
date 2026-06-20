import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2LaunchTemplateSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function LaunchTemplatesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const templates = useQuery({ queryKey: ["launch-templates"], queryFn: api.listLaunchTemplates });
  const current = templates.data?.find((lt) => lt.launchTemplateId === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <LayoutTemplate className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("lt.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("lt.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["launch-templates"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", templates.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {templates.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : templates.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(templates.error as Error).message}
          </div>
        ) : templates.data && templates.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("lt.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("lt.col.id")}</th>
                <th className="px-4 py-2 font-medium">{t("lt.col.default")}</th>
                <th className="px-4 py-2 font-medium">{t("lt.col.latest")}</th>
                <th className="px-4 py-2 font-medium">{t("lt.col.created")}</th>
              </tr>
            </thead>
            <tbody>
              {templates.data.map((lt: Ec2LaunchTemplateSummary) => (
                <tr
                  key={lt.launchTemplateId}
                  onClick={() => setSelected(lt.launchTemplateId)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected === lt.launchTemplateId && "bg-brand-fg hover:bg-brand-fg",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">
                    {lt.launchTemplateName || "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {lt.launchTemplateId}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{lt.defaultVersionNumber ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{lt.latestVersionNumber ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {formatDate(lt.createTime, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <LayoutTemplate className="h-10 w-10" />
            <p className="text-sm">{t("lt.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <TemplateDetail
          key={current.launchTemplateId}
          launchTemplateId={current.launchTemplateId}
          name={current.launchTemplateName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TemplateDetail({
  launchTemplateId,
  name,
  onClose,
}: {
  launchTemplateId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const version = useQuery({
    queryKey: ["launch-template-version", launchTemplateId],
    queryFn: () => api.getLaunchTemplateVersion(launchTemplateId),
  });

  return (
    <div className="flex h-72 shrink-0 flex-col border-t bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="font-mono text-xs text-slate-500">{launchTemplateId}</span>
        {version.data?.versionNumber != null && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {t("lt.defaultVersion", { n: version.data.versionNumber })}
          </span>
        )}
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
        {version.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : version.isError ? (
          <p className="text-sm text-red-600">{(version.error as Error).message}</p>
        ) : version.data ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <KV label={t("lt.field.ami")} value={version.data.imageId} mono />
            <KV label={t("lt.field.instanceType")} value={version.data.instanceType} />
            <KV label={t("lt.field.keyName")} value={version.data.keyName} />
            <KV
              label={t("lt.field.securityGroups")}
              value={
                [...version.data.securityGroupIds, ...version.data.securityGroups].join(", ") ||
                null
              }
              mono
            />
            <KV label={t("lt.field.iamRole")} value={version.data.iamInstanceProfileArn} mono />
            <KV
              label={t("lt.field.imdsv2")}
              value={
                version.data.metadataHttpTokens
                  ? `${version.data.metadataHttpTokens}${
                      version.data.metadataHopLimit != null
                        ? ` (hop ${version.data.metadataHopLimit})`
                        : ""
                    }`
                  : null
              }
            />
            <KV
              label={t("lt.field.userData")}
              value={version.data.userDataPresent ? t("common.yes") : t("common.no")}
            />
            <KV
              label={t("lt.field.blockDevices")}
              value={
                version.data.blockDevices
                  .map((b) =>
                    `${b.deviceName ?? "?"}: ${b.size ?? "?"}GiB ${b.volumeType ?? ""}${
                      b.encrypted ? " 🔒" : ""
                    }`.trim(),
                  )
                  .join("  ·  ") || null
              }
              mono
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">{label}</div>
      <div className={cn("text-sm text-slate-700", mono && "break-all font-mono text-xs")}>
        {value || "—"}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader, ResourceTable, Td, Th, Tr } from "@/components/kit";
import { useToast } from "@/components/toast";
import { Button, Modal } from "@/components/ui";
import { api } from "@/lib/lambda-api";
import type { LambdaLayerSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function LambdaLayersPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<LambdaLayerSummary | null>(null);

  const layers = useQuery({ queryKey: ["lambda-layers"], queryFn: api.listLayers });

  const del = useMutation({
    mutationFn: (l: LambdaLayerSummary) =>
      api.deleteLayerVersion(l.layerName, l.latestVersion ?? 0),
    onSuccess: () => {
      toast.success(t("function.layer.deleted"));
      qc.invalidateQueries({ queryKey: ["lambda-layers"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Layers}
        title={t("function.layer.heading")}
        subtitle={t("function.layer.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["lambda-layers"] })}
        refreshing={layers.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={layers.isLoading}
          isError={layers.isError}
          error={layers.error}
          service="Lambda"
          data={layers.data}
          getKey={(l) => l.layerName}
          empty={{ icon: Layers, message: t("function.layer.none") }}
          head={
            <tr>
              <Th>{t("function.layer.col.name")}</Th>
              <Th>{t("function.layer.col.latestVersion")}</Th>
              <Th>{t("function.layer.col.runtimes")}</Th>
              <Th>{t("function.layer.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(l: LambdaLayerSummary) => (
            <Tr key={l.layerName}>
              <Td className="font-medium text-slate-700">{l.layerName}</Td>
              <Td>{l.latestVersion ?? "—"}</Td>
              <Td muted>
                {l.compatibleRuntimes.length > 0 ? l.compatibleRuntimes.join(", ") : "—"}
              </Td>
              <Td muted>{formatDate(l.createdDate, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={() => setDeleteTarget(l)}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("function.layer.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {t("function.layer.deleteConfirm", {
              name: deleteTarget?.layerName,
              version: deleteTarget?.latestVersion,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

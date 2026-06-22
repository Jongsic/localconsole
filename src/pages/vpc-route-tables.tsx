import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Route, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  DefinitionGrid,
  KV,
  PageHeader,
  PanelHeader,
  ResourceTable,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { useToast } from "@/components/toast";
import { Button, CONTROL_CLASS, Field, FieldLabel, Modal, Select } from "@/components/ui";
import { VpcTagsCard } from "@/components/vpc-tags-card";
import type { RouteEntry, RouteTableSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/vpc-api";

export function VpcRouteTablesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RouteTableSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const tables = useQuery({ queryKey: ["route-tables"], queryFn: api.listRouteTables });
  const current = tables.data?.find((rt) => rt.routeTableId === selected) ?? null;

  const del = useMutation({
    mutationFn: (id: string) => api.deleteRouteTable(id),
    onSuccess: (_d, id) => {
      toast.success(t("vpc.rt.deleted"));
      qc.invalidateQueries({ queryKey: ["route-tables"] });
      if (selected === id) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Route}
        title={t("vpc.rt.heading")}
        subtitle={t("vpc.section")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["route-tables"] })}
        refreshing={tables.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("vpc.rt.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={tables.isLoading}
          isError={tables.isError}
          error={tables.error}
          service="VPC route tables"
          data={tables.data}
          getKey={(rt) => rt.routeTableId}
          empty={{ icon: Route, message: t("vpc.rt.none") }}
          head={
            <tr>
              <Th>{t("vpc.rt.col.name")}</Th>
              <Th>{t("vpc.rt.col.id")}</Th>
              <Th>{t("vpc.rt.col.vpc")}</Th>
              <Th>{t("vpc.rt.col.main")}</Th>
              <Th>{t("vpc.rt.col.routes")}</Th>
              <Th>{t("vpc.rt.col.associations")}</Th>
              <Th />
            </tr>
          }
          row={(rt: RouteTableSummary) => (
            <Tr
              key={rt.routeTableId}
              onClick={() => setSelected(rt.routeTableId)}
              selected={selected === rt.routeTableId}
            >
              <Td className="font-medium text-slate-700">{rt.name || "—"}</Td>
              <Td mono>{rt.routeTableId}</Td>
              <Td mono>{rt.vpcId ?? "—"}</Td>
              <Td>{rt.main ? "✓" : "—"}</Td>
              <Td>{rt.routes.length}</Td>
              <Td>{rt.associationCount}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  disabled={rt.main}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(rt);
                  }}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      {current && (
        <RouteTableDetailPanel
          key={current.routeTableId}
          table={current}
          onClose={() => setSelected(null)}
        />
      )}

      <CreateRouteTableModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vpc.rt.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("vpc.rt.deleteConfirm", { id: deleteTarget?.routeTableId })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.routeTableId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RouteTableDetailPanel({
  table,
  onClose,
}: {
  table: RouteTableSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ResizableBottomPanel storageKey="oc_panel_h_rt">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="font-mono text-xs text-slate-500">{table.routeTableId}</span>
        {table.name && <span className="text-sm font-semibold text-slate-900">{table.name}</span>}
      </PanelHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <DefinitionGrid>
          <KV label={t("vpc.rt.col.id")} value={table.routeTableId} mono />
          <KV label={t("vpc.rt.col.vpc")} value={table.vpcId} mono />
          <KV label={t("vpc.rt.col.main")} value={table.main ? t("common.yes") : t("common.no")} />
          <KV label={t("vpc.rt.detail.ownerId")} value={table.ownerId} mono />
          <KV
            label={t("vpc.rt.detail.propagatingVgws")}
            value={table.propagatingVgws.length > 0 ? table.propagatingVgws.join(", ") : null}
            mono
          />
          <KV label={t("vpc.rt.detail.associations")} className="col-span-2 md:col-span-3">
            {table.associations.length > 0 ? (
              <ul className="space-y-0.5">
                {table.associations.map((a) => (
                  <li
                    key={a.subnetId ?? (a.main ? "main" : "assoc")}
                    className="flex flex-wrap gap-x-4 break-all font-mono text-xs text-slate-800"
                  >
                    <span>
                      {a.main
                        ? t("vpc.rt.detail.associationMain")
                        : (a.subnetId ?? t("vpc.rt.detail.associationSubnet"))}
                    </span>
                    {a.state && <span className="text-slate-400">({a.state})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-slate-800">{t("vpc.rt.detail.noAssociations")}</span>
            )}
          </KV>
        </DefinitionGrid>
        <RouteEditor table={table} />
        <VpcTagsCard
          resourceId={table.routeTableId}
          tags={table.tags}
          invalidateKey={["route-tables"]}
        />
      </div>
    </ResizableBottomPanel>
  );
}

function RouteEditor({ table }: { table: RouteTableSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [destination, setDestination] = useState("0.0.0.0/0");
  const [gatewayId, setGatewayId] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["route-tables"] });

  const add = useMutation({
    mutationFn: () =>
      api.createRoute({
        routeTableId: table.routeTableId,
        destinationCidrBlock: destination.trim(),
        gatewayId: gatewayId.trim(),
      }),
    onSuccess: () => {
      toast.success(t("vpc.rt.routeAdded"));
      setGatewayId("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (r: RouteEntry) => api.deleteRoute(table.routeTableId, r.destination),
    onSuccess: () => {
      toast.success(t("vpc.rt.routeRemoved"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card title={t("vpc.rt.routes")}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("vpc.rt.route.destination")}</th>
              <th className="px-3 py-2 font-semibold">{t("vpc.rt.route.target")}</th>
              <th className="px-3 py-2 font-semibold">{t("vpc.rt.route.state")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.routes.map((r) => (
              <tr key={`${r.destination}|${r.target}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-slate-700">{r.destination}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{r.target}</td>
                <td className="px-3 py-2 text-slate-500">{r.state ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {r.target !== "local" && (
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={() => remove.mutate(r)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {table.routes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  {t("vpc.rt.route.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("vpc.rt.route.destination")}</FieldLabel>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="0.0.0.0/0"
            className={cn(CONTROL_CLASS, "w-40 py-1.5 font-mono")}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <FieldLabel>{t("vpc.rt.route.target")}</FieldLabel>
          <input
            value={gatewayId}
            onChange={(e) => setGatewayId(e.target.value)}
            placeholder="igw-… / nat-… / vgw-…"
            className={cn(CONTROL_CLASS, "w-full min-w-[12rem] py-1.5 font-mono")}
          />
        </label>
        <Button
          loading={add.isPending}
          disabled={!destination.trim() || !gatewayId.trim()}
          onClick={() => add.mutate()}
        >
          <Plus className="h-3.5 w-3.5" /> {t("vpc.rt.addRoute")}
        </Button>
      </div>
    </Card>
  );
}

function CreateRouteTableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [vpcId, setVpcId] = useState("");

  const vpcs = useQuery({ queryKey: ["vpcs"], queryFn: api.listVpcs, enabled: open });

  const create = useMutation({
    mutationFn: () => api.createRouteTable(vpcId.trim()),
    onSuccess: () => {
      toast.success(t("vpc.rt.created"));
      qc.invalidateQueries({ queryKey: ["route-tables"] });
      setVpcId("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("vpc.rt.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("vpc.rt.col.vpc")}>
          <Select value={vpcId} onChange={(e) => setVpcId(e.target.value)}>
            <option value="">{t("vpc.rt.pickVpc")}</option>
            {(vpcs.data ?? []).map((v) => (
              <option key={v.vpcId} value={v.vpcId}>
                {v.vpcId}
                {v.name ? ` (${v.name})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!vpcId.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

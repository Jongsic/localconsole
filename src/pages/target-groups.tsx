import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Target, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { ResourceError } from "@/components/resource-error";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Spinner, TextInput } from "@/components/ui";
import { api as ec2 } from "@/lib/ec2-api";
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
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TargetGroupSummary | null>(null);

  const tgs = useQuery({ queryKey: ["target-groups"], queryFn: api.listTargetGroups });
  const current = tgs.data?.find((tg) => tg.arn === selected) ?? null;

  const del = useMutation({
    mutationFn: (arn: string) => api.deleteTargetGroup(arn),
    onSuccess: (_d, arn) => {
      toast.success(t("tg.deleted"));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
      if (selected === arn) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <Target className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("tg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("tg.subtitle")}</div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("tg.create")}
        </Button>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["target-groups"] })}
          className="ml-1 text-slate-400 hover:text-slate-600"
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
          <ResourceError error={tgs.error} service="ELBv2 target groups" />
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
                <th className="px-4 py-2" />
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
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(tg);
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
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

      {current && <HealthPanel key={current.arn} tg={current} onClose={() => setSelected(null)} />}

      <CreateTgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("tg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("tg.deleteConfirm", { name: deleteTarget?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.arn)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Health-check summary (read-only) + editable attributes (stickiness / dereg delay / algorithm). */
function TgAttributes({ tg }: { tg: TargetGroupSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const attrs = useQuery({
    queryKey: ["tg-attributes", tg.arn],
    queryFn: () => api.getTargetGroupAttributes(tg.arn),
  });

  const [stickiness, setStickiness] = useState(false);
  const [duration, setDuration] = useState(86400);
  const [dereg, setDereg] = useState(300);
  const [algo, setAlgo] = useState("round_robin");
  // sync once data arrives
  useEffect(() => {
    if (attrs.data) {
      setStickiness(attrs.data.stickinessEnabled);
      setDuration(attrs.data.stickinessDurationSeconds);
      setDereg(attrs.data.deregistrationDelaySeconds);
      setAlgo(attrs.data.loadBalancingAlgorithm);
    }
  }, [attrs.data]);

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.modifyTargetGroupAttributes(tg.arn, {
        stickinessEnabled: stickiness,
        stickinessType: attrs.data?.stickinessType ?? "lb_cookie",
        stickinessDurationSeconds: duration,
        deregistrationDelaySeconds: dereg,
        loadBalancingAlgorithm: algo,
      }),
    onSuccess: () => toast.success(t("tg.attrsSaved")),
    onError: (e) => toast.error((e as Error).message),
  });

  // Health-check editor (ModifyTargetGroup) — only meaningful for HTTP/HTTPS target groups.
  const isHttp = (tg.healthCheckProtocol ?? "").startsWith("HTTP");
  const [hcPath, setHcPath] = useState(tg.healthCheckPath ?? "/");
  const [hcInterval, setHcInterval] = useState(tg.healthCheckIntervalSeconds ?? 30);
  const [hcTimeout, setHcTimeout] = useState(tg.healthCheckTimeoutSeconds ?? 5);
  const [hcHealthy, setHcHealthy] = useState(tg.healthyThreshold ?? 5);
  const [hcUnhealthy, setHcUnhealthy] = useState(tg.unhealthyThreshold ?? 2);
  const [hcMatcher, setHcMatcher] = useState(tg.matcherHttpCode ?? "200");

  const saveHc = useMutation({
    mutationFn: () =>
      api.modifyHealthCheck(tg.arn, {
        path: hcPath,
        intervalSeconds: hcInterval,
        timeoutSeconds: hcTimeout,
        healthyThreshold: hcHealthy,
        unhealthyThreshold: hcUnhealthy,
        matcherHttpCode: hcMatcher,
      }),
    onSuccess: () => {
      toast.success(t("tg.hcSaved"));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const tags = useQuery({ queryKey: ["tg-tags", tg.arn], queryFn: () => api.getTags(tg.arn) });
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(tg.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["tg-tags", tg.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const numCls =
    "w-16 rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand";

  return (
    <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
      {/* health check */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <span className="self-center font-medium uppercase text-slate-400">
          {t("tg.healthCheck")}
        </span>
        {isHttp && (
          <label className="flex flex-col gap-1 text-slate-500">
            {t("tg.hcPath")}
            <input
              value={hcPath}
              onChange={(e) => setHcPath(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1 font-mono outline-none focus:border-brand"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.hcInterval")}
          <input
            type="number"
            min={1}
            value={hcInterval}
            onChange={(e) => setHcInterval(Math.max(1, Number(e.target.value) || 1))}
            className={numCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.hcTimeout")}
          <input
            type="number"
            min={1}
            value={hcTimeout}
            onChange={(e) => setHcTimeout(Math.max(1, Number(e.target.value) || 1))}
            className={numCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.hcHealthy")}
          <input
            type="number"
            min={1}
            value={hcHealthy}
            onChange={(e) => setHcHealthy(Math.max(1, Number(e.target.value) || 1))}
            className={numCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.hcUnhealthy")}
          <input
            type="number"
            min={1}
            value={hcUnhealthy}
            onChange={(e) => setHcUnhealthy(Math.max(1, Number(e.target.value) || 1))}
            className={numCls}
          />
        </label>
        {isHttp && (
          <label className="flex flex-col gap-1 text-slate-500">
            {t("tg.hcMatcher")}
            <input
              value={hcMatcher}
              onChange={(e) => setHcMatcher(e.target.value)}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 font-mono outline-none focus:border-brand"
            />
          </label>
        )}
        <Button variant="secondary" loading={saveHc.isPending} onClick={() => saveHc.mutate()}>
          {t("common.apply")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
        <label className="flex items-center gap-1.5 text-slate-600">
          <input
            type="checkbox"
            checked={stickiness}
            onChange={(e) => setStickiness(e.target.checked)}
          />
          {t("tg.stickiness")}
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.stickinessDuration")}
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
            disabled={!stickiness}
            className="w-24 rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand disabled:bg-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.deregDelay")}
          <input
            type="number"
            value={dereg}
            onChange={(e) => setDereg(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          {t("tg.algorithm")}
          <select
            value={algo}
            onChange={(e) => setAlgo(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand"
          >
            <option value="round_robin">round_robin</option>
            <option value="least_outstanding_requests">least_outstanding_requests</option>
          </select>
        </label>
        <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
          {t("common.apply")}
        </Button>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="mb-2 font-medium uppercase text-slate-400">{t("tags.heading")}</div>
        <TagsEditor
          current={tags.data ?? []}
          saving={saveTags.isPending}
          onSave={(tg2, removed) => saveTags.mutate({ tags: tg2, removed })}
        />
      </div>
    </div>
  );
}

function HealthPanel({ tg, onClose }: { tg: TargetGroupSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const health = useQuery({
    queryKey: ["target-health", tg.arn],
    queryFn: () => api.getTargetHealth(tg.arn),
  });
  const instances = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: ec2.listInstances,
    enabled: tg.targetType === "instance",
  });

  const [targetId, setTargetId] = useState("");
  const [port, setPort] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["target-health", tg.arn] });

  const register = useMutation({
    mutationFn: () =>
      api.registerTarget(tg.arn, targetId.trim(), port.trim() ? Number(port) : null),
    onSuccess: () => {
      toast.success(t("tg.registered"));
      setTargetId("");
      setPort("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deregister = useMutation({
    mutationFn: (h: TargetHealthEntry) => api.deregisterTarget(tg.arn, h.id, h.port),
    onSuccess: () => {
      toast.success(t("tg.deregistered"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_tg">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{tg.name}</span>
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
        <TgAttributes tg={tg} />

        {/* register a new target */}
        <div className="mb-4 flex items-end gap-1.5">
          {tg.targetType === "instance" ? (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
            >
              <option value="">{t("tg.pickInstance")}</option>
              {(instances.data ?? []).map((i) => (
                <option key={i.instanceId} value={i.instanceId}>
                  {i.name ? `${i.name} — ` : ""}
                  {i.instanceId}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={t("tg.targetIp")}
              className="w-40 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs outline-none focus:border-brand"
            />
          )}
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder={tg.port != null ? String(tg.port) : t("tg.port")}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          />
          <Button
            variant="secondary"
            loading={register.isPending}
            disabled={!targetId.trim()}
            onClick={() => register.mutate()}
          >
            <Plus className="h-3.5 w-3.5" /> {t("tg.register")}
          </Button>
        </div>

        {health.isLoading ? (
          <div className="flex justify-center py-6">
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
                <th className="py-1 pr-4 font-medium">{t("tg.health.reason")}</th>
                <th className="py-1" />
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
                  <td className="py-1.5 pr-4 text-xs text-slate-500">
                    {h.reason ?? ""}
                    {h.description ? ` — ${h.description}` : ""}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      title={t("tg.deregister")}
                      onClick={() => deregister.mutate(h)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">{t("tg.noTargets")}</p>
        )}
      </div>
    </ResizableBottomPanel>
  );
}

const TG_PROTOCOLS = ["HTTP", "HTTPS", "TCP", "TLS", "UDP"];

function CreateTgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState("HTTP");
  const [port, setPort] = useState("80");
  const [targetType, setTargetType] = useState<"instance" | "ip">("instance");
  const [vpcId, setVpcId] = useState("");
  const [healthCheckPath, setHealthCheckPath] = useState("/");

  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const vpcIds = Array.from(
    new Set((subnets.data ?? []).map((s) => s.vpcId).filter(Boolean) as string[]),
  );

  const create = useMutation({
    mutationFn: () =>
      api.createTargetGroup({
        name: name.trim(),
        protocol,
        port: Number(port) || 80,
        targetType,
        vpcId: vpcId.trim() || undefined,
        healthCheckPath: protocol.startsWith("HTTP") ? healthCheckPath.trim() || "/" : undefined,
      }),
    onSuccess: () => {
      toast.success(t("tg.created", { name }));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("tg.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("tg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tg.col.protocol")}>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {TG_PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("tg.port")}>
            <TextInput type="number" value={port} onChange={(e) => setPort(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tg.col.targetType")}>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "instance" | "ip")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="instance">instance</option>
              <option value="ip">ip</option>
            </select>
          </Field>
          <Field label={t("tg.col.vpc")}>
            <select
              value={vpcId}
              onChange={(e) => setVpcId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">{t("sg.defaultVpc")}</option>
              {vpcIds.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {protocol.startsWith("HTTP") && (
          <Field label={t("tg.healthCheckPath")}>
            <TextInput
              value={healthCheckPath}
              onChange={(e) => setHealthCheckPath(e.target.value)}
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

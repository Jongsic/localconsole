import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Network, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ResourceError } from "@/components/resource-error";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Spinner, TextInput } from "@/components/ui";
import { api as ec2 } from "@/lib/ec2-api";
import { api } from "@/lib/elbv2-api";
import type { AlbListenerDetail, AlbSummary, TargetGroupSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AlbPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlbSummary | null>(null);

  const lbs = useQuery({ queryKey: ["load-balancers"], queryFn: api.listLoadBalancers });

  const del = useMutation({
    mutationFn: (arn: string) => api.deleteLoadBalancer(arn),
    onSuccess: () => {
      toast.success(t("alb.deleted"));
      qc.invalidateQueries({ queryKey: ["load-balancers"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <Network className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("alb.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("alb.subtitle")}</div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("alb.create")}
        </Button>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["load-balancers"] })}
          className="ml-1 text-slate-400 hover:text-slate-600"
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
          <ResourceError error={lbs.error} service="ELBv2 (load balancers)" />
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
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {lbs.data.map((lb: AlbSummary) => (
                <tr
                  key={lb.arn}
                  onClick={() => navigate(encodeURIComponent(lb.name))}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 font-medium text-brand hover:underline">{lb.name}</td>
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
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(lb);
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
            <Network className="h-10 w-10" />
            <p className="text-sm">{t("alb.none")}</p>
          </div>
        )}
      </div>

      <CreateAlbModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("alb.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("alb.deleteConfirm", { name: deleteTarget?.name })}</p>
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

export function AlbDetailPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { lbName = "" } = useParams();
  const name = decodeURIComponent(lbName);

  const lbs = useQuery({ queryKey: ["load-balancers"], queryFn: api.listLoadBalancers });
  const lb = lbs.data?.find((x) => x.name === name) ?? null;

  const listeners = useQuery({
    queryKey: ["listeners", lb?.arn],
    queryFn: () => api.getListeners(lb?.arn ?? ""),
    enabled: Boolean(lb?.arn),
  });
  const tgs = useQuery({ queryKey: ["target-groups"], queryFn: api.listTargetGroups });

  const [protocol, setProtocol] = useState("HTTP");
  const [port, setPort] = useState("80");
  const [actionType, setActionType] = useState<"forward" | "fixed-response">("forward");
  const [tgArn, setTgArn] = useState("");
  const [statusCode, setStatusCode] = useState("404");
  const [body, setBody] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["listeners", lb?.arn] });

  const addListener = useMutation({
    mutationFn: () =>
      api.createListener({
        loadBalancerArn: lb?.arn ?? "",
        protocol,
        port: Number(port) || 80,
        action:
          actionType === "forward"
            ? { type: "forward", targetGroupArn: tgArn }
            : { type: "fixed-response", statusCode, contentType: "text/plain", body },
      }),
    onSuccess: () => {
      toast.success(t("alb.listenerCreated"));
      setTgArn("");
      setBody("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canAdd =
    port.trim() !== "" && (actionType === "forward" ? tgArn !== "" : statusCode.trim() !== "");

  const delListener = useMutation({
    mutationFn: (arn: string) => api.deleteListener(arn),
    onSuccess: () => {
      toast.success(t("alb.listenerDeleted"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <button
          type="button"
          title={t("common.back")}
          onClick={() => navigate("/compute/load-balancers")}
          className="text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{name}</div>
          <div className="font-mono text-[11px] text-slate-400">
            {lb?.type ?? ""}
            {lb?.scheme ? ` · ${lb.scheme}` : ""}
            {lb?.dnsName ? ` · ${lb.dnsName}` : ""}
          </div>
        </div>
        <span className="text-xs text-slate-400">{t("alb.listeners")}</span>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={refresh}
          className="ml-1 text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", listeners.isFetching && "animate-spin")} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {lb && <AlbAttributesSection lb={lb} />}

        <div className="mb-2 mt-4 text-[11px] font-medium uppercase text-slate-400">
          {t("alb.listeners")}
        </div>
        {/* create listener */}
        <div className="mb-4 flex items-end gap-1.5">
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          >
            {["HTTP", "HTTPS", "TCP"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder={t("tg.port")}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          />
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as "forward" | "fixed-response")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          >
            <option value="forward">{t("alb.actionForward")}</option>
            <option value="fixed-response">{t("alb.actionFixed")}</option>
          </select>
          {actionType === "forward" ? (
            <select
              value={tgArn}
              onChange={(e) => setTgArn(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
            >
              <option value="">{t("alb.pickTargetGroup")}</option>
              {(tgs.data ?? []).map((tg) => (
                <option key={tg.arn} value={tg.arn}>
                  {tg.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                placeholder="404"
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
              />
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("alb.responseBody")}
                className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
              />
            </>
          )}
          <Button
            variant="secondary"
            loading={addListener.isPending}
            disabled={!canAdd}
            onClick={() => addListener.mutate()}
          >
            <Plus className="h-3.5 w-3.5" /> {t("alb.addListener")}
          </Button>
        </div>

        {listeners.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : listeners.isError ? (
          <p className="text-sm text-red-600">{(listeners.error as Error).message}</p>
        ) : listeners.data && listeners.data.length > 0 ? (
          <div className="flex flex-col gap-5">
            {listeners.data.map((l: AlbListenerDetail) => (
              <ListenerCard
                key={l.arn}
                listener={l}
                targetGroups={tgs.data ?? []}
                onDeleteListener={() => delListener.mutate(l.arn)}
                onChanged={refresh}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("alb.noListeners")}</p>
        )}
      </div>
    </div>
  );
}

/** Load-balancer attributes (idle timeout / deletion protection / http2) + tags. */
function AlbAttributesSection({ lb }: { lb: AlbSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const attrs = useQuery({
    queryKey: ["lb-attributes", lb.arn],
    queryFn: () => api.getLoadBalancerAttributes(lb.arn),
  });
  const tags = useQuery({ queryKey: ["lb-tags", lb.arn], queryFn: () => api.getTags(lb.arn) });

  const [idle, setIdle] = useState(60);
  const [delProt, setDelProt] = useState(false);
  const [http2, setHttp2] = useState(true);
  useEffect(() => {
    if (attrs.data) {
      setIdle(attrs.data.idleTimeoutSeconds);
      setDelProt(attrs.data.deletionProtection);
      setHttp2(attrs.data.http2Enabled);
    }
  }, [attrs.data]);

  const saveAttrs = useMutation({
    mutationFn: () =>
      api.modifyLoadBalancerAttributes(lb.arn, {
        idleTimeoutSeconds: idle,
        deletionProtection: delProt,
        http2Enabled: http2,
      }),
    onSuccess: () => toast.success(t("alb.attrsSaved")),
    onError: (e) => toast.error((e as Error).message),
  });

  const qc = useQueryClient();
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(lb.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["lb-tags", lb.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-5 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase text-slate-400">
          {t("alb.attributes")}
        </div>
        <div className="flex flex-wrap items-end gap-3 text-xs text-slate-500">
          <label className="flex flex-col gap-1">
            {t("alb.idleTimeout")}
            <input
              type="number"
              min={1}
              value={idle}
              onChange={(e) => setIdle(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={delProt}
              onChange={(e) => setDelProt(e.target.checked)}
            />
            {t("alb.deletionProtection")}
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={http2} onChange={(e) => setHttp2(e.target.checked)} />
            {t("alb.http2")}
          </label>
          <Button
            variant="secondary"
            loading={saveAttrs.isPending}
            onClick={() => saveAttrs.mutate()}
          >
            {t("common.apply")}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-medium uppercase text-slate-400">
          {t("tags.heading")}
        </div>
        <TagsEditor
          current={tags.data ?? []}
          saving={saveTags.isPending}
          onSave={(tg, removed) => saveTags.mutate({ tags: tg, removed })}
        />
      </div>
    </div>
  );
}

function ListenerCard({
  listener,
  targetGroups,
  onDeleteListener,
  onChanged,
}: {
  listener: AlbListenerDetail;
  targetGroups: TargetGroupSummary[];
  onDeleteListener: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [priority, setPriority] = useState("10");
  const [field, setField] = useState<"path-pattern" | "host-header">("path-pattern");
  const [values, setValues] = useState("");
  const [tgArn, setTgArn] = useState("");

  const tags = useQuery({
    queryKey: ["listener-tags", listener.arn],
    queryFn: () => api.getTags(listener.arn),
    enabled: showTags,
  });
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(listener.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["listener-tags", listener.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addRule = useMutation({
    mutationFn: () =>
      api.createRule({
        listenerArn: listener.arn,
        priority: Number(priority) || 1,
        conditionField: field,
        values,
        targetGroupArn: tgArn,
      }),
    onSuccess: () => {
      toast.success(t("alb.ruleCreated"));
      setValues("");
      setTgArn("");
      setAdding(false);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delRule = useMutation({
    mutationFn: (ruleArn: string) => api.deleteRule(ruleArn),
    onSuccess: () => {
      toast.success(t("alb.ruleDeleted"));
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {listener.protocol}:{listener.port}
        <span className="text-xs font-normal text-slate-400">
          {t("alb.defaultAction")}: {listener.defaultActionType ?? "—"}
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-normal text-brand hover:underline"
        >
          + {t("alb.addRule")}
        </button>
        <button
          type="button"
          onClick={() => setShowTags((v) => !v)}
          className="text-xs font-normal text-brand hover:underline"
        >
          {t("tags.heading")}
        </button>
        <button
          type="button"
          title={t("alb.deleteListener")}
          onClick={onDeleteListener}
          className="text-slate-400 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showTags && (
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase text-slate-400">
            {t("tags.heading")}
          </div>
          <TagsEditor
            current={tags.data ?? []}
            saving={saveTags.isPending}
            onSave={(tg, removed) => saveTags.mutate({ tags: tg, removed })}
          />
        </div>
      )}

      {adding && (
        <div className="mb-2 flex flex-wrap items-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder={t("alb.priority")}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          />
          <select
            value={field}
            onChange={(e) => setField(e.target.value as "path-pattern" | "host-header")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          >
            <option value="path-pattern">path</option>
            <option value="host-header">host</option>
          </select>
          <input
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder={field === "path-pattern" ? "/api/*" : "api.example.com"}
            className="w-40 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs outline-none focus:border-brand"
          />
          <select
            value={tgArn}
            onChange={(e) => setTgArn(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
          >
            <option value="">{t("alb.pickTargetGroup")}</option>
            {targetGroups.map((tg) => (
              <option key={tg.arn} value={tg.arn}>
                {tg.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            loading={addRule.isPending}
            disabled={!values.trim() || !tgArn || !priority.trim()}
            onClick={() => addRule.mutate()}
          >
            {t("common.add")}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-20 px-3 py-2 font-medium">{t("alb.priority")}</th>
              <th className="px-3 py-2 font-medium">{t("alb.conditions")}</th>
              <th className="px-3 py-2 font-medium">{t("alb.actions")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listener.rules.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules ordered, no stable id
              <tr key={i} className="align-top hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700">
                  {r.isDefault ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {r.priority}
                    </span>
                  ) : (
                    r.priority
                  )}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-500">
                  {r.conditions.length ? r.conditions.join("; ") : "—"}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-500">
                  {r.actions.length ? r.actions.join("; ") : "—"}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {!r.isDefault && (
                    <button
                      type="button"
                      title={t("alb.deleteRule")}
                      onClick={() => delRule.mutate(r.arn)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAlbModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<"internet-facing" | "internal">("internet-facing");
  const [type, setType] = useState<"application" | "network">("application");
  const [subnetIds, setSubnetIds] = useState<string[]>([]);
  const [sgIds, setSgIds] = useState<string[]>([]);

  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const sgs = useQuery({
    queryKey: ["security-groups"],
    queryFn: ec2.listSecurityGroups,
    enabled: open,
  });

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = useMutation({
    mutationFn: () =>
      api.createLoadBalancer({
        name: name.trim(),
        scheme,
        type,
        subnetIds,
        securityGroupIds: sgIds,
      }),
    onSuccess: () => {
      toast.success(t("alb.created", { name }));
      qc.invalidateQueries({ queryKey: ["load-balancers"] });
      setName("");
      setSubnetIds([]);
      setSgIds([]);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("alb.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("alb.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("alb.col.type")}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "application" | "network")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="application">application</option>
              <option value="network">network</option>
            </select>
          </Field>
          <Field label={t("alb.col.scheme")}>
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as "internet-facing" | "internal")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="internet-facing">internet-facing</option>
              <option value="internal">internal</option>
            </select>
          </Field>
        </div>

        <Field label={t("alb.subnets")}>
          <div className="max-h-28 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
            {(subnets.data ?? []).map((s) => (
              <label
                key={s.subnetId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50",
                  subnetIds.includes(s.subnetId) && "bg-brand-fg",
                )}
              >
                <input
                  type="checkbox"
                  checked={subnetIds.includes(s.subnetId)}
                  onChange={() => toggle(setSubnetIds, s.subnetId)}
                />
                <span className="font-mono text-slate-600">{s.subnetId}</span>
                <span className="text-slate-400">{s.availabilityZone}</span>
              </label>
            ))}
          </div>
          <span className="text-xs text-slate-400">{t("alb.subnetsHint")}</span>
        </Field>

        <Field label={t("ec2.launch.securityGroups")}>
          <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
            {(sgs.data ?? []).map((g) => (
              <label
                key={g.groupId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50",
                  sgIds.includes(g.groupId) && "bg-brand-fg",
                )}
              >
                <input
                  type="checkbox"
                  checked={sgIds.includes(g.groupId)}
                  onChange={() => toggle(setSgIds, g.groupId)}
                />
                <span className="font-medium text-slate-700">{g.groupName}</span>
                <span className="font-mono text-slate-400">{g.groupId}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || subnetIds.length === 0}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

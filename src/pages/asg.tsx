import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Spinner, TextInput } from "@/components/ui";
import { api } from "@/lib/autoscaling-api";
import { api as ec2 } from "@/lib/ec2-api";
import { api as elbv2 } from "@/lib/elbv2-api";
import type { AsgSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AsgPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const asgs = useQuery({ queryKey: ["asgs"], queryFn: api.listAutoScalingGroups });
  const current = asgs.data?.find((g) => g.name === selected) ?? null;

  const del = useMutation({
    mutationFn: (name: string) => api.deleteAutoScalingGroup(name, true),
    onSuccess: (_d, name) => {
      toast.success(t("asg.deleted"));
      qc.invalidateQueries({ queryKey: ["asgs"] });
      if (selected === name) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <TrendingUp className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("asg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("asg.subtitle")}</div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("asg.create")}
        </Button>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["asgs"] })}
          className="ml-1 text-slate-400 hover:text-slate-600"
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
          <ResourceError error={asgs.error} service="Auto Scaling" />
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
                <th className="px-4 py-2" />
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
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(g.name);
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
            <TrendingUp className="h-10 w-10" />
            <p className="text-sm">{t("asg.none")}</p>
          </div>
        )}
      </div>

      {current && (
        <AsgDetailPanel key={current.name} name={current.name} onClose={() => setSelected(null)} />
      )}

      <CreateAsgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("asg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("asg.deleteConfirm", { name: deleteTarget })}</p>
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

function CreateAsgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [launchTemplateId, setLaunchTemplateId] = useState("");
  const [minSize, setMinSize] = useState(1);
  const [maxSize, setMaxSize] = useState(2);
  const [desired, setDesired] = useState(1);
  const [subnetIds, setSubnetIds] = useState<string[]>([]);
  const [targetGroupArns, setTargetGroupArns] = useState<string[]>([]);

  const templates = useQuery({
    queryKey: ["launch-templates"],
    queryFn: ec2.listLaunchTemplates,
    enabled: open,
  });
  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const tgs = useQuery({
    queryKey: ["target-groups"],
    queryFn: elbv2.listTargetGroups,
    enabled: open,
  });

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = useMutation({
    mutationFn: () =>
      api.createAutoScalingGroup({
        name: name.trim(),
        launchTemplateId,
        minSize,
        maxSize,
        desiredCapacity: desired,
        subnetIds,
        targetGroupArns,
      }),
    onSuccess: () => {
      toast.success(t("asg.created", { name }));
      qc.invalidateQueries({ queryKey: ["asgs"] });
      setName("");
      setSubnetIds([]);
      setTargetGroupArns([]);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("asg.createTitle")} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t("asg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("asg.col.launchTemplate")}>
          <select
            value={launchTemplateId}
            onChange={(e) => setLaunchTemplateId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">{t("asg.pickTemplate")}</option>
            {(templates.data ?? []).map((lt) => (
              <option key={lt.launchTemplateId} value={lt.launchTemplateId}>
                {lt.launchTemplateName} ({lt.launchTemplateId})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("asg.min")}>
            <TextInput
              type="number"
              min={0}
              value={minSize}
              onChange={(e) => setMinSize(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label={t("asg.desired")}>
            <TextInput
              type="number"
              min={0}
              value={desired}
              onChange={(e) => setDesired(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label={t("asg.max")}>
            <TextInput
              type="number"
              min={0}
              value={maxSize}
              onChange={(e) => setMaxSize(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
        <Field label={t("alb.subnets")}>
          <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
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
        </Field>
        {(tgs.data ?? []).length > 0 && (
          <Field label={t("compute.targetGroups")}>
            <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
              {(tgs.data ?? []).map((tg) => (
                <label
                  key={tg.arn}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50",
                    targetGroupArns.includes(tg.arn) && "bg-brand-fg",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={targetGroupArns.includes(tg.arn)}
                    onChange={() => toggle(setTargetGroupArns, tg.arn)}
                  />
                  <span className="font-medium text-slate-700">{tg.name}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || !launchTemplateId || subnetIds.length === 0}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}

function CapacityEditor({
  name,
  min,
  desired,
  max,
}: {
  name: string;
  min: number;
  desired: number;
  max: number;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [minSize, setMinSize] = useState(min);
  const [desiredCapacity, setDesired] = useState(desired);
  const [maxSize, setMaxSize] = useState(max);

  const save = useMutation({
    mutationFn: () => api.updateCapacity(name, { minSize, maxSize, desiredCapacity }),
    onSuccess: () => {
      toast.success(t("asg.capacityUpdated"));
      qc.invalidateQueries({ queryKey: ["asg-detail", name] });
      qc.invalidateQueries({ queryKey: ["asgs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const inputCls =
    "w-16 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand";

  return (
    <div>
      <SectionTitle>{t("asg.section.capacity")}</SectionTitle>
      <div className="flex items-end gap-2 text-xs text-slate-500">
        <label className="flex flex-col gap-1">
          {t("asg.min")}
          <input
            type="number"
            min={0}
            value={minSize}
            onChange={(e) => setMinSize(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t("asg.desired")}
          <input
            type="number"
            min={0}
            value={desiredCapacity}
            onChange={(e) => setDesired(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t("asg.max")}
          <input
            type="number"
            min={0}
            value={maxSize}
            onChange={(e) => setMaxSize(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
          {t("common.apply")}
        </Button>
      </div>
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
    <ResizableBottomPanel storageKey="oc_panel_h_asg">
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
            <CapacityEditor
              name={name}
              min={detail.data.minSize}
              desired={detail.data.desiredCapacity}
              max={detail.data.maxSize}
            />
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
    </ResizableBottomPanel>
  );
}

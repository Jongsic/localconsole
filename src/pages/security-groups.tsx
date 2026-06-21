import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Spinner, TextInput } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2SecurityGroup, Ec2SgRule, SgRuleInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SecurityGroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ec2SecurityGroup | null>(null);

  const groups = useQuery({ queryKey: ["security-groups"], queryFn: api.listSecurityGroups });

  const del = useMutation({
    mutationFn: (groupId: string) => api.deleteSecurityGroup(groupId),
    onSuccess: () => {
      toast.success(t("sg.deleted"));
      qc.invalidateQueries({ queryKey: ["security-groups"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("sg.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("sg.subtitle")}</div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("sg.create")}
        </Button>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["security-groups"] })}
          className="ml-1 text-slate-400 hover:text-slate-600"
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
          <ResourceError error={groups.error} service="EC2 security groups" />
        ) : groups.data && groups.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("sg.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.id")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.vpc")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.description")}</th>
                <th className="px-4 py-2 font-medium">{t("sg.col.rules")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g: Ec2SecurityGroup) => (
                <tr
                  key={g.groupId}
                  onClick={() => navigate(g.groupId)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 font-medium text-brand hover:underline">
                    {g.groupName || "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{g.groupId}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{g.vpcId ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{g.description ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {t("sg.ruleCount", { in: g.inbound.length, out: g.outbound.length })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(g);
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
            <ShieldCheck className="h-10 w-10" />
            <p className="text-sm">{t("sg.none")}</p>
          </div>
        )}
      </div>

      <CreateSgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("sg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("sg.deleteConfirm", { name: deleteTarget?.groupName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.groupId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Detail page (route: /compute/security-groups/:groupId) ── */

export function SecurityGroupDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId = "" } = useParams();
  const qc = useQueryClient();

  const groups = useQuery({ queryKey: ["security-groups"], queryFn: api.listSecurityGroups });
  const group = groups.data?.find((g) => g.groupId === groupId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <button
          type="button"
          title={t("common.back")}
          onClick={() => navigate("/compute/security-groups")}
          className="text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{group?.groupName || groupId}</div>
          <div className="font-mono text-[11px] text-slate-400">
            {groupId}
            {group?.vpcId ? ` · ${group.vpcId}` : ""}
            {group?.description ? ` · ${group.description}` : ""}
          </div>
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

      <div className="flex-1 overflow-auto p-4">
        {groups.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : groups.isError ? (
          <ResourceError error={groups.error} service="EC2 security groups" />
        ) : group ? (
          <div className="grid max-w-5xl gap-8 md:grid-cols-2">
            <RuleEditor group={group} direction="ingress" />
            <RuleEditor group={group} direction="egress" />
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("sg.notFound", { id: groupId })}</p>
        )}
      </div>
    </div>
  );
}

const PROTOCOLS = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "icmp", label: "ICMP" },
  { value: "-1", label: "All" },
];

function RuleEditor({
  group,
  direction,
}: {
  group: Ec2SecurityGroup;
  direction: "ingress" | "egress";
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const rules = direction === "ingress" ? group.inbound : group.outbound;

  const [protocol, setProtocol] = useState("tcp");
  const [port, setPort] = useState("");
  const [cidr, setCidr] = useState("0.0.0.0/0");

  const refresh = () => qc.invalidateQueries({ queryKey: ["security-groups"] });

  const add = useMutation({
    mutationFn: () => {
      const p = port.trim() === "" ? null : Number(port);
      const input: SgRuleInput = {
        direction,
        protocol,
        fromPort: protocol === "-1" ? null : p,
        toPort: protocol === "-1" ? null : p,
        cidr: cidr.trim(),
      };
      return api.authorizeRule(group.groupId, input);
    },
    onSuccess: () => {
      toast.success(t("sg.ruleAdded"));
      setPort("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (r: Ec2SgRule) =>
      api.revokeRule(group.groupId, {
        direction,
        protocol: r.protocol,
        fromPort: r.fromPort,
        toPort: r.toPort,
        cidr: r.source,
      }),
    onSuccess: () => {
      toast.success(t("sg.ruleRemoved"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const portsLabel = (r: Ec2SgRule) => {
    if (r.fromPort == null && r.toPort == null) return t("ec2.security.allPorts");
    if (r.fromPort === r.toPort) return String(r.fromPort);
    return `${r.fromPort}–${r.toPort}`;
  };

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase text-slate-400">
        {direction === "ingress" ? t("ec2.security.inbound") : t("ec2.security.outbound")}
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t("ec2.security.protocol")}</th>
              <th className="px-3 py-2 font-medium">{t("ec2.security.ports")}</th>
              <th className="px-3 py-2 font-medium">{t("ec2.security.source")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules have no stable id
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700">
                  {r.protocol === "-1" ? t("ec2.security.allTraffic") : r.protocol}
                </td>
                <td className="px-3 py-1.5 text-slate-700">{portsLabel(r)}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500">{r.source}</td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    title={t("common.delete")}
                    onClick={() => remove.mutate(r)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                  {t("ec2.security.noRules")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-end gap-1.5">
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
        >
          {PROTOCOLS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder={t("sg.port")}
          disabled={protocol === "-1"}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand disabled:bg-slate-100"
        />
        <input
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          placeholder="0.0.0.0/0"
          className="w-28 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs outline-none focus:border-brand"
        />
        <Button
          variant="secondary"
          loading={add.isPending}
          disabled={!cidr.trim() || (protocol !== "-1" && port.trim() === "")}
          onClick={() => add.mutate()}
        >
          <Plus className="h-3.5 w-3.5" /> {t("sg.addRule")}
        </Button>
      </div>
    </div>
  );
}

function CreateSgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vpcId, setVpcId] = useState("");

  const subnetsForVpc = useQuery({
    queryKey: ["subnets"],
    queryFn: api.listSubnets,
    enabled: open,
  });
  const vpcIds = Array.from(
    new Set((subnetsForVpc.data ?? []).map((s) => s.vpcId).filter(Boolean) as string[]),
  );

  const create = useMutation({
    mutationFn: () =>
      api.createSecurityGroup({
        groupName: name.trim(),
        description: description.trim(),
        vpcId: vpcId.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("sg.created", { name }));
      qc.invalidateQueries({ queryKey: ["security-groups"] });
      setName("");
      setDescription("");
      setVpcId("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("sg.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("sg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("sg.col.description")}>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t("sg.vpc")}>
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

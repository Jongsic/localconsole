import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  DefinitionGrid,
  DetailHeader,
  KV,
  PageHeader,
  ResourceTable,
  Table,
  TableLoading,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/kit";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Select, Textarea, TextInput } from "@/components/ui";
import { api } from "@/lib/iam-api";
import type { IamRoleSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** Pretty-print a JSON document string for display; fall back to the raw text. */
function formatJson(doc: string | null | undefined): string {
  if (!doc) return "";
  try {
    return JSON.stringify(JSON.parse(doc), null, 2);
  } catch {
    return doc;
  }
}

/** A sane default EC2 trust policy, prefilled into the create modal. */
const DEFAULT_TRUST_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ec2.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  },
  null,
  2,
);

export function IamRolesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IamRoleSummary | null>(null);

  const roles = useQuery({ queryKey: ["iam-roles"], queryFn: api.listRoles });

  const del = useMutation({
    mutationFn: (roleName: string) => api.deleteRole(roleName),
    onSuccess: (_d, roleName) => {
      toast.success(t("iam.role.deleted", { name: roleName }));
      qc.invalidateQueries({ queryKey: ["iam-roles"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={UserCog}
        title={t("iam.role.heading")}
        subtitle={t("iam.role.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["iam-roles"] })}
        refreshing={roles.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("iam.role.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={roles.isLoading}
          isError={roles.isError}
          error={roles.error}
          service="IAM roles"
          data={roles.data}
          getKey={(r) => r.roleName}
          empty={{ icon: UserCog, message: t("iam.role.none") }}
          head={
            <tr>
              <Th>{t("iam.role.col.name")}</Th>
              <Th>{t("iam.role.col.arn")}</Th>
              <Th>{t("iam.role.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(r: IamRoleSummary) => (
            <Tr key={r.roleName} onClick={() => navigate(r.roleName)}>
              <Td className="font-medium text-brand hover:underline">{r.roleName}</Td>
              <Td mono>{r.arn}</Td>
              <Td muted>{formatDate(r.createDate, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(r);
                  }}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("iam.role.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("iam.role.deleteConfirm", { name: deleteTarget?.roleName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.roleName)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Detail page (route: /iam/roles/:roleName) ── */

export function IamRoleDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { roleName = "" } = useParams();
  const qc = useQueryClient();

  const roles = useQuery({ queryKey: ["iam-roles"], queryFn: api.listRoles });
  const role = roles.data?.find((r) => r.roleName === roleName) ?? null;

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        title={role?.roleName || roleName}
        meta={role?.arn ?? roleName}
        onBack={() => navigate("/iam/roles")}
        backTitle={t("common.back")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["iam-roles"] })}
        refreshing={roles.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto p-4">
        {roles.isLoading ? (
          <TableLoading />
        ) : roles.isError ? (
          <ResourceError error={roles.error} service="IAM roles" />
        ) : role ? (
          <div className="flex max-w-4xl flex-col gap-4">
            <DefinitionGrid>
              <KV label={t("iam.role.col.name")} value={role.roleName} />
              <KV label={t("iam.role.col.path")} value={role.path} mono />
              <KV
                label={t("iam.role.col.created")}
                value={formatDate(role.createDate, i18n.language)}
              />
              <KV label={t("iam.role.col.arn")} value={role.arn} mono />
              <KV label={t("iam.role.col.description")} value={role.description} />
            </DefinitionGrid>

            <TrustRelationshipSection
              roleName={roleName}
              document={role.assumeRolePolicyDocument}
            />
            <AttachedPoliciesSection roleName={roleName} />
            <InlinePoliciesSection roleName={roleName} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("iam.role.notFound", { name: roleName })}</p>
        )}
      </div>
    </div>
  );
}

/* ── Trust relationship ── */

function TrustRelationshipSection({
  roleName,
  document,
}: {
  roleName: string;
  document: string | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(() => formatJson(document));

  // Re-sync the editor when the underlying role document changes (e.g. refresh).
  useEffect(() => {
    setValue(formatJson(document));
  }, [document]);

  const save = useMutation({
    mutationFn: () => api.updateAssumeRolePolicy(roleName, value),
    onSuccess: () => {
      toast.success(t("iam.role.trust.saved"));
      qc.invalidateQueries({ queryKey: ["iam-roles"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card title={t("iam.role.trust.title")}>
      <p className="mb-2 text-xs text-slate-500">{t("iam.role.trust.description")}</p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        className="h-48 w-full p-2 font-mono text-xs"
      />
      <div className="mt-2 flex justify-end">
        <Button loading={save.isPending} disabled={!value.trim()} onClick={() => save.mutate()}>
          {t("iam.role.trust.save")}
        </Button>
      </div>
    </Card>
  );
}

/* ── Attached (managed) policies ── */

function AttachedPoliciesSection({ roleName }: { roleName: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const key = ["iam-attached-policies", roleName];

  const attached = useQuery({
    queryKey: key,
    queryFn: () => api.listAttachedRolePolicies(roleName),
  });
  const managed = useQuery({
    queryKey: ["iam-policies", "Local"],
    queryFn: () => api.listPolicies("Local"),
  });

  const [arn, setArn] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const attach = useMutation({
    mutationFn: (policyArn: string) => api.attachRolePolicy(roleName, policyArn),
    onSuccess: () => {
      toast.success(t("iam.role.attached.attached"));
      setArn("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detach = useMutation({
    mutationFn: (policyArn: string) => api.detachRolePolicy(roleName, policyArn),
    onSuccess: () => {
      toast.success(t("iam.role.attached.detached"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card title={t("iam.role.attached.title")}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          value=""
          aria-label={t("iam.role.attached.pickPolicy")}
          onChange={(e) => {
            if (e.target.value) attach.mutate(e.target.value);
          }}
          className="py-1.5 text-sm"
        >
          <option value="">{t("iam.role.attached.pickPlaceholder")}</option>
          {(managed.data ?? []).map((p) => (
            <option key={p.arn} value={p.arn}>
              {p.policyName}
            </option>
          ))}
        </Select>
        <TextInput
          value={arn}
          onChange={(e) => setArn(e.target.value)}
          placeholder={t("iam.role.attached.orArn")}
          className="min-w-64 flex-1 py-1.5 text-sm"
        />
        <Button
          loading={attach.isPending}
          disabled={!arn.trim()}
          onClick={() => attach.mutate(arn.trim())}
        >
          <Plus className="h-4 w-4" /> {t("iam.role.attached.attach")}
        </Button>
      </div>

      {attached.isLoading ? (
        <TableLoading />
      ) : attached.data && attached.data.length > 0 ? (
        <Table>
          <Thead sticky={false}>
            <tr>
              <Th>{t("iam.role.col.name")}</Th>
              <Th>{t("iam.role.col.arn")}</Th>
              <Th />
            </tr>
          </Thead>
          <tbody>
            {attached.data.map((p) => (
              <Tr key={p.policyArn}>
                <Td className="font-medium text-slate-700">{p.policyName}</Td>
                <Td mono>{p.policyArn}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    title={t("iam.role.attached.detach")}
                    onClick={() => detach.mutate(p.policyArn)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-sm text-slate-400">{t("iam.role.attached.none")}</p>
      )}
    </Card>
  );
}

/* ── Inline policies ── */

function InlinePoliciesSection({ roleName }: { roleName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["iam-inline-policies", roleName];
  const [addOpen, setAddOpen] = useState(false);

  const names = useQuery({ queryKey: key, queryFn: () => api.listRolePolicies(roleName) });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <Card title={t("iam.role.inline.title")}>
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> {t("iam.role.inline.add")}
        </Button>
      </div>

      {names.isLoading ? (
        <TableLoading />
      ) : names.data && names.data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {names.data.map((name) => (
            <InlinePolicyEditor
              key={name}
              roleName={roleName}
              policyName={name}
              onChanged={refresh}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t("iam.role.inline.none")}</p>
      )}

      <AddInlinePolicyModal
        open={addOpen}
        roleName={roleName}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />
    </Card>
  );
}

function InlinePolicyEditor({
  roleName,
  policyName,
  onChanged,
}: {
  roleName: string;
  policyName: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const key = ["iam-inline-policy", roleName, policyName];
  const [value, setValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const doc = useQuery({ queryKey: key, queryFn: () => api.getRolePolicy(roleName, policyName) });

  useEffect(() => {
    if (doc.data) setValue(formatJson(doc.data.document));
  }, [doc.data]);

  const save = useMutation({
    mutationFn: () => api.putRolePolicy(roleName, policyName, value),
    onSuccess: () => {
      toast.success(t("iam.role.inline.saved", { name: policyName }));
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: () => api.deleteRolePolicy(roleName, policyName),
    onSuccess: () => {
      toast.success(t("iam.role.inline.deleted", { name: policyName }));
      setDeleteOpen(false);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-slate-700">{policyName}</span>
        <button
          type="button"
          title={t("common.delete")}
          onClick={() => setDeleteOpen(true)}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {doc.isLoading ? (
        <TableLoading />
      ) : (
        <>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            className="h-40 w-full p-2 font-mono text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button loading={save.isPending} disabled={!value.trim()} onClick={() => save.mutate()}>
              {t("iam.role.inline.save")}
            </Button>
          </div>
        </>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("iam.role.inline.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("iam.role.inline.deleteConfirm", { name: policyName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const DEFAULT_INLINE_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: ["s3:GetObject"], Resource: "*" }],
  },
  null,
  2,
);

function AddInlinePolicyModal({
  open,
  roleName,
  onClose,
  onSaved,
}: {
  open: boolean;
  roleName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [document, setDocument] = useState(DEFAULT_INLINE_POLICY);

  const save = useMutation({
    mutationFn: () => api.putRolePolicy(roleName, name.trim(), document),
    onSuccess: () => {
      toast.success(t("iam.role.inline.saved", { name }));
      setName("");
      setDocument(DEFAULT_INLINE_POLICY);
      onSaved();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("iam.role.inline.addTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("iam.role.inline.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-inline-policy"
            autoComplete="off"
          />
        </Field>
        <Field label={t("iam.role.inline.document")}>
          <Textarea
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            spellCheck={false}
            className="h-44 w-full p-2 font-mono text-xs"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!name.trim() || !document.trim()}
            onClick={() => save.mutate()}
          >
            {t("iam.role.inline.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateRoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [trustPolicy, setTrustPolicy] = useState(DEFAULT_TRUST_POLICY);

  const create = useMutation({
    mutationFn: () =>
      api.createRole({
        roleName: name.trim(),
        path: path.trim() || undefined,
        assumeRolePolicyDocument: trustPolicy,
      }),
    onSuccess: () => {
      toast.success(t("iam.role.created", { name }));
      qc.invalidateQueries({ queryKey: ["iam-roles"] });
      setName("");
      setPath("");
      setTrustPolicy(DEFAULT_TRUST_POLICY);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("iam.role.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("iam.role.col.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-role"
            autoComplete="off"
          />
        </Field>
        <Field label={t("iam.role.col.path")}>
          <TextInput value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
        </Field>
        <Field label={t("iam.role.trustPolicy")}>
          <Textarea
            value={trustPolicy}
            onChange={(e) => setTrustPolicy(e.target.value)}
            spellCheck={false}
            className="h-44 w-full p-2 font-mono text-xs"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || !trustPolicy.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

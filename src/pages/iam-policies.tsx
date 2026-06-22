import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ScrollText, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  DefinitionGrid,
  DetailHeader,
  KV,
  PageHeader,
  ResourceTable,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Textarea, TextInput } from "@/components/ui";
import { api } from "@/lib/iam-api";
import type { IamPolicySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** A minimal valid policy, prefilled into the create modal. */
const DEFAULT_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:GetObject"],
        Resource: "*",
      },
    ],
  },
  null,
  2,
);

export function IamPoliciesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IamPolicySummary | null>(null);
  const [showAws, setShowAws] = useState(true);
  const [query, setQuery] = useState("");

  const scope = showAws ? "All" : "Local";
  const policies = useQuery({
    queryKey: ["iam-policies", scope],
    queryFn: () => api.listPolicies(scope),
  });

  // Client-side filter by name or ARN.
  const q = query.trim().toLowerCase();
  const filtered = (policies.data ?? []).filter(
    (p) => !q || p.policyName.toLowerCase().includes(q) || p.arn.toLowerCase().includes(q),
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["iam-policies"] });

  const del = useMutation({
    mutationFn: (p: IamPolicySummary) => api.deletePolicy(p.arn),
    onSuccess: (_d, p) => {
      toast.success(t("iam.policy.deleted", { name: p.policyName }));
      refresh();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={ScrollText}
        title={t("iam.policy.heading")}
        subtitle={t("iam.policy.subtitle")}
        onRefresh={refresh}
        refreshing={policies.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 text-slate-400" />
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("iam.policy.search")}
                className="w-56 py-1.5 pl-8"
              />
            </div>
            <Button
              variant={showAws ? "primary" : "secondary"}
              onClick={() => setShowAws((v) => !v)}
              title={t("iam.policy.showAwsHint")}
            >
              {t("iam.policy.showAws")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t("iam.policy.create")}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={policies.isLoading}
          isError={policies.isError}
          error={policies.error}
          service="IAM policies"
          data={filtered}
          getKey={(p) => p.arn}
          empty={{ icon: ScrollText, message: q ? t("iam.policy.noMatch") : t("iam.policy.none") }}
          head={
            <tr>
              <Th>{t("iam.policy.col.name")}</Th>
              <Th>{t("iam.policy.col.type")}</Th>
              <Th>{t("iam.policy.col.attachments")}</Th>
              <Th>{t("iam.policy.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(p: IamPolicySummary) => (
            <Tr key={p.arn} onClick={() => navigate(encodeURIComponent(p.arn))}>
              <Td className="font-medium text-brand hover:underline">{p.policyName}</Td>
              <Td muted>
                {p.isAwsManaged ? t("iam.policy.typeAws") : t("iam.policy.typeCustomer")}
              </Td>
              <Td muted>{p.attachmentCount}</Td>
              <Td muted>{formatDate(p.createDate, i18n.language)}</Td>
              <Td className="text-right">
                {!p.isAwsManaged && (
                  <button
                    type="button"
                    title={t("common.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreatePolicyModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("iam.policy.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("iam.policy.deleteConfirm", { name: deleteTarget?.policyName })}</p>
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

function CreatePolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [document, setDocument] = useState(DEFAULT_POLICY);

  const create = useMutation({
    mutationFn: () =>
      api.createPolicy({
        policyName: name.trim(),
        path: path.trim() || undefined,
        document,
      }),
    onSuccess: () => {
      toast.success(t("iam.policy.created", { name }));
      qc.invalidateQueries({ queryKey: ["iam-policies"] });
      setName("");
      setPath("");
      setDocument(DEFAULT_POLICY);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("iam.policy.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("iam.policy.col.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-policy"
            autoComplete="off"
          />
        </Field>
        <Field label={t("iam.policy.col.path")}>
          <TextInput value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
        </Field>
        <Field label={t("iam.policy.document")}>
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
            loading={create.isPending}
            disabled={!name.trim() || !document.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Detail page (route: /iam/policies/:policyId) — shows default-version doc ── */

export function IamPolicyDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { policyId = "" } = useParams();
  const arn = decodeURIComponent(policyId);
  const qc = useQueryClient();

  const policy = useQuery({
    queryKey: ["iam-policy", arn],
    queryFn: () => api.getPolicy(arn),
  });

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        title={policy.data?.policyName || arn}
        meta={arn}
        onBack={() => navigate("/iam/policies")}
        backTitle={t("common.back")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["iam-policy", arn] })}
        refreshing={policy.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto p-4">
        {policy.isLoading ? (
          <TableLoading />
        ) : policy.isError ? (
          <ResourceError error={policy.error} service="IAM policies" />
        ) : policy.data ? (
          <div className="flex max-w-4xl flex-col gap-4">
            <DefinitionGrid>
              <KV label={t("iam.policy.col.name")} value={policy.data.policyName} />
              <KV
                label={t("iam.policy.col.type")}
                value={
                  policy.data.isAwsManaged ? t("iam.policy.typeAws") : t("iam.policy.typeCustomer")
                }
              />
              <KV label={t("iam.policy.col.path")} value={policy.data.path} mono />
              <KV
                label={t("iam.policy.col.attachments")}
                value={String(policy.data.attachmentCount)}
              />
              <KV
                label={t("iam.policy.col.created")}
                value={formatDate(policy.data.createDate, i18n.language)}
              />
              <KV label={t("iam.policy.defaultVersion")} value={policy.data.defaultVersionId} />
              <KV label={t("iam.policy.col.arn")} value={policy.data.arn} mono />
            </DefinitionGrid>
            <Card title={t("iam.policy.document")}>
              <pre className="overflow-auto rounded bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {policy.data.document ?? "—"}
              </pre>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("iam.policy.notFound")}</p>
        )}
      </div>
    </div>
  );
}

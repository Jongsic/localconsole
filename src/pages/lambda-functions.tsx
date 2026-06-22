import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  DefinitionGrid,
  DetailHeader,
  KV,
  PageHeader,
  ResourceTable,
  StatusBadge,
  type StatusTone,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResourceError } from "@/components/resource-error";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import { Button, Field, FormCard, Modal, Select, Textarea, TextInput } from "@/components/ui";
import { api as iamApi } from "@/lib/iam-api";
import { api } from "@/lib/lambda-api";
import { handlerToFilename, zipInlineCode } from "@/lib/lambda-package";
import type { LambdaFunctionDetail, LambdaFunctionSummary, Tag } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";

/** Short, sensible runtime list for the create form. */
const RUNTIMES = ["nodejs20.x", "nodejs22.x", "python3.12", "python3.13", "ruby3.3"] as const;

/** Default handler per runtime family. */
function defaultHandler(runtime: string): string {
  if (runtime.startsWith("python")) return "lambda_function.lambda_handler";
  if (runtime.startsWith("ruby")) return "lambda_function.handler";
  return "index.handler";
}

/** Prefilled hello-world source for the selected runtime. */
function helloWorld(runtime: string): string {
  if (runtime.startsWith("python")) {
    return [
      "def lambda_handler(event, context):",
      '    return {"statusCode": 200, "body": "Hello from Lambda!"}',
      "",
    ].join("\n");
  }
  if (runtime.startsWith("ruby")) {
    return [
      "def handler(event:, context:)",
      '  { statusCode: 200, body: "Hello from Lambda!" }',
      "end",
      "",
    ].join("\n");
  }
  return [
    "export const handler = async (event) => {",
    '  return { statusCode: 200, body: "Hello from Lambda!" };',
    "};",
    "",
  ].join("\n");
}

const STATE_TONES: Record<string, StatusTone> = {
  Active: "green",
  Pending: "amber",
  Inactive: "neutral",
  Failed: "red",
};

const UPDATE_TONES: Record<string, StatusTone> = {
  Successful: "green",
  InProgress: "amber",
  Failed: "red",
};

function StatusCell({ value, tones }: { value: string | null; tones: Record<string, StatusTone> }) {
  if (!value) return <>—</>;
  return <StatusBadge tone={tones[value] ?? "neutral"}>{value}</StatusBadge>;
}

export function LambdaFunctionsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LambdaFunctionSummary | null>(null);

  const fns = useQuery({ queryKey: ["lambda-functions"], queryFn: api.listFunctions });

  const del = useMutation({
    mutationFn: (functionName: string) => api.deleteFunction(functionName),
    onSuccess: (_d, functionName) => {
      toast.success(t("function.fn.deleted", { name: functionName }));
      qc.invalidateQueries({ queryKey: ["lambda-functions"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Zap}
        title={t("function.fn.heading")}
        subtitle={t("function.fn.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["lambda-functions"] })}
        refreshing={fns.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("function.fn.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={fns.isLoading}
          isError={fns.isError}
          error={fns.error}
          service="Lambda"
          data={fns.data}
          getKey={(f) => f.functionName}
          empty={{ icon: Zap, message: t("function.fn.none") }}
          head={
            <tr>
              <Th>{t("function.fn.col.name")}</Th>
              <Th>{t("function.fn.col.runtime")}</Th>
              <Th>{t("function.fn.col.memory")}</Th>
              <Th>{t("function.fn.col.timeout")}</Th>
              <Th>{t("function.fn.col.codeSize")}</Th>
              <Th>{t("function.fn.col.lastModified")}</Th>
              <Th />
            </tr>
          }
          row={(f: LambdaFunctionSummary) => (
            <Tr key={f.functionName} onClick={() => navigate(f.functionName)}>
              <Td className="font-medium text-brand hover:underline">{f.functionName}</Td>
              <Td>{f.runtime ?? "—"}</Td>
              <Td>{f.memorySize != null ? `${f.memorySize} MB` : "—"}</Td>
              <Td>{f.timeout != null ? `${f.timeout}s` : "—"}</Td>
              <Td>{f.codeSize != null ? formatBytes(f.codeSize) : "—"}</Td>
              <Td muted>{formatDate(f.lastModified, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(f);
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

      <CreateFunctionModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("function.fn.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("function.fn.deleteConfirm", { name: deleteTarget?.functionName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.functionName)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CreateFunctionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState<string>(RUNTIMES[0]);
  const [handler, setHandler] = useState(defaultHandler(RUNTIMES[0]));
  const [roleArn, setRoleArn] = useState("");
  const [roleManual, setRoleManual] = useState(false);
  const [sourceMode, setSourceMode] = useState<"inline" | "upload">("inline");
  const [code, setCode] = useState(helloWorld(RUNTIMES[0]));
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [memorySize, setMemorySize] = useState(128);
  const [timeout, setTimeout] = useState(3);

  const roles = useQuery({ queryKey: ["iam-roles"], queryFn: iamApi.listRoles, enabled: open });

  // Keep handler + hello-world in sync when the runtime family changes.
  const onRuntimeChange = (next: string) => {
    setRuntime(next);
    setHandler(defaultHandler(next));
    setCode(helloWorld(next));
  };

  const reset = () => {
    setName("");
    onRuntimeChange(RUNTIMES[0]);
    setRoleArn("");
    setRoleManual(false);
    setSourceMode("inline");
    setZipFile(null);
    setMemorySize(128);
    setTimeout(3);
  };

  const create = useMutation({
    mutationFn: async () => {
      let bytes: Uint8Array;
      if (sourceMode === "upload") {
        if (!zipFile) throw new Error(t("function.fn.create_.noFile"));
        bytes = new Uint8Array(await zipFile.arrayBuffer());
      } else {
        bytes = zipInlineCode(handlerToFilename(handler, runtime), code);
      }
      await api.createFunction({
        functionName: name.trim(),
        runtime,
        handler: handler.trim(),
        role: roleArn.trim(),
        code: bytes,
        memorySize,
        timeout,
      });
    },
    onSuccess: () => {
      toast.success(t("function.fn.created", { name: name.trim() }));
      qc.invalidateQueries({ queryKey: ["lambda-functions"] });
      reset();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const noRoles = open && !roles.isLoading && (roles.data ?? []).length === 0;
  const useManualRole = roleManual || noRoles;

  const canSubmit =
    name.trim().length > 0 &&
    handler.trim().length > 0 &&
    roleArn.trim().length > 0 &&
    (sourceMode === "inline" ? code.trim().length > 0 : zipFile !== null);

  return (
    <Modal open={open} onClose={onClose} title={t("function.fn.createTitle")} className="max-w-xl">
      <div className="flex flex-col gap-3">
        <Field label={t("function.fn.create_.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-function"
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("function.fn.create_.runtime")}>
            <Select value={runtime} onChange={(e) => onRuntimeChange(e.target.value)}>
              {RUNTIMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("function.fn.create_.handler")}>
            <TextInput
              value={handler}
              onChange={(e) => setHandler(e.target.value)}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        </div>

        <Field label={t("function.fn.create_.role")}>
          {useManualRole ? (
            <TextInput
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::000000000000:role/my-role"
              autoComplete="off"
              className="font-mono"
            />
          ) : (
            <Select value={roleArn} onChange={(e) => setRoleArn(e.target.value)}>
              <option value="">{t("function.fn.create_.rolePlaceholder")}</option>
              {(roles.data ?? []).map((r) => (
                <option key={r.arn} value={r.arn}>
                  {r.roleName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {!noRoles && (
          <button
            type="button"
            className="-mt-1.5 self-start text-xs text-brand hover:underline"
            onClick={() => {
              setRoleManual((v) => !v);
              setRoleArn("");
            }}
          >
            {roleManual ? t("function.fn.create_.rolePick") : t("function.fn.create_.roleManual")}
          </button>
        )}

        <Field label={t("function.fn.create_.codeSource")}>
          <Select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as "inline" | "upload")}
          >
            <option value="inline">{t("function.fn.create_.inline")}</option>
            <option value="upload">{t("function.fn.create_.upload")}</option>
          </Select>
        </Field>

        {sourceMode === "inline" ? (
          <Field label={t("function.fn.create_.code")}>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={8}
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        ) : (
          <Field label={t("function.fn.create_.zip")}>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
          </Field>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("function.fn.config.memory")}>
            <TextInput
              type="number"
              min={128}
              value={memorySize}
              onChange={(e) => setMemorySize(Math.max(128, Number(e.target.value) || 128))}
            />
          </Field>
          <Field label={t("function.fn.config.timeout")}>
            <TextInput
              type="number"
              min={1}
              value={timeout}
              onChange={(e) => setTimeout(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Detail page (route: /function/functions/:functionName) ── */

export function LambdaFunctionDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { functionName = "" } = useParams();
  const qc = useQueryClient();

  const fn = useQuery({
    queryKey: ["lambda-function", functionName],
    queryFn: () => api.getFunction(functionName),
  });

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        title={functionName}
        meta={fn.data?.role ?? functionName}
        onBack={() => navigate("/function/functions")}
        backTitle={t("common.back")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["lambda-function", functionName] })}
        refreshing={fn.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto p-4">
        {fn.isLoading ? (
          <TableLoading />
        ) : fn.isError ? (
          <ResourceError error={fn.error} service="Lambda" />
        ) : fn.data ? (
          <div className="flex max-w-4xl flex-col gap-4">
            <DefinitionGrid>
              <KV label={t("function.fn.col.name")} value={fn.data.functionName} />
              <KV label={t("function.fn.col.runtime")} value={fn.data.runtime} />
              <KV label={t("function.fn.col.handler")} value={fn.data.handler} mono />
              <KV label={t("function.fn.col.role")} value={fn.data.role} mono />
              <KV
                label={t("function.fn.col.memory")}
                value={fn.data.memorySize != null ? `${fn.data.memorySize} MB` : null}
              />
              <KV
                label={t("function.fn.col.timeout")}
                value={fn.data.timeout != null ? `${fn.data.timeout}s` : null}
              />
              <KV
                label={t("function.fn.col.codeSize")}
                value={fn.data.codeSize != null ? formatBytes(fn.data.codeSize) : null}
              />
              <KV label={t("function.fn.col.arch")} value={fn.data.architectures.join(", ")} />
              <KV label={t("function.fn.col.packageType")} value={fn.data.packageType} />
              <KV
                label={t("function.fn.col.lastModified")}
                value={formatDate(fn.data.lastModified, i18n.language)}
              />
              <KV label={t("function.fn.col.state")}>
                <StatusCell value={fn.data.state} tones={STATE_TONES} />
              </KV>
              <KV label={t("function.fn.col.lastUpdate")}>
                <StatusCell value={fn.data.lastUpdateStatus} tones={UPDATE_TONES} />
              </KV>
              <KV label={t("function.fn.col.description")} value={fn.data.description} />
            </DefinitionGrid>

            <ConfigSection fn={fn.data} />
            <EnvironmentSection fn={fn.data} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {t("function.fn.notFound", { name: functionName })}
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigSection({ fn }: { fn: LambdaFunctionDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [memory, setMemory] = useState(fn.memorySize ?? 128);
  const [timeout, setTimeout] = useState(fn.timeout ?? 3);
  const [handler, setHandler] = useState(fn.handler ?? "");
  const [description, setDescription] = useState(fn.description ?? "");

  const save = useMutation({
    mutationFn: () =>
      api.updateFunctionConfiguration({
        functionName: fn.functionName,
        memorySize: memory,
        timeout,
        handler: handler.trim(),
        description,
      }),
    onSuccess: () => {
      toast.success(t("function.fn.config.saved"));
      qc.invalidateQueries({ queryKey: ["lambda-function", fn.functionName] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <FormCard
      title={t("function.fn.config.title")}
      description={t("function.fn.config.description")}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("function.fn.config.memory")}>
          <TextInput
            type="number"
            min={128}
            value={memory}
            onChange={(e) => setMemory(Math.max(128, Number(e.target.value) || 128))}
          />
        </Field>
        <Field label={t("function.fn.config.timeout")}>
          <TextInput
            type="number"
            min={1}
            value={timeout}
            onChange={(e) => setTimeout(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <Field label={t("function.fn.config.handler")}>
          <TextInput
            value={handler}
            onChange={(e) => setHandler(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t("function.fn.config.fnDescription")}>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          {t("function.fn.config.save")}
        </Button>
      </div>
    </FormCard>
  );
}

function EnvironmentSection({ fn }: { fn: LambdaFunctionDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const current: Tag[] = Object.entries(fn.environment).map(([key, value]) => ({ key, value }));

  const save = useMutation({
    mutationFn: (tags: Tag[]) => {
      const vars: Record<string, string> = {};
      for (const { key, value } of tags) {
        if (key.trim()) vars[key.trim()] = value;
      }
      return api.updateFunctionEnvironment(fn.functionName, vars);
    },
    onSuccess: () => {
      toast.success(t("function.fn.env.saved"));
      qc.invalidateQueries({ queryKey: ["lambda-function", fn.functionName] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <FormCard title={t("function.fn.env.title")} description={t("function.fn.env.description")}>
      <TagsEditor current={current} saving={save.isPending} onSave={(tags) => save.mutate(tags)} />
    </FormCard>
  );
}

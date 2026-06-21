import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ResourceError } from "@/components/resource-error";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Spinner, TextInput } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2KeyPairSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function KeyPairsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ["key-pairs"], queryFn: api.listKeyPairs });

  const del = useMutation({
    mutationFn: (name: string) => api.deleteKeyPair(name),
    onSuccess: (_d, name) => {
      toast.success(t("kp.deleted", { name }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <KeyRound className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("kp.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("kp.subtitle")}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> {t("kp.import")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("kp.create")}
          </Button>
          <button
            type="button"
            title={t("common.refresh")}
            onClick={() => qc.invalidateQueries({ queryKey: ["key-pairs"] })}
            className="ml-1 text-slate-400 hover:text-slate-600"
          >
            <RefreshCw className={cn("h-4 w-4", keys.isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {keys.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : keys.isError ? (
          <ResourceError error={keys.error} service="EC2 key pairs" />
        ) : keys.data && keys.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("kp.col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("kp.col.id")}</th>
                <th className="px-4 py-2 font-medium">{t("kp.col.type")}</th>
                <th className="px-4 py-2 font-medium">{t("kp.col.fingerprint")}</th>
                <th className="px-4 py-2 font-medium">{t("kp.col.created")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.data.map((k: Ec2KeyPairSummary) => (
                <tr key={k.keyPairId || k.keyName} className="group border-b border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{k.keyName}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{k.keyPairId}</td>
                  <td className="px-4 py-2 text-slate-600">{k.keyType ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                    {k.fingerprint ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {formatDate(k.createTime, i18n.language)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      title={t("common.delete")}
                      onClick={() => setDeleteTarget(k.keyName)}
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
            <KeyRound className="h-10 w-10" />
            <p className="text-sm">{t("kp.none")}</p>
          </div>
        )}
      </div>

      <CreateKeyPairModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ImportKeyPairModal open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("kp.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("kp.deleteConfirm", { name: deleteTarget })}</p>
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

function CreateKeyPairModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<"rsa" | "ed25519">("rsa");

  const create = useMutation({
    mutationFn: () => api.createKeyPair(name.trim(), keyType),
    onSuccess: ({ keyName, keyMaterial }) => {
      // Download the private key — it is only returned once, at creation time.
      if (keyMaterial) {
        const blob = new Blob([keyMaterial], { type: "application/x-pem-file" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${keyName}.pem`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(t("kp.created", { name: keyName }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("kp.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("kp.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-key"
            autoComplete="off"
          />
        </Field>
        <Field label={t("kp.type")}>
          <select
            value={keyType}
            onChange={(e) => setKeyType(e.target.value as "rsa" | "ed25519")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="rsa">RSA</option>
            <option value="ed25519">ED25519</option>
          </select>
        </Field>
        <p className="text-xs text-amber-600">{t("kp.downloadNote")}</p>
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

function ImportKeyPairModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const imp = useMutation({
    mutationFn: () => api.importKeyPair(name.trim(), publicKey.trim()),
    onSuccess: () => {
      toast.success(t("kp.imported", { name }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setName("");
      setPublicKey("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("kp.importTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("kp.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-key"
            autoComplete="off"
          />
        </Field>
        <Field label={t("kp.publicKey")}>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            spellCheck={false}
            placeholder="ssh-ed25519 AAAA... user@host"
            className="h-28 w-full resize-none rounded-md border border-slate-300 p-2 font-mono text-xs outline-none focus:border-brand"
          />
        </Field>
        <p className="text-xs text-slate-400">{t("kp.importNote")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={imp.isPending}
            disabled={!name.trim() || !publicKey.trim()}
            onClick={() => imp.mutate()}
          >
            {t("kp.import")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

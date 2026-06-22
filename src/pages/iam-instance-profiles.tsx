import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdCard, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader, ResourceTable, Td, Th, Tr } from "@/components/kit";
import { useToast } from "@/components/toast";
import { Button, Field, FieldLabel, Modal, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/iam-api";
import type { IamInstanceProfileSummary } from "@/lib/types";

export function InstanceProfilesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IamInstanceProfileSummary | null>(null);

  const profiles = useQuery({
    queryKey: ["instance-profiles"],
    queryFn: api.listInstanceProfiles,
  });
  const roles = useQuery({ queryKey: ["iam-roles"], queryFn: api.listRoles });

  const refresh = () => qc.invalidateQueries({ queryKey: ["instance-profiles"] });

  const del = useMutation({
    mutationFn: (name: string) => api.deleteInstanceProfile(name),
    onSuccess: (_d, name) => {
      toast.success(t("iam.profile.deleted", { name }));
      refresh();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const attach = useMutation({
    mutationFn: ({ profileName, roleName }: { profileName: string; roleName: string }) =>
      api.addRoleToInstanceProfile(profileName, roleName),
    onSuccess: () => {
      toast.success(t("iam.profile.roleAttached"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detach = useMutation({
    mutationFn: ({ profileName, roleName }: { profileName: string; roleName: string }) =>
      api.removeRoleFromInstanceProfile(profileName, roleName),
    onSuccess: () => {
      toast.success(t("iam.profile.roleDetached"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const roleNames = (roles.data ?? []).map((r) => r.roleName);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={IdCard}
        title={t("iam.profile.heading")}
        subtitle={t("iam.profile.subtitle")}
        onRefresh={refresh}
        refreshing={profiles.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("iam.profile.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={profiles.isLoading}
          isError={profiles.isError}
          error={profiles.error}
          service="IAM instance profiles"
          data={profiles.data}
          getKey={(p) => p.instanceProfileName}
          empty={{ icon: IdCard, message: t("iam.profile.none") }}
          head={
            <tr>
              <Th>{t("iam.profile.col.name")}</Th>
              <Th>{t("iam.profile.col.arn")}</Th>
              <Th>{t("iam.profile.col.roles")}</Th>
              <Th />
            </tr>
          }
          row={(p: IamInstanceProfileSummary) => (
            <Tr key={p.instanceProfileName}>
              <Td className="font-medium text-slate-700">{p.instanceProfileName}</Td>
              <Td mono>{p.arn}</Td>
              <Td>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.roleNames.map((rn) => (
                    <span
                      key={rn}
                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                    >
                      {rn}
                      <button
                        type="button"
                        title={t("iam.profile.detachRole")}
                        onClick={() =>
                          detach.mutate({ profileName: p.instanceProfileName, roleName: rn })
                        }
                        className="rounded text-slate-400 transition-colors hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {p.roleNames.length === 0 && (
                    <span className="text-xs text-slate-400">{t("iam.profile.noRoles")}</span>
                  )}
                  <AttachRoleControl
                    roleNames={roleNames.filter((rn) => !p.roleNames.includes(rn))}
                    onAttach={(roleName) =>
                      attach.mutate({ profileName: p.instanceProfileName, roleName })
                    }
                  />
                </div>
              </Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={() => setDeleteTarget(p)}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreateProfileModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("iam.profile.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("iam.profile.deleteConfirm", { name: deleteTarget?.instanceProfileName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.instanceProfileName)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Inline select for attaching one of the unattached roles to a profile. */
function AttachRoleControl({
  roleNames,
  onAttach,
}: {
  roleNames: string[];
  onAttach: (roleName: string) => void;
}) {
  const { t } = useTranslation();
  if (roleNames.length === 0) return null;
  return (
    <Select
      value=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        if (e.target.value) onAttach(e.target.value);
      }}
      className="py-1 text-xs"
    >
      <option value="">{t("iam.profile.attachRole")}</option>
      {roleNames.map((rn) => (
        <option key={rn} value={rn}>
          {rn}
        </option>
      ))}
    </Select>
  );
}

function CreateProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [roleName, setRoleName] = useState("");

  const roles = useQuery({ queryKey: ["iam-roles"], queryFn: api.listRoles, enabled: open });

  const create = useMutation({
    mutationFn: async () => {
      const profileName = name.trim();
      await api.createInstanceProfile({
        instanceProfileName: profileName,
        path: path.trim() || undefined,
      });
      if (roleName) await api.addRoleToInstanceProfile(profileName, roleName);
    },
    onSuccess: () => {
      toast.success(t("iam.profile.created", { name }));
      qc.invalidateQueries({ queryKey: ["instance-profiles"] });
      setName("");
      setPath("");
      setRoleName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("iam.profile.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("iam.profile.col.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-instance-profile"
            autoComplete="off"
          />
        </Field>
        <Field label={t("iam.profile.col.path")}>
          <TextInput value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
        </Field>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("iam.profile.role")}</FieldLabel>
          <Select value={roleName} onChange={(e) => setRoleName(e.target.value)}>
            <option value="">{t("iam.profile.noRole")}</option>
            {(roles.data ?? []).map((r) => (
              <option key={r.roleName} value={r.roleName}>
                {r.roleName}
              </option>
            ))}
          </Select>
        </label>
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

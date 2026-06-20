import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/ec2-api";
import type { Ec2LaunchInput } from "@/lib/types";
import { useToast } from "./toast";
import { Button, Field, Modal, TextInput } from "./ui";

const INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "m5.large",
  "c5.large",
];

export function Ec2LaunchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [imageId, setImageId] = useState("ami-0abcdef1234567890");
  const [instanceType, setInstanceType] = useState("t3.micro");
  const [count, setCount] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [securityGroups, setSecurityGroups] = useState("");
  const [subnetId, setSubnetId] = useState("");

  const launch = useMutation({
    mutationFn: () => {
      const input: Ec2LaunchInput = {
        imageId: imageId.trim(),
        instanceType: instanceType.trim(),
        count,
        name: name.trim() || undefined,
        keyName: keyName.trim() || undefined,
        securityGroupIds: securityGroups
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        subnetId: subnetId.trim() || undefined,
      };
      return api.launchInstances(input);
    },
    onSuccess: () => {
      toast.success(t("ec2.launch.created"));
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid = imageId.trim() !== "" && instanceType.trim() !== "" && count >= 1;

  return (
    <Modal open={open} onClose={onClose} title={t("ec2.launch.title")} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t("ec2.launch.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-instance"
          />
        </Field>

        <Field label={t("ec2.launch.ami")}>
          <TextInput value={imageId} onChange={(e) => setImageId(e.target.value)} />
          <span className="text-xs text-slate-400">{t("ec2.launch.amiHint")}</span>
        </Field>

        <Field label={t("ec2.launch.instanceType")}>
          <select
            value={instanceType}
            onChange={(e) => setInstanceType(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            {INSTANCE_TYPES.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("ec2.launch.count")}>
          <TextInput
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-28"
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="self-start text-xs font-medium text-brand hover:underline"
        >
          {advanced ? "− " : "+ "}
          {t("ec2.launch.advanced")}
        </button>

        {advanced && (
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Field label={t("ec2.launch.keyName")}>
              <TextInput value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            </Field>
            <Field label={t("ec2.launch.securityGroups")}>
              <TextInput
                value={securityGroups}
                onChange={(e) => setSecurityGroups(e.target.value)}
                placeholder="sg-123, sg-456"
              />
              <span className="text-xs text-slate-400">{t("ec2.launch.securityGroupsHint")}</span>
            </Field>
            <Field label={t("ec2.launch.subnet")}>
              <TextInput
                value={subnetId}
                onChange={(e) => setSubnetId(e.target.value)}
                placeholder="subnet-123"
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => launch.mutate()} loading={launch.isPending} disabled={!valid}>
            {t("ec2.launch.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/kit";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import { api as ec2 } from "@/lib/ec2-api";
import type { Tag } from "@/lib/types";

/**
 * Tags editor for an EC2-family resource (VPC/subnet/IGW/NAT/EIP) inside a detail
 * panel. Seeds from the resource's tags and persists via the EC2 CreateTags/DeleteTags
 * (`ec2-api.saveTags`), then invalidates the owning list query so the panel reseeds.
 */
export function VpcTagsCard({
  resourceId,
  tags,
  invalidateKey,
}: {
  resourceId: string;
  tags: Tag[];
  invalidateKey: unknown[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (v: { tags: Tag[]; removed: string[] }) =>
      ec2.saveTags(resourceId, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card title={t("tags.heading")}>
      <TagsEditor
        current={tags}
        saving={save.isPending}
        onSave={(next, removed) => save.mutate({ tags: next, removed })}
      />
    </Card>
  );
}

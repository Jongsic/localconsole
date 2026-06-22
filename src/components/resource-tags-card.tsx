import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/kit";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import type { Tag } from "@/lib/types";

/**
 * Tags editor for a resource addressed by ARN (RDS / ElastiCache). Tags aren't part of
 * the list response for these services, so the card fetches them on demand via `getTags`
 * and persists with `saveTags` (diff: remove dropped keys, then upsert). The tag query is
 * keyed by ARN so it reseeds after a save.
 */
export function ResourceTagsCard({
  arn,
  getTags,
  saveTags,
}: {
  arn: string;
  getTags: (arn: string) => Promise<Tag[]>;
  saveTags: (arn: string, tags: Tag[], removedKeys: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const queryKey = ["resource-tags", arn];

  const tags = useQuery({ queryKey, queryFn: () => getTags(arn) });

  const save = useMutation({
    mutationFn: (v: { tags: Tag[]; removed: string[] }) => saveTags(arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card title={t("tags.heading")}>
      {tags.isLoading ? (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      ) : (
        <TagsEditor
          current={tags.data ?? []}
          saving={save.isPending}
          onSave={(next, removed) => save.mutate({ tags: next, removed })}
        />
      )}
    </Card>
  );
}

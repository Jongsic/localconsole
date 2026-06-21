import { Ban, Lock, PlugZap, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { type AwsErrorKind, classifyAwsError } from "@/lib/aws-error";

const ICONS: Record<AwsErrorKind, ComponentType<{ className?: string }>> = {
  unsupported: Ban,
  denied: Lock,
  cors: PlugZap,
  network: PlugZap,
  other: TriangleAlert,
};

/** Tone: unsupported is calm/muted; denied/network are amber; other is red. */
const TONES: Record<AwsErrorKind, string> = {
  unsupported: "text-slate-400",
  denied: "text-amber-600",
  cors: "text-amber-600",
  network: "text-amber-600",
  other: "text-red-600",
};

/**
 * Renders a query/error in a calm, classified way. Use in a page's `isError` branch:
 *   if (q.isError) return <ResourceError error={q.error} service="EC2" />;
 */
export function ResourceError({ error, service }: { error: unknown; service: string }) {
  const { t } = useTranslation();
  const { kind, detail } = classifyAwsError(error);
  const Icon = ICONS[kind];

  const title =
    kind === "unsupported"
      ? t("resourceError.unsupported", { service })
      : kind === "denied"
        ? t("resourceError.denied")
        : kind === "cors" || kind === "network"
          ? t("resourceError.network")
          : t("resourceError.other");

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Icon className={`h-10 w-10 ${TONES[kind]}`} />
      <p className={`text-sm font-medium ${TONES[kind]}`}>{title}</p>
      {/* The raw detail is useful for denied/other; for unsupported keep it subtle. */}
      {kind !== "unsupported" && <p className="max-w-md text-xs text-slate-400">{detail}</p>}
    </div>
  );
}

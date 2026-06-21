import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useResizablePanel } from "./use-resizable-panel";

/**
 * Bottom detail panel whose height is drag-resizable (top-edge grip) and persisted
 * per page via `storageKey`. Wrap a panel's header + body as children.
 */
export function ResizableBottomPanel({
  storageKey,
  children,
  className,
}: {
  storageKey: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const { height, onPointerDown } = useResizablePanel(storageKey);

  return (
    <div className={cn("flex shrink-0 flex-col border-t bg-white", className)} style={{ height }}>
      <button
        type="button"
        aria-label={t("common.resize")}
        onPointerDown={onPointerDown}
        className="group -mt-1 h-2 shrink-0 cursor-row-resize"
      >
        <span className="mx-auto block h-0.5 w-10 rounded-full bg-slate-200 group-hover:bg-brand" />
      </button>
      {children}
    </div>
  );
}

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";

/** Curated standard AWS regions. Any other value is still allowed via the custom input. */
const REGIONS: { id: string; city: string }[] = [
  { id: "us-east-1", city: "N. Virginia" },
  { id: "us-east-2", city: "Ohio" },
  { id: "us-west-1", city: "N. California" },
  { id: "us-west-2", city: "Oregon" },
  { id: "ca-central-1", city: "Canada (Central)" },
  { id: "eu-west-1", city: "Ireland" },
  { id: "eu-west-2", city: "London" },
  { id: "eu-central-1", city: "Frankfurt" },
  { id: "eu-north-1", city: "Stockholm" },
  { id: "ap-northeast-1", city: "Tokyo" },
  { id: "ap-northeast-2", city: "Seoul" },
  { id: "ap-southeast-1", city: "Singapore" },
  { id: "ap-southeast-2", city: "Sydney" },
  { id: "ap-south-1", city: "Mumbai" },
  { id: "sa-east-1", city: "São Paulo" },
];

export function RegionSwitch() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const setSettings = useSettings((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (region: string) => {
    const next = region.trim();
    if (next && next !== settings.region) setSettings({ ...settings, region: next });
    setOpen(false);
    setCustom(false);
  };

  const toggle = () => {
    setOpen((v) => !v);
    setCustom(false);
    setDraft(settings.region);
  };

  return (
    <div ref={ref} className="relative" title={t("region.title")}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Globe className="h-4 w-4 text-slate-400" />
        <span className="font-mono">{settings.region}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <div className="max-h-72 overflow-auto">
            {REGIONS.map((r) => {
              const active = r.id === settings.region;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => apply(r.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-50",
                    active ? "text-brand" : "text-slate-700",
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs">{r.id}</span>
                  <span className="ml-auto text-xs text-slate-400">{r.city}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-1 border-t border-slate-100 pt-1">
            {custom ? (
              <form
                className="flex items-center gap-1.5 px-2 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  apply(draft);
                }}
              >
                <input
                  // biome-ignore lint/a11y/noAutofocus: focus the field the user just opened
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("region.customPlaceholder")}
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button
                  type="submit"
                  className="rounded bg-brand px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-brand/90"
                >
                  {t("common.apply")}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCustom(true);
                  setDraft(settings.region);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
              >
                {t("region.custom")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

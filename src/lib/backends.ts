import { z } from "zod";
import backendsJson from "@/config/backends.json";
import type { BackendKind, Section } from "./types";

/* ── Registry schema (validates config/backends.json at load) ── */

const sectionSchema = z.enum(["s3", "compute", "vpc", "db", "function", "iam"]);

const detectSchema = z.object({
  /** Health/status path probed without credentials */
  healthPath: z.string(),
  /** Default local ports this backend listens on (for candidate discovery) */
  ports: z.array(z.number()),
  /** If set, the health JSON must contain this top-level key to match */
  jsonKey: z.string().optional(),
});

const entrySchema = z.object({
  label: z.string(),
  detect: detectSchema.optional(),
  sections: z.array(sectionSchema),
  note: z.string().optional(),
});

const registrySchema = z.object({
  backends: z.record(z.string(), entrySchema),
});

export type BackendDetect = z.infer<typeof detectSchema>;
export type BackendEntry = z.infer<typeof entrySchema>;

const registry = registrySchema.parse(backendsJson).backends;

/** Registry entry for a backend kind (falls back to a closed/none-like entry). */
export function backendEntry(backend: BackendKind): BackendEntry {
  return registry[backend] ?? { label: backend, sections: [] };
}

/** Sections to open for a backend. Unlisted sections are hidden entirely. */
export function sectionsFor(backend: BackendKind): Section[] {
  return backendEntry(backend).sections;
}

/** Whether a given nav section is enabled for the backend. */
export function hasSection(backend: BackendKind, section: Section): boolean {
  return sectionsFor(backend).includes(section);
}

/** Detection specs for kinds that declare one (used by detect.ts / discovery). */
export function detectableBackends(): { backend: BackendKind; detect: BackendDetect }[] {
  return Object.entries(registry)
    .filter((e): e is [string, BackendEntry & { detect: BackendDetect }] => Boolean(e[1].detect))
    .map(([backend, entry]) => ({ backend: backend as BackendKind, detect: entry.detect }));
}

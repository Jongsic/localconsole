import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { type BackendDetect, detectableBackends } from "./backends";
import { clientFromSettings } from "./s3-client";
import type { BackendKind, ConnectionSettings } from "./types";

/** Connection failure classification */
export type DetectFailure = "cors" | "credentials" | "other";

export type DetectResult = {
  backend: BackendKind;
  /** Whether S3 ListBuckets actually worked */
  reachable: boolean;
  /** Failure cause (when not reachable) */
  failure?: DetectFailure;
  /** Human-readable detail (error name/message) */
  detail?: string;
};

function base(endpoint: string): string {
  return endpoint.trim().replace(/\/$/, "");
}

/** Probe one backend's health path; honors an optional required JSON key. */
async function matchesDetect(ep: string, detect: BackendDetect): Promise<boolean> {
  try {
    const r = await fetch(`${ep}${detect.healthPath}`, { method: "GET" });
    if (!r.ok) return false;
    if (detect.jsonKey) {
      const j = await r.json().catch(() => null);
      return !!(j && typeof j === "object" && detect.jsonKey in j);
    }
    return true;
  } catch {
    return false;
  }
}

const AUTH_ERROR_RE =
  /InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|InvalidSecurity|InvalidClientTokenId|UnrecognizedClient|TokenRefreshRequired|MissingAuthentication/i;

type ProbeResult = { ok: true } | { ok: false; kind: DetectFailure; detail: string };

/**
 * Classify an S3 error by cause.
 *  - HTTP status (esp. 401/403) or an auth-related error name -> credentials/permission
 *  - has a status code but not auth-related -> other
 *  - no status code -> the browser blocked the response (CORS) or the network is down
 */
export function classifyFailure(e: unknown): { kind: DetectFailure; detail: string } {
  const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = err?.$metadata?.httpStatusCode;
  const name = err?.name ?? "";
  const detail = name && err?.message ? `${name}: ${err.message}` : name || err?.message || "error";

  if (status || AUTH_ERROR_RE.test(name)) {
    if (status === 403 || status === 401 || AUTH_ERROR_RE.test(name)) {
      return { kind: "credentials", detail };
    }
    return { kind: "other", detail };
  }
  return { kind: "cors", detail };
}

/** Actually call ListBuckets to test connectivity and classify any failure. */
async function probeListBuckets(s: ConnectionSettings): Promise<ProbeResult> {
  try {
    await clientFromSettings(s).send(new ListBucketsCommand({}));
    return { ok: true };
  } catch (e) {
    return { ok: false, ...classifyFailure(e) };
  }
}

/** Guess the backend kind + run a connection test (with failure classification). */
export async function detectBackend(s: ConnectionSettings): Promise<DetectResult> {
  const ep = base(s.endpoint);

  let backend: BackendKind = "unknown";
  if (!ep || /amazonaws\.com/i.test(ep)) {
    backend = "aws";
  } else {
    for (const { backend: kind, detect } of detectableBackends()) {
      if (await matchesDetect(ep, detect)) {
        backend = kind;
        break;
      }
    }
  }

  const probe = await probeListBuckets(s);
  if (probe.ok) {
    return { backend, reachable: true };
  }
  // Unknown kind and not reachable -> none
  return {
    backend: backend === "unknown" ? "none" : backend,
    reachable: false,
    failure: probe.kind,
    detail: probe.detail,
  };
}

/* ── Candidate discovery ── */

export type Candidate = {
  backend: BackendKind;
  endpoint: string;
  /** Defaults to fill into the form when selected */
  defaults: Pick<
    ConnectionSettings,
    "endpoint" | "region" | "forcePathStyle" | "accessKeyId" | "secretAccessKey" | "websiteHost"
  >;
};

/** Form-fill defaults (creds / website host) per backend; endpoint is derived from the probed port. */
type CandidateDefaults = Omit<Candidate["defaults"], "endpoint">;

const CANDIDATE_DEFAULTS: Partial<Record<BackendKind, CandidateDefaults>> = {
  floci: {
    region: "us-east-1",
    forcePathStyle: true,
    accessKeyId: "test",
    secretAccessKey: "test",
    websiteHost: "",
  },
  localstack: {
    region: "us-east-1",
    forcePathStyle: true,
    accessKeyId: "test",
    secretAccessKey: "test",
    websiteHost: "s3-website.localhost.localstack.cloud:4566",
  },
  moto: {
    region: "us-east-1",
    forcePathStyle: true,
    accessKeyId: "testing",
    secretAccessKey: "testing",
    websiteHost: "",
  },
  minio: {
    region: "us-east-1",
    forcePathStyle: true,
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    websiteHost: "",
  },
};

/**
 * Probe the registry's default local ports and collect the backends that respond.
 * Backends are tried in registry order, so for a shared port (Floci & LocalStack both on 4566)
 * the more specific match wins and each endpoint yields at most one candidate.
 * (Checks only health paths without credentials — finds CORS-allowed backends only.)
 */
export async function discoverCandidates(): Promise<Candidate[]> {
  const specs = detectableBackends();

  // endpoint -> backends to try there, in registry order
  const byEndpoint = new Map<string, typeof specs>();
  for (const spec of specs) {
    for (const port of spec.detect.ports) {
      const ep = `http://localhost:${port}`;
      byEndpoint.set(ep, [...(byEndpoint.get(ep) ?? []), spec]);
    }
  }

  const found: Candidate[] = [];
  for (const [endpoint, list] of byEndpoint) {
    for (const { backend, detect } of list) {
      if (await matchesDetect(endpoint, detect)) {
        const defaults = CANDIDATE_DEFAULTS[backend];
        if (defaults) found.push({ backend, endpoint, defaults: { ...defaults, endpoint } });
        break; // first (most specific) match per endpoint
      }
    }
  }
  return found;
}

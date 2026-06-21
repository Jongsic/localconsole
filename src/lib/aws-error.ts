/**
 * Classify an AWS SDK error so the UI can show a calm, accurate state instead of a raw error.
 *
 * Kinds:
 *  - `unsupported`: the backend does not implement this service/action (e.g. a Pro-only service on
 *    LocalStack community, or an action moto hasn't emulated). Shown as a quiet "not supported" state.
 *  - `denied`: credentials are valid but lack permission. Shown plainly — never hidden.
 *  - `cors` / `network`: the browser blocked the response or the endpoint is unreachable.
 *  - `other`: anything we cannot confidently classify — shown as a real error so bugs aren't masked.
 *
 * We classify as `unsupported` only on strong signals, to avoid masking genuine failures.
 */
export type AwsErrorKind = "unsupported" | "denied" | "cors" | "network" | "other";

export type ClassifiedError = { kind: AwsErrorKind; detail: string };

type SdkError = {
  name?: string;
  message?: string;
  $metadata?: { httpStatusCode?: number };
};

const DENIED_RE =
  /AccessDenied|UnauthorizedOperation|Forbidden|not authorized|AccessDeniedException/i;

/** Strong "this backend doesn't implement it" signals, across LocalStack community and moto. */
const UNSUPPORTED_RE =
  /not (yet )?(implemented|emulated)|NotYetImplemented|not included in your current license|is a Pro feature|InternalFailure.*not.*implemented|API for service .* is (either )?not/i;

export function classifyAwsError(e: unknown): ClassifiedError {
  const err = e as SdkError;
  const status = err?.$metadata?.httpStatusCode;
  const name = err?.name ?? "";
  const message = err?.message ?? "";
  const detail = name && message ? `${name}: ${message}` : name || message || "error";
  const haystack = `${name} ${message}`;

  // Unsupported: explicit "not implemented / not in license" messaging, or moto's 404 NotYetImplemented.
  if (UNSUPPORTED_RE.test(haystack) || (status === 501 && !DENIED_RE.test(haystack))) {
    return { kind: "unsupported", detail };
  }

  // Permission problems — keep visible.
  if (status === 403 || status === 401 || DENIED_RE.test(haystack)) {
    return { kind: "denied", detail };
  }

  // Has an HTTP status but not classified above -> a real, surfaced error.
  if (status) return { kind: "other", detail };

  // No status code at all -> browser blocked it (CORS) or the endpoint is down.
  return { kind: "network", detail };
}

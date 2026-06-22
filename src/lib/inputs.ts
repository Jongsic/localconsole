/**
 * Pure input-transform helpers for form fields. Extracted from inline component
 * logic (e.g. the security-group RuleEditor) so they can be unit-tested directly
 * — this is the cheapest, least-brittle place to catch our-side regressions such
 * as the NaN-port bug.
 *
 * These are pure functions: no React, no i18n, no network.
 */

export type PortRange = { from: number; to: number };

/**
 * Parse a port field into a `{from, to}` range.
 *  - ""            → null  (means "all ports" — caller omits FromPort/ToPort)
 *  - "80"          → { from: 80, to: 80 }
 *  - "8000-8010"   → { from: 8000, to: 8010 }
 *  - "  80 - 90 "  → { from: 80, to: 90 } (whitespace tolerated)
 *  - non-numeric   → throws (e.g. "abc", "80-x") so callers surface an error
 *
 * Numbers must be finite; anything that parses to NaN throws.
 */
export function parsePortRange(input: string): PortRange | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parts = trimmed.split("-").map((s) => s.trim());
  const from = Number(parts[0]);
  const to = parts.length > 1 ? Number(parts[1]) : from;
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error("invalid-port");
  }
  return { from, to };
}

/**
 * Split a comma-separated CIDR field into a clean list: trim each entry and drop
 * empties. "10.0.0.0/8, , 0.0.0.0/0 " → ["10.0.0.0/8", "0.0.0.0/0"].
 */
export function splitCidrs(input: string): string[] {
  return input
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Parse an IPv4 "a.b.c.d/n" CIDR into a 32-bit network base + prefix length, or null if malformed. */
function parseIpv4Cidr(cidr: string): { base: number; prefix: number } | null {
  const m = cidr.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) return null;
  const [o0, o1, o2, o3] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  const prefix = Number(m[5]);
  if ([o0, o1, o2, o3].some((o) => o > 255) || prefix > 32) return null;
  // >>> 0 keeps the result an unsigned 32-bit integer.
  const addr = ((o0 << 24) | (o1 << 16) | (o2 << 8) | o3) >>> 0;
  // Mask the address down to its network base so host bits don't affect comparison.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { base: (addr & mask) >>> 0, prefix };
}

/**
 * True when an IPv4 subnet CIDR falls entirely within a VPC CIDR.
 *  - both must be valid IPv4 CIDRs
 *  - the subnet prefix length must be >= the vpc prefix length (subnet no larger than the vpc)
 *  - the subnet's network base, masked to the vpc prefix, must equal the vpc's network base
 *
 * Equal ranges (same base + same prefix) count as contained. Returns false on any malformed input.
 */
export function cidrContains(vpcCidr: string, subnetCidr: string): boolean {
  const vpc = parseIpv4Cidr(vpcCidr);
  const subnet = parseIpv4Cidr(subnetCidr);
  if (!vpc || !subnet) return false;
  if (subnet.prefix < vpc.prefix) return false;
  const vpcMask = vpc.prefix === 0 ? 0 : (0xffffffff << (32 - vpc.prefix)) >>> 0;
  return (subnet.base & vpcMask) >>> 0 === vpc.base;
}

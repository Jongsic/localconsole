import { describe, expect, it } from "vitest";
import { cidrContains, parsePortRange, splitCidrs } from "./inputs";

describe("parsePortRange", () => {
  it("treats empty / whitespace as all ports (null)", () => {
    expect(parsePortRange("")).toBeNull();
    expect(parsePortRange("   ")).toBeNull();
  });

  it("expands a single port into a from===to range", () => {
    expect(parsePortRange("80")).toEqual({ from: 80, to: 80 });
    expect(parsePortRange("443")).toEqual({ from: 443, to: 443 });
  });

  it("parses an explicit range", () => {
    expect(parsePortRange("8000-8010")).toEqual({ from: 8000, to: 8010 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parsePortRange("  80 - 90 ")).toEqual({ from: 80, to: 90 });
  });

  it("throws on non-numeric input (the NaN-port regression)", () => {
    expect(() => parsePortRange("abc")).toThrow();
    expect(() => parsePortRange("80-x")).toThrow();
    expect(() => parsePortRange("x-80")).toThrow();
  });
});

describe("splitCidrs", () => {
  it("returns a single trimmed CIDR", () => {
    expect(splitCidrs("0.0.0.0/0")).toEqual(["0.0.0.0/0"]);
    expect(splitCidrs("  10.0.0.0/8  ")).toEqual(["10.0.0.0/8"]);
  });

  it("splits comma-separated CIDRs and drops empties", () => {
    expect(splitCidrs("10.0.0.0/8, , 0.0.0.0/0 ")).toEqual(["10.0.0.0/8", "0.0.0.0/0"]);
  });

  it("returns an empty list for blank input", () => {
    expect(splitCidrs("")).toEqual([]);
    expect(splitCidrs(" , , ")).toEqual([]);
  });
});

describe("cidrContains", () => {
  it("returns true when the subnet is within the VPC range", () => {
    expect(cidrContains("10.0.0.0/16", "10.0.1.0/24")).toBe(true);
    expect(cidrContains("10.0.0.0/16", "10.0.255.0/24")).toBe(true);
    expect(cidrContains("172.16.0.0/12", "172.31.0.0/16")).toBe(true);
  });

  it("returns false when the subnet network falls outside the VPC range", () => {
    expect(cidrContains("10.0.0.0/16", "10.1.0.0/24")).toBe(false);
    expect(cidrContains("192.168.0.0/16", "10.0.0.0/24")).toBe(false);
  });

  it("returns false when the subnet prefix is shorter than the VPC prefix (subnet larger than vpc)", () => {
    expect(cidrContains("10.0.0.0/16", "10.0.0.0/8")).toBe(false);
    expect(cidrContains("10.0.0.0/24", "10.0.0.0/16")).toBe(false);
  });

  it("treats an equal range as contained", () => {
    expect(cidrContains("10.0.0.0/16", "10.0.0.0/16")).toBe(true);
  });

  it("ignores host bits in the subnet input (network base is what matters)", () => {
    expect(cidrContains("10.0.0.0/16", "10.0.5.7/24")).toBe(true);
  });

  it("returns false on malformed input", () => {
    expect(cidrContains("not-a-cidr", "10.0.1.0/24")).toBe(false);
    expect(cidrContains("10.0.0.0/16", "10.0.1.0")).toBe(false);
    expect(cidrContains("10.0.0.0/16", "10.0.1.0/40")).toBe(false);
    expect(cidrContains("10.0.0.0/16", "10.0.300.0/24")).toBe(false);
  });
});

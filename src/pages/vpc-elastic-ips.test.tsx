import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElasticIpSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/vpc-api", () => ({
  api: {
    listAddresses: vi.fn(),
    allocateAddress: vi.fn().mockResolvedValue(undefined),
    releaseAddress: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/ec2-api", () => ({
  api: { saveTags: vi.fn().mockResolvedValue(undefined) },
}));

import { api } from "@/lib/vpc-api";
import { VpcElasticIpsPage } from "./vpc-elastic-ips";

const eip: ElasticIpSummary = {
  allocationId: "eipalloc-1",
  publicIp: "52.0.0.1",
  domain: "vpc",
  association: null,
  name: "web-eip",
  tags: [{ key: "team", value: "platform" }],
  networkBorderGroup: null,
  publicIpv4Pool: null,
};

describe("VpcElasticIpsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listAddresses).mockResolvedValue([eip]);
    renderWithProviders(<VpcElasticIpsPage />);
    expect(await screen.findByText("52.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("eipalloc-1")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listAddresses).mockResolvedValue([]);
    renderWithProviders(<VpcElasticIpsPage />);
    expect(await screen.findByText("No Elastic IPs")).toBeInTheDocument();
  });

  it("allocate button calls allocateAddress", async () => {
    vi.mocked(api.listAddresses).mockResolvedValue([]);
    const { user } = renderWithProviders(<VpcElasticIpsPage />);
    await screen.findByText("No Elastic IPs");

    await user.click(screen.getByRole("button", { name: /Allocate Elastic IP/ }));
    await waitFor(() => expect(api.allocateAddress).toHaveBeenCalled());
  });

  it("release flow calls releaseAddress with the allocation id", async () => {
    vi.mocked(api.listAddresses).mockResolvedValue([eip]);
    const { user } = renderWithProviders(<VpcElasticIpsPage />);
    await screen.findByText("52.0.0.1");

    await user.click(screen.getByTitle("Release"));
    const buttons = await screen.findAllByRole("button", { name: "Release" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.releaseAddress).toHaveBeenCalledWith("eipalloc-1"));
  });

  it("selecting a row opens a panel with seeded tags", async () => {
    vi.mocked(api.listAddresses).mockResolvedValue([eip]);
    const { user } = renderWithProviders(<VpcElasticIpsPage />);

    await user.click(await screen.findByText("eipalloc-1"));
    expect(await screen.findByDisplayValue("team")).toBeInTheDocument();
    expect(screen.getByDisplayValue("platform")).toBeInTheDocument();
  });
});

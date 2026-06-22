import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VpcSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/vpc-api", () => ({
  api: {
    listVpcs: vi.fn(),
    createVpc: vi.fn().mockResolvedValue(undefined),
    deleteVpc: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/vpc-api";
import { VpcVpcsPage } from "./vpc-vpcs";

const vpc: VpcSummary = {
  vpcId: "vpc-1",
  cidrBlock: "10.0.0.0/16",
  state: "available",
  isDefault: false,
  name: "main",
  tags: [],
  ownerId: null,
  instanceTenancy: "default",
  dhcpOptionsId: null,
  cidrAssociations: [],
  ipv6CidrAssociations: [],
};

describe("VpcVpcsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listVpcs).mockResolvedValue([vpc]);
    renderWithProviders(<VpcVpcsPage />);
    expect(await screen.findByText("main")).toBeInTheDocument();
    expect(screen.getByText("vpc-1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.0/16")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listVpcs).mockResolvedValue([]);
    renderWithProviders(<VpcVpcsPage />);
    expect(await screen.findByText("No VPCs")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listVpcs).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeVpcs is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<VpcVpcsPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support VPC.")).toBeInTheDocument(),
    );
  });

  it("create modal sends the CIDR block to createVpc", async () => {
    vi.mocked(api.listVpcs).mockResolvedValue([]);
    const { user } = renderWithProviders(<VpcVpcsPage />);
    await screen.findByText("No VPCs");

    await user.click(screen.getByRole("button", { name: /Create VPC/ }));
    const cidr = screen.getByLabelText("CIDR block");
    await user.clear(cidr);
    await user.type(cidr, "172.16.0.0/16");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createVpc).toHaveBeenCalledWith("172.16.0.0/16"));
  });

  it("delete confirm calls deleteVpc with the id", async () => {
    vi.mocked(api.listVpcs).mockResolvedValue([vpc]);
    const { user } = renderWithProviders(<VpcVpcsPage />);
    await screen.findByText("main");

    await user.click(screen.getByTitle("Delete"));
    // Confirm in the modal (two "Delete" buttons now: the row trash + the modal confirm).
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteVpc).toHaveBeenCalledWith("vpc-1"));
  });
});

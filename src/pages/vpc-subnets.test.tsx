import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubnetSummary, VpcSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/vpc-api", () => ({
  api: {
    listSubnets: vi.fn(),
    listVpcs: vi.fn().mockResolvedValue([]),
    createSubnet: vi.fn().mockResolvedValue(undefined),
    deleteSubnet: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/ec2-api", () => ({
  api: { saveTags: vi.fn().mockResolvedValue(undefined) },
}));

import { api as ec2 } from "@/lib/ec2-api";
import { api } from "@/lib/vpc-api";
import { VpcSubnetsPage } from "./vpc-subnets";

const subnet: SubnetSummary = {
  subnetId: "subnet-1",
  vpcId: "vpc-1",
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-east-1a",
  availableIpCount: 250,
  state: "available",
  name: "public",
  tags: [{ key: "env", value: "prod" }],
  ownerId: null,
  availabilityZoneId: null,
  defaultForAz: false,
  mapPublicIpOnLaunch: false,
  assignIpv6AddressOnCreation: false,
  ipv6CidrBlocks: [],
  enableDns64: false,
};

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

describe("VpcSubnetsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([subnet]);
    renderWithProviders(<VpcSubnetsPage />);
    expect(await screen.findByText("public")).toBeInTheDocument();
    expect(screen.getByText("subnet-1")).toBeInTheDocument();
    expect(screen.getByText("10.0.1.0/24")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([]);
    renderWithProviders(<VpcSubnetsPage />);
    expect(await screen.findByText("No subnets")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listSubnets).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeSubnets is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<VpcSubnetsPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support VPC subnets.")).toBeInTheDocument(),
    );
  });

  it("create modal sends vpcId + CIDR + AZ to createSubnet", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([]);
    vi.mocked(api.listVpcs).mockResolvedValue([vpc]);
    const { user } = renderWithProviders(<VpcSubnetsPage />);
    await screen.findByText("No subnets");

    await user.click(screen.getByRole("button", { name: /Create subnet/ }));
    await user.selectOptions(screen.getByLabelText("VPC ID"), "vpc-1");
    const cidr = screen.getByLabelText("CIDR block");
    await user.clear(cidr);
    await user.type(cidr, "10.0.2.0/24");
    await user.type(screen.getByLabelText("Availability zone (optional)"), "us-east-1b");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createSubnet).toHaveBeenCalledWith({
        vpcId: "vpc-1",
        cidrBlock: "10.0.2.0/24",
        availabilityZone: "us-east-1b",
      }),
    );
  });

  it("delete confirm calls deleteSubnet with the id", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([subnet]);
    const { user } = renderWithProviders(<VpcSubnetsPage />);
    await screen.findByText("public");

    await user.click(screen.getByTitle("Delete"));
    // Confirm in the modal (two "Delete" buttons now: the row trash + the modal confirm).
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteSubnet).toHaveBeenCalledWith("subnet-1"));
  });
});

describe("VpcSubnetsPage detail panel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selecting a row opens a panel with attributes + seeded tags", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([subnet]);
    const { user } = renderWithProviders(<VpcSubnetsPage />);

    await user.click(await screen.findByText("public"));

    // Tags seeded into the editor (panel-only inputs).
    expect(await screen.findByDisplayValue("env")).toBeInTheDocument();
    expect(screen.getByDisplayValue("prod")).toBeInTheDocument();
    // Attributes render in the panel — AZ now appears in both the row and the panel.
    expect(screen.getAllByText("us-east-1a").length).toBeGreaterThan(1);
    expect(screen.getAllByText("250").length).toBeGreaterThan(1);
  });

  it("saving tags calls ec2.saveTags with the subnet id", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([subnet]);
    const { user } = renderWithProviders(<VpcSubnetsPage />);

    await user.click(await screen.findByText("public"));
    await screen.findByDisplayValue("env");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(ec2.saveTags).toHaveBeenCalledWith("subnet-1", [{ key: "env", value: "prod" }], []),
    );
  });
});

describe("VpcSubnetsPage create CIDR validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks submit when the CIDR is outside the selected VPC", async () => {
    vi.mocked(api.listSubnets).mockResolvedValue([]);
    vi.mocked(api.listVpcs).mockResolvedValue([vpc]);
    const { user } = renderWithProviders(<VpcSubnetsPage />);
    await screen.findByText("No subnets");

    await user.click(screen.getByRole("button", { name: /Create subnet/ }));
    await user.selectOptions(screen.getByLabelText("VPC ID"), "vpc-1");
    const cidr = screen.getByLabelText("CIDR block");
    await user.clear(cidr);
    await user.type(cidr, "192.168.1.0/24");

    expect(await screen.findByText(/CIDR must be within the selected VPC/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(api.createSubnet).not.toHaveBeenCalled();
  });
});

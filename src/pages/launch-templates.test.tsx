import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2LaunchTemplateSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    listLaunchTemplates: vi.fn(),
    getLaunchTemplateVersion: vi.fn(),
    createLaunchTemplate: vi.fn().mockResolvedValue(undefined),
    deleteLaunchTemplate: vi.fn().mockResolvedValue(undefined),
    listKeyPairs: vi.fn().mockResolvedValue([{ keyName: "demo" }]),
    listSecurityGroups: vi
      .fn()
      .mockResolvedValue([{ groupId: "sg-1", groupName: "web", inbound: [], outbound: [] }]),
  },
}));

import { api } from "@/lib/ec2-api";
import { LaunchTemplatesPage } from "./launch-templates";

const sample: Ec2LaunchTemplateSummary = {
  launchTemplateId: "lt-1",
  launchTemplateName: "web",
  defaultVersionNumber: 1,
  latestVersionNumber: 3,
  createTime: "2024-01-01T00:00:00.000Z",
};

describe("LaunchTemplatesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listLaunchTemplates).mockResolvedValue([sample]);
    renderWithProviders(<LaunchTemplatesPage />);
    expect(await screen.findByText("web")).toBeInTheDocument();
    expect(screen.getByText("lt-1")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listLaunchTemplates).mockResolvedValue([]);
    renderWithProviders(<LaunchTemplatesPage />);
    expect(await screen.findByText("No launch templates")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listLaunchTemplates).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeLaunchTemplates is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<LaunchTemplatesPage />);
    await waitFor(() =>
      expect(
        screen.getByText("This backend does not support EC2 launch templates."),
      ).toBeInTheDocument(),
    );
  });

  it("clicking a row opens the version detail panel and shows the mapped data", async () => {
    vi.mocked(api.listLaunchTemplates).mockResolvedValue([sample]);
    vi.mocked(api.getLaunchTemplateVersion).mockResolvedValue({
      versionNumber: 1,
      imageId: "ami-123",
      instanceType: "t3.small",
      keyName: "demo",
      securityGroupIds: ["sg-1"],
      securityGroups: [],
      iamInstanceProfileArn: null,
      metadataHttpTokens: null,
      metadataHopLimit: null,
      userDataPresent: false,
      blockDevices: [],
    });
    const { user } = renderWithProviders(<LaunchTemplatesPage />);

    await user.click(await screen.findByText("web"));
    await waitFor(() => expect(api.getLaunchTemplateVersion).toHaveBeenCalledWith("lt-1"));
    expect(await screen.findByText("ami-123")).toBeInTheDocument();
    expect(screen.getByText("t3.small")).toBeInTheDocument();
  });

  it("create modal sends name/ami/instance type/key/SG to createLaunchTemplate", async () => {
    vi.mocked(api.listLaunchTemplates).mockResolvedValue([]);
    const { user } = renderWithProviders(<LaunchTemplatesPage />);
    await screen.findByText("No launch templates");

    await user.click(screen.getByRole("button", { name: /Create launch template/ }));
    await user.type(screen.getByLabelText("Name"), "my-lt");
    await user.selectOptions(await screen.findByLabelText("Key pair"), "demo");
    await user.click(await screen.findByRole("checkbox", { name: /web/ }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createLaunchTemplate).toHaveBeenCalledWith({
        name: "my-lt",
        imageId: "ami-0abcdef1234567890",
        instanceType: "t3.micro",
        keyName: "demo",
        securityGroupIds: ["sg-1"],
      }),
    );
  });

  it("delete action calls deleteLaunchTemplate with the id", async () => {
    vi.mocked(api.listLaunchTemplates).mockResolvedValue([sample]);
    const { user } = renderWithProviders(<LaunchTemplatesPage />);
    await screen.findByText("web");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLElement);

    await waitFor(() => expect(api.deleteLaunchTemplate).toHaveBeenCalledWith("lt-1"));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IamInstanceProfileSummary, IamRoleSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/iam-api", () => ({
  api: {
    listInstanceProfiles: vi.fn(),
    listRoles: vi.fn().mockResolvedValue([]),
    createInstanceProfile: vi.fn().mockResolvedValue(undefined),
    deleteInstanceProfile: vi.fn().mockResolvedValue(undefined),
    addRoleToInstanceProfile: vi.fn().mockResolvedValue(undefined),
    removeRoleFromInstanceProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/iam-api";
import { InstanceProfilesPage } from "./iam-instance-profiles";

const role: IamRoleSummary = {
  roleName: "app-role",
  arn: "arn:aws:iam::000000000000:role/app-role",
  path: "/",
  createDate: null,
  description: null,
  assumeRolePolicyDocument: null,
};

const profile: IamInstanceProfileSummary = {
  instanceProfileName: "web-profile",
  arn: "arn:aws:iam::000000000000:instance-profile/web-profile",
  path: "/",
  createDate: null,
  roleNames: ["app-role"],
};

describe("InstanceProfilesPage list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row + attached role name", async () => {
    vi.mocked(api.listInstanceProfiles).mockResolvedValue([profile]);
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    renderWithProviders(<InstanceProfilesPage />);
    expect(await screen.findByText("web-profile")).toBeInTheDocument();
    expect(screen.getByText("app-role")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listInstanceProfiles).mockResolvedValue([]);
    renderWithProviders(<InstanceProfilesPage />);
    expect(await screen.findByText("No instance profiles")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listInstanceProfiles).mockRejectedValue({
      name: "InternalFailure",
      message: "ListInstanceProfiles is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<InstanceProfilesPage />);
    await waitFor(() =>
      expect(
        screen.getByText("This backend does not support IAM instance profiles."),
      ).toBeInTheDocument(),
    );
  });

  it("create modal sends the name (+ optional role) to createInstanceProfile and attaches the role", async () => {
    vi.mocked(api.listInstanceProfiles).mockResolvedValue([]);
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    const { user } = renderWithProviders(<InstanceProfilesPage />);
    await screen.findByText("No instance profiles");

    await user.click(screen.getByRole("button", { name: /Create instance profile/ }));
    await user.type(screen.getByLabelText("Name"), "api-profile");
    await user.selectOptions(screen.getByLabelText("Role (optional)"), "app-role");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createInstanceProfile).toHaveBeenCalledWith({
        instanceProfileName: "api-profile",
        path: undefined,
      }),
    );
    await waitFor(() =>
      expect(api.addRoleToInstanceProfile).toHaveBeenCalledWith("api-profile", "app-role"),
    );
  });

  it("delete flow calls deleteInstanceProfile with the name", async () => {
    vi.mocked(api.listInstanceProfiles).mockResolvedValue([profile]);
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    const { user } = renderWithProviders(<InstanceProfilesPage />);
    await screen.findByText("web-profile");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteInstanceProfile).toHaveBeenCalledWith("web-profile"));
  });

  it("detach role calls removeRoleFromInstanceProfile", async () => {
    vi.mocked(api.listInstanceProfiles).mockResolvedValue([profile]);
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    const { user } = renderWithProviders(<InstanceProfilesPage />);
    await screen.findByText("web-profile");

    await user.click(screen.getByRole("button", { name: "Detach role" }));
    await waitFor(() =>
      expect(api.removeRoleFromInstanceProfile).toHaveBeenCalledWith("web-profile", "app-role"),
    );
  });
});

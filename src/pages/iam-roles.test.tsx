import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IamRoleSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/iam-api", () => ({
  api: {
    listRoles: vi.fn(),
    createRole: vi.fn().mockResolvedValue(undefined),
    deleteRole: vi.fn().mockResolvedValue(undefined),
    listAttachedRolePolicies: vi.fn().mockResolvedValue([]),
    attachRolePolicy: vi.fn().mockResolvedValue(undefined),
    detachRolePolicy: vi.fn().mockResolvedValue(undefined),
    listRolePolicies: vi.fn().mockResolvedValue([]),
    getRolePolicy: vi.fn().mockResolvedValue({ policyName: "", document: "{}" }),
    putRolePolicy: vi.fn().mockResolvedValue(undefined),
    deleteRolePolicy: vi.fn().mockResolvedValue(undefined),
    updateAssumeRolePolicy: vi.fn().mockResolvedValue(undefined),
    listPolicies: vi.fn().mockResolvedValue([]),
  },
}));

import { api } from "@/lib/iam-api";
import { IamRoleDetailPage, IamRolesPage } from "./iam-roles";

const role: IamRoleSummary = {
  roleName: "app-role",
  arn: "arn:aws:iam::000000000000:role/app-role",
  path: "/",
  createDate: "2024-01-01T00:00:00.000Z",
  description: "app role",
  assumeRolePolicyDocument: '{"Version":"2012-10-17","Statement":[]}',
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/iam/roles/:roleName" element={<IamRoleDetailPage />} />
    </Routes>,
    { route: "/iam/roles/app-role" },
  );
}

describe("IamRolesPage list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    renderWithProviders(<IamRolesPage />);
    expect(await screen.findByText("app-role")).toBeInTheDocument();
    expect(screen.getByText("arn:aws:iam::000000000000:role/app-role")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listRoles).mockResolvedValue([]);
    renderWithProviders(<IamRolesPage />);
    expect(await screen.findByText("No roles")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listRoles).mockRejectedValue({
      name: "InternalFailure",
      message: "ListRoles is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<IamRolesPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support IAM roles.")).toBeInTheDocument(),
    );
  });

  it("create modal sends name/path/trust-policy to createRole", async () => {
    vi.mocked(api.listRoles).mockResolvedValue([]);
    const { user } = renderWithProviders(<IamRolesPage />);
    await screen.findByText("No roles");

    await user.click(screen.getByRole("button", { name: /Create role/ }));
    await user.type(screen.getByLabelText("Name"), "api-role");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createRole).mock.calls[0]?.[0];
    expect(arg?.roleName).toBe("api-role");
    expect(arg?.path).toBeUndefined();
    // The trust policy is the prefilled EC2 assume-role document.
    expect(arg?.assumeRolePolicyDocument).toContain("ec2.amazonaws.com");
  });

  it("delete flow calls deleteRole with the role name", async () => {
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    const { user } = renderWithProviders(<IamRolesPage />);
    await screen.findByText("app-role");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    // Confirm in the modal.
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteRole).toHaveBeenCalledWith("app-role"));
  });
});

describe("IamRoleDetailPage permissions view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listRoles).mockResolvedValue([role]);
    vi.mocked(api.listAttachedRolePolicies).mockResolvedValue([]);
    vi.mocked(api.listRolePolicies).mockResolvedValue([]);
    vi.mocked(api.listPolicies).mockResolvedValue([]);
  });

  it("renders trust, attached, and inline sections from the mocked api", async () => {
    vi.mocked(api.listAttachedRolePolicies).mockResolvedValue([
      {
        policyName: "AmazonS3ReadOnlyAccess",
        policyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",
      },
    ]);
    vi.mocked(api.listRolePolicies).mockResolvedValue(["inline-a"]);
    vi.mocked(api.getRolePolicy).mockResolvedValue({
      policyName: "inline-a",
      document: '{"Version":"2012-10-17","Statement":[]}',
    });

    renderDetail();

    expect(await screen.findByText("Trust relationship")).toBeInTheDocument();
    expect(await screen.findByText("AmazonS3ReadOnlyAccess")).toBeInTheDocument();
    expect(await screen.findByText("inline-a")).toBeInTheDocument();
  });

  it("attach by ARN calls attachRolePolicy with the role + arn", async () => {
    const { user } = renderDetail();
    await screen.findByText("Trust relationship");

    await user.type(
      screen.getByPlaceholderText("…or paste a policy ARN"),
      "arn:aws:iam::aws:policy/AmazonS3FullAccess",
    );
    await user.click(screen.getByRole("button", { name: /Attach policy/ }));

    await waitFor(() =>
      expect(api.attachRolePolicy).toHaveBeenCalledWith(
        "app-role",
        "arn:aws:iam::aws:policy/AmazonS3FullAccess",
      ),
    );
  });

  it("add inline policy calls putRolePolicy with name + document", async () => {
    const { user } = renderDetail();
    await screen.findByText("Trust relationship");

    await user.click(screen.getByRole("button", { name: /Add inline policy/ }));
    await user.type(screen.getByLabelText("Policy name"), "logs-write");
    // The modal's Save button.
    const saveButtons = await screen.findAllByRole("button", { name: "Save" });
    await user.click(saveButtons[saveButtons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.putRolePolicy).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.putRolePolicy).mock.calls[0];
    expect(call?.[0]).toBe("app-role");
    expect(call?.[1]).toBe("logs-write");
    expect(call?.[2]).toContain("2012-10-17");
  });

  it("saving the trust policy calls updateAssumeRolePolicy", async () => {
    const { user } = renderDetail();
    await screen.findByText("Trust relationship");

    await user.click(screen.getByRole("button", { name: "Save trust policy" }));

    await waitFor(() => expect(api.updateAssumeRolePolicy).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.updateAssumeRolePolicy).mock.calls[0]?.[0]).toBe("app-role");
  });
});

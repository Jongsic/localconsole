import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IamPolicySummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/iam-api", () => ({
  api: {
    listPolicies: vi.fn(),
    createPolicy: vi.fn().mockResolvedValue(undefined),
    deletePolicy: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/iam-api";
import { IamPoliciesPage } from "./iam-policies";

const policy: IamPolicySummary = {
  policyName: "my-policy",
  arn: "arn:aws:iam::000000000000:policy/my-policy",
  path: "/",
  attachmentCount: 1,
  isAwsManaged: false,
  createDate: "2024-03-03T00:00:00.000Z",
};

describe("IamPoliciesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listPolicies).mockResolvedValue([policy]);
    renderWithProviders(<IamPoliciesPage />);
    expect(await screen.findByText("my-policy")).toBeInTheDocument();
    expect(screen.getByText("Customer managed")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listPolicies).mockResolvedValue([]);
    renderWithProviders(<IamPoliciesPage />);
    expect(await screen.findByText("No policies")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listPolicies).mockRejectedValue({
      name: "InternalFailure",
      message: "ListPolicies is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<IamPoliciesPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support IAM policies.")).toBeInTheDocument(),
    );
  });

  it("create modal sends name + document to createPolicy", async () => {
    vi.mocked(api.listPolicies).mockResolvedValue([]);
    const { user } = renderWithProviders(<IamPoliciesPage />);
    await screen.findByText("No policies");

    await user.click(screen.getByRole("button", { name: /Create policy/ }));
    await user.type(screen.getByLabelText("Name"), "s3-read");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createPolicy).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createPolicy).mock.calls[0]?.[0];
    expect(arg?.policyName).toBe("s3-read");
    expect(arg?.path).toBeUndefined();
    expect(arg?.document).toContain("2012-10-17");
  });

  it("delete flow calls deletePolicy with the policy ARN", async () => {
    vi.mocked(api.listPolicies).mockResolvedValue([policy]);
    const { user } = renderWithProviders(<IamPoliciesPage />);
    await screen.findByText("my-policy");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deletePolicy).toHaveBeenCalledWith(policy.arn));
  });
});

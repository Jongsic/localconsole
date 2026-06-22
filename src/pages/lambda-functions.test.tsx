import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LambdaFunctionDetail, LambdaFunctionSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/lambda-api", () => ({
  api: {
    listFunctions: vi.fn(),
    getFunction: vi.fn(),
    createFunction: vi.fn().mockResolvedValue(undefined),
    updateFunctionConfiguration: vi.fn().mockResolvedValue(undefined),
    updateFunctionEnvironment: vi.fn().mockResolvedValue(undefined),
    deleteFunction: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/iam-api", () => ({
  api: {
    listRoles: vi.fn().mockResolvedValue([
      {
        roleName: "fn-role",
        arn: "arn:aws:iam::000000000000:role/fn-role",
        path: "/",
        createDate: null,
        description: null,
        assumeRolePolicyDocument: null,
      },
    ]),
  },
}));

import { api } from "@/lib/lambda-api";
import { LambdaFunctionDetailPage, LambdaFunctionsPage } from "./lambda-functions";

const fn: LambdaFunctionSummary = {
  functionName: "fn-1",
  runtime: "nodejs20.x",
  handler: "index.handler",
  memorySize: 256,
  timeout: 30,
  codeSize: 1024,
  lastModified: "2024-01-01T00:00:00.000Z",
  architectures: ["x86_64"],
  packageType: "Zip",
};

const detail: LambdaFunctionDetail = {
  ...fn,
  role: "arn:aws:iam::000000000000:role/fn-role",
  description: "my function",
  state: "Active",
  lastUpdateStatus: "Successful",
  environment: { FOO: "bar" },
  codeLocation: "https://example.com/code.zip",
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/function/functions/:functionName" element={<LambdaFunctionDetailPage />} />
    </Routes>,
    { route: "/function/functions/fn-1" },
  );
}

describe("LambdaFunctionsPage list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listFunctions).mockResolvedValue([fn]);
    renderWithProviders(<LambdaFunctionsPage />);
    expect(await screen.findByText("fn-1")).toBeInTheDocument();
    expect(screen.getByText("nodejs20.x")).toBeInTheDocument();
    expect(screen.getByText("256 MB")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listFunctions).mockResolvedValue([]);
    renderWithProviders(<LambdaFunctionsPage />);
    expect(await screen.findByText("No functions")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listFunctions).mockRejectedValue({
      name: "InternalFailure",
      message: "ListFunctions is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<LambdaFunctionsPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support Lambda.")).toBeInTheDocument(),
    );
  });

  it("create flow (inline code) calls createFunction with expected fields", async () => {
    vi.mocked(api.listFunctions).mockResolvedValue([]);
    const { user } = renderWithProviders(<LambdaFunctionsPage />);
    await screen.findByText("No functions");

    await user.click(screen.getByRole("button", { name: "Create function" }));

    // Role select is populated from the mocked iam-api.listRoles.
    await screen.findByRole("option", { name: "fn-role" });

    const name = screen.getByPlaceholderText("my-function");
    await user.type(name, "my-fn");

    const roleSelect = screen.getByDisplayValue("Select a role…");
    await user.selectOptions(roleSelect, "arn:aws:iam::000000000000:role/fn-role");

    // Submit (the modal's Create button).
    const createButtons = screen.getAllByRole("button", { name: "Create" });
    await user.click(createButtons[createButtons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.createFunction).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createFunction).mock.calls[0]?.[0];
    expect(arg?.functionName).toBe("my-fn");
    expect(arg?.runtime).toBe("nodejs20.x");
    expect(arg?.handler).toBe("index.handler");
    expect(arg?.role).toBe("arn:aws:iam::000000000000:role/fn-role");
    expect(arg?.code).toBeInstanceOf(Uint8Array);
    expect((arg?.code.length ?? 0) > 0).toBe(true);
  });

  it("delete flow calls deleteFunction with the name", async () => {
    vi.mocked(api.listFunctions).mockResolvedValue([fn]);
    const { user } = renderWithProviders(<LambdaFunctionsPage />);
    await screen.findByText("fn-1");

    await user.click(screen.getByTitle("Delete"));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteFunction).toHaveBeenCalledWith("fn-1"));
  });
});

describe("LambdaFunctionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFunction).mockResolvedValue(detail);
  });

  it("renders config + environment from the mocked api", async () => {
    renderDetail();
    expect(await screen.findByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Environment variables")).toBeInTheDocument();
    expect(screen.getByDisplayValue("FOO")).toBeInTheDocument();
  });

  it("saving config sends the payload to updateFunctionConfiguration", async () => {
    const { user } = renderDetail();
    await screen.findByText("Configuration");

    await user.click(screen.getByRole("button", { name: "Save configuration" }));

    await waitFor(() => expect(api.updateFunctionConfiguration).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.updateFunctionConfiguration).mock.calls[0]?.[0];
    expect(arg?.functionName).toBe("fn-1");
    expect(arg?.memorySize).toBe(256);
    expect(arg?.timeout).toBe(30);
    expect(arg?.handler).toBe("index.handler");
    expect(arg?.description).toBe("my function");
  });

  it("saving env vars sends the record to updateFunctionEnvironment", async () => {
    const { user } = renderDetail();
    await screen.findByText("Environment variables");

    // The env editor's Apply button.
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(api.updateFunctionEnvironment).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.updateFunctionEnvironment).mock.calls[0];
    expect(call?.[0]).toBe("fn-1");
    expect(call?.[1]).toEqual({ FOO: "bar" });
  });
});

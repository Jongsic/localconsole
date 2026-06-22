import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LambdaLayerSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/lambda-api", () => ({
  api: {
    listLayers: vi.fn(),
    deleteLayerVersion: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/lambda-api";
import { LambdaLayersPage } from "./lambda-layers";

const layer: LambdaLayerSummary = {
  layerName: "layer-1",
  latestVersion: 3,
  latestVersionArn: "arn:aws:lambda:us-east-1:000000000000:layer:layer-1:3",
  compatibleRuntimes: ["nodejs20.x"],
  createdDate: "2024-01-01T00:00:00.000Z",
};

describe("LambdaLayersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listLayers).mockResolvedValue([layer]);
    renderWithProviders(<LambdaLayersPage />);
    expect(await screen.findByText("layer-1")).toBeInTheDocument();
    expect(screen.getByText("nodejs20.x")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listLayers).mockResolvedValue([]);
    renderWithProviders(<LambdaLayersPage />);
    expect(await screen.findByText("No layers")).toBeInTheDocument();
  });

  it("delete flow calls deleteLayerVersion with name + version", async () => {
    vi.mocked(api.listLayers).mockResolvedValue([layer]);
    const { user } = renderWithProviders(<LambdaLayersPage />);
    await screen.findByText("layer-1");

    await user.click(screen.getByTitle("Delete"));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteLayerVersion).toHaveBeenCalledWith("layer-1", 3));
  });
});

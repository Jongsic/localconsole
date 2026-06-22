import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2VolumeSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    listVolumes: vi.fn(),
    createVolume: vi.fn().mockResolvedValue(undefined),
    deleteVolume: vi.fn().mockResolvedValue(undefined),
    attachVolume: vi.fn().mockResolvedValue(undefined),
    detachVolume: vi.fn().mockResolvedValue(undefined),
    listInstances: vi.fn().mockResolvedValue([{ instanceId: "i-1", name: "web" }]),
  },
}));

import { api } from "@/lib/ec2-api";
import { VolumesPage } from "./volumes";

const sampleVolume: Ec2VolumeSummary = {
  volumeId: "vol-0abc",
  size: 8,
  volumeType: "gp3",
  iops: 3000,
  throughput: 125,
  state: "available",
  encrypted: true,
  availabilityZone: "us-east-1a",
  createTime: "2024-01-01T00:00:00.000Z",
  attachments: [],
};

describe("VolumesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([sampleVolume]);
    renderWithProviders(<VolumesPage />);

    expect(await screen.findByText("vol-0abc")).toBeInTheDocument();
    expect(screen.getByText("gp3")).toBeInTheDocument();
  });

  it("renders the empty state when the api resolves []", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([]);
    renderWithProviders(<VolumesPage />);

    expect(await screen.findByText("No volumes")).toBeInTheDocument();
  });

  it("renders the calm 'not supported' state on a not-implemented error", async () => {
    // A backend that doesn't emulate EBS — our code must show the unsupported
    // copy via the real classifyAwsError/ResourceError, not crash.
    vi.mocked(api.listVolumes).mockRejectedValue({
      name: "InternalFailure",
      message: "API for service 'ec2' action 'DescribeVolumes' is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<VolumesPage />);

    await waitFor(() =>
      expect(screen.getByText("This backend does not support EBS.")).toBeInTheDocument(),
    );
  });

  it("create modal sends az/size/type/encrypted to createVolume", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([]);
    const { user } = renderWithProviders(<VolumesPage />);
    await screen.findByText("No volumes");

    await user.click(screen.getByRole("button", { name: /Create volume/ }));
    await user.type(screen.getByLabelText("Availability zone"), "us-east-1a");
    await user.click(screen.getByLabelText("Encrypted"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createVolume).toHaveBeenCalledWith({
        availabilityZone: "us-east-1a",
        size: 8,
        volumeType: "gp3",
        encrypted: true,
      }),
    );
  });

  it("attach action picks an instance + device and calls attachVolume", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([sampleVolume]);
    const { user } = renderWithProviders(<VolumesPage />);
    await screen.findByText("vol-0abc");

    await user.click(screen.getByRole("button", { name: "Attach" }));
    await user.selectOptions(await screen.findByLabelText("Instance"), "i-1");
    // Submit button inside the modal shares the "Attach" label.
    await user.click(screen.getAllByRole("button", { name: "Attach" }).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(api.attachVolume).toHaveBeenCalledWith("vol-0abc", "i-1", "/dev/sdf"),
    );
  });

  it("detach action calls detachVolume for an in-use volume", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([
      {
        ...sampleVolume,
        volumeId: "vol-inuse",
        state: "in-use",
        attachments: [{ instanceId: "i-1", device: "/dev/sdf", state: "attached" }],
      },
    ]);
    const { user } = renderWithProviders(<VolumesPage />);
    await screen.findByText("vol-inuse");

    await user.click(screen.getByRole("button", { name: "Detach" }));
    await waitFor(() => expect(api.detachVolume).toHaveBeenCalledWith("vol-inuse"));
  });
});

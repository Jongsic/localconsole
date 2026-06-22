import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClusterSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/rds-api", () => ({
  api: {
    listDbClusters: vi.fn(),
    createDbCluster: vi.fn().mockResolvedValue(undefined),
    deleteDbCluster: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([{ key: "env", value: "prod" }]),
    saveTags: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/rds-api";
import { RdsClustersPage } from "./rds-clusters";

const cluster: DbClusterSummary = {
  dbClusterIdentifier: "db-cluster-1",
  engine: "aurora-postgresql",
  engineVersion: "15.4",
  status: "available",
  endpoint: "db-cluster-1.cluster.example.com",
  readerEndpoint: "db-cluster-1.cluster-ro.example.com",
  port: 5432,
  multiAZ: true,
  arn: "arn:aws:rds:us-east-1:000000000000:cluster:db-cluster-1",
  availabilityZones: ["us-east-1a", "us-east-1b"],
  storageEncrypted: true,
  parameterGroup: "default.aurora-postgresql15",
  backupRetentionPeriod: 7,
  preferredBackupWindow: "03:00-04:00",
  preferredMaintenanceWindow: "sun:05:00-sun:06:00",
  createdTime: "2026-01-01T00:00:00.000Z",
  members: [
    { dbInstanceIdentifier: "db-cluster-1-writer", isWriter: true },
    { dbInstanceIdentifier: "db-cluster-1-reader", isWriter: false },
  ],
};

describe("RdsClustersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listDbClusters).mockResolvedValue([cluster]);
    renderWithProviders(<RdsClustersPage />);
    expect(await screen.findByText("db-cluster-1")).toBeInTheDocument();
    expect(screen.getByText("aurora-postgresql")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listDbClusters).mockResolvedValue([]);
    renderWithProviders(<RdsClustersPage />);
    expect(await screen.findByText("No DB clusters")).toBeInTheDocument();
  });

  it("create modal sends the payload to createDbCluster", async () => {
    vi.mocked(api.listDbClusters).mockResolvedValue([]);
    const { user } = renderWithProviders(<RdsClustersPage />);
    await screen.findByText("No DB clusters");

    await user.click(screen.getByRole("button", { name: /Create DB cluster/ }));
    await user.type(screen.getByLabelText("Identifier"), "mycluster");
    await user.selectOptions(screen.getByLabelText("Engine"), "aurora-mysql");
    await user.type(screen.getByLabelText("Master password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createDbCluster).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createDbCluster).mock.calls[0]?.[0];
    expect(arg?.dbClusterIdentifier).toBe("mycluster");
    expect(arg?.engine).toBe("aurora-mysql");
    expect(arg?.masterUsername).toBe("admin");
    expect(arg?.masterUserPassword).toBe("secret123");
  });

  it("selecting a row opens the detail panel with attributes, members and tags", async () => {
    vi.mocked(api.listDbClusters).mockResolvedValue([cluster]);
    const { user } = renderWithProviders(<RdsClustersPage />);
    await user.click(await screen.findByText("db-cluster-1"));

    expect(await screen.findByText("default.aurora-postgresql15")).toBeInTheDocument();
    expect(screen.getByText("db-cluster-1.cluster-ro.example.com")).toBeInTheDocument();
    expect(screen.getByText("db-cluster-1-writer")).toBeInTheDocument();
    expect(
      screen.getByText("arn:aws:rds:us-east-1:000000000000:cluster:db-cluster-1"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(api.getTags).toHaveBeenCalledWith(
        "arn:aws:rds:us-east-1:000000000000:cluster:db-cluster-1",
      ),
    );
    expect(await screen.findByDisplayValue("env")).toBeInTheDocument();
  });

  it("delete confirm calls deleteDbCluster with the id", async () => {
    vi.mocked(api.listDbClusters).mockResolvedValue([cluster]);
    const { user } = renderWithProviders(<RdsClustersPage />);
    await screen.findByText("db-cluster-1");

    await user.click(screen.getByTitle("Delete"));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteDbCluster).toHaveBeenCalledWith("db-cluster-1"));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbInstanceSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/rds-api", () => ({
  api: {
    listDbInstances: vi.fn(),
    createDbInstance: vi.fn().mockResolvedValue(undefined),
    deleteDbInstance: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([{ key: "env", value: "prod" }]),
    saveTags: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/rds-api";
import { RdsInstancesPage } from "./rds-instances";

const instance: DbInstanceSummary = {
  dbInstanceIdentifier: "db-1",
  engine: "postgres",
  engineVersion: "15.4",
  dbInstanceClass: "db.t3.micro",
  status: "available",
  endpoint: "db-1.example.com",
  port: 5432,
  allocatedStorage: 20,
  storageType: "gp3",
  storageEncrypted: true,
  multiAZ: false,
  availabilityZone: "us-east-1a",
  publiclyAccessible: false,
  parameterGroup: "default.postgres15",
  backupRetentionPeriod: 7,
  preferredBackupWindow: "03:00-04:00",
  preferredMaintenanceWindow: "sun:05:00-sun:06:00",
  createdTime: "2026-01-01T00:00:00.000Z",
  arn: "arn:aws:rds:us-east-1:000000000000:db:db-1",
};

describe("RdsInstancesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listDbInstances).mockResolvedValue([instance]);
    renderWithProviders(<RdsInstancesPage />);
    expect(await screen.findByText("db-1")).toBeInTheDocument();
    expect(screen.getByText("db-1.example.com")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listDbInstances).mockResolvedValue([]);
    renderWithProviders(<RdsInstancesPage />);
    expect(await screen.findByText("No DB instances")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listDbInstances).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeDBInstances is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<RdsInstancesPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support RDS.")).toBeInTheDocument(),
    );
  });

  it("create modal sends the payload to createDbInstance", async () => {
    vi.mocked(api.listDbInstances).mockResolvedValue([]);
    const { user } = renderWithProviders(<RdsInstancesPage />);
    await screen.findByText("No DB instances");

    await user.click(screen.getByRole("button", { name: /Create DB instance/ }));
    await user.type(screen.getByLabelText("Identifier"), "mydb");
    await user.type(screen.getByLabelText("Master password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createDbInstance).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createDbInstance).mock.calls[0]?.[0];
    expect(arg?.dbInstanceIdentifier).toBe("mydb");
    expect(arg?.engine).toBe("postgres");
    expect(arg?.dbInstanceClass).toBe("db.t3.micro");
    expect(arg?.allocatedStorage).toBe(20);
    expect(arg?.masterUsername).toBe("admin");
    expect(arg?.masterUserPassword).toBe("secret123");
  });

  it("selecting a row opens the detail panel with attributes and tags", async () => {
    vi.mocked(api.listDbInstances).mockResolvedValue([instance]);
    const { user } = renderWithProviders(<RdsInstancesPage />);
    await user.click(await screen.findByText("db-1"));

    expect(await screen.findByText("default.postgres15")).toBeInTheDocument();
    expect(screen.getByText("sun:05:00-sun:06:00")).toBeInTheDocument();
    expect(screen.getByText("arn:aws:rds:us-east-1:000000000000:db:db-1")).toBeInTheDocument();

    await waitFor(() =>
      expect(api.getTags).toHaveBeenCalledWith("arn:aws:rds:us-east-1:000000000000:db:db-1"),
    );
    expect(await screen.findByDisplayValue("env")).toBeInTheDocument();
  });

  it("delete confirm calls deleteDbInstance with the id", async () => {
    vi.mocked(api.listDbInstances).mockResolvedValue([instance]);
    const { user } = renderWithProviders(<RdsInstancesPage />);
    await screen.findByText("db-1");

    await user.click(screen.getByTitle("Delete"));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteDbInstance).toHaveBeenCalledWith("db-1"));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheClusterSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/elasticache-api", () => ({
  api: {
    listCacheClusters: vi.fn(),
    createCacheCluster: vi.fn().mockResolvedValue(undefined),
    deleteCacheCluster: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([{ key: "env", value: "prod" }]),
    saveTags: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/elasticache-api";
import { CacheClustersPage } from "./cache-clusters";

const cluster: CacheClusterSummary = {
  cacheClusterId: "cache-1",
  engine: "redis",
  engineVersion: "7.1",
  status: "available",
  nodeType: "cache.t3.micro",
  numCacheNodes: 1,
  endpoint: "cache-1.example.com",
  port: 6379,
  arn: "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
  parameterGroup: "default.redis7",
  subnetGroup: "default",
  securityGroups: ["sg-123"],
  preferredMaintenanceWindow: "sun:05:00-sun:06:00",
  snapshotRetentionLimit: 3,
  snapshotWindow: "03:00-04:00",
  availabilityZone: "us-east-1a",
  createdTime: "2026-01-01T00:00:00.000Z",
};

describe("CacheClustersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([cluster]);
    renderWithProviders(<CacheClustersPage />);
    expect(await screen.findByText("cache-1")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
    expect(screen.getByText("cache-1.example.com")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([]);
    renderWithProviders(<CacheClustersPage />);
    expect(await screen.findByText("No cache clusters")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listCacheClusters).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeCacheClusters is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<CacheClustersPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support ElastiCache.")).toBeInTheDocument(),
    );
  });

  it("create modal sends the payload to createCacheCluster", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([]);
    const { user } = renderWithProviders(<CacheClustersPage />);
    await screen.findByText("No cache clusters");

    await user.click(screen.getByRole("button", { name: /Create cache cluster/ }));
    await user.type(screen.getByLabelText("Cluster ID"), "mycache");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createCacheCluster).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createCacheCluster).mock.calls[0]?.[0];
    expect(arg?.cacheClusterId).toBe("mycache");
    expect(arg?.engine).toBe("redis");
    expect(arg?.cacheNodeType).toBe("cache.t3.micro");
    expect(arg?.numCacheNodes).toBe(1);
  });

  it("create modal passes the chosen engine (valkey) to the api", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([]);
    const { user } = renderWithProviders(<CacheClustersPage />);
    await screen.findByText("No cache clusters");

    await user.click(screen.getByRole("button", { name: /Create cache cluster/ }));
    await user.type(screen.getByLabelText("Cluster ID"), "vk");
    await user.selectOptions(screen.getByLabelText("Engine"), "valkey");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createCacheCluster).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(api.createCacheCluster).mock.calls[0]?.[0];
    expect(arg?.cacheClusterId).toBe("vk");
    expect(arg?.engine).toBe("valkey");
  });

  it("selecting a row opens the detail panel with attributes and tags", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([cluster]);
    const { user } = renderWithProviders(<CacheClustersPage />);
    await user.click(await screen.findByText("cache-1"));

    expect(await screen.findByText("default.redis7")).toBeInTheDocument();
    expect(screen.getByText("sg-123")).toBeInTheDocument();
    expect(
      screen.getByText("arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(api.getTags).toHaveBeenCalledWith(
        "arn:aws:elasticache:us-east-1:000000000000:cluster:cache-1",
      ),
    );
    expect(await screen.findByDisplayValue("env")).toBeInTheDocument();
  });

  it("delete confirm calls deleteCacheCluster with the id", async () => {
    vi.mocked(api.listCacheClusters).mockResolvedValue([cluster]);
    const { user } = renderWithProviders(<CacheClustersPage />);
    await screen.findByText("cache-1");

    await user.click(screen.getByTitle("Delete"));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(api.deleteCacheCluster).toHaveBeenCalledWith("cache-1"));
  });
});

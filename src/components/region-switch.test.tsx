import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { useSettings } from "@/store/settings";
import { renderWithProviders, screen } from "@/test/render";
import { RegionSwitch } from "./region-switch";

describe("RegionSwitch", () => {
  beforeEach(() => {
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, region: "us-east-1" } });
  });

  it("shows the current region on the trigger", () => {
    renderWithProviders(<RegionSwitch />);
    expect(screen.getByRole("button", { name: /us-east-1/ })).toBeInTheDocument();
  });

  it("selecting a curated region updates the settings store", async () => {
    const { user } = renderWithProviders(<RegionSwitch />);
    await user.click(screen.getByRole("button", { name: /us-east-1/ }));
    await user.click(screen.getByRole("button", { name: /ap-northeast-2/ }));
    expect(useSettings.getState().settings.region).toBe("ap-northeast-2");
  });

  it("applies an arbitrary region via the custom input", async () => {
    const { user } = renderWithProviders(<RegionSwitch />);
    await user.click(screen.getByRole("button", { name: /us-east-1/ }));
    await user.click(screen.getByRole("button", { name: /custom region/i }));
    const input = screen.getByPlaceholderText(/us-gov-west-1/);
    await user.clear(input);
    await user.type(input, "us-gov-west-1");
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(useSettings.getState().settings.region).toBe("us-gov-west-1");
  });
});

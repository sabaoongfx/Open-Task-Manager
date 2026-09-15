import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Performance", exact: true }).click();
  await expect(page.locator(".perf-tile").first()).toBeVisible();
});

test("shows CPU detail by default", async ({ page }) => {
  await expect(page.locator(".perf-tile.active")).toContainText("CPU");
  await expect(page.locator(".perf-detail-header h2")).toHaveText("CPU");
  await expect(page.locator(".perf-detail-model")).toBeVisible();
});

test("switching tiles updates the detail pane", async ({ page }) => {
  await page.locator(".perf-tile", { hasText: "Memory" }).click();
  await expect(page.locator(".perf-tile.active")).toContainText("Memory");
  await expect(page.locator(".perf-detail-header h2")).toHaveText("Memory");
  await expect(page.getByText("Swap used")).toBeVisible();

  await page.locator(".perf-tile", { hasText: "Network" }).click();
  await expect(page.locator(".perf-detail-header h2")).toHaveText("Network");
  await expect(page.getByText("Interface")).toBeVisible();
});

test("the big chart renders an SVG line for the selected metric", async ({ page }) => {
  await expect(page.locator(".perf-chart path")).toHaveCount(2); // area fill + line
});

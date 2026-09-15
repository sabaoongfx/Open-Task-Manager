import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("shows description and status columns", async ({ page }) => {
  const row = page.locator(".row", { hasText: "AudioEndpointBuilder" });
  await expect(row.locator(".col-desc")).toHaveText("Windows Audio Endpoint Builder");
  await expect(row.locator(".col-status")).toHaveText("Running");
});

test("filters services by name or description", async ({ page }) => {
  await page.getByRole("button", { name: "Search" }).click();
  const search = page.getByPlaceholder("Filter services...");
  await search.fill("audio");
  await expect(page.locator(".row", { hasText: "AudioEndpointBuilder" })).toBeVisible();
  await expect(page.locator(".row", { hasText: "Spooler" })).toHaveCount(0);
});

test("right-click offers Stop for a running service and Start for a stopped one", async ({ page }) => {
  const running = page.locator(".row", { hasText: "Dnscache" });
  await running.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu.getByRole("button", { name: "Stop" })).toBeVisible();
  await menu.getByRole("button", { name: "Stop" }).click();
  await expect(running.locator(".col-status")).toHaveText("Stopped");

  await running.click({ button: "right" });
  await expect(menu.getByRole("button", { name: "Start" })).toBeVisible();
});

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("shows scope, description and status columns", async ({ page }) => {
  const row = page.locator(".row", { hasText: "NetworkManager" });
  await expect(row.locator(".col-scope")).toHaveText("System");
  await expect(row.locator(".col-desc")).toHaveText("Network Manager");
  await expect(row.locator(".col-status")).toHaveText("Running");
});

test("failed system and user units are listed first and counted in the header", async ({ page }) => {
  await expect(page.locator(".failed-count")).toHaveText("2 failed");
  const rows = page.locator(".row");
  await expect(rows.nth(0).locator(".col-name")).toHaveText("backup-home");
  await expect(rows.nth(0).locator(".col-scope")).toHaveText("User");
  await expect(rows.nth(0).locator(".col-status")).toHaveClass(/failed/);
  await expect(rows.nth(1).locator(".col-name")).toHaveText("cups-browsed");
  await expect(rows.nth(1).locator(".col-scope")).toHaveText("System");
});

test("filters services by name, description or scope", async ({ page }) => {
  await page.getByRole("button", { name: "Search" }).click();
  const search = page.getByPlaceholder("Filter services...");
  await search.fill("pipewire");
  await expect(page.locator(".row", { hasText: "pipewire" })).toBeVisible();
  await expect(page.locator(".row", { hasText: "docker" })).toHaveCount(0);
  await search.fill("user");
  await expect(page.locator(".row", { hasText: "syncthing" })).toBeVisible();
  await expect(page.locator(".row", { hasText: "NetworkManager" })).toHaveCount(0);
});

test("right-click offers Stop for a running service and Start for a stopped one", async ({ page }) => {
  const running = page.locator(".row", { hasText: "NetworkManager" });
  await running.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu.getByRole("button", { name: "Stop" })).toBeVisible();
  await menu.getByRole("button", { name: "Stop" }).click();
  await expect(running.locator(".col-status")).toHaveText("Stopped");

  await running.click({ button: "right" });
  await expect(menu.getByRole("button", { name: "Start" })).toBeVisible();
});

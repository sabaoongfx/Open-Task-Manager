import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("groups processes by owning user", async ({ page }) => {
  await expect(page.locator(".row", { hasText: "sabaoongfx" })).toBeVisible();
  await expect(page.locator(".row", { hasText: "SYSTEM" })).toBeVisible();
});

test("expanding a user shows their individual processes", async ({ page }) => {
  const userRow = page.locator(".row", { hasText: "sabaoongfx" }).first();
  await expect(page.locator(".sub-row")).toHaveCount(0);
  await userRow.click();
  const subRowCount = await page.locator(".sub-row").count();
  expect(subRowCount).toBeGreaterThan(0);
});

test("selecting a user enables Disconnect", async ({ page }) => {
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  await expect(disconnect).toBeDisabled();
  await page.locator(".row", { hasText: "SYSTEM" }).first().click();
  await expect(disconnect).toBeEnabled();
});

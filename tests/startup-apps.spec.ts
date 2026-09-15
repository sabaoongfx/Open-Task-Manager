import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Startup apps", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("shows publisher and startup impact columns", async ({ page }) => {
  const row = page.locator(".row", { hasText: "Google Chrome" });
  await expect(row.locator(".col-publisher")).toHaveText("Google LLC");
  await expect(row.locator(".col-impact")).toHaveText("High");
});

test("disabled apps render dimmed", async ({ page }) => {
  const disabledRow = page.locator(".row", { hasText: "Steam" });
  await expect(disabledRow).toHaveClass(/dim/);
});

test("selecting a row and disabling it updates its status", async ({ page }) => {
  const chromeRow = page.locator(".row", { hasText: "Google Chrome" });
  await chromeRow.click();
  const disableBtn = page.getByRole("button", { name: "Disable" });
  await expect(disableBtn).toBeEnabled();
  await disableBtn.click();
  await expect(chromeRow.locator(".col-status")).toHaveText("Disabled");
  await expect(chromeRow).toHaveClass(/dim/);
});

test("enabling a disabled row flips it back", async ({ page }) => {
  const steamRow = page.locator(".row", { hasText: "Steam" });
  await steamRow.click();
  const enableBtn = page.getByRole("button", { name: "Enable" });
  await expect(enableBtn).toBeEnabled();
  await enableBtn.click();
  await expect(steamRow.locator(".col-status")).toHaveText("Enabled");
  await expect(steamRow).not.toHaveClass(/dim/);
});

test("right-click offers Disable for an enabled app and Enable for a disabled one", async ({ page }) => {
  const chromeRow = page.locator(".row", { hasText: "Google Chrome" });
  await chromeRow.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu.getByRole("button", { name: "Disable" })).toBeVisible();
  await menu.getByRole("button", { name: "Disable" }).click();
  await expect(chromeRow.locator(".col-status")).toHaveText("Disabled");

  await chromeRow.click({ button: "right" });
  await expect(menu.getByRole("button", { name: "Enable" })).toBeVisible();
  await menu.getByRole("button", { name: "Enable" }).click();
  await expect(chromeRow.locator(".col-status")).toHaveText("Enabled");
});

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("lists every process flat, without grouping", async ({ page }) => {
  const chromeRows = page.locator(".row", { hasText: "Google Chrome" });
  await expect(chromeRows).toHaveCount(5);
  await expect(page.locator(".group-header")).toHaveCount(0);
});

test("shows status and user name columns", async ({ page }) => {
  const row = page.locator(".row", { hasText: "Notepad" }).first();
  await expect(row.locator(".col-status")).toHaveText("Running");
  await expect(row.locator(".col-user")).not.toHaveText("");
});

test("sorting by name toggles direction on repeated clicks", async ({ page }) => {
  const nameHeader = page.locator(".col-name", { hasText: "Name" });
  await nameHeader.click();
  const asc = await page.locator(".row .col-name").first().innerText();
  await nameHeader.click();
  const desc = await page.locator(".row .col-name").first().innerText();
  expect(asc).not.toBe(desc);
});

test("right-clicking a row opens a context menu that ends the task", async ({ page }) => {
  const row = page.locator(".row", { hasText: "Notepad" }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "End task" }).click();
  await expect(page.locator(".row", { hasText: "Notepad" })).toHaveCount(0);
});

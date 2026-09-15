import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "App history", exact: true }).click();
  await expect(page.locator(".row").first()).toBeVisible();
});

test("shows a live-accumulating CPU time per app", async ({ page }) => {
  const row = page.locator(".row", { hasText: "Google Chrome" });
  await expect(row.locator(".col-cputime")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
});

test("deleting usage history zeroes every row", async ({ page }) => {
  await page.getByRole("button", { name: "Delete usage history" }).click();
  const rows = page.locator(".row");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i).locator(".col-cputime")).toHaveText("00:00:00");
  }
});

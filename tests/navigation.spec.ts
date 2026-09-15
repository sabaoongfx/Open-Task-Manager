import { test, expect } from "@playwright/test";

const TABS = [
  "Processes",
  "Performance",
  "App history",
  "Startup apps",
  "Users",
  "Details",
  "Services",
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("loads on the Processes tab by default", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Processes" })).toBeVisible();
  await expect(page.locator(".nav-item.active")).toHaveText(/Processes/);
});

for (const label of TABS) {
  test(`can switch to the ${label} tab`, async ({ page }) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".nav-item.active")).toHaveText(new RegExp(label));
  });
}

test("Settings shows the placeholder", async ({ page }) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".placeholder-pane")).toContainText("Not implemented yet");
});

test("sidebar can be collapsed and expanded", async ({ page }) => {
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).not.toHaveClass(/collapsed/);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(sidebar).toHaveClass(/collapsed/);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(sidebar).not.toHaveClass(/collapsed/);
});

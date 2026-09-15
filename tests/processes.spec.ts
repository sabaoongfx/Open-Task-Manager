import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Let the first poll land before asserting on data-dependent UI.
  await expect(page.locator(".row").first()).toBeVisible();
});

test("groups multi-instance apps and shows an instance count", async ({ page }) => {
  const chromeRow = page.locator(".row", { hasText: "Google Chrome" }).first();
  await expect(chromeRow).toContainText("Google Chrome (5)");
});

test("singleton apps are not grouped and show a PID", async ({ page }) => {
  const notepadRow = page.locator(".row", { hasText: "Notepad" }).first();
  await expect(notepadRow).toContainText("1014");
});

test("clicking a grouped process name expands its instances", async ({ page }) => {
  const chromeRow = page.locator(".row", { hasText: "Google Chrome (5)" }).first();
  await expect(page.locator(".row.sub-row")).toHaveCount(0);

  await chromeRow.click();
  await expect(page.locator(".row.sub-row")).toHaveCount(5);
  await expect(chromeRow).toHaveClass(/selected/);

  await chromeRow.click();
  await expect(page.locator(".row.sub-row")).toHaveCount(0);
});

test("group sections (Apps / Background processes) can be collapsed", async ({ page }) => {
  const appsHeader = page.getByRole("button", { name: /^Apps \(\d+\)/ });
  await expect(page.locator(".row", { hasText: "Notepad" })).toBeVisible();

  await appsHeader.click();
  await expect(page.locator(".row", { hasText: "Notepad" })).toBeHidden();

  await appsHeader.click();
  await expect(page.locator(".row", { hasText: "Notepad" })).toBeVisible();
});

test("filters the process list by name via search", async ({ page }) => {
  await page.getByRole("button", { name: "Search" }).click();
  const search = page.getByPlaceholder("Filter processes...");
  await expect(search).toBeVisible();

  await search.fill("spotify");
  await expect(page.locator(".row", { hasText: "Spotify" })).toBeVisible();
  await expect(page.locator(".row", { hasText: "Notepad" })).toHaveCount(0);

  await search.fill("");
  await expect(page.locator(".row", { hasText: "Notepad" })).toBeVisible();
});

test("clicking a column header re-sorts the list", async ({ page }) => {
  const nameHeader = page.locator(".col-name", { hasText: "Name" });
  await nameHeader.click(); // ascending by name
  const firstNameAsc = await page.locator(".row .col-name").first().innerText();

  await nameHeader.click(); // descending by name
  const firstNameDesc = await page.locator(".row .col-name").first().innerText();

  expect(firstNameAsc).not.toBe(firstNameDesc);
});

test("selecting a single-instance row enables End task", async ({ page }) => {
  const endTask = page.getByRole("button", { name: "End task" });
  await expect(endTask).toBeDisabled();

  await page.locator(".row", { hasText: "Notepad" }).first().click();
  await expect(endTask).toBeEnabled();
});

test("ending a task removes it from the list", async ({ page }) => {
  await page.locator(".row", { hasText: "Notepad" }).first().click();
  await page.getByRole("button", { name: "End task" }).click();
  await expect(page.locator(".row", { hasText: "Notepad" })).toHaveCount(0);
});

test("sub-rows show the process name instead of a redundant PID label", async ({ page }) => {
  await page.locator(".row", { hasText: "Google Chrome (5)" }).first().click();
  const subRowNames = page.locator(".sub-row .col-name");
  await expect(subRowNames).toHaveCount(5);
  await expect(subRowNames.first()).toHaveText("Google Chrome");
});

test("right-clicking a row opens a context menu that can end the task", async ({ page }) => {
  const notepadRow = page.locator(".row", { hasText: "Notepad" }).first();
  await notepadRow.click({ button: "right" });

  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(notepadRow).toHaveClass(/selected/);

  await menu.getByRole("button", { name: "End task" }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".row", { hasText: "Notepad" })).toHaveCount(0);
});

test("context menu closes when clicking elsewhere", async ({ page }) => {
  await page.locator(".row", { hasText: "Notepad" }).first().click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();

  await page.locator(".panel-header h1").click();
  await expect(page.locator(".context-menu")).toBeHidden();
});

test("efficiency mode toggles compact row styling", async ({ page }) => {
  const table = page.locator(".process-table");
  const toggle = page.getByRole("button", { name: "Efficiency mode" });

  await expect(table).not.toHaveClass(/compact/);
  await toggle.click();
  await expect(table).toHaveClass(/compact/);
  await expect(toggle).toHaveClass(/active/);

  await toggle.click();
  await expect(table).not.toHaveClass(/compact/);
});

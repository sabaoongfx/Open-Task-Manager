import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Disk usage", exact: true }).click();
});

// Opening the tab scans the home folder by itself.
async function scanHome(page: import("@playwright/test").Page) {
  await expect(page.locator(".disk-tree .row").first()).toBeVisible();
}

test("scans the home folder as soon as the tab opens", async ({ page }) => {
  await expect(page.locator(".history-meta")).toContainText("Scanning…");
  await expect(page.getByLabel("Location")).toHaveValue("");
  await scanHome(page);
  await expect(page.getByRole("button", { name: "Scan", exact: true })).toBeEnabled();
});

test("switching tabs keeps the last scan instead of rescanning", async ({ page }) => {
  await scanHome(page);
  await page.locator(".disk-tree .row", { hasText: "Videos" }).locator(".chevron").click();
  await page.getByRole("button", { name: "Processes", exact: true }).click();
  await page.getByRole("button", { name: "Disk usage", exact: true }).click();
  await expect(page.locator(".history-meta")).not.toContainText("Scanning");
  await expect(page.locator(".disk-tree .row", { hasText: "Big Buck Bunny.mkv" })).toBeVisible();
});

test("a scan left running shows up after switching back", async ({ page }) => {
  await page.getByRole("button", { name: "Processes", exact: true }).click();
  await page.getByRole("button", { name: "Disk usage", exact: true }).click();
  await scanHome(page);
});

test("scans and lists folders biggest first", async ({ page }) => {
  await scanHome(page);
  const rows = page.locator(".disk-tree .row");
  await expect(rows.nth(0).locator(".col-du-name")).toHaveText("/home/user");
  await expect(rows.nth(1).locator(".col-du-name")).toHaveText("Videos");
  await expect(page.locator(".history-meta")).toContainText("files");
  await expect(page.locator(".history-meta")).toContainText("3 folders couldn't be read");
});

test("expands a folder to show its children", async ({ page }) => {
  await scanHome(page);
  const videos = page.locator(".disk-tree .row", { hasText: "Videos" });
  await videos.locator(".chevron").click();
  await expect(page.locator(".disk-tree .row", { hasText: "Big Buck Bunny.mkv" })).toBeVisible();
  await videos.locator(".chevron").click();
  await expect(page.locator(".disk-tree .row", { hasText: "Big Buck Bunny.mkv" })).toHaveCount(0);
});

test("lists extensions with a color swatch", async ({ page }) => {
  await scanHome(page);
  const first = page.locator(".disk-extensions .row").first();
  await expect(first.locator(".col-ext")).toHaveText(".mp4");
  await expect(first.locator(".ext-swatch")).toBeVisible();
  await first.click();
  await expect(first).toHaveClass(/selected/);
});

test("clicking the treemap selects that file in the tree", async ({ page }) => {
  await scanHome(page);
  const box = (await page.locator(".treemap").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await expect(page.locator(".treemap-tooltip")).toBeVisible();
  await page.mouse.click(box.x + 5, box.y + 5);
  const selected = page.locator(".disk-tree .row.selected");
  await expect(selected).toHaveCount(1);
  await expect(selected).toBeInViewport();
});

test("right-click a folder offers to scan it", async ({ page }) => {
  await scanHome(page);
  await page.locator(".disk-tree .row", { hasText: "Music" }).click({ button: "right" });
  await page.locator(".context-menu").getByRole("button", { name: "Scan this folder" }).click();
  await expect(page.locator(".disk-tree .row").first().locator(".col-du-name")).toHaveText("/home/user/Music");
  await expect(page.getByLabel("Folder to scan")).toHaveValue("/home/user/Music");
});

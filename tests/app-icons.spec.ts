import { test, expect } from "@playwright/test";

// Process names come raw ("gnome-terminal-server") or prettified ("Gnome Terminal Server");
// both spellings must find the same brand icon.
const CASES: [string, string | null][] = [
  ["gnome-terminal-server", "gnometerminal"],
  ["Gnome Terminal Server", "gnometerminal"],
  ["Gnome Shell", "gnome"],
  ["Kwin Wayland", "kde"],
  ["Bash", "gnubash"],
  ["zsh", "zsh"],
  ["postgres", "postgresql"],
  ["Redis Server", "redis"],
  ["notepad++", "notepadplusplus"],
  ["Xfce4 Panel", "xfce"],
  ["Github Desktop", "github"],
  ["Git", "git"],
  ["Google Chrome", "googlechrome"],
  ["Konsole", "kde"],
  ["Kioworker", "kde"],
  ["Gitstatusd", "git"],
  ["Claude", "claude"],
  ["Systemd", null],
  ["Digit", null], // "git" only matches as a whole word
];

test("maps process names to brand icons", async ({ page }) => {
  await page.goto("/");
  const slugs = await page.evaluate(async (names) => {
    const { findBrandIcon } = await import("/src/appIcons.tsx");
    return names.map((name) => findBrandIcon(name)?.slug ?? null);
  }, CASES.map(([name]) => name));
  CASES.forEach(([name, slug], i) => expect(slugs[i], name).toBe(slug));
});

test("shows brand icons in the Processes table", async ({ page }) => {
  await page.goto("/");
  const chrome = page.locator(".row", { hasText: "Google Chrome" }).first();
  await expect(chrome.locator("svg.proc-icon-svg")).toBeVisible();
});

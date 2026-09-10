import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const route = async (page: Page, name: string) => { await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true }).click(); };
const settled = async (page: Page) => { await expect(page.locator(".query-feedback > .fetch-notice")).toHaveCount(0); };
test("seven routes mount independently, direct links and browser history work", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?profile=small#/projects");
  await expect(page.getByRole("tab", { name: "Phases", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Phases", exact: true }).click(); await settled(page);
  await expect(page.locator("tbody tr")).toHaveCount(30);
  await page.locator("tbody tr").first().click(); await settled(page);
  await expect(page.locator(".detail")).toContainText("Prerequisites");
  await expect(page).toHaveURL(/phase=phase-/);
  const selectedURL = page.url(); await page.reload(); await settled(page);
  await expect(page.locator(".detail")).toContainText("Reported progress");
  for (const [name, title] of [["Planning", "Planning"], ["Work queue", "Work queue"], ["Resources", "Resources"], ["Issues & delays", "Issues & delays"], ["Analytics", "Analytics"], ["Overview", "Portfolio overview"]]) {
    await route(page, name!); await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible(); await settled(page);
    await expect(page.locator(".screen")).toHaveCount(1);
  }
  await page.goto(selectedURL); await expect(page.locator(".detail")).toContainText("Reported progress");
  await route(page, "Planning"); await page.goBack(); await expect(page.locator(".detail")).toContainText("Reported progress");
  expect(errors).toEqual([]);
});

test("planning, resources, and semantic work filters change real results", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?profile=small#/planning");
  await page.getByLabel("View", { exact: true }).selectOption("blocked"); await settled(page);
  await expect(page.locator("tbody tr").first()).toContainText("Blocked");
  await page.getByRole("button", { name: "Sort Δ days", exact: true }).click(); await settled(page);
  await page.getByLabel("Projects", { exact: true }).selectOption("project-00000002"); await settled(page);
  await page.getByLabel("Projects", { exact: true }).selectOption("__all"); await settled(page);
  await expect(page.locator("tbody tr").first()).toContainText("Blocked");
  await route(page, "Resources"); await page.getByRole("tab", { name: "Labour", exact: true }).click(); await settled(page);
  await page.getByLabel("Activity reasons", { exact: true }).selectOption("defectResolution"); await settled(page);
  await expect(page.locator("tbody tr").first()).toContainText("Defect Resolution");
  await page.getByRole("tab", { name: "Materials", exact: true }).click(); await settled(page);
  await page.locator("tbody tr").first().click(); await settled(page);
  await expect(page.locator(".detail")).toContainText("Orders and deliveries");
  await route(page, "Work queue"); await page.getByLabel("Work", { exact: true }).fill("not-a-real-phase-xyz"); await settled(page);
  await expect(page.getByText("No records match the current filters.", { exact: true })).toBeVisible();
  await page.getByLabel("Work", { exact: true }).fill(""); await settled(page);
  await page.getByRole("checkbox", { name: /^Blocked prerequisite:/ }).locator("..").click(); await settled(page);
  await expect(page.locator(".queue-record").first()).toContainText("Blocked");
  expect(errors).toEqual([]);
});

test("scenario regeneration resets shared edits and reference selections", async ({ page }) => {
  await page.goto("/?profile=small#/projects"); await expect(page.getByRole("tab", { name: "Summary", exact: true })).toBeVisible();
  await page.getByText("Demo controls", { exact: true }).click();
  await page.getByLabel("Scenario seed", { exact: true }).fill("42");
  await page.getByRole("button", { name: "Regenerate / reset edits", exact: true }).click();
  await expect(page.locator(".command-notice")).toContainText("Scenario regenerated");
  await expect(page.locator(".demo-context")).toContainText("Seed 42");
  await settled(page); await expect(page.locator(".detail")).toBeVisible();
});

test("issue and delay commands create, edit, resolve and refresh shared registers", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?profile=small#/issues");
  await page.getByRole("button", { name: "+ Report issue", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Phase", { exact: true }).locator("option")).not.toHaveCount(1);
  await dialog.getByLabel("Phase", { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("Issue title", { exact: true }).fill("Acceptance cable defect");
  await dialog.getByLabel("Estimated cost · DKK").fill("2500");
  await dialog.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("textbox", { name: "Issues", exact: true }).fill("Acceptance cable defect"); await settled(page);
  await expect(page.locator("tbody tr")).toHaveCount(1); await page.locator("tbody tr").click(); await settled(page);
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  await dialog.getByLabel("Issue title", { exact: true }).fill("Acceptance updated cable defect");
  await dialog.getByRole("button", { name: "Save record", exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole("textbox", { name: "Issues", exact: true }).fill("Acceptance updated cable defect"); await settled(page);
  await page.locator("tbody tr").click(); await settled(page);
  await page.getByRole("button", { name: "Resolve issue", exact: true }).click();
  await dialog.getByRole("button", { name: "Resolve issue", exact: true }).click(); await expect(dialog).not.toBeVisible(); await settled(page);
  await expect(page.locator("tbody tr")).toContainText("Resolved");
  await page.getByRole("textbox", { name: "Issues", exact: true }).fill("");
  await page.getByRole("tab", { name: "Delays", exact: true }).click(); await settled(page);
  await page.getByRole("button", { name: "+ Report delay", exact: true }).click();
  await expect(dialog.getByLabel("Phase", { exact: true }).locator("option")).not.toHaveCount(1);
  await dialog.getByLabel("Phase", { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("Delay description", { exact: true }).fill("Acceptance access hold");
  await dialog.getByLabel("Estimated lost hours", { exact: true }).fill("8");
  await dialog.getByRole("button", { name: "Save record", exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole("textbox", { name: "Delays", exact: true }).fill("Acceptance access hold"); await settled(page);
  await page.locator("tbody tr").click(); await settled(page); await page.getByRole("button", { name: "End delay", exact: true }).click();
  await dialog.getByRole("button", { name: "End delay", exact: true }).click(); await expect(dialog).not.toBeVisible(); await settled(page);
  await expect(page.locator("tbody tr")).toContainText("Ended");
  expect(errors).toEqual([]);
});

test("charts, theme controls, forced states, and mobile layout remain usable", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?profile=small#/analytics"); await settled(page);
  await expect(page.locator("fray-blockgraph")).toBeVisible();
  await page.getByRole("tab", { name: "Trends", exact: true }).click(); await settled(page);
  await expect(page.locator("fray-linegraph svg")).toBeVisible();
  await page.getByLabel("Metric group", { exact: true }).selectOption("cost"); await settled(page);
  await expect(page.locator(".trends")).toContainText("Actual direct cost");
  await page.getByText("Demo controls", { exact: true }).click();
  for (const theme of ["java", "shiny", "minimal"]) { await page.getByLabel("Theme", { exact: true }).selectOption(theme); await expect(page.locator('link[data-fray-stylesheet="theme"]')).toHaveAttribute("href", new RegExp(theme)); }
  await page.getByLabel("Palette", { exact: true }).selectOption("purple");
  await page.getByLabel("Fetch state", { exact: true }).selectOption("error"); await expect(page.locator(".query-feedback > [role=alert]")).toContainText("Simulated error");
  await page.getByRole("button", { name: "Retry", exact: true }).click(); await settled(page);
  await page.getByRole("checkbox", { name: /^Disabled:/ }).locator("..").click(); await expect(page.locator(".workspace-fieldset")).toHaveAttribute("disabled", "");
  await page.getByRole("checkbox", { name: /^Disabled:/ }).locator("..").click();
  await route(page, "Overview"); await settled(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

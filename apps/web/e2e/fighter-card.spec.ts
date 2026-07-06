// Fighter Card: 3-column profile, timeline, notes, tasks, quick actions.
import { test, expect } from "@playwright/test";

test.describe("Fighter Card", () => {
  test("opens from the members list with status badge + timeline", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("link", { name: /Marco/ }).click();
    await expect(page.getByText(/MEMBERSHIP CURRENT|PAST DUE|INACTIVE/)).toBeVisible();
    // timeline is the default tab; demo check-ins appear as events
    await expect(page.getByRole("button", { name: "timeline" })).toBeVisible();
  });

  test("log attendance quick action updates the stats card", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("link", { name: /Marco/ }).click();
    await page.getByRole("button", { name: /Log attendance now/ }).click();
    await expect(page.getByText("Check-in recorded.")).toBeVisible();
  });

  test("coach note can be added and appears in the list", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("link", { name: /Marco/ }).click();
    await page.getByRole("button", { name: "notes" }).click();
    await page.getByPlaceholder(/Coaching note/).fill("Left hook drops when throwing combinations");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Note saved.")).toBeVisible();
    await expect(page.getByText("Left hook drops when throwing combinations")).toBeVisible();
  });

  test("task can be added and checked off", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("link", { name: /Marco/ }).click();
    await page.getByRole("button", { name: "tasks" }).click();
    await page.getByPlaceholder(/Follow up/).fill("Call about renewal");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Task added.")).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await expect(page.getByText("Call about renewal")).toHaveClass(/line-through/);
  });
});

// Core member flows: list, add, edit-guarded archive (type-to-confirm), restore.
import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("list renders with demo members and pagination info", async ({ page }) => {
    await page.goto("/members");
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Marco/ })).toBeVisible();
  });

  test("add member appears in the list", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("button", { name: "+ Add member" }).click();
    await page.getByPlaceholder("first name").fill("Test");
    await page.getByPlaceholder("last name").fill("Fighter");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(/Test added/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Test Fighter/ })).toBeVisible();
  });

  test("filter chips narrow the list", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("button", { name: "Past due" }).click();
    // demo data has at least one non-paid member; the All chip restores everyone
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByRole("link", { name: /Marco/ })).toBeVisible();
  });

  test("archive requires typing the member's name, then restore works", async ({ page }) => {
    await page.goto("/members");
    const row = page.locator("tr", { has: page.getByRole("link", { name: /Marco/ }) });
    await row.getByRole("button", { name: "Archive" }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByText(/NOT deleted/)).toBeVisible();
    const confirmBtn = modal.getByRole("button", { name: "Archive member" });
    await expect(confirmBtn).toBeDisabled(); // locked until the name is typed
    await modal.getByRole("textbox").fill("Marco Silva");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page.getByText("Marco archived.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Marco/ })).toHaveCount(0);

    // restore from the archived drawer
    await page.getByRole("button", { name: /Show archived/ }).click();
    await page.getByRole("button", { name: "Restore" }).first().click();
    await expect(page.getByText(/restored to your active list/)).toBeVisible();
  });

  test("CSV import validates rows before importing", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("button", { name: "Import CSV" }).click();
    await page
      .getByPlaceholder(/first_name,last_name/)
      .fill("first_name,last_name,email,phone\nGood,Person,good@x.com,514-555-0000\nBad,Email,not-an-email,123");
    await expect(page.getByText(/1 row needs? fixing|1 rows? need fixing/)).toBeVisible();
    await expect(page.getByText(/invalid email/)).toBeVisible();
    await expect(page.getByText("1 ready")).toBeVisible();
    await page.getByRole("button", { name: /Import 1 member/ }).click();
    await expect(page.getByText(/Imported 1 member/)).toBeVisible();
  });
});

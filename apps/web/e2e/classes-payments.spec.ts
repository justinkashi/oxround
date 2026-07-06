// Classes (destructive modals) + payments (record → membership paid).
import { test, expect } from "@playwright/test";

test.describe("Classes", () => {
  test("deactivating a class requires typing its name", async ({ page }) => {
    await page.goto("/classes");
    await page.getByRole("button", { name: "deactivate" }).first().click();
    const modal = page.getByRole("dialog");
    const btn = modal.getByRole("button", { name: "Deactivate class" });
    await expect(btn).toBeDisabled();
    // typing the wrong name keeps it locked
    await modal.getByRole("textbox").fill("Wrong Name");
    await expect(btn).toBeDisabled();
    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).toHaveCount(0);
  });

  test("canceling a session goes through the confirm modal", async ({ page }) => {
    await page.goto("/classes");
    // open the first session roster
    await page.locator('a[href*="/classes/session"]').first().click();
    const cancelBtn = page.getByRole("button", { name: "Cancel session" });
    if (await cancelBtn.count()) {
      await cancelBtn.click();
      const modal = page.getByRole("dialog");
      await expect(modal.getByText(/Booked members should be notified/)).toBeVisible();
      await modal.getByRole("button", { name: "Cancel session" }).click();
      await expect(page.getByText("CANCELED")).toBeVisible();
    }
  });
});

test.describe("Payments", () => {
  test("recording a payment adds it to the history", async ({ page }) => {
    await page.goto("/payments");
    await page.locator("select").first().selectOption({ index: 1 });
    await page.getByPlaceholder(/amount|0\.00|\$/i).or(page.locator('input[inputmode="decimal"], input[type="number"]').first()).first().fill("85");
    await page.getByRole("button", { name: /Record|Add payment|Save/ }).first().click();
    await expect(page.getByText("$85.00").first()).toBeVisible();
  });
});

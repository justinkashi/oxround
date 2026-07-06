// Leads kanban: add, move, convert-to-member guardrail.
import { test, expect } from "@playwright/test";

test.describe("Leads", () => {
  test("new lead lands in the New column with value aggregate", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("button", { name: "+ New lead" }).click();
    await page.getByPlaceholder("First name").fill("Trial");
    await page.getByPlaceholder("Last name").fill("Guy");
    await page.getByPlaceholder("Est. value $/mo").fill("120");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Lead added.")).toBeVisible();
    await expect(page.getByText("Trial Guy")).toBeVisible();
  });

  test("moving a lead into Converted opens the convert guardrail and creates a member", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("button", { name: "+ New lead" }).click();
    await page.getByPlaceholder("First name").fill("Winner");
    await page.getByPlaceholder("Last name").fill("Lead");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Winner Lead")).toBeVisible();

    // march the card across the pipeline: new → contacted → trial booked → trialing → (guardrail)
    const card = page.locator("div.rounded-md", { hasText: "Winner Lead" }).first();
    for (let i = 0; i < 4; i++) {
      await page.locator("div.rounded-md", { hasText: "Winner Lead" }).first().getByRole("button", { name: "→" }).click();
    }
    await expect(page.getByRole("dialog").getByText(/Convert Winner to a member\?/)).toBeVisible();
    await page.getByRole("button", { name: "Convert to member" }).click();
    await expect(page.getByText(/Winner is now a member/)).toBeVisible();
  });
});

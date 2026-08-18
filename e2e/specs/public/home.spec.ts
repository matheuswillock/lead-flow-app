import { expect, test } from "@playwright/test";

test.describe("app/page", () => {
  test("carrega a landing sem erro e mostra o heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /ALTA PERFORMANCE/i }),
    ).toBeVisible();
  });
});

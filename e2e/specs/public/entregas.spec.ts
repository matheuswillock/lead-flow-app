import { expect, test } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("app/entregas", () => {
  test("carrega a proposta com o heading e o CTA do WhatsApp", async ({ page }) => {
    await page.goto("/entregas");
    await expect(page.getByRole("heading", { name: /Você fecha/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quero fechar a proposta" })).toHaveAttribute(
      "href",
      /wa\.me\/5511939534668/,
    );
  });

  test("atualiza a projeção da régua ao trocar o período", async ({ page }) => {
    await page.goto("/entregas");
    const agendadas = page.locator(".funil-item").first().locator(".valor b");
    await expect(agendadas).toHaveText("60");
    await page.getByRole("tab", { name: "Trimestre" }).click();
    await expect(agendadas).toHaveText("180");
    await expect(page.getByRole("tab", { name: "Trimestre" })).toHaveAttribute("aria-selected", "true");
  });

  test("não estoura a largura em telas pequenas", async ({ page }) => {
    await runResponsiveChecks(page);
  });
});

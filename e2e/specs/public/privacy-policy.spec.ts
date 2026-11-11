import { expect, test } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("app/privacy-policy", () => {
  test("explica o suporte da equipe e o papel de controlador e operador", async ({ page }) => {
    await page.goto("/privacy-policy");

    await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();
    await expect(page.getByText("Última atualização: 11/11/2026")).toBeVisible();

    await expect(
      page.getByText(
        "Prestar suporte e manter o serviço, com acesso da equipe do Corretor Studio à sua conta, limitado a essa finalidade.",
      ),
    ).toBeVisible();

    const role = page.locator("article", {
      has: page.getByRole("heading", { name: "6. Seu papel e o nosso" }),
    });
    await expect(role).toContainText("controladora");
    await expect(role).toContainText("operador");

    await expect(page.getByRole("heading", { name: "7. Contato" })).toBeVisible();
  });

  test("o item de suporte não fala em registro do acesso", async ({ page }) => {
    await page.goto("/privacy-policy");

    const item = page.getByText("Prestar suporte e manter o serviço");
    await expect(item).toBeVisible();
    await expect(item).not.toContainText(/registrad/i);
  });

  test("no celular não estoura a largura e mantém alvos de toque de 44px", async ({ page }) => {
    await page.goto("/privacy-policy");
    await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();

    await runResponsiveChecks(page);
  });
});

import { expect, test } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("app/terms", () => {
  test("mostra os Termos de Uso com a seção de suporte da equipe", async ({ page }) => {
    await page.goto("/terms");

    await expect(page.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeVisible();
    await expect(page.getByText("Última atualização: 11/11/2026")).toBeVisible();

    const support = page.locator("article", {
      has: page.getByRole("heading", { name: "7. Suporte e acesso da equipe Corretor Studio" }),
    });
    await expect(support).toBeVisible();
    await expect(support).toContainText("@corretorstudio.com.br");
    await expect(support).toContainText("ver e operar os dados da sua conta");
    await expect(support.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/privacy-policy",
    );
  });

  test("não promete nada que o produto não garante sobre a equipe de suporte", async ({ page }) => {
    await page.goto("/terms");

    const support = page.locator("article", {
      has: page.getByRole("heading", { name: "7. Suporte e acesso da equipe Corretor Studio" }),
    });
    await expect(support).not.toContainText(/cobran[çc]a/i);
    await expect(support).not.toContainText(/exporta/i);
    await expect(support).not.toContainText(/registrad/i);
  });

  test("no celular não estoura a largura e mantém alvos de toque de 44px", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeVisible();

    await runResponsiveChecks(page);
  });
});

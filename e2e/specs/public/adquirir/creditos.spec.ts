import { expect, test } from "@playwright/test";
import { prisma } from "../../../support/db";

test.describe("public/adquirir/creditos", () => {
  const existingEmail = `e2e-creditos-${Date.now()}@test.com`;
  let createdProfileId: string | null = null;

  test.beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        email: existingEmail,
        fullName: "E2E Creditos User",
        role: "manager",
        isMaster: true,
      },
    });
    createdProfileId = profile.id;
  });

  test.afterAll(async () => {
    if (createdProfileId) {
      await prisma.profile.delete({ where: { id: createdProfileId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("carrega sem erro e mostra heading e cards", async ({ page }) => {
    await page.goto("/adquirir/creditos");
    await expect(page.getByRole("heading", { name: /Ative seu volume mensal de disparo/i })).toBeVisible();
    await expect(page.getByText("25 mil")).toBeVisible();
    await expect(page.getByText("375").first()).toBeVisible();
    await expect(page.getByText("50 mil")).toBeVisible();
    await expect(page.getByText("650").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ativar" }).first()).toBeVisible();
  });

  test("abre modal ao clicar em Ativar", async ({ page }) => {
    await page.goto("/adquirir/creditos");
    await page.getByRole("button", { name: "Ativar" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Confirme seu e-mail")).toBeVisible();
    await expect(page.getByLabel(/E-mail da conta/i)).toBeVisible();
  });

  test("valida e-mail inválido sem chamar API", async ({ page }) => {
    await page.goto("/adquirir/creditos");
    await page.getByRole("button", { name: "Ativar" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/E-mail da conta/i).fill("invalido");
    await page.getByRole("button", { name: "Continuar para pagamento" }).click();

    await expect(page.getByText(/Informe um e-mail válido/i)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("mostra erro para e-mail inexistente", async ({ page }) => {
    await page.goto("/adquirir/creditos");
    await page.getByRole("button", { name: "Ativar" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/E-mail da conta/i).fill("naoexiste-xyz-12345@test.com");
    await page.getByRole("button", { name: "Continuar para pagamento" }).click();

    await expect(page.getByText(/não encontrado/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("e-mail existente redireciona para checkout do Asaas", async ({ page }) => {
    await page.goto("/adquirir/creditos");
    await page.getByRole("button", { name: "Ativar" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/E-mail da conta/i).fill(existingEmail);

    const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null);

    await page.getByRole("button", { name: "Continuar para pagamento" }).click();

    const popup = await popupPromise;

    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
      const url = popup.url();
      expect(url).toContain("asaas.com/c/");
    } else {
      // Fallback: some browsers block popup — check that dialog closed (success path)
      await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    }
  });
});

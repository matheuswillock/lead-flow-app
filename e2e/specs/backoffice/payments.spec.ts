import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

/**
 * Estágio E1 da SPEC 51 (DA1 — "Payments para de mentir e de engolir",
 * P1-1/P1-2): falha de listagem não pode virar empty state, e falha ao criar
 * cobrança não pode ser engolida silenciosamente (o operador pode cobrar em
 * dobro sem saber se a primeira tentativa funcionou).
 */
test.describe("app/backoffice/(app)/payments", () => {
  test.setTimeout(120_000);

  const suffix = randomUUID().slice(0, 8);
  const clientName = `E2E Payments Client ${suffix}`;
  let backofficeProfileId: string | null = null;
  let backofficeSupabaseId = "";
  let backofficeEmail = "";
  let clientId: string | null = null;

  test.beforeAll(async () => {
    const prisma = getPrisma();
    backofficeSupabaseId = randomUUID();
    backofficeEmail = `e2e.backoffice.payments.${Date.now()}@example.com`;
    const profile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Payments",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true },
    });
    backofficeProfileId = profile.id;

    await prisma.backofficeUser.create({
      data: {
        profileId: profile.id,
        email: backofficeEmail,
        fullAccess: true,
        isActive: true,
      },
    });

    const client = await prisma.backofficeClient.create({
      data: {
        fullName: clientName,
        email: `e2e.payments.client.${suffix}@example.com`,
        asaasCustomerId: `cus_e2e_${suffix}`,
      },
      select: { id: true },
    });
    clientId = client.id;
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    if (clientId) {
      await prisma.backofficePayment.deleteMany({ where: { clientId } }).catch(() => null);
      await prisma.backofficeClient.deleteMany({ where: { id: clientId } }).catch(() => null);
    }
    if (backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, {
      supabaseId: backofficeSupabaseId,
      email: backofficeEmail,
    });
  });

  test("carrega sem erro e mostra o heading, o CTA e o cabeçalho da tabela", async ({ page }) => {
    await page.goto("/backoffice/payments");
    const main = page.locator("#backoffice-main-content");
    await expect(main.getByRole("heading", { name: "Pagamentos" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(main.getByRole("button", { name: "Nova Cobrança" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto("/backoffice/payments");
    const main = page.locator("#backoffice-main-content");
    await expect(main.getByRole("heading", { name: "Pagamentos" })).toBeVisible({
      timeout: 60_000,
    });
    // Recarrega a página no passo de reduced-motion — asserts que dependem
    // de estado da página devem vir antes desta chamada. O spinner do
    // `GlobalLoading` do shell do backoffice (Loader2/animate-spin) é
    // legítimo: aparece só durante o carregamento transitório do usuário
    // backoffice logo após o reload, não é decoração persistente.
    await runResponsiveChecks(page, { reducedMotion: { ignoreSelector: "svg.animate-spin" } });
  });

  test("T-51.1: 500 na listagem mostra banner de erro + retry, nunca empty state", async ({
    page,
  }) => {
    let getCount = 0;
    await page.route("**/api/q/backoffice/payments", async (route) => {
      if (route.request().method() === "GET") {
        getCount += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isValid: false, errorMessages: ["Erro interno"], result: null }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/backoffice/payments");

    await expect(page.getByText("Erro ao carregar cobranças")).toBeVisible({ timeout: 30_000 });
    // A falha chega DEPOIS da página montada: sem live region o leitor de
    // tela não anuncia nada. O `Alert` do shadcn fornece role="alert".
    const alertBanner = page.getByRole("alert").filter({ hasText: "Erro ao carregar cobranças" });
    await expect(alertBanner).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(page.getByText("Nenhuma cobrança encontrada")).not.toBeVisible();
    expect(getCount).toBeGreaterThan(0);

    // Retry também bate no endpoint mockado — confirma que o botão dispara
    // uma nova tentativa real, não é decorativo.
    const countBeforeRetry = getCount;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect
      .poll(() => getCount, { timeout: 10_000 })
      .toBeGreaterThan(countBeforeRetry);
    await expect(page.getByText("Erro ao carregar cobranças")).toBeVisible();
  });

  test("T-51.2: criar cobrança com rede caindo mostra toast, mantém dialog aberto, reabilita o botão e não duplica POST", async ({
    page,
  }) => {
    await page.goto("/backoffice/payments");
    await expect(page.getByRole("button", { name: "Nova Cobrança" })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Nova Cobrança" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nova Cobrança")).toBeVisible();

    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: clientName }).click();
    await dialog.getByLabel("Valor (R$) *").fill("150");

    let postCount = 0;
    await page.route("**/api/q/backoffice/payments", async (route) => {
      if (route.request().method() === "POST") {
        postCount += 1;
        // Atraso proposital: mantém a 1ª tentativa "em voo" tempo suficiente
        // para o 2º clique acontecer enquanto a trava por ref ainda está
        // ativa — sem o atraso, o abort() é rápido demais e a janela do
        // duplo clique nunca se sobrepõe à requisição real.
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    const submitButton = dialog.getByRole("button", { name: "Criar Cobrança" });
    // Dois cliques DOM síncronos no mesmo tick: o texto do botão muda para
    // "Criando..." assim que a 1ª submissão engata (re-render React), o que
    // faria um 2º `locator.click()` normal esperar o texto voltar ao normal
    // e reenviar de propósito — não é isso que queremos medir. Disparar os
    // dois `click()` nativos de dentro do mesmo `evaluate` reproduz a janela
    // real entre o clique e o re-render que a trava por ref precisa fechar.
    await submitButton.evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });

    await expect(page.getByText("Ocorreu um erro.")).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).not.toBeDisabled();

    expect(postCount).toBe(1);
  });
});

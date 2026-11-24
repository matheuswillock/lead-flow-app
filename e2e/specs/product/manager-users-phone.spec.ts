import { expect, test, type Request } from "@playwright/test";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

// O cliente fala com `/api/q/...` (proxy de consulta) e a API é `/api/v1/...`: cobre os dois.
const USERS_API = `**/api/*/manager/${E2E_MASTER_SUPABASE_ID}/users**`;

test.describe("cadastro de usuário adicional exige telefone", () => {
  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    expect(await findE2eMasterProfile()).not.toBeNull();
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    );
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("formulário recusa envio sem telefone e manda o número ao servidor quando preenchido", async ({ page }) => {
    test.setTimeout(120_000);
    const posts: Request[] = [];

    // Não cria usuário nem convite de verdade: só observa o que o formulário envia.
    await page.route(USERS_API, async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        posts.push(request);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: ["Usuário criado com sucesso"],
            errorMessages: [],
            result: { id: "e2e-user", name: "Maria Nova", email: "maria.nova@example.com", role: "operator" },
          }),
        });
        return;
      }
      if (request.method() === "GET" && request.url().includes("email=")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result: { available: true } }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/manager-users`);
    const novidades = page.getByRole("dialog", { name: /Novidades no Corretor Studio/ });
    if (await novidades.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole("button", { name: "Close" }).click();
      await expect(novidades).toBeHidden({ timeout: 10_000 });
    }

    await page.getByRole("button", { name: "Adicionar Usuário" }).click({ timeout: 60_000 });
    const dialog = page.getByRole("dialog", { name: "Criar Novo Usuário" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Nome Completo").fill("Maria Nova");
    await dialog.getByLabel("E-mail").fill("maria.nova@example.com");
    await dialog.getByRole("button", { name: "Criar Usuário" }).click();

    await expect(dialog.getByText("Telefone é obrigatório")).toBeVisible();
    expect(posts).toHaveLength(0);

    await dialog.getByLabel("Telefone").fill("1199");
    await dialog.getByRole("button", { name: "Criar Usuário" }).click();
    await expect(dialog.getByText("Telefone inválido")).toBeVisible();
    expect(posts).toHaveLength(0);

    await dialog.getByLabel("Telefone").fill("11999998888");
    await expect(dialog.getByLabel("Telefone")).toHaveValue("(11) 99999-8888");
    // Alvo de toque do campo novo em 375px, com o diálogo aberto (os demais controles já existiam).
    await page.setViewportSize({ width: 375, height: 812 });
    const box = await dialog.getByLabel("Telefone").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 1280, height: 720 });

    await dialog.getByRole("button", { name: "Criar Usuário" }).click();

    await expect.poll(() => posts.length, { timeout: 15_000 }).toBe(1);
    expect(posts[0].postDataJSON()).toMatchObject({ email: "maria.nova@example.com", phone: "11999998888" });

    // Último: o passo de movimento reduzido recarrega a página.
    await runResponsiveChecks(page, { touchTargets: { selector: 'input[type="tel"]' } });
  });
});

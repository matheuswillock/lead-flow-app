import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

/**
 * Abre o menu de ações da tabela de times e entra em "Gerenciar".
 *
 * A página de times tem refresh periódico (times com pagamento pendente
 * disparam `refreshTeams` a cada 10s) que remonta as linhas e derruba o
 * clique em "Abrir menu" no meio da ação. Em vez de um clique único com
 * timeout longo (que segura um worker da VPS por minutos e gera flake em
 * cascata nos specs paralelos), tenta em rajadas curtas até estabilizar.
 */
async function openManageMenu(page: Page, attempts = 6): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.getByRole("button", { name: "Abrir menu" }).first().click({ timeout: 15_000 });
      await page.getByRole("menuitem", { name: "Gerenciar" }).click({ timeout: 10_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(2_000);
    }
  }
  throw lastError;
}

test.describe("configuração de duração de reuniões por time", () => {
  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    expect(await findE2eMasterProfile()).not.toBeNull();
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("manager configura duração fixa e a interface permanece responsiva", async ({ page }) => {
    // Spec pesado (screenshots + responsive checks) na VPS self-hosted de 2 vCPU:
    // o timeout padrão de 30s estoura sob carga (medido na pipeline).
    test.setTimeout(120_000);
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/teams`);
    await expect(page.getByRole("heading", { name: "Gerenciar times", exact: true })).toBeVisible({ timeout: 60_000 });
    // Aguarda o fim do loading da tabela antes de interagir: o refresh
    // periódico (times com pagamento pendente) remonta as linhas e derruba
    // cliques feitos durante a transição loading -> dados.
    await expect(page.getByText(/time\(s\) encontrado/)).toBeVisible({ timeout: 30_000 });

    const team = await getPrisma().team.findFirst({
      where: { master: { supabaseId: E2E_MASTER_SUPABASE_ID }, deletedAt: null },
      select: { id: true },
    });
    expect(team).not.toBeNull();

    await openManageMenu(page);
    await page.getByRole("tab", { name: "Agendamento" }).click();
    await page.screenshot({
      path: "test-results/team-schedule-settings/before/manage-team-desktop.png",
      fullPage: true,
    });

    const update = await page.request.put(`/api/v1/teams/${team!.id}/schedule-settings`, {
      headers: {
        "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
        "x-team-id": team!.id,
      },
      data: { durationMinutes: 45 },
    });
    expect(update.ok()).toBe(true);

    await page.reload();
    await expect(page.getByText(/time\(s\) encontrado/)).toBeVisible({ timeout: 30_000 });
    await openManageMenu(page);
    await page.getByRole("tab", { name: "Agendamento" }).click();
    await expect(page.getByLabel("Duração da reunião")).toHaveText(/45 minutos/);
    await page.screenshot({
      path: "test-results/team-schedule-settings/after/manage-team-desktop.png",
      fullPage: true,
    });

    await runResponsiveChecks(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({
      path: "test-results/team-schedule-settings/after/manage-team-mobile.png",
      fullPage: true,
    });
  });
});

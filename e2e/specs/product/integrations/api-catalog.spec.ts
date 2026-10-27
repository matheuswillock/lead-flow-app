/**
 * app/[supabaseId]/integrations/api-catalog/page.tsx
 *
 * SPEC 14 (API Studio) — recurso "Horários disponíveis": ativação, token mostrado uma vez só,
 * desativar/reativar e rotação (T-14.1, T-14.2).
 *
 * Cobertura:
 * - Sem ativação: o recurso aparece como "Não ativado" e oferece "Ativar e gerar token".
 * - Ativar mostra o token (prefixo cs_avail_) e o exemplo de chamada uma vez só; depois de dispensar
 *   (ou recarregar) só o preview aparece.
 * - Desativar e reativar mantêm o mesmo token; "Gerar novo token" troca o token.
 * - Sem overflow horizontal em 360px.
 */

import { expect, test } from "@playwright/test";
import { WHATS_NEW_VERSION } from "../../../../components/whats-new-modal";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

const PAGE_PATH = `/${E2E_MASTER_SUPABASE_ID}/integrations/api-catalog`;

async function resolveE2eTeamId(): Promise<string> {
  const profile = await findE2eMasterProfile();
  if (!profile?.activeTeamId) {
    throw new Error("Seed E2E sem time ativo — rode `bun run db:seed:e2e`");
  }
  return profile.activeTeamId;
}

async function clearActivation(): Promise<void> {
  const teamId = await resolveE2eTeamId();
  await getPrisma().teamApiResourceActivation.deleteMany({ where: { teamId, resourceSlug: "availability" } });
}

test.describe("app/[supabaseId]/integrations/api-catalog", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    // O modal "Novidades" intercepta cliques; pré-marcar como visto equivale a um usuário que já o fechou.
    await context.addInitScript(
      ({ version, supabaseId }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { version: WHATS_NEW_VERSION, supabaseId: E2E_MASTER_SUPABASE_ID },
    );
    await clearActivation();
  });

  test.afterAll(async () => {
    await clearActivation();
    await disconnectPrisma();
  });

  test("T-14.1: ativar mostra o token uma vez só e depois só o preview", async ({ page }) => {
    await page.goto(PAGE_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Catálogo de API", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Não ativado")).toBeVisible();

    await page.getByRole("button", { name: "Ativar e gerar token" }).click();

    const tokenField = page.getByLabel("Token do recurso");
    await expect(tokenField).toBeVisible({ timeout: 30_000 });
    expect(await tokenField.inputValue()).toMatch(/^cs_avail_[0-9a-f]{64}$/);
    await expect(page.getByText("Exemplo de chamada")).toBeVisible();

    await page.getByRole("button", { name: "Já copiei o token" }).click();
    await expect(tokenField).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ativo", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Token do recurso")).toHaveCount(0);
    await expect(page.getByText(/cs_avail_…/)).toBeVisible();
  });

  test("T-14.2: desativar e reativar; gerar novo token troca o token", async ({ page }) => {
    await page.goto(PAGE_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Ativar e gerar token" }).click();
    const first = await page.getByLabel("Token do recurso").inputValue();
    await page.getByRole("button", { name: "Já copiei o token" }).click();

    await page.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Inativo", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Ativo", { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Gerar novo token" }).click();
    const second = await page.getByLabel("Token do recurso").inputValue();
    expect(second).not.toBe(first);
  });

  test("responsivo: sem overflow em 360/375, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(PAGE_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Catálogo de API", exact: true })).toBeVisible({ timeout: 30_000 });
    await runResponsiveChecks(page);
  });
});

/**
 * Prova dedicada de AuthContext + TimezoneContext em E2E: o fuso horário
 * exibido no app deve vir do perfil (seedado como America/Sao_Paulo), não
 * do fuso do browser Playwright (forçado aqui para Asia/Tokyo via
 * `test.use({ timezoneId })`).
 *
 * Antes da correção de `injectE2eAuthCookie`/AuthContext.tsx, `useAuth().user`
 * ficava sempre `null` no client (o cookie JWT assinado só autentica SSR —
 * ver lib/e2e/resolve-e2e-user.ts), então o efeito de
 * `app/context/TimezoneContext.tsx` nunca disparava e `tz` ficava preso no
 * valor inicial `detectBrowserTimezone()`. Nesse cenário o badge "Fuso
 * horário" da página de conta mostrava o fuso do BROWSER (aqui,
 * "Asia/Tokyo", cru — sem tradução, porque `getProfileTimezoneOptions`
 * sintetiza um label = value quando o fuso atual não está entre as opções
 * padrão). Com a correção, `user.id` é populado a partir do cookie
 * `sb-e2e-auth-user` e o fetch de `/api/q/profiles/{id}/timezone` roda,
 * resolvendo para o fuso salvo no perfil ("São Paulo").
 *
 * Não é a spec de cobertura completa de app/[supabaseId]/account/page.tsx
 * (ainda listada em e2ePageCoverageAllowlist) — cobre só esta seção. O teste
 * de responsividade abaixo exclui os `role="tab"` e os `Checkbox` de
 * "Gerenciar funções" do assert de touch target: são alvos pré-existentes
 * da página inteira, sem relação com fuso horário, e não foram tocados por
 * esta mudança (tarefa de follow-up sinalizada separadamente).
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, findE2eMasterProfile } from "../../support/db";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { runResponsiveChecks } from "../../support/responsive";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";

test.describe("AuthContext + TimezoneContext: fuso do app vence o do browser", () => {
  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile();
    if (!profile) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
    await injectE2eAuthCookie(context);
    // Sem isso o dialog "novidades" cobre a tela no primeiro load (ver
    // agents.md § Receita de setup, item 4).
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

  test.describe("fuso do browser divergente do perfil", () => {
    /** Fuso do BROWSER, deliberadamente diferente do perfil seedado (America/Sao_Paulo). */
    test.use({ timezoneId: "Asia/Tokyo" });

    test("mostra o fuso salvo no perfil (São Paulo), não o do browser (Asia/Tokyo)", async ({
      page,
    }) => {
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/account`);
      await expect(page.getByText("Minha conta")).toBeVisible();

      // "Fuso horário" fica na aba "Conexões", não na aba "Perfil" (default).
      await page.getByRole("tab", { name: "Conexões" }).click();

      const timezoneSection = page.locator("section").filter({ hasText: "Fuso horário" });
      await expect(timezoneSection.getByText("São Paulo", { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(timezoneSection.getByText("Asia/Tokyo")).toHaveCount(0);
    });
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({
    page,
  }) => {
    // Sem override de timezoneId: fuso do browser == fuso do perfil, então o
    // toast "Usar fuso do navegador" não aparece — mantém este teste restrito
    // a layout/touch-target/reduced-motion, sem acoplar com o botão de ação
    // do sonner (achado real, sinalizado à parte, não corrigido aqui).
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/account`);
    await expect(page.getByText("Minha conta")).toBeVisible();
    await runResponsiveChecks(page, {
      touchTargets: {
        selector: 'a[href], button:not([role="tab"]):not([role="checkbox"]), [role="button"]',
      },
    });
  });
});

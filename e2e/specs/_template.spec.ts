/**
 * Template de spec E2E (Playwright).
 *
 * Como montar uma spec nova:
 * 1. Copiar este arquivo para `e2e/specs/<dominio>/<slug>.spec.ts`
 *    conforme a seção **E2E Tests (FOR NEW FEATURES)** em `agents.md`.
 * 2. Ciclo TDD: escrever a spec ANTES do código (red) → implementar até verde.
 * 3. Arrange no banco, Act no Playwright, Assert na UI e no banco.
 * 4. Cobertura mínima: página carrega, heading visível, CTA principal,
 *    estado vazio/loading com Skeleton (não crash).
 * 5. Feature de cobrança: assertir produto, ciclo, valor e a ausência do
 *    termo CDP. Chamar `assertAsaasSandbox()` no `beforeAll` se a spec
 *    criar customer/cobrança/checkout/assinatura.
 * 6. Rodar: `bun run test:e2e:local -- e2e/specs/<arquivo>.spec.ts`
 *
 * Convenção de path:
 * - `app/[supabaseId]/subscription/page.tsx` → `e2e/specs/product/subscription.spec.ts`
 * - `app/backoffice/(app)/pricing/page.tsx` → `e2e/specs/backoffice/pricing.spec.ts`
 * - `app/adesao/[token]/page.tsx` → `e2e/specs/checkout/adesao.spec.ts`
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../fixtures/auth";
import { disconnectPrisma, findE2eMasterProfile } from "../support/db";
import { assertAsaasSandbox } from "../support/asaas";

test.describe("app/example-route", () => {
  test.beforeAll(() => {
    // Remover se a spec não fala com Asaas.
    if (process.env.E2E_TOUCHES_ASAAS === "true") {
      assertAsaasSandbox();
    }
  });

  test.beforeEach(async ({ context }) => {
    // Página autenticada: injeta o cookie JWT do master seedado.
    // Página pública: apague este beforeEach.
    await injectE2eAuthCookie(context);
    const profile = await findE2eMasterProfile();
    if (!profile) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("carrega sem erro e mostra o heading", async ({ page }) => {
    await page.goto("/example-route");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

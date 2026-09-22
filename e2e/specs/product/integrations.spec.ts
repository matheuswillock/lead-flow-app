/**
 * app/[supabaseId]/integrations/page.tsx
 *
 * SPEC 15 (Hub de Integrações) — T-15.4, T-15.7.
 *
 * Cobertura:
 * - O hub carrega sem erro de console e mostra as três entradas (Catálogo de
 *   API, Webhooks, Pixel).
 * - Webhooks e Pixel navegam para a subpágina própria.
 * - Catálogo de API aparece como "Em breve", sem link quebrado (SPEC 14 ainda
 *   não existe).
 * - Sem overflow horizontal em 360px.
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

async function grantFeatureBeta(profileId: string, slug: "integration" | "radar") {
  const prisma = getPrisma();
  const feature = await prisma.backofficeFeature.findUnique({ where: { slug }, select: { id: true } });
  if (!feature) {
    throw new Error(`Feature ${slug} ausente no catálogo — rode \`bun run db:seed:e2e\``);
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: {
        featureId: feature.id,
        profileId,
        grantType: "BETA",
      },
    },
    create: {
      featureId: feature.id,
      profileId,
      grantType: "BETA",
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
    update: {
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
  });
}

/**
 * Ruído de ambiente sem relação com a página: Realtime fica desligado no
 * Postgres local "db-only" (`/api/v1/realtime/auth-token` 401), o script de
 * Vercel Analytics não existe fora de um deploy Vercel (`/_vercel/insights`
 * 404), e o tunnelRoute do Sentry (`next.config.ts:114`, `/monitoring`, só
 * ativo em build de produção) devolve 401 com o DSN placeholder do
 * `.env.test`. São as três únicas origens conhecidas de resposta >= 400
 * nesta página — qualquer outra é reprovada (achado de revisão R15-10:
 * filtrar pela mensagem de console genérica "Failed to load resource"
 * escondia um 403/500 real vindo da própria página).
 */
const KNOWN_NOISE_URL_PATTERNS = ["realtime/auth-token", "_vercel/insights", "/monitoring?"];

function isKnownNoiseUrl(url: string): boolean {
  return KNOWN_NOISE_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

/** Mensagem de console que não é o eco genérico de um recurso de rede (esse já é coberto por `page.on("response")`). */
function isGenericResourceLoadMessage(message: string): boolean {
  return message.startsWith("Failed to load resource:") || message.startsWith("Refused to execute script");
}

test.describe("app/[supabaseId]/integrations", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    const profile = await findE2eMasterProfile();
    if (!profile) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
    await grantFeatureBeta(profile.id, "integration");
    await grantFeatureBeta(profile.id, "radar");
    // Evita o dialog de novidades interceptar cliques na primeira carga.
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("carrega sem erro e mostra as três entradas do hub", async ({ page }) => {
    const consoleErrors: string[] = [];
    const unexpectedFailedResponses: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isGenericResourceLoadMessage(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !isKnownNoiseUrl(response.url())) {
        unexpectedFailedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");

    await expect(page.getByRole("heading", { name: "Integrações", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(main.getByText("Catálogo de API")).toBeVisible();
    await expect(main.getByText("Webhooks", { exact: true })).toBeVisible();
    await expect(main.getByText("Pixel", { exact: true })).toBeVisible();
    await expect(main.getByText("Em breve").first()).toBeVisible();

    expect(consoleErrors, `Erros de console: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(
      unexpectedFailedResponses,
      `Respostas >= 400 não esperadas: ${unexpectedFailedResponses.join(" | ")}`
    ).toEqual([]);
  });

  test("Catálogo de API não tem link quebrado (recurso ainda não existe)", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");

    const apiCatalogCard = main.locator("div, a").filter({ hasText: "Catálogo de API" }).last();
    await expect(apiCatalogCard).toBeVisible();

    const apiCatalogLink = page.locator('a[href="' + `/${E2E_MASTER_SUPABASE_ID}/integrations/api-catalog` + '"]');
    await expect(apiCatalogLink).toHaveCount(0);
  });

  test("Webhooks navega para a página de entrada de webhooks", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await page.locator("main").getByRole("link", { name: /Webhooks/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks$`));
    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible({ timeout: 30_000 });
  });

  test("Pixel navega para a página própria do Pixel", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await page.locator("main").getByRole("link", { name: /Pixel/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations/pixel$`));
    await expect(page.getByRole("heading", { name: "Pixel", exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Integrações", exact: true })).toBeVisible({ timeout: 30_000 });
    await runResponsiveChecks(page);
  });
});

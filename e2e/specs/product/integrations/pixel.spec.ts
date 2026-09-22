/**
 * app/[supabaseId]/integrations/pixel/page.tsx
 *
 * SPEC 15 (Hub de Integrações) — T-15.6, T-15.7.
 *
 * B-E3: o conteúdo atual de `RadarPixelIntegration` (SPEC 30) só muda de
 * lugar — o componente não foi movido nem editado, e continua lendo o
 * `IntegrationsContext` compartilhado. Esta spec cobre a página nova, não o
 * comportamento interno do pixel (isso é da SPEC 30).
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

async function grantRadarBeta(profileId: string) {
  const prisma = getPrisma();
  const feature = await prisma.backofficeFeature.findUnique({ where: { slug: "radar" }, select: { id: true } });
  if (!feature) {
    throw new Error("Feature radar ausente no catálogo — rode `bun run db:seed:e2e`");
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: { featureId: feature.id, profileId, grantType: "BETA" },
    },
    create: { featureId: feature.id, profileId, grantType: "BETA", isActive: true, betaTeamScope: "ALL_TEAMS" },
    update: { isActive: true, betaTeamScope: "ALL_TEAMS" },
  });
}

/**
 * Ruído de ambiente sem relação com a página: Realtime fica desligado no
 * Postgres local "db-only" (`/api/v1/realtime/auth-token` 401), o script de
 * Vercel Analytics não existe fora de um deploy Vercel (`/_vercel/insights`
 * 404), e o tunnelRoute do Sentry (`next.config.ts:114`, `/monitoring`, só
 * ativo em build de produção) devolve 401 com o DSN placeholder do
 * `.env.test`. São as três únicas origens conhecidas de resposta >= 400
 * nesta página — qualquer outra é reprovada (achado de revisão R15-10).
 */
const KNOWN_NOISE_URL_PATTERNS = ["realtime/auth-token", "_vercel/insights", "/monitoring?"];

function isKnownNoiseUrl(url: string): boolean {
  return KNOWN_NOISE_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

/** Mensagem de console que não é o eco genérico de um recurso de rede (esse já é coberto por `page.on("response")`). */
function isGenericResourceLoadMessage(message: string): boolean {
  return message.startsWith("Failed to load resource:") || message.startsWith("Refused to execute script");
}

test.describe("app/[supabaseId]/integrations/pixel", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    const profile = await findE2eMasterProfile();
    if (!profile) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
    await grantRadarBeta(profile.id);
    // Evita o dialog de novidades interceptar cliques na primeira carga.
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("carrega com o conteúdo atual do Pixel (setup e atividade)", async ({ page }) => {
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

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/pixel`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Pixel", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Corretor Studio Pixel")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Atividade do pixel")).toBeVisible();

    expect(consoleErrors, `Erros de console: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(
      unexpectedFailedResponses,
      `Respostas >= 400 não esperadas: ${unexpectedFailedResponses.join(" | ")}`
    ).toEqual([]);
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/pixel`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Pixel", exact: true })).toBeVisible({ timeout: 30_000 });
    await runResponsiveChecks(page);
  });
});

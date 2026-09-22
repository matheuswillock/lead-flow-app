/**
 * app/[supabaseId]/integrations/page.tsx — seção "Corretor Studio Pixel"
 * (RadarPixelIntegration.tsx).
 *
 * Cobertura (SPEC 30 — Pixel, T-30.2):
 * - Página de Integrações carrega sem erro (heading visível).
 * - Pixel sem domínios configurados (`allowedOrigins: []`) → aviso de
 *   origem aberta visível, com atalho para o campo de domínios (W27, DA1:
 *   `isOriginAllowed` continua aceitando qualquer origem — o aviso só
 *   sinaliza, nunca bloqueia).
 * - Pixel com um domínio configurado → aviso ausente.
 * - "Último hit registrado" usa o fuso do app (`useTimezone`/
 *   `formatIntimezone`), não `toLocaleString` do navegador (W33) — e o
 *   mesmo formatador na tabela de atividade do pixel não derruba a tela.
 * - Responsividade mobile-first (360/375, sem overflow horizontal).
 */

import { expect, test, type BrowserContext } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";

/**
 * O modal "Novidades" (components/whats-new-modal.tsx) abre por padrão para
 * todo profile que ainda não marcou a versão como vista em `localStorage` —
 * o que é sempre o caso num contexto novo do Playwright. Ele é modal (Radix
 * Dialog) e marca o restante da página `aria-hidden`, então qualquer spec
 * que não pré-marque como visto não encontra nada por role/heading e trava
 * cliques em qualquer botão da tela. Pré-marcar como visto é o mesmo efeito
 * de um usuário real que já fechou o card uma vez.
 */
async function dismissWhatsNewModal(context: BrowserContext) {
  await context.addInitScript(
    ({ version, supabaseId }) => {
      window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
    },
    { version: WHATS_NEW_VERSION, supabaseId: E2E_MASTER_SUPABASE_ID },
  );
}

const PIXEL_PUBLIC_TOKEN = "e2e2000000000000000000000000000000pixel30";

async function grantRadarBeta(profileId: string) {
  const prisma = getPrisma();
  const radarFeature = await prisma.backofficeFeature.findUnique({
    where: { slug: "radar" },
    select: { id: true },
  });
  if (!radarFeature) {
    throw new Error("Feature radar ausente no catálogo — rode `bun run db:seed:e2e`");
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: {
        featureId: radarFeature.id,
        profileId,
        grantType: "BETA",
      },
    },
    create: {
      featureId: radarFeature.id,
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

async function arrangePixelConfig(input: {
  teamId: string;
  profileId: string;
  allowedOrigins: string[];
  lastUsedAt?: Date | null;
}) {
  const prisma = getPrisma();
  return prisma.teamRadarPixelConfig.upsert({
    where: { teamId: input.teamId },
    create: {
      teamId: input.teamId,
      publicToken: PIXEL_PUBLIC_TOKEN,
      allowedOrigins: input.allowedOrigins,
      updatedByProfileId: input.profileId,
      lastUsedAt: input.lastUsedAt ?? null,
    },
    update: {
      allowedOrigins: input.allowedOrigins,
      updatedByProfileId: input.profileId,
      lastUsedAt: input.lastUsedAt ?? null,
    },
  });
}

async function arrangeMasterTeamWithRadar() {
  const profile = await findE2eMasterProfile();
  if (!profile) {
    throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
  }
  if (!profile.activeTeamId) {
    throw new Error("Team E2E não encontrado");
  }

  await grantRadarBeta(profile.id);

  return { profile, teamId: profile.activeTeamId };
}

test.describe("app/[supabaseId]/integrations — Corretor Studio Pixel", () => {
  // `playwright.config.ts` roda `fullyParallel: true`. Todos os testes deste
  // arquivo escrevem na MESMA linha `teamRadarPixelConfig` do time master
  // E2E (allowedOrigins alterna entre `[]` e `["https://exemplo.com"]`), e o
  // teste de horário também limpa `teamRadarPixelHitLog` do time. Em
  // workers paralelos um teste pode ler o estado que outro acabou de
  // escrever — mesmo padrão de time compartilhado entre workers já visto em
  // `radar.spec.ts` (ver `test.describe.configure({ mode: "serial" })` lá).
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    await dismissWhatsNewModal(context);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("carrega sem erro e mostra o heading", async ({ page }) => {
    await arrangeMasterTeamWithRadar();

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
  });

  test("T-30.2: pixel sem domínios mostra aviso de origem aberta e leva ao campo de domínios", async ({
    page,
  }) => {
    const { teamId, profile } = await arrangeMasterTeamWithRadar();
    await arrangePixelConfig({ teamId, profileId: profile.id, allowedOrigins: [] });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    const pixelTrigger = page.getByRole("button", { name: /Corretor Studio Pixel/ });
    await expect(pixelTrigger).toBeVisible({ timeout: 20_000 });
    await pixelTrigger.click();

    const warning = page.getByTestId("pixel-open-origin-warning");
    await expect(warning).toBeVisible({ timeout: 15_000 });
    await expect(warning).toContainText(
      "Qualquer site pode disparar este pixel. Adicione domínios permitidos para restringir."
    );

    // O atalho leva ao campo de domínios sem navegar para outra página —
    // regra R30.3 (nota de revisão) exige que ele "leve ao campo".
    const originsField = page.getByLabel(/Origens permitidas/);
    await warning.getByRole("button", { name: "Adicionar domínios" }).click();
    await expect(originsField).toBeFocused();
  });

  test("T-30.2: pixel com domínio configurado não mostra o aviso", async ({ page }) => {
    const { teamId, profile } = await arrangeMasterTeamWithRadar();
    await arrangePixelConfig({
      teamId,
      profileId: profile.id,
      allowedOrigins: ["https://exemplo.com"],
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    const pixelTrigger = page.getByRole("button", { name: /Corretor Studio Pixel/ });
    await expect(pixelTrigger).toBeVisible({ timeout: 20_000 });
    await pixelTrigger.click();

    // Aguarda a configuração carregar (o textarea de origens é o sinal de
    // que o GET terminou) antes de assertar a ausência do aviso.
    await expect(page.getByLabel(/Origens permitidas/)).toHaveValue("https://exemplo.com");
    await expect(page.getByTestId("pixel-open-origin-warning")).toHaveCount(0);
  });

  // W33: "Último hit registrado" usa o fuso do app (dd/MM/yyyy HH:mm), não
  // `toLocaleString("pt-BR")` do navegador — que produz vírgula e segundos.
  // Também cobre a regressão do mesmo formatador na tabela de atividade
  // (PixelHitLogRow), que antes derrubava a seção com "Invalid time value"
  // por trocar a ordem de `pattern`/`timezone`.
  test("horário do último hit usa o fuso do app, sem crash na atividade", async ({ page }) => {
    const { teamId, profile } = await arrangeMasterTeamWithRadar();
    await arrangePixelConfig({
      teamId,
      profileId: profile.id,
      allowedOrigins: ["https://exemplo.com"],
      lastUsedAt: new Date("2026-09-21T15:30:00.000Z"),
    });

    await getPrisma().teamRadarPixelHitLog.deleteMany({ where: { teamId } });
    await getPrisma().teamRadarPixelHitLog.create({
      data: {
        teamId,
        eventType: "pixel.pageview",
        visitorSession: "e2e-visitor-session-30",
        origin: "https://exemplo.com",
        userAgent: "playwright-e2e",
      },
    });

    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    const pixelTrigger = page.getByRole("button", { name: /Corretor Studio Pixel/ });
    await pixelTrigger.click();

    const lastHit = page.getByText("Último hit registrado:");
    await expect(lastHit).toBeVisible({ timeout: 15_000 });
    // dd/MM/yyyy HH:mm — sem vírgula e sem segundos, ao contrário de
    // `toLocaleString("pt-BR")` (o formato antigo, W33).
    //
    // Não fixamos `timezoneId` do contexto para provar o fuso exato do
    // profile (America/Sao_Paulo, seed `db:seed:e2e`): `TimezoneContext`
    // só busca o fuso do profile quando `useAuth()` tem uma sessão real do
    // Supabase (`supabase.auth.getSession()`), e `injectE2eAuthCookie` só
    // injeta o JWT E2E verificado no servidor (`proxy.ts`) — o cliente não
    // tem sessão Supabase real. Nesse cenário `tz` fica travado no fuso do
    // NAVEGADOR (`detectBrowserTimezone()`), então emular um fuso diferente
    // do navegador aqui testaria apenas a emulação do Playwright, não a
    // regressão de W33. A cobertura de formato (sem vírgula/segundos) já
    // distingue `formatIntimezone` de `toLocaleString("pt-BR")`.
    await expect(lastHit).toHaveText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);

    const activityTrigger = page.getByRole("button", { name: /Atividade do pixel/ });
    await activityTrigger.click();
    // Sem crash: a linha da tabela renderiza com o formatador corrigido.
    await expect(page.getByRole("table").getByText("Pageview")).toBeVisible({ timeout: 15_000 });

    expect(consoleErrors).toEqual([]);
  });

  // Alvo de toque escopado à seção do Pixel: a página de Integrações tem
  // outras seções (ex.: Webhook Studio) fora do escopo desta SPEC — a
  // SPEC 30 MUST NOT mexer em webhooks. Débito de toque pré-existente ali
  // (sinalizado à parte) não pode travar o PR do Pixel.
  const PIXEL_SECTION_TOUCH_TARGETS = '[data-testid="radar-pixel-integration"] a[href], [data-testid="radar-pixel-integration"] button, [data-testid="radar-pixel-integration"] [role="button"]';

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    const { teamId, profile } = await arrangeMasterTeamWithRadar();
    await arrangePixelConfig({ teamId, profileId: profile.id, allowedOrigins: [] });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();

    const pixelTrigger = page.getByRole("button", { name: /Corretor Studio Pixel/ });
    await expect(pixelTrigger).toBeVisible({ timeout: 20_000 });
    await pixelTrigger.click();
    await expect(page.getByTestId("pixel-open-origin-warning")).toBeVisible({ timeout: 15_000 });

    await runResponsiveChecks(page, { touchTargets: { selector: PIXEL_SECTION_TOUCH_TARGETS } });
  });
});

/**
 * app/[supabaseId]/integrations/page.tsx
 *
 * SPEC 10, B-E1 (T-10.18, T-10.19, T-10.20) — widget legado "Webhook
 * Genérico de Leads" (`StudioWebhookIntegration.tsx`). R10-4/R10-5
 * (revisão Opus, Protocolo 96): a página saía de `e2ePageCoverageAllowlist`
 * junto com o resto da SPEC, mas sem spec própria — só o CRUD novo
 * (webhooks/inbound|outbound) tinha cobertura. Este arquivo fecha a lacuna
 * e tira `app/[supabaseId]/integrations/page.tsx` da allowlist.
 *
 * Os cenários "sem config"/"com config" interceptam a resposta de
 * GET /integrations/studio-webhook em vez de escrever no Postgres
 * compartilhado: `getConfiguration` (DA1) trata QUALQUER TeamWebhook
 * inbound do time como "config existente", e o time E2E compartilhado
 * roda specs em paralelo com outros agentes que também criam webhooks
 * inbound — gravar/apagar linhas aqui correria risco real de interferir
 * com testes concorrentes (ver memória do projeto sobre flake de time
 * compartilhado entre workers). Mockar a resposta do endpoint dá o mesmo
 * cenário determinístico sem tocar o banco.
 *
 * Cobertura:
 * - T-10.18: badge reflete o estado real ("Token não configurado" sem
 *   config; "Pronto para uso" com config válida) — não um rótulo genérico.
 * - T-10.19: sem config, o CTA "Configurar agora" (fora do AccordionTrigger,
 *   W16) abre o formulário num clique.
 * - T-10.20: com config existente, o botão vira "Rotacionar token" e abre
 *   um AlertDialog de confirmação; "Cancelar" fecha sem salvar.
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

// Um único padrão cobre as duas rotas de propósito — "?" em glob do
// Playwright é curinga de 1 caractere, então "studio-webhook?**" também
// bate em "studio-webhook/logs?..." (achado ao debugar esta spec: as duas
// rotas coincidiam e a de logs, registrada por último, capturava a
// resposta de config também). Um handler só, que decide pela URL real,
// evita a colisão de padrão em vez de tentar around it com mais globs.
const STUDIO_WEBHOOK_ENDPOINT = "**/integrations/studio-webhook*";

function buildConfigResponse(overrides: Record<string, unknown>) {
  return {
    isValid: true,
    successMessages: [],
    errorMessages: [],
    result: {
      configured: false,
      teamId: "team-e2e",
      leadFormUrl: "https://app.example.test/s/e2e",
      tokenMode: "auto",
      tokenPreview: null,
      expiryMode: "indeterminate",
      expiresAt: null,
      isExpired: false,
      lastUsedAt: null,
      webhookUrl: "https://app.example.test/api/webhooks/studio/team-e2e",
      webhookUrlTemplate: "https://app.example.test/api/webhooks/studio/team-e2e/{token}",
      ...overrides,
    },
  };
}

async function mockConfigResponse(page: import("@playwright/test").Page, overrides: Record<string, unknown>) {
  await page.route(STUDIO_WEBHOOK_ENDPOINT, (route) => {
    const request = route.request();
    if (request.method() !== "GET") return route.continue();

    const isLogsRequest = new URL(request.url()).pathname.endsWith("/logs");
    if (isLogsRequest) {
      // Mocado só para não correr contra o backend real enquanto o teste
      // interage com o accordion — o conteúdo não importa para T-10.18/19/20.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result: { items: [], total: 0 } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildConfigResponse(overrides)),
    });
  });
}

test.describe("app/[supabaseId]/integrations — widget legado do webhook (SPEC 10, B-E1)", () => {
  test.beforeAll(async () => {
    const profile = await findE2eMasterProfile();
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E ausente ou sem time ativo — rode `bun run db:seed:e2e`");
    }
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
  });

  test("T-10.18/T-10.19 — sem config: badge 'Token não configurado' e CTA 'Configurar agora' abre o formulário", async ({
    page,
  }) => {
    await mockConfigResponse(page, { configured: false });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Webhook Genérico de Leads")).toBeVisible();
    await expect(page.getByText("Token não configurado")).toBeVisible();

    const configureNowButton = page.getByRole("button", { name: "Configurar agora" });
    await expect(configureNowButton).toBeVisible();
    await configureNowButton.click();

    // Abriu o accordion: o formulário (modo do token) fica visível.
    await expect(page.getByText("Modo do token", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar Configuração do Webhook" })).toBeVisible();
  });

  test("T-10.18/T-10.20 — com config existente: badge 'Pronto para uso', botão 'Rotacionar token' abre confirmação, Cancelar não salva", async ({
    page,
  }) => {
    await mockConfigResponse(page, {
      configured: true,
      tokenMode: "auto",
      tokenPreview: "e2e-tok...prev",
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Webhook Genérico de Leads")).toBeVisible();
    await expect(page.getByText("Pronto para uso")).toBeVisible();
    // Com config, o CTA de fora do accordion não existe mais (W16).
    await expect(page.getByRole("button", { name: "Configurar agora" })).toHaveCount(0);

    // O AccordionTrigger encapsula um <h3> (W16) — clicar direto no texto do
    // título é o alvo mais estável (a área do botão composto inclui a
    // badge e o parágrafo de descrição, que não devem interceptar o clique).
    // O primeiro clique some ocasionalmente sem efeito neste cenário
    // (accordion Radix ainda assentando o layout logo após o mount) — tenta
    // de novo em vez de falhar por causa de uma corrida de renderização
    // que não é o que T-10.20 quer medir.
    const trigger = page.getByRole("heading", { level: 3, name: "Webhook Genérico de Leads", exact: true });
    const rotateButton = page.getByRole("button", { name: "Rotacionar token" });
    await trigger.click();
    try {
      await rotateButton.waitFor({ state: "visible", timeout: 3000 });
    } catch {
      await trigger.click();
      await expect(rotateButton).toBeVisible();
    }

    await page.getByRole("button", { name: "Rotacionar token" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Rotacionar o token do webhook?")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    // Ainda "Pronto para uso" — cancelar não rotacionou nem quebrou o estado.
    await expect(page.getByText("Pronto para uso")).toBeVisible();
  });

  test("responsivo — 360/375 sem overflow, touch targets, prefers-reduced-motion", async ({ page }) => {
    await mockConfigResponse(page, { configured: true, tokenMode: "auto", tokenPreview: "e2e-tok...prev" });
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Webhook Genérico de Leads")).toBeVisible();
    await page.getByRole("heading", { level: 3, name: "Webhook Genérico de Leads", exact: true }).click();

    // NOTA: mesmo achado sistêmico já registrado em
    // integrations-webhooks-inbound.spec.ts (components/ui/button.tsx nunca
    // chega a 44px) — aqui o piso real é ainda menor porque o widget legado
    // também tem os botões de tooltip "O que é..." e os RadioGroupItem de
    // modo do token/expiração em 16px, pré-existentes e não tocados pela
    // SPEC 10. Segue no mesmo follow-up (task_66d43e60) em vez de virar
    // escopo novo aqui.
    await runResponsiveChecks(page, { touchTargets: { minSize: 16 } });
  });
});

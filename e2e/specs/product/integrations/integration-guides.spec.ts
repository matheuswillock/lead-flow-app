/**
 * app/[supabaseId]/integrations/page.tsx
 * app/[supabaseId]/integrations/api-catalog/page.tsx
 * app/[supabaseId]/integrations/webhooks/inbound/[id]/page.tsx
 *
 * Guias de uso da integração (webhook v2 + API Studio) dentro do app, para o time logado.
 *
 * Cobertura:
 * - Hub: o passo a passo "Como colocar uma integração para funcionar" lista 5 passos com link.
 * - Detalhe do webhook v2: a aba "Guia" mostra a URL do próprio webhook nos exemplos, só o placeholder do
 *   token e avisa que a duração vem do time.
 * - Catálogo de API: o guia explica a ordem de uso, o exemplo de resposta e a tabela de respostas.
 * - Detalhe do webhook: versão, permissões e SDR do rodízio no v2; sem troca de versão no v1 (T-11.23).
 * - Contrato legível por máquina: OpenAPI 3.1 e JSON Schema públicos, sem token, e os códigos de resultado no guia.
 * - Sem overflow horizontal em 360/375 no guia do webhook.
 */

import { expect, test } from "@playwright/test";
import { WHATS_NEW_VERSION } from "../../../../components/whats-new-modal";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

const WEBHOOK_NAME = "E2E Guia v2";
const V1_NAME = "E2E Guia v1";

type Ctx = { teamId: string; webhookId: string };
const ctx: Ctx = { teamId: "", webhookId: "" };

async function cleanup(): Promise<void> {
  if (!ctx.teamId) return;
  const prisma = getPrisma();
  const hooks = await prisma.teamWebhook.findMany({ where: { teamId: ctx.teamId, name: { in: [WEBHOOK_NAME, V1_NAME] } }, select: { id: true } });
  const ids = hooks.map((hook) => hook.id);
  await prisma.teamWebhookInboundEvent.deleteMany({ where: { webhookId: { in: ids } } });
  await prisma.teamWebhook.deleteMany({ where: { id: { in: ids } } });
}

async function openGuideTab(page: import("@playwright/test").Page) {
  await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/inbound/${ctx.webhookId}`, { waitUntil: "domcontentloaded" });
  const guideTab = page.getByRole("tab", { name: "Guia" });
  // Cliques logo após `domcontentloaded` podem ser perdidos antes da hidratação.
  await expect(async () => {
    await guideTab.click();
    await expect(guideTab).toHaveAttribute("aria-selected", "true", { timeout: 1_500 });
  }).toPass({ timeout: 30_000 });
}

test.describe("guias de integração no app", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    const profile = await findE2eMasterProfile();
    if (!profile?.activeTeamId) throw new Error("Seed E2E sem time ativo — rode `bun run db:seed:e2e`");
    ctx.teamId = profile.activeTeamId;
    await cleanup();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    await context.addInitScript(
      ({ version, supabaseId }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { version: WHATS_NEW_VERSION, supabaseId: E2E_MASTER_SUPABASE_ID },
    );
  });

  test.afterAll(async () => {
    await cleanup();
    await disconnectPrisma();
  });

  test("hub: o passo a passo lista 5 passos com link", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });
    const flow = page.getByTestId("integration-flow");
    await expect(flow).toBeVisible({ timeout: 30_000 });
    await expect(flow.getByRole("listitem")).toHaveCount(5);
    await expect(flow.getByRole("link", { name: "Abrir Catálogo de API" })).toHaveAttribute(
      "href",
      `/${E2E_MASTER_SUPABASE_ID}/integrations/api-catalog`,
    );
  });

  test("detalhe do webhook v2: a aba Guia mostra a URL do webhook, só o placeholder do token e a duração do time", async ({ page, context }) => {
    const profile = await findE2eMasterProfile();
    const response = await context.request.post("/api/v1/integrations/webhooks", {
      data: {
        direction: "inbound",
        name: WEBHOOK_NAME,
        tokenMode: "auto",
        expiryMode: "months_6",
        contractVersion: 2,
        scopes: ["leads_create", "leads_schedule"],
        defaultAssigneeProfileIds: [profile!.id],
        defaultMeetingLink: "https://meet.google.com/e2e-guia-link",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const body = (await response.json()).result;
    ctx.webhookId = body.id;

    await openGuideTab(page);

    const guide = page.getByTestId("inbound-v2-guide");
    await expect(guide).toBeVisible();
    const createExample = guide.getByLabel("Exemplo sem agendamento");
    await expect(createExample).toContainText(`/api/webhooks/studio/v2/${ctx.teamId}`);
    await expect(createExample).toContainText("Bearer SEU_TOKEN_DO_WEBHOOK");
    await expect(createExample).not.toContainText(body.token);
    await expect(guide.getByLabel("Exemplo com agendamento")).not.toContainText("duration_minutes");
    await expect(guide.getByText(/configurada no time/)).toBeVisible();
    await expect(guide.getByRole("link", { name: "Catálogo de API" }).first()).toHaveAttribute(
      "href",
      `/${E2E_MASTER_SUPABASE_ID}/integrations/api-catalog`,
    );
  });

  test("responsivo: o guia do webhook v2 não gera overflow em 360/375", async ({ page }) => {
    await openGuideTab(page);
    await expect(page.getByTestId("inbound-v2-guide")).toBeVisible();
    await runResponsiveChecks(page, { touchTargets: { selector: '[data-testid="inbound-v2-guide"] button, [data-testid="inbound-v2-guide"] a' } });
  });

  test("contrato público: OpenAPI e JSON Schema respondem sem token e descrevem os dois endpoints", async ({ request }) => {
    const openapi = await request.get("/api/studio/v1/openapi.json");
    expect(openapi.status()).toBe(200);
    const doc = await openapi.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(["/api/webhooks/studio/v2/{teamId}", "/api/studio/v1/availability"]);
    expect(JSON.stringify(doc)).not.toContain("duration_minutes\":{");

    const schema = await request.get("/api/webhooks/studio/v2/schema");
    expect(schema.status()).toBe(200);
    const json = await schema.json();
    expect(json.required).toEqual(["lead"]);
    expect(json.properties.lead.required).toEqual(["name", "phone"]);
    expect(json.properties.schedule.properties.starts_at.description).toContain("RFC 3339");
  });

  test("detalhe do v2 mostra versão, permissões e o SDR do rodízio; a lista marca v2", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/inbound/${ctx.webhookId}`, { waitUntil: "domcontentloaded" });
    const overview = page.getByTestId("inbound-overview");
    await expect(overview).toBeVisible({ timeout: 30_000 });
    await expect(overview).toContainText("Versão 2");
    await expect(overview).toContainText("Criar leads");
    await expect(overview).toContainText("Agendar reuniões");
    await expect(overview.getByText("Próximo lead")).toBeVisible({ timeout: 30_000 });
    await expect(overview.getByRole("link", { name: /Criar webhook v2/ })).toHaveCount(0);

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/inbound`, { waitUntil: "domcontentloaded" });
    const row = page.getByRole("row", { name: new RegExp(WEBHOOK_NAME) });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText("v2", { exact: true })).toBeVisible();
  });

  test("T-11.23: o detalhe de um v1 não oferece troca de versão, só criar um v2 a partir dele", async ({ page, context }) => {
    const response = await context.request.post("/api/v1/integrations/webhooks", {
      data: { direction: "inbound", name: V1_NAME, tokenMode: "auto", expiryMode: "months_6" },
    });
    expect(response.status(), await response.text()).toBe(201);
    const v1Id = (await response.json()).result.id as string;

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/inbound/${v1Id}`, { waitUntil: "domcontentloaded" });
    const overview = page.getByTestId("inbound-overview");
    await expect(overview).toContainText("Versão 1 (descontinuada)", { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: "Guia" })).toHaveCount(0);
    const createV2 = overview.getByRole("link", { name: /Criar webhook v2 a partir deste/ });
    await expect(createV2).toHaveAttribute("href", /\/inbound\/new\?from_name=/);

    await createV2.click();
    await expect(page.locator("#inbound-v2-name")).toHaveValue(`${V1_NAME} (v2)`, { timeout: 30_000 });
  });

  test("a aba Guia lista os códigos de resultado e os links do contrato", async ({ page }) => {
    await openGuideTab(page);
    const guide = page.getByTestId("inbound-v2-guide");
    await expect(guide.getByRole("heading", { name: "Resultado de cada evento (aba Logs)" })).toBeVisible();
    await expect(guide.getByRole("cell", { name: "schedule_conflict_flagged", exact: true })).toBeVisible();
    await expect(guide.getByRole("link", { name: /OpenAPI 3.1/ })).toHaveAttribute("href", "/api/studio/v1/openapi.json");
    await expect(guide.getByRole("link", { name: "JSON Schema do evento" })).toHaveAttribute("href", "/api/webhooks/studio/v2/schema");
  });

  test("catálogo de API: o guia mostra a ordem de uso, o exemplo de resposta e as respostas", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/api-catalog`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Como usar" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Exemplo de resposta")).toContainText("slot_minutes");
    await expect(page.getByText("date_out_of_range")).toBeVisible();
    await expect(page.getByRole("link", { name: "webhook v2" })).toHaveAttribute(
      "href",
      `/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks`,
    );
  });
});

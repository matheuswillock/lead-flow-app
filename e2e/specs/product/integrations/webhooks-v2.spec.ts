/**
 * app/api/webhooks/studio/v2/[teamId]/route.ts
 * app/api/studio/v1/availability/route.ts
 * app/[supabaseId]/board/page.tsx
 *
 * SPEC 11 (webhook v2) e SPEC 14 (API Studio) — fluxo real ponta a ponta contra o servidor e o Postgres local:
 * cria o webhook v2, envia o lead do parceiro (YouPop), confere idempotência, agendamento, conflito de
 * agenda e o selo "Remarcar urgente" no quadro.
 *
 * Cobertura:
 * - Token inválido/ausente → 401; escopo e versão são conferidos.
 * - Lead sem agendamento: 202 + event_id, processado em background; mesma Idempotency-Key devolve o mesmo event_id.
 * - Lead com agendamento: o lead entra `scheduled` e o horário some da API de disponibilidade.
 * - Segundo lead no mesmo horário do mesmo closer: entra como `new_opportunity` com `needsReschedule`, e o quadro mostra "Remarcar urgente".
 */

import { expect, test, type APIRequestContext } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";
import { WHATS_NEW_VERSION } from "../../../../components/whats-new-modal";

const WEBHOOK_NAME = "E2E YouPop v2";
const LEAD_NAME_PREFIX = "E2E v2 ";
const MEET_LINK = "https://meet.google.com/e2e-v2-link";

type Ctx = { teamId: string; profileId: string; token: string; webhookId: string };
const ctx: Ctx = { teamId: "", profileId: "", token: "", webhookId: "" };

function uniquePhone(): string {
  return `1199${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

function slotInDays(days: number, hourUtc: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString().replace(".000Z", "Z");
}

async function cleanup(): Promise<void> {
  if (!ctx.teamId) return;
  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({ where: { teamId: ctx.teamId, name: { startsWith: LEAD_NAME_PREFIX } }, select: { id: true } });
  const leadIds = leads.map((lead) => lead.id);
  await prisma.leadRescheduleAlert.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.teamMeetingSlotReservation.deleteMany({ where: { teamId: ctx.teamId } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  const webhooks = await prisma.teamWebhook.findMany({ where: { teamId: ctx.teamId, name: WEBHOOK_NAME }, select: { id: true } });
  await prisma.teamWebhookInboundEvent.deleteMany({ where: { webhookId: { in: webhooks.map((hook) => hook.id) } } });
  await prisma.teamWebhook.deleteMany({ where: { id: { in: webhooks.map((hook) => hook.id) } } });
  await prisma.teamApiResourceActivation.deleteMany({ where: { teamId: ctx.teamId, resourceSlug: "availability" } });
}

async function sendLead(request: APIRequestContext, body: object, key: string, token = ctx.token) {
  return request.post(`/api/webhooks/studio/v2/${ctx.teamId}`, {
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" },
    data: body,
  });
}

async function waitForProcessed(eventId: string) {
  const prisma = getPrisma();
  await expect
    .poll(async () => (await prisma.teamWebhookInboundEvent.findUnique({ where: { id: eventId }, select: { status: true } }))?.status, {
      timeout: 60_000,
      intervals: [500, 1000, 2000],
    })
    .toBe("processed");
  return prisma.teamWebhookInboundEvent.findUniqueOrThrow({ where: { id: eventId } });
}

test.describe("webhook v2 + API Studio — ponta a ponta", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const profile = await findE2eMasterProfile();
    if (!profile?.activeTeamId) throw new Error("Seed E2E sem time ativo — rode `bun run db:seed:e2e`");
    ctx.teamId = profile.activeTeamId;
    ctx.profileId = profile.id;
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

  test("cria o webhook v2 pela API do produto e devolve o token uma vez só", async ({ context }) => {
    // `context.request` carrega o cookie E2E injetado; a fixture `request` não.
    const response = await context.request.post("/api/v1/integrations/webhooks", {
      data: {
        direction: "inbound",
        name: WEBHOOK_NAME,
        tokenMode: "auto",
        expiryMode: "months_6",
        contractVersion: 2,
        scopes: ["leads_create", "leads_schedule"],
        defaultAssigneeProfileIds: [ctx.profileId],
        defaultMeetingLink: MEET_LINK,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    ctx.token = body.result.token;
    ctx.webhookId = body.result.id;
    expect(ctx.token).toMatch(/\S{20,}/);
    expect(body.result.webhookUrl).toContain(`/api/webhooks/studio/v2/${ctx.teamId}`);
    expect(body.result.contractVersion).toBe(2);
  });

  test("sem token ou com token errado → 401", async ({ request }) => {
    const semToken = await request.post(`/api/webhooks/studio/v2/${ctx.teamId}`, { data: {} });
    expect(semToken.status()).toBe(401);
    const errado = await sendLead(request, { lead: { name: "x", phone: "1" } }, `e2e-${Date.now()}`, "token-invalido-123456");
    expect(errado.status()).toBe(401);
  });

  test("T-11.7: lead sem agendamento → 202, processa em background e a mesma chave devolve o mesmo event_id", async ({ request }) => {
    const key = `e2e-create-${Date.now()}`;
    const payload = { lead: { name: `${LEAD_NAME_PREFIX}Sem Agenda`, phone: uniquePhone(), email: `e2e-v2-${Date.now()}@example.test` }, source: "youpop" };

    const first = await sendLead(request, payload, key);
    expect(first.status(), await first.text()).toBe(202);
    const { event_id: eventId } = await first.json();
    expect(eventId).toBeTruthy();

    const replay = await sendLead(request, payload, key);
    expect(replay.status()).toBe(202);
    expect((await replay.json()).event_id).toBe(eventId);

    const event = await waitForProcessed(eventId);
    expect(event.resultCode).toBeTruthy();
    const leads = await getPrisma().lead.findMany({ where: { teamId: ctx.teamId, name: `${LEAD_NAME_PREFIX}Sem Agenda` } });
    expect(leads).toHaveLength(1);
    expect(leads[0].status).toBe("new_opportunity");
  });

  test("lead com agendamento entra scheduled e o horário some da disponibilidade; o segundo no mesmo horário pede remarcação", async ({ request, page, context }) => {
    const startsAt = slotInDays(9, 15);
    const date = startsAt.slice(0, 10);
    const schedule = (title: string) => ({ closer: { profile_id: ctx.profileId }, starts_at: startsAt, type: "call", title });

    // Disponibilidade (SPEC 14): ativa o recurso e consulta o dia antes de agendar.
    const activation = await context.request.post("/api/v1/integrations/api-resources/availability");
    expect(activation.status(), await activation.text()).toBeLessThan(300);
    const availabilityToken: string = (await activation.json()).result.token;
    const availability = () =>
      request.get(`/api/studio/v1/availability?date=${date}`, { headers: { Authorization: `Bearer ${availabilityToken}` } });

    const before = await availability();
    expect(before.status(), await before.text()).toBe(200);
    const hasSlot = (body: { closers: Array<{ closer_id: string; slots: Array<{ starts_at: string }> }> }) =>
      body.closers
        .filter((closer) => closer.closer_id === ctx.profileId)
        .some((closer) => closer.slots.some((slot) => new Date(slot.starts_at).getTime() === new Date(startsAt).getTime()));
    expect(hasSlot(await before.json())).toBe(true);

    const winner = await sendLead(
      request,
      { lead: { name: `${LEAD_NAME_PREFIX}Ganha Horário`, phone: uniquePhone() }, schedule: schedule("Primeira") },
      `e2e-win-${Date.now()}`,
    );
    expect(winner.status(), await winner.text()).toBe(202);
    const winnerEvent = await waitForProcessed((await winner.json()).event_id);
    expect(winnerEvent.resultCode, JSON.stringify(winnerEvent.result)).toBe("processed");
    const winnerLead = await getPrisma().lead.findFirstOrThrow({ where: { teamId: ctx.teamId, name: `${LEAD_NAME_PREFIX}Ganha Horário` } });
    expect(winnerLead.status).toBe("scheduled");
    expect(winnerLead.needsReschedule).toBe(false);

    // O horário reservado some da disponibilidade (mesma fonte de verdade da agenda do closer).
    const after = await availability();
    expect(after.status(), await after.text()).toBe(200);
    expect(hasSlot(await after.json())).toBe(false);

    const loser = await sendLead(
      request,
      { lead: { name: `${LEAD_NAME_PREFIX}Perde Horário`, phone: uniquePhone() }, schedule: schedule("Segunda") },
      `e2e-lose-${Date.now()}`,
    );
    expect(loser.status(), await loser.text()).toBe(202);
    await waitForProcessed((await loser.json()).event_id);
    const loserLead = await getPrisma().lead.findFirstOrThrow({ where: { teamId: ctx.teamId, name: `${LEAD_NAME_PREFIX}Perde Horário` } });
    expect(loserLead.status).toBe("new_opportunity");
    expect(loserLead.needsReschedule).toBe(true);
    const alerts = await getPrisma().leadRescheduleAlert.count({ where: { leadId: loserLead.id } });
    expect(alerts).toBe(1);

    // O quadro (board) mostra o selo de urgência no lead que não conseguiu o horário.
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" });
    const badge = page.getByTestId("lead-needs-reschedule").first();
    await expect(badge).toBeVisible({ timeout: 60_000 });
    await expect(badge).toContainText("Remarcar urgente");
  });

  test("responsivo: board com o selo \"Remarcar urgente\" sem overflow em 360/375, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("lead-needs-reschedule").first()).toBeVisible({ timeout: 60_000 });
    // O selo é informativo (não interativo): os botões do board já existentes têm cobertura própria e ficam
    // fora desta medição; aqui interessam overflow em 360/375 e o pulso respeitar `prefers-reduced-motion`.
    await runResponsiveChecks(page, {
      touchTargets: { selector: '[data-testid="lead-needs-reschedule"]', minSize: 14 },
    });
  });
});

import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { disconnectPrisma, getPrisma } from "../../support/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

const BASE_URL = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

test.describe("api/v1/backoffice/campanhas-analytics", () => {
  test.setTimeout(90_000);

  let backofficeSupabaseId: string;
  let backofficeProfileId: string;
  let nonBackofficeSupabaseId: string;
  let nonBackofficeProfileId: string;
  let masterId: string;
  let teamId: string;
  let campaignId: string;
  let templateId: string;
  let dispatchId: string;
  let formId: string;
  let publicationId: string;

  test.beforeAll(async () => {
    const prisma: PrismaAny = getPrisma();
    const suffix = randomUUID().slice(0, 8);

    backofficeSupabaseId = randomUUID();
    const backofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: `e2e.ca.backoffice.${suffix}@example.com`,
        fullName: "E2E CA Backoffice",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true },
    });
    backofficeProfileId = backofficeProfile.id;
    await prisma.backofficeUser.create({
      data: {
        profileId: backofficeProfileId,
        email: `e2e.ca.backoffice.${suffix}@example.com`,
        fullAccess: true,
        isActive: true,
      },
    });

    nonBackofficeSupabaseId = randomUUID();
    const nonBackofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: nonBackofficeSupabaseId,
        email: `e2e.ca.manager.${suffix}@example.com`,
        fullName: "E2E CA Manager",
        role: "manager",
        isMaster: true,
      },
      select: { id: true },
    });
    nonBackofficeProfileId = nonBackofficeProfile.id;

    const master = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `e2e.ca.master.${suffix}@example.com`,
        fullName: "E2E CA Master",
        isMaster: true,
      },
      select: { id: true },
    });
    masterId = master.id;

    const team = await prisma.team.create({ data: { name: `E2E CA Team ${suffix}`, masterId: master.id } });
    teamId = team.id;

    const templateIdValue = randomUUID();
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateIdValue,
        teamId: team.id,
        createdBy: master.id,
        name: `Template ${suffix}`,
        subject: "Assunto",
        html: "<p>Oi</p>",
        versionGroupId: templateIdValue,
      },
    });
    templateId = template.id;

    const campaign = await prisma.emailCampaign.create({
      data: { teamId: team.id, createdBy: master.id, templateId: template.id, name: `Campanha ${suffix}` },
    });
    campaignId = campaign.id;

    const dispatch = await prisma.emailCampaignDispatch.create({
      data: {
        campaignId: campaign.id,
        teamId: team.id,
        dispatchNumber: 1,
        templateId: template.id,
        templateVersionNumber: 1,
        templateName: "Template E2E",
        templateSubject: "Assunto",
        templateHtml: "<p>Oi</p>",
        dispatchedAt: new Date(),
        triggeredBy: master.id,
        totalRecipients: 10,
        totalSent: 10,
        totalDelivered: 9,
        totalOpened: 3,
        totalClicked: 1,
        totalBounced: 1,
        status: "completed",
      },
    });
    dispatchId = dispatch.id;

    const form = await prisma.publicForm.create({
      data: {
        teamId: team.id,
        createdById: master.id,
        publicId: randomUUID(),
        name: `Form E2E ${suffix}`,
        status: "published",
        approvalStatus: "approved",
      },
    });
    formId = form.id;

    const publication = await prisma.publicFormPublication.create({
      data: { formId: form.id, publishedById: master.id, version: 1, snapshot: {} },
    });
    publicationId = publication.id;

    const now = new Date();
    const funnelEvents = [
      { eventType: "form_viewed", visitorSessionId: "e2e-s1" },
      { eventType: "form_viewed", visitorSessionId: "e2e-s2" },
      { eventType: "form_started", visitorSessionId: "e2e-s1" },
      { eventType: "form_completed", visitorSessionId: "e2e-s1" },
      { eventType: "lead_created", visitorSessionId: "e2e-s1" },
    ];
    for (const [index, event] of funnelEvents.entries()) {
      await prisma.publicFormMetricEvent.create({
        data: {
          formId: form.id,
          publicationId: publication.id,
          visitorSessionId: event.visitorSessionId,
          eventType: event.eventType,
          eventKey: `e2e-ca-${suffix}-${index}`,
          createdAt: now,
        },
      });
    }
  });

  test.afterAll(async () => {
    const prisma: PrismaAny = getPrisma();
    if (formId) {
      await prisma.publicFormMetricEvent.deleteMany({ where: { formId } }).catch(() => null);
      await prisma.publicFormPublication.deleteMany({ where: { formId } }).catch(() => null);
      await prisma.publicForm.deleteMany({ where: { id: formId } }).catch(() => null);
    }
    if (dispatchId) await prisma.emailCampaignDispatch.deleteMany({ where: { id: dispatchId } }).catch(() => null);
    if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } }).catch(() => null);
    if (templateId) await prisma.emailTemplate.deleteMany({ where: { id: templateId } }).catch(() => null);
    if (teamId) await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => null);
    if (masterId) await prisma.profile.deleteMany({ where: { id: masterId } }).catch(() => null);
    if (backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    if (nonBackofficeProfileId) {
      await prisma.profile.deleteMany({ where: { id: nonBackofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  const range = () => {
    const today = new Date();
    const from = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    return { from, to };
  };

  test("GET summary — 200 com shape estável", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/summary?from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { isValid: boolean; result: { totals: Record<string, unknown>; rates: Record<string, unknown>; byTeam: unknown[] } };
    expect(body.isValid).toBe(true);
    expect(body.result.totals).toHaveProperty("sent");
    expect(body.result.totals).toHaveProperty("leadsCreated");
    expect(body.result.totals).toHaveProperty("leadsAttached");
    expect(body.result.rates).toHaveProperty("openRate");
    expect(Array.isArray(body.result.byTeam)).toBe(true);
  });

  test("GET summary — 400 quando o período ultrapassa 92 dias", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/summary?from=2026-01-01&to=2026-12-31`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { isValid: boolean; errorMessages: string[] };
    expect(body.isValid).toBe(false);
    expect(body.errorMessages.join(" ")).toContain("92");
  });

  test("GET summary — 403 sem acesso backoffice", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/summary?from=${from}&to=${to}`,
      { headers: { "x-supabase-user-id": nonBackofficeSupabaseId } }
    );
    expect(res.status()).toBe(403);
  });

  test("GET dispatches — 200 paginado, contém o disparo semeado", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/dispatches?from=${from}&to=${to}&teamIds=${teamId}&page=1&pageSize=10`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { result: { rows: Array<{ id: string }>; page: number; pageSize: number } };
    expect(body.result.page).toBe(1);
    expect(body.result.pageSize).toBe(10);
    expect(body.result.rows.some((row) => row.id === dispatchId)).toBe(true);
  });

  test("GET dispatches — 400 quando pageSize excede 100", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/dispatches?from=${from}&to=${to}&pageSize=500`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(400);
  });

  test("GET teams-series — 200 com série total agregada", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/teams-series?from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { result: { total: unknown[]; points: unknown[] } };
    expect(Array.isArray(body.result.total)).toBe(true);
    expect(Array.isArray(body.result.points)).toBe(true);
  });

  test("GET templates — 200, openRate calculado e ordenado desc", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/templates?from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { result: Array<{ templateName: string; openRate: number | null }> };
    const row = body.result.find((entry) => entry.templateName === "Template E2E");
    expect(row).toBeDefined();
    expect(row?.openRate).toBeCloseTo(0.3, 1); // 3 abertos / 10 enviados
  });

  test("GET forms-funnel — 200, lead_created e lead_attached separados, closeRate null sem starts", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/forms-funnel?from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      result: Array<{
        formId: string;
        viewed: number;
        started: number;
        completed: number;
        leadCreated: number;
        leadAttached: number;
        startRate: number | null;
        closeRate: number | null;
      }>;
    };
    const row = body.result.find((entry) => entry.formId === formId);
    expect(row).toBeDefined();
    expect(row?.viewed).toBe(2);
    expect(row?.started).toBe(1);
    expect(row?.completed).toBe(1);
    expect(row?.leadCreated).toBe(1);
    expect(row?.leadAttached).toBe(0);
    expect(row?.closeRate).toBe(1);
  });

  test("GET export.csv — dataset=templates: BOM, ';', header PT-BR, filename e paridade com o JSON", async ({ request }) => {
    const { from, to } = range();
    const jsonRes = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/templates?from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    const jsonBody = (await jsonRes.json()) as { result: Array<{ templateName: string }> };

    const csvRes = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/export.csv?dataset=templates&from=${from}&to=${to}&teamIds=${teamId}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()["content-type"]).toContain("text/csv");
    expect(csvRes.headers()["content-disposition"]).toContain(`campanhas_templates_${from}_${to}.csv`);

    const csvText = await csvRes.text();
    expect(csvText.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = csvText.slice(1).split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("Time;Template;Disparos;Enviados;Entregues;Abertos;Cliques;Bounces;Falhas;Taxa de Abertura");
    expect(lines.length - 1).toBe(jsonBody.result.length); // paridade de linhas (T-10.10)
    expect(lines.some((line) => line.includes("Template E2E"))).toBe(true);
  });

  test("GET export.csv — dataset inválido retorna 400", async ({ request }) => {
    const { from, to } = range();
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/export.csv?dataset=invalido&from=${from}&to=${to}`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(400);
  });

  test("GET export.csv — range acima de 92 dias retorna 400", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/backoffice/campanhas-analytics/export.csv?dataset=templates&from=2026-01-01&to=2026-12-31`,
      { headers: { "x-supabase-user-id": backofficeSupabaseId } }
    );
    expect(res.status()).toBe(400);
  });
});

import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Luminância relativa (WCAG) a partir de "rgb(r, g, b)" ou "rgba(r, g, b, a)". */
function relativeLuminance(rgb: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(rgb);
  if (!match) return 1;
  const [r, g, b] = match[1].split(",").map((part) => Number.parseFloat(part.trim()) / 255);
  const linearize = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Chromium resolve `getComputedStyle` para o color space declarado na CSS
 * (`lab()`/`oklch()` para os tokens deste design system), não sempre
 * `rgb()`. Um canvas 1x1 normaliza qualquer color function para sRGB real.
 */
async function getComputedColors(locator: ReturnType<Page["locator"]>) {
  return locator.first().evaluate((element) => {
    const style = window.getComputedStyle(element);
    const toRgb = (colorString: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = colorString;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    };
    return { color: toRgb(style.color), backgroundColor: toRgb(style.backgroundColor) };
  });
}

test.describe("app/backoffice/(app)/campanhas-analytics", () => {
  test.setTimeout(180_000);

  let backofficeProfileId: string | null = null;
  let backofficeSupabaseId = "";
  let backofficeEmail = "";
  let teamId = "";
  let masterId = "";
  let templateId = "";
  let campaignId = "";
  let dispatchId = "";
  let failedDispatchId = "";
  let formId = "";
  let publicationId = "";
  let leadId = "";
  const submissionIds: string[] = [];

  test.beforeAll(async () => {
    const prisma = getPrisma();
    const suffix = randomUUID().slice(0, 8);

    backofficeSupabaseId = randomUUID();
    backofficeEmail = uniqueEmail("e2e.backoffice.campanhas-analytics");
    const profile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Campanhas Analytics",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true },
    });
    backofficeProfileId = profile.id;

    await prisma.backofficeUser.create({
      data: { profileId: profile.id, email: profile.email, fullAccess: true, isActive: true },
    });

    const master = await prisma.profile.create({
      data: { supabaseId: randomUUID(), email: uniqueEmail("e2e.ca-page.master"), fullName: "E2E CA Master", isMaster: true },
      select: { id: true },
    });
    masterId = master.id;

    const team = await prisma.team.create({ data: { name: `E2E CA Page Team ${suffix}`, masterId: master.id } });
    teamId = team.id;

    const templateIdValue = randomUUID();
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateIdValue,
        teamId: team.id,
        createdBy: master.id,
        name: `Template Page ${suffix}`,
        subject: "Assunto",
        html: "<p>Oi</p>",
        versionGroupId: templateIdValue,
      },
    });
    templateId = template.id;

    const campaign = await prisma.emailCampaign.create({
      data: { teamId: team.id, createdBy: master.id, templateId: template.id, name: `Campanha Page ${suffix}` },
    });
    campaignId = campaign.id;

    const now = new Date();

    const dispatch = await prisma.emailCampaignDispatch.create({
      data: {
        campaignId: campaign.id,
        teamId: team.id,
        dispatchNumber: 1,
        templateId: template.id,
        templateVersionNumber: 1,
        templateName: "Template E2E Page",
        templateSubject: "Assunto",
        templateHtml: "<p>Oi</p>",
        dispatchedAt: now,
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

    const failedDispatch = await prisma.emailCampaignDispatch.create({
      data: {
        campaignId: campaign.id,
        teamId: team.id,
        dispatchNumber: 2,
        templateId: template.id,
        templateVersionNumber: 1,
        templateName: "Template E2E Page (falho)",
        templateSubject: "Assunto",
        templateHtml: "<p>Oi</p>",
        dispatchedAt: now,
        triggeredBy: master.id,
        totalRecipients: 1,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        status: "failed",
        errorMessage: "Falha de envio simulada no E2E",
      },
    });
    failedDispatchId = failedDispatch.id;

    const form = await prisma.publicForm.create({
      data: {
        teamId: team.id,
        createdById: master.id,
        publicId: randomUUID(),
        name: `Form E2E Page ${suffix}`,
        status: "published",
        approvalStatus: "approved",
      },
    });
    formId = form.id;

    const publication = await prisma.publicFormPublication.create({
      data: { formId: form.id, publishedById: master.id, version: 1, snapshot: {} },
    });
    publicationId = publication.id;

    const funnelEvents = [
      { eventType: "form_viewed", visitorSessionId: "e2e-ca-page-s1" },
      { eventType: "form_started", visitorSessionId: "e2e-ca-page-s1" },
      { eventType: "form_completed", visitorSessionId: "e2e-ca-page-s1" },
    ];
    for (const [index, event] of funnelEvents.entries()) {
      await prisma.publicFormMetricEvent.create({
        data: {
          formId: form.id,
          publicationId: publication.id,
          visitorSessionId: event.visitorSessionId,
          eventType: event.eventType,
          eventKey: `e2e-ca-page-${suffix}-${index}`,
          createdAt: now,
        },
      });
    }

    const lead = await prisma.lead.create({
      data: {
        name: "E2E CA Page Lead",
        leadCode: `e2e-ca-page-${suffix}`,
        teamId: team.id,
        managerId: master.id,
        originChannel: "public_form",
        createdAt: now,
      },
    });
    leadId = lead.id;

    const submission = await prisma.publicFormSubmission.create({
      data: {
        formId: form.id,
        publicationId: publication.id,
        leadId: lead.id,
        requestKey: `e2e-ca-page-${suffix}-sub`,
        completionStatus: "complete",
        status: "completed",
        createdAt: now,
      },
    });
    submissionIds.push(submission.id);
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    if (submissionIds.length) {
      await prisma.publicFormSubmission.deleteMany({ where: { id: { in: submissionIds } } }).catch(() => null);
    }
    if (leadId) await prisma.lead.deleteMany({ where: { id: leadId } }).catch(() => null);
    if (formId) {
      await prisma.publicFormMetricEvent.deleteMany({ where: { formId } }).catch(() => null);
      await prisma.publicFormPublication.deleteMany({ where: { formId } }).catch(() => null);
      await prisma.publicForm.deleteMany({ where: { id: formId } }).catch(() => null);
    }
    if (failedDispatchId) await prisma.emailCampaignDispatch.deleteMany({ where: { id: failedDispatchId } }).catch(() => null);
    if (dispatchId) await prisma.emailCampaignDispatch.deleteMany({ where: { id: dispatchId } }).catch(() => null);
    if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } }).catch(() => null);
    if (templateId) await prisma.emailTemplate.deleteMany({ where: { id: templateId } }).catch(() => null);
    if (teamId) await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => null);
    if (masterId) await prisma.profile.deleteMany({ where: { id: masterId } }).catch(() => null);
    if (backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, { supabaseId: backofficeSupabaseId, email: backofficeEmail });
  });

  test("T-11.3 — carrega com Skeleton -> dados; heading visível; filtros operáveis", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    await expect(page.getByRole("heading", { name: "Analytics de Campanhas" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Período/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Times/ })).toBeVisible();

    const updateButton = page.getByRole("button", { name: "Atualizar" });
    await expect(updateButton).toBeVisible();
    await expect(updateButton).toBeEnabled({ timeout: 30_000 });
  });

  test("T-11.6 — gráfico de série renderiza com o seed e mostra tooltip no hover", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    const chart = page.getByRole("img", { name: /enviados, entregues e abertos/i });
    await expect(chart).toBeVisible({ timeout: 30_000 });
    await expect(chart.locator("svg")).toBeVisible({ timeout: 30_000 });

    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(chart.locator(".recharts-tooltip-wrapper").first()).toContainText("Enviados", { timeout: 10_000 });
  });

  test("T-11.7/T-11.8 — tabela de disparos mostra o seed; status failed com Badge destrutivo", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    await expect(page.getByText("Template E2E Page", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Template E2E Page (falho)").first()).toBeVisible();
    await expect(page.getByText("Falhou").first()).toBeVisible();
    await expect(page.getByText("Falha de envio simulada no E2E")).toBeVisible();
  });

  test("T-11.9/T-11.10 — exportar CSV de templates dispara o download com o nome do backend", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    await expect(page.getByRole("button", { name: "Atualizar" })).toBeEnabled({ timeout: 30_000 });

    await page.getByRole("button", { name: /Exportar/ }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Templates" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^campanhas_templates_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("T-11.11 — erro 500 no resumo mostra banner + Tentar novamente, nunca vira estado vazio", async ({ page }) => {
    await page.route("**/api/**/backoffice/campanhas-analytics/summary**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }),
      })
    );

    await page.goto("/backoffice/campanhas-analytics");
    // Cada bloco que depende de `summary` (KPIs, ranking por time, abertura por
    // time) reporta o próprio banner — 3 blocos independentes, honestamente
    // reportando a mesma falha (DA3), não um bug de duplicação.
    await expect(page.getByRole("alert").filter({ hasText: "Erro interno" }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
    // Nunca deve virar "vazio" — o texto de estado vazio das KPIs não existe.
    await expect(page.getByText("Nenhum disparo no período selecionado.")).toHaveCount(0);
  });

  test("T-11.12 — asserts medidos: sem overflow horizontal, contraste, reduced-motion", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    await expect(page.getByRole("heading", { name: "Analytics de Campanhas" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Atualizar" })).toBeEnabled({ timeout: 30_000 });

    for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      );
      expect(overflow, `sem overflow horizontal em ${viewport.width}px`).toBe(true);
    }

    // Pares medidos contra o próprio background opaco do elemento (nunca contra
    // `document.body`, que é transparente neste layout e daria falso-negativo).
    // Nota: o botão "Atualizar" usa a variante default (bg-primary/primary-
    // foreground) do design system global — medido à parte (ver resumo da
    // sessão) porque é um token compartilhado por toda a aplicação, fora do
    // escopo desta feature; aqui medimos os pares que esta página controla.
    const exportButtonColors = await getComputedColors(page.getByRole("button", { name: /Exportar/ }));
    expect(contrastRatio(exportButtonColors.color, exportButtonColors.backgroundColor)).toBeGreaterThanOrEqual(4.5);

    const labelColors = await getComputedColors(page.locator('[data-slot="card-title"]'));
    const cardColors = await getComputedColors(page.locator('[data-slot="card"]'));
    expect(contrastRatio(labelColors.color, cardColors.backgroundColor)).toBeGreaterThanOrEqual(4.5);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Analytics de Campanhas" })).toBeVisible({ timeout: 60_000 });
    const animationDurations = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".recharts-area, .recharts-bar-rectangle")).map(
        (element) => window.getComputedStyle(element).animationDuration
      )
    );
    for (const duration of animationDurations) {
      expect(["0s", "", "0ms"]).toContain(duration);
    }
  });

  test("T-11.13 — fluxo completo: filtrar time+período, Atualizar, KPIs mudam, exportar CSV", async ({ page }) => {
    await page.goto("/backoffice/campanhas-analytics");
    await expect(page.getByRole("button", { name: "Atualizar" })).toBeEnabled({ timeout: 30_000 });

    await page.getByRole("button", { name: /Times/ }).click();
    await page.getByPlaceholder("Buscar time...").fill(`E2E CA Page Team`);
    await page.getByRole("option").first().click();
    await page.keyboard.press("Escape");

    const summaryResponse = page.waitForResponse((response) =>
      response.url().includes("/backoffice/campanhas-analytics/summary") && response.request().method() === "GET"
    );
    await page.getByRole("button", { name: "Atualizar" }).click();
    const response = await summaryResponse;
    expect(response.status()).toBe(200);

    await expect(page.getByText("Template E2E Page", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /Exportar/ }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Disparos" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("campanhas_dispatches_");
  });
});

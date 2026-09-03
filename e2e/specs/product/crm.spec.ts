import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { assertNoHorizontalOverflow, runResponsiveChecks } from "../../support/responsive";

const LAYOUT_LEAD_ID = "e2e20000-0000-4000-8000-000000000301";
const LAYOUT_LEAD_CODE = "E2ELEADLAYOUT001";
const LAYOUT_LEAD_NAME = "Lead Layout Dialog E2E";

async function seedLayoutLead() {
  const prisma = getPrisma();
  const profile = await findE2eMasterProfile();
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
  if (!profile.activeTeamId) throw new Error("Team E2E não encontrado");
  const teamId = profile.activeTeamId;

  await prisma.lead.deleteMany({ where: { id: LAYOUT_LEAD_ID } });
  await prisma.lead.create({
    data: {
      id: LAYOUT_LEAD_ID,
      leadCode: LAYOUT_LEAD_CODE,
      managerId: profile.id,
      teamId,
      status: "new_opportunity",
      name: LAYOUT_LEAD_NAME,
      createdBy: profile.id,
      updatedBy: profile.id,
    },
  });
  await prisma.leadActivity.createMany({
    data: Array.from({ length: 6 }, (_, index) => ({
      leadId: LAYOUT_LEAD_ID,
      type: "note" as const,
      body: `Atividade de layout ${index + 1}`,
      createdBy: profile.id,
      createdAt: new Date(Date.now() - index * 60_000),
    })),
  });

  return { profile, teamId };
}

test.describe("app/[supabaseId]/crm", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile();
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull();
    await injectE2eAuthCookie(context);
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION }
    );
  });

  test.afterAll(async () => {
    await getPrisma().lead.deleteMany({ where: { id: LAYOUT_LEAD_ID } });
    await disconnectPrisma();
  });

  test("carrega o CRM autenticado sem assinatura inativa", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm`);

    await expect(page.locator("h1.text-2xl", { hasText: "CRM" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Assinatura Inativa")).toHaveCount(0);
    await expect(page.getByText("Sem Acesso à Plataforma")).toHaveCount(0);
  });

  test("responsividade mobile-first do CRM", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm`);
    await expect(page.locator("h1.text-2xl", { hasText: "CRM" })).toBeVisible({
      timeout: 30_000,
    });
    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page);
  });

  test("paginação da tabela cabe no viewport de 360px", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm?view=pipeline`);

    // Espera a tabela REAL (não o skeleton de loading) — a paginação só conta
    // quando renderizada de verdade.
    await expect(page.getByText("Linhas por página")).toBeVisible({ timeout: 30_000 });

    // Overflow de página medido com a tabela renderizada (helper compartilhado).
    await assertNoHorizontalOverflow(page, [360]);

    // A linha de paginação usa justify-end: quando o conteúdo excede a largura,
    // ele vaza pela ESQUERDA — o que não aumenta scrollWidth e passa batido no
    // assert de página. Medir o bounding box de cada controle pega esse caso.
    const controls = [
      page.getByLabel("Linhas por página"),
      page.getByText(/Página \d+ de \d+/),
      page.getByRole("button", { name: "Ir para primeira página" }),
      page.getByRole("button", { name: "Página anterior" }),
      page.getByRole("button", { name: "Próxima página" }),
      page.getByRole("button", { name: "Ir para última página" }),
    ];
    const viewportWidth = 360;
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box, "controle de paginação sem bounding box").not.toBeNull();
      expect(
        box!.x,
        `controle vazando pela esquerda em ${viewportWidth}px (x=${Math.round(box!.x)})`
      ).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `controle vazando pela direita em ${viewportWidth}px`
      ).toBeLessThanOrEqual(viewportWidth + 1);
    }
  });

  test("dialog do lead mantém timeline, chips e composer visíveis em 1280×800", async ({ page }) => {
    // 150s: o poll de convergência do cache (até ~75s, ver abaixo) + as
    // interações do dialog não cabem com folga nos 90s padrão.
    test.setTimeout(150_000);
    await seedLayoutLead();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm`);

    // A listagem de leads vem de "use cache" com SWR (stale 30 / revalidate 60,
    // ver getCachedTeamLeads) e o seed direto via Prisma NÃO invalida a tag
    // team-leads: quando os testes anteriores visitaram o CRM, a primeira
    // navegação daqui recebe a lista vazia cacheada e o lead seedado nunca
    // aparece (flaky que só o retry da CI salvava). O fetch em si dispara a
    // revalidação em background — recarregar até o lead aparecer converge em
    // poucos segundos.
    const seededLeadCell = page.getByText(LAYOUT_LEAD_NAME).first();
    await expect(async () => {
      if ((await seededLeadCell.count()) === 0) {
        await page.reload({ waitUntil: "domcontentloaded" });
      }
      await expect(seededLeadCell).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 75_000 });

    await seededLeadCell.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Editar Lead")).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("Informações do lead")).toBeVisible();

    const composerButton = dialog.getByRole("button", { name: "Adicionar atividade" });
    await expect(composerButton).toBeVisible({ timeout: 30_000 });

    // Composer inteiro dentro do viewport — a regressão histórica era ele ser
    // empurrado para fora quando o painel excedia a altura do dialog.
    const composerBox = await composerButton.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(800);

    // Timeline é a dona do scroll vertical e recebe a altura sobrando.
    const timelineScroll = dialog.locator(".activity-scrollbar.overflow-y-auto").first();
    await expect(timelineScroll).toBeVisible();
    const timelineHeight = await timelineScroll.evaluate((el) => el.clientHeight);
    expect(timelineHeight).toBeGreaterThanOrEqual(200);

    // Chips de filtro em UMA linha (scroll horizontal, sem wrap).
    const chipsRow = dialog.getByRole("group").filter({ hasText: "Todas" }).first();
    const chips = await chipsRow.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(chips.clientHeight).toBeLessThan(48);
    expect(chips.scrollWidth).toBeGreaterThan(chips.clientWidth);
  });
});

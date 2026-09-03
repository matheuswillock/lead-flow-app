import { expect, test, type APIRequestContext } from "@playwright/test";
import { injectE2eAuthCookie, signE2eSessionToken } from "../../fixtures/auth";
import { E2E_COOKIE_NAME, E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks } from "../../support/responsive";

const LAYOUT_LEAD_ID = "e2e20000-0000-4000-8000-000000000301";
const LAYOUT_LEAD_CODE = "E2ELEADLAYOUT001";
const LAYOUT_LEAD_NAME = "Lead Layout Dialog E2E";

async function seedLayoutLead(request: APIRequestContext) {
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

  // A listagem do CRM vem de `getCachedTeamLeads` ("use cache", revalidate 60s):
  // o teste anterior deste worker já aqueceu o cache com a lista SEM este lead,
  // e a escrita direta via Prisma não passa por `invalidateLeadCache`. O PUT
  // no-op roda o caminho real de invalidação (teamLeads + leadDetails); sem
  // ele, o board serve a lista vazia cacheada e o clique no lead estoura
  // timeout — flake que só aparece com os testes em sequência no mesmo worker.
  const invalidation = await request.put(`/api/v1/leads/${LAYOUT_LEAD_ID}`, {
    data: { name: LAYOUT_LEAD_NAME },
  });
  expect(invalidation.ok(), "PUT de invalidação de cache do lead seedado").toBe(true);

  // `revalidateTag(tag, "max")` é stale-while-revalidate: o PRIMEIRO GET após a
  // invalidação ainda serve a entrada velha e só dispara a revalidação em
  // background. O poll consome esse serve stale e garante que, quando a página
  // fizer o próprio fetch, a lista cacheada já contenha o lead.
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `/api/v1/leads?role=manager&teamId=${teamId}`,
        );
        if (!response.ok()) return false;
        const body = (await response.json()) as {
          result?: { leads?: Array<{ id: string }> };
        };
        return (body.result?.leads ?? []).some((lead) => lead.id === LAYOUT_LEAD_ID);
      },
      {
        message: "lista de leads do time reflete o lead seedado após invalidação",
        timeout: 15_000,
      },
    )
    .toBe(true);

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

  test.afterAll(async ({ request }) => {
    // DELETE pela API (não Prisma direto): roda `invalidateLeadFullCache`.
    // Sem isso a lista "use cache" do time segue com o lead-fantasma por até
    // 60s e contamina a PRÓXIMA rodada do spec — o board renderia linhas no
    // teste de responsividade. O hook não tem o cookie do contexto do browser,
    // então assina o próprio token.
    const cookie = `${E2E_COOKIE_NAME}=${signE2eSessionToken()}`;
    await request.delete(`/api/v1/leads/${LAYOUT_LEAD_ID}`, {
      headers: { cookie },
    });
    // Consome o serve stale do revalidateTag (SWR) para a próxima rodada já
    // encontrar a lista sem o lead.
    await expect
      .poll(
        async () => {
          const profile = await findE2eMasterProfile();
          if (!profile?.activeTeamId) return true;
          const response = await request.get(
            `/api/v1/leads?role=manager&teamId=${profile.activeTeamId}`,
            { headers: { cookie } },
          );
          if (!response.ok()) return false;
          const body = (await response.json()) as {
            result?: { leads?: Array<{ id: string }> };
          };
          return (body.result?.leads ?? []).every((lead) => lead.id !== LAYOUT_LEAD_ID);
        },
        {
          message: "lista de leads do time sem o lead de layout após cleanup",
          timeout: 15_000,
        },
      )
      .toBe(true);
    // Idempotente: garante o banco limpo mesmo se o DELETE via API falhar.
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

  test("dialog do lead mantém timeline, chips e composer visíveis em 1280×800", async ({ page }) => {
    test.setTimeout(90_000);
    await seedLayoutLead(page.request);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm`);

    await page.getByText(LAYOUT_LEAD_NAME).first().click();
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

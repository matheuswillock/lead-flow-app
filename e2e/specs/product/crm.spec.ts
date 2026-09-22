import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  runResponsiveChecks,
} from "../../support/responsive";

const LAYOUT_LEAD_ID = "e2e20000-0000-4000-8000-000000000301";
const LAYOUT_LEAD_CODE = "E2ELEADLAYOUT001";
const LAYOUT_LEAD_NAME = "Lead Layout Dialog E2E";

// Lead dedicado ao teste de responsividade: os alvos de toque das linhas
// (drag handle, menu de ações, link do WhatsApp) só renderizam com um lead no
// board. ID próprio para não disputar seed/cleanup com o teste do dialog.
const TOUCH_LEAD_ID = "e2e20000-0000-4000-8000-000000000302";
const TOUCH_LEAD_CODE = "E2ELEADTOUCH0001";
const TOUCH_LEAD_NAME = "Lead Touch Target E2E";
const TOUCH_LEAD_PHONE = "11999990302";

// Lead dedicado ao teste de alvos de toque dos formulários compartilhados
// (dialog "Novo Lead" e dialog "Agendar Reunião") — bugfix touch-targets-44px.
// ID próprio para não disputar seed com os outros testes deste spec. NÃO entra
// em CRM_E2E_LEAD_IDS/afterAll: com `fullyParallel` e mais de um worker, o
// afterAll do describe roda por worker assim que ELE termina os testes que
// pegou — inclusive quando esse worker nunca rodou o teste que seeda este
// lead. Isso apaga o lead sob um teste ainda em andamento em outro worker
// (achado do Codex review no PR #1218). Este ID limpa a si mesmo num
// try/finally dentro do próprio teste, sem depender do afterAll do describe.
const FORM_TOUCH_LEAD_ID = "e2e20000-0000-4000-8000-000000000303";
const FORM_TOUCH_LEAD_CODE = "E2ELEADFORMTOUCH1";
const FORM_TOUCH_LEAD_NAME = "Lead Form Touch Target E2E";
const FORM_TOUCH_LEAD_PHONE = "11999990303";

const CRM_E2E_LEAD_IDS = [LAYOUT_LEAD_ID, TOUCH_LEAD_ID];

/** Mesma resolução de `playwright.config.ts` — o afterAll cria o próprio
 * `APIRequestContext` (a fixture `request` é por-teste e não existe em
 * hooks de worker) e precisa do baseURL explícito. */
const E2E_API_BASE_URL =
  process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

interface SeedCrmLeadOptions {
  id: string;
  leadCode: string;
  name: string;
  phone?: string;
  activityCount?: number;
}

async function seedCrmLead({ id, leadCode, name, phone, activityCount = 0 }: SeedCrmLeadOptions) {
  const prisma = getPrisma();
  const profile = await findE2eMasterProfile();
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
  if (!profile.activeTeamId) throw new Error("Team E2E não encontrado");
  const teamId = profile.activeTeamId;

  await prisma.lead.deleteMany({ where: { id } });
  await prisma.lead.create({
    data: {
      id,
      leadCode,
      managerId: profile.id,
      teamId,
      status: "new_opportunity",
      name,
      phone,
      createdBy: profile.id,
      updatedBy: profile.id,
    },
  });
  if (activityCount > 0) {
    await prisma.leadActivity.createMany({
      data: Array.from({ length: activityCount }, (_, index) => ({
        leadId: id,
        type: "note" as const,
        body: `Atividade de layout ${index + 1}`,
        createdBy: profile.id,
        createdAt: new Date(Date.now() - index * 60_000),
      })),
    });
  }

  return { profile, teamId };
}

/**
 * O seed via Prisma NÃO invalida a tag team-leads do "use cache" da listagem
 * (getCachedTeamLeads, stale 30 / revalidate 60): quando testes anteriores já
 * visitaram o CRM, a entrada vazia cacheada é nova demais para revalidar e o
 * lead seedado fica invisível por mais de 75s — era o flaky da CI no PR #1153.
 * Um PUT idempotente pela API invalida a tag exatamente como uma mutação real
 * do app (invalidateLeadCache).
 *
 * E `revalidateTag(tag, "max")` é stale-while-revalidate: o PRIMEIRO GET após
 * a invalidação ainda serve a entrada velha e só dispara a revalidação em
 * background. O poll final consome esse serve stale ANTES de o teste navegar
 * — sem ele o goto seguinte podia renderizar o board da lista vazia cacheada
 * e o teste só passava no retry (flake serial das runs de 09/09, develop
 * 15:01Z e release v0.299.6 — fix do PR #1158).
 */
async function invalidateTeamLeadsCache(
  page: Page,
  { leadId, teamId, name }: { leadId: string; teamId: string; name: string },
) {
  const headers = {
    "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
    "x-team-id": teamId,
  };
  const invalidateResponse = await page.request.put(`/api/v1/leads/${leadId}`, {
    headers,
    data: { name },
  });
  expect(invalidateResponse.ok(), "PUT de invalidação do cache falhou").toBe(true);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `/api/v1/leads?role=manager&teamId=${teamId}`,
          { headers },
        );
        if (!response.ok()) return false;
        const body = (await response.json()) as {
          result?: { leads?: Array<{ id: string }> };
        };
        return (body.result?.leads ?? []).some((lead) => lead.id === leadId);
      },
      {
        message: "lista de leads do time reflete o lead seedado após invalidação",
        timeout: 15_000,
      },
    )
    .toBe(true);
}

/**
 * Garante o lead seedado visível no board: recarrega enquanto a listagem
 * cacheada ainda não o traz e filtra por nome para isolar o lead do que os
 * outros workers da CI criam no mesmo time (orderBy createdAt desc, página 1).
 *
 * Janela de 120s, não 60s — medido nos traces da CI (run 34385997396): mesmo
 * com o PUT de invalidação e o poll da API drenados, os fetches da PÁGINA
 * receberam por 50s+ um snapshot da lista ANTERIOR ao seed, que só revalida
 * ao cruzar a fronteira de `revalidate: 60` do `use cache`
 * (getCachedTeamLeads). Com 60s de toPass, a espera estourava um fetch antes
 * da fronteira (último stale aos 62s de idade da entrada); 120s garante
 * atravessá-la para QUALQUER entrada presa, por mais nova que fosse no
 * momento do seed.
 */
async function waitForSeededLeadOnBoard(page: Page, name: string) {
  const nameFilter = page.getByPlaceholder("Filtrar por nome...");
  const seededLeadCell = page.getByText(name).first();
  await expect(async () => {
    if ((await seededLeadCell.count()) === 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await nameFilter.fill(name);
    await expect(seededLeadCell).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 120_000 });
  return seededLeadCell;
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

  test.afterAll(async ({ playwright }) => {
    // DELETE pela API (não só Prisma direto): roda `invalidateLeadFullCache`
    // para CADA lead seedado — achado codex no PR #1160: deletar só via
    // Prisma deixava a lista "use cache" do time com leads-fantasma por até
    // 60s, contaminando a próxima rodada do spec. A fixture `request` é
    // por-teste e não existe em afterAll: o contexto é criado e descartado
    // aqui mesmo, com o mesmo header-auth de modo E2E dos testes.
    const profile = await findE2eMasterProfile();
    const api = await playwright.request.newContext({ baseURL: E2E_API_BASE_URL });
    try {
      if (profile?.activeTeamId) {
        const headers = {
          "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
          "x-team-id": profile.activeTeamId,
        };
        // Sem assert de .ok(): o DELETE é idempotente por design — numa rodada
        // que falhou antes do seed, o lead pode nem existir (404 legítimo). O
        // invariante real é o poll abaixo: a lista cacheada SEM os leads.
        for (const leadId of CRM_E2E_LEAD_IDS) {
          await api.delete(`/api/v1/leads/${leadId}`, { headers });
        }
        // Consome o serve stale do revalidateTag (SWR) para a próxima rodada
        // já encontrar a lista sem os leads deste spec.
        await expect
          .poll(
            async () => {
              const response = await api.get(
                `/api/v1/leads?role=manager&teamId=${profile.activeTeamId}`,
                { headers },
              );
              if (!response.ok()) return false;
              const body = (await response.json()) as {
                result?: { leads?: Array<{ id: string }> };
              };
              return (body.result?.leads ?? []).every(
                (lead) => !CRM_E2E_LEAD_IDS.includes(lead.id),
              );
            },
            {
              message: "lista de leads do time sem os leads seedados após cleanup",
              timeout: 15_000,
            },
          )
          .toBe(true);
      }
    } finally {
      // Fallback SEMPRE roda (achados cursor/codex no PR #1158): mesmo se o
      // DELETE via API falhar ou o poll estourar, o banco fica limpo e a
      // conexão fecha — a falha do cache ainda propaga depois do finally.
      await api.dispose();
      await getPrisma().lead.deleteMany({ where: { id: { in: CRM_E2E_LEAD_IDS } } });
      await disconnectPrisma();
    }
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
    // 210s: a espera do board pode consumir até 120s (fronteira do
    // revalidate:60 — ver waitForSeededLeadOnBoard) + responsive checks.
    test.setTimeout(210_000);
    // Board VAZIO não renderiza os alvos de toque das linhas (drag handle,
    // menu de ações, link do WhatsApp) — foi assim que os botões de 32×32
    // passaram batidos no assertTouchTargets. O lead seedado (com telefone)
    // garante que a medição cubra os controles de linha.
    const { teamId } = await seedCrmLead({
      id: TOUCH_LEAD_ID,
      leadCode: TOUCH_LEAD_CODE,
      name: TOUCH_LEAD_NAME,
      phone: TOUCH_LEAD_PHONE,
    });
    await invalidateTeamLeadsCache(page, {
      leadId: TOUCH_LEAD_ID,
      teamId,
      name: TOUCH_LEAD_NAME,
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm?view=pipeline`);
    await expect(page.locator("h1.text-2xl", { hasText: "CRM" })).toBeVisible({
      timeout: 30_000,
    });
    await waitForSeededLeadOnBoard(page, TOUCH_LEAD_NAME);

    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page);
  });

  /**
   * Bugfix touch-targets-44px-controles-compartilhados: cobre, em 360px, os
   * controles de formulário compartilhado apontados no relatório da SPEC 40
   * — `+ Adicionar` (`AgeEntryInput`/`LeadAgeField`) e `SaveWithDraftButton`
   * (botão principal + chevron do dropdown) — dentro do dialog "Novo Lead"
   * (`components/forms/leadForm.tsx`) e o `SelectTrigger` compartilhado
   * (`components/ui/select.tsx`) dentro do dialog "Agendar Reunião"
   * (`ScheduleMeetingDialog`, fora do escopo de edição deste bugfix).
   *
   * Mede APENAS estes controles, não o dialog inteiro: o dialog "Novo Lead"
   * tem outros alvos de toque pré-existentes abaixo de 44px (pills de status,
   * abas, composer de atividade) que já existiam antes da SPEC 40 e estão
   * fora do escopo deste bugfix — um `assertTouchTargets` genérico sobre o
   * dialog inteiro reprovaria por eles, não pelos controles corrigidos aqui.
   */
  test("responsividade mobile-first dos formulários compartilhados (novo lead e agendar reunião)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // Cleanup próprio (try/finally), não o afterAll do describe: ver o
    // comentário na declaração de FORM_TOUCH_LEAD_ID acima.
    const { teamId } = await seedCrmLead({
      id: FORM_TOUCH_LEAD_ID,
      leadCode: FORM_TOUCH_LEAD_CODE,
      name: FORM_TOUCH_LEAD_NAME,
      phone: FORM_TOUCH_LEAD_PHONE,
    });
    try {
      await invalidateTeamLeadsCache(page, {
        leadId: FORM_TOUCH_LEAD_ID,
        teamId,
        name: FORM_TOUCH_LEAD_NAME,
      });

      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm?view=pipeline`);
      await expect(page.locator("h1.text-2xl", { hasText: "CRM" })).toBeVisible({
        timeout: 30_000,
      });
      const seededLeadCell = await waitForSeededLeadOnBoard(page, FORM_TOUCH_LEAD_NAME);

      await page.setViewportSize({ width: 360, height: 800 });

      // --- Dialog "Novo Lead": "+ Adicionar", SaveWithDraftButton e "Cancelar" ---
      // Medidos via `assertTouchTargets` (fonte única de alvo de toque —
      // agents.md #responsividade-mobile-first-must) com selector restrito
      // a `data-testid` dos controles corrigidos por este bugfix: o dialog
      // "Novo Lead" tem outros alvos pré-existentes abaixo de 44px (pills de
      // status, abas, composer de atividade) fora do escopo desta mudança —
      // um selector genérico sobre o dialog inteiro reprovaria por eles.
      await page.getByRole("button", { name: "Adicionar novo lead" }).click();
      const newLeadDialog = page.getByRole("dialog").filter({ hasText: "Novo Lead" });
      await expect(newLeadDialog).toBeVisible({ timeout: 15_000 });
      // Confirma que os 4 controles existem ANTES de medir: `assertTouchTargets`
      // passa silenciosamente se o selector não casar com nada — sem este
      // guard, um data-testid renomeado/removido faria o teste ficar verde
      // sem medir nada (achado do review Opus final neste PR).
      await expect(newLeadDialog.getByTestId("age-entry-add-button")).toHaveCount(1);
      await expect(newLeadDialog.getByTestId("save-with-draft-main")).toHaveCount(1);
      await expect(newLeadDialog.getByTestId("save-with-draft-chevron")).toHaveCount(1);
      await expect(newLeadDialog.getByTestId("lead-form-cancel")).toHaveCount(1);
      await assertTouchTargets(page, {
        selector:
          '[data-testid="age-entry-add-button"], [data-testid="save-with-draft-main"], [data-testid="save-with-draft-chevron"], [data-testid="lead-form-cancel"]',
      });

      await page.keyboard.press("Escape");
      await expect(newLeadDialog).toHaveCount(0);

      // --- Dialog "Agendar Reunião": SelectTrigger compartilhado do closer ---
      // (verificação apenas — select.tsx não foi alterado por este bugfix, já
      // aplicava `max-lg:h-11!` para o mobile antes desta mudança).
      const seededRow = page.getByRole("row").filter({ has: seededLeadCell });
      await seededRow.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("menuitem", { name: "Agendar reunião" }).click();
      const scheduleDialog = page.getByRole("dialog").filter({ hasText: "Agendar Reunião" });
      await expect(scheduleDialog).toBeVisible({ timeout: 15_000 });
      await expect(scheduleDialog.locator('[role="combobox"]').first()).toHaveCount(1);
      await assertTouchTargets(page, { selector: '[role="dialog"] [role="combobox"]' });
      await page.keyboard.press("Escape");
      await expect(scheduleDialog).toHaveCount(0);
    } finally {
      const headers = {
        "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
        "x-team-id": teamId,
      };
      await page.request.delete(`/api/v1/leads/${FORM_TOUCH_LEAD_ID}`, { headers }).catch(() => null);
      await getPrisma().lead.deleteMany({ where: { id: FORM_TOUCH_LEAD_ID } });
    }
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
    // 210s: a espera do board pode consumir até 120s (fronteira do
    // revalidate:60 — ver waitForSeededLeadOnBoard) + dialog + asserts.
    test.setTimeout(210_000);
    const { teamId } = await seedCrmLead({
      id: LAYOUT_LEAD_ID,
      leadCode: LAYOUT_LEAD_CODE,
      name: LAYOUT_LEAD_NAME,
      activityCount: 6,
    });
    await invalidateTeamLeadsCache(page, {
      leadId: LAYOUT_LEAD_ID,
      teamId,
      name: LAYOUT_LEAD_NAME,
    });

    // Aquece o "use cache" de /details (o mesmo que o hover na tabela faz via
    // prefetchLeadDetails): na CI, computar essa entrada sob a carga dos 4
    // workers passava de 30s e o dialog ficava em "Carregando lead..." até o
    // assert da timeline estourar — o retry só passava porque herdava o cache
    // aquecido pela 1ª tentativa.
    const warmDetailsResponse = await page.request.get(
      `/api/v1/leads/${LAYOUT_LEAD_ID}/details`,
      {
        headers: {
          "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
          "x-team-id": teamId,
        },
      }
    );
    expect(warmDetailsResponse.ok(), "pré-aquecimento de /details falhou").toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/crm`);

    const seededLeadCell = await waitForSeededLeadOnBoard(page, LAYOUT_LEAD_NAME);

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
    // 30s como o assert do composer acima: a timeline só monta depois do fetch
    // de detalhes do lead, que sob a carga dos 4 workers da CI passa dos 5s
    // do timeout default.
    await expect(timelineScroll).toBeVisible({ timeout: 30_000 });
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

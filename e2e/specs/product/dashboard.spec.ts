import { expect, test, type APIRequestContext } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks } from "../../support/responsive";
import {
  cleanupMultiTeamAgendaFixture,
  seedMultiTeamAgendaFixture,
  type MultiTeamAgendaFixture,
} from "../../support/multi-team-agenda";

/** Namespace próprio: a spec do calendário usa "ca" e as duas podem rodar em paralelo. */
const AGENDA_NAMESPACE = "da" as const;

let fixture: MultiTeamAgendaFixture;

function activeTeamHeaders() {
  return {
    "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
    "x-team-id": fixture.activeTeamId,
  };
}

/**
 * O widget de agenda do dashboard não passa por `"use cache"` — a rota consulta
 * o repositório a cada request — então o seed via Prisma já aparece no próximo
 * GET, sem invalidação nem poll de staleness.
 */
async function listDayAgendaLeadNames(api: APIRequestContext): Promise<string[]> {
  const response = await api.get("/api/v1/dashboard/schedules", {
    headers: activeTeamHeaders(),
  });
  expect(response.ok(), `GET /dashboard/schedules falhou: ${response.status()}`).toBe(true);
  const body = (await response.json()) as { result?: Array<{ leadName: string }> };
  return (body.result ?? []).map((schedule) => schedule.leadName);
}

test.describe("app/[supabaseId]/dashboard", () => {
  // Serial: além do motivo da spec do calendário (o `beforeAll` recria a
  // fixture), o teste de conta inativa muda o estado da assinatura do outro
  // master — em paralelo isso vazaria para os demais testes deste arquivo.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    fixture = await seedMultiTeamAgendaFixture(AGENDA_NAMESPACE);
  });

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile();
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull();
    await injectE2eAuthCookie(context);
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    );
  });

  test.afterAll(async () => {
    await cleanupMultiTeamAgendaFixture(AGENDA_NAMESPACE);
    await disconnectPrisma();
  });

  test("widget de agenda entra em member-all: todos os times do membro, papel por time", async ({
    page,
  }) => {
    // Arrange conferido no banco: os três agendamentos do dia estão em times que
    // NÃO são o time ativo da sessão.
    const seededSchedules = await getPrisma().leadsSchedule.findMany({
      where: {
        id: {
          in: [
            fixture.ids.managerTeamScheduleId,
            fixture.ids.operatorTeamOwnScheduleId,
            fixture.ids.operatorTeamOtherScheduleId,
          ],
        },
      },
      select: { id: true, lead: { select: { teamId: true } } },
    });
    expect(seededSchedules).toHaveLength(3);
    for (const schedule of seededSchedules) {
      expect(schedule.lead.teamId).not.toBe(fixture.activeTeamId);
    }

    // Sem parâmetro de escopo: o default da rota é member-all.
    const leadNames = await listDayAgendaLeadNames(page.request);

    expect(leadNames).toContain(fixture.leadNames.managerTeam);
    expect(leadNames).toContain(fixture.leadNames.operatorTeamOwn);
    expect(leadNames).not.toContain(fixture.leadNames.operatorTeamOther);
  });

  test("escopo active continua restrito ao time ativo", async ({ page }) => {
    const response = await page.request.get("/api/v1/dashboard/schedules?teamScope=active", {
      headers: activeTeamHeaders(),
    });
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { result?: Array<{ teamId: string }> };

    for (const schedule of body.result ?? []) {
      expect(schedule.teamId).toBe(fixture.activeTeamId);
    }
  });

  test("a página carrega e lista a reunião de um time que não é o ativo", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/dashboard`);

    await expect(page.getByText("Próximas Reuniões")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Assinatura Inativa")).toHaveCount(0);

    await expect(page.getByText(fixture.leadNames.managerTeam).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(fixture.leadNames.operatorTeamOther)).toHaveCount(0);

    // Com reuniões de mais de um time no dia, a coluna Time passa a informar algo.
    await expect(page.getByRole("columnheader", { name: "Time" })).toBeVisible();
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({
    page,
  }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/dashboard`);
    await expect(page.getByText("Próximas Reuniões")).toBeVisible({ timeout: 60_000 });

    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page);
  });

  // ÚLTIMO teste do arquivo de propósito: ele desliga a assinatura do outro
  // master e `getAccountAccessStatus` tem cache de 45s — mesmo restaurando no
  // `finally`, um teste logo depois ainda leria a conta como inativa.
  test("time cuja conta ficou inativa sai do escopo member-all", async ({ page }) => {
    const prisma = getPrisma();
    const otherMasterId = fixture.ids.otherMasterProfileId;

    // `getAccountSubscriptionStatus` aceita a assinatura permanente tanto do
    // Profile quanto do ProfileSubscription — desligar só um deixa a conta ativa.
    await prisma.profile.update({
      where: { id: otherMasterId },
      data: { hasPermanentSubscription: false, subscriptionStatus: "canceled" },
    });
    await prisma.profileSubscription.update({
      where: { profileId: otherMasterId },
      data: { hasPermanentSubscription: false, subscriptionStatus: "canceled" },
    });

    try {
      // `getAccountAccessStatus` tem cache de 45s; o poll espera a virada em vez
      // de assumir efeito imediato.
      await expect
        .poll(() => listDayAgendaLeadNames(page.request), {
          message: "agenda deixa de trazer o time da conta inativa",
          timeout: 90_000,
        })
        .not.toContain(fixture.leadNames.operatorTeamOwn);

      // O time do master ativo continua no escopo — o filtro é por conta, não geral.
      const leadNames = await listDayAgendaLeadNames(page.request);
      expect(leadNames).toContain(fixture.leadNames.managerTeam);
    } finally {
      await prisma.profile.update({
        where: { id: otherMasterId },
        data: { hasPermanentSubscription: true, subscriptionStatus: "active" },
      });
      await prisma.profileSubscription.update({
        where: { profileId: otherMasterId },
        data: { hasPermanentSubscription: true, subscriptionStatus: "active" },
      });
    }
  });
});

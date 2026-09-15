import { expect, test, type APIRequestContext } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks } from "../../support/responsive";
import {
  MULTI_TEAM_AGENDA,
  MULTI_TEAM_AGENDA_TITLES,
  cleanupMultiTeamAgendaFixture,
  seedMultiTeamAgendaFixture,
  type MultiTeamAgendaFixture,
} from "../../support/multi-team-agenda";

/** Mesma resolução de `playwright.config.ts` — hooks de worker não têm a fixture `request`. */
const E2E_API_BASE_URL =
  process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

let fixture: MultiTeamAgendaFixture;

function dayWindow(reference: Date) {
  const dayKey = reference.toISOString().slice(0, 10);
  return {
    dateFrom: `${dayKey}T00:00:00.000Z`,
    dateTo: `${dayKey}T23:59:59.999Z`,
  };
}

function headersForTeam(teamId: string) {
  return { "x-supabase-user-id": E2E_MASTER_SUPABASE_ID, "x-team-id": teamId };
}

/**
 * O seed via Prisma não derruba o `"use cache"` de `ListTasksUseCase` (tags
 * `team-tasks` / `team-calendar`, stale 30 / revalidate 60). Um PATCH idempotente
 * pela API roda a invalidação real, exatamente como uma edição no app. Como
 * `revalidateTag(tag, "max")` é stale-while-revalidate, quem consome o serve
 * stale é o poll de cada teste.
 */
async function invalidateSeededTeamTasksCache(api: APIRequestContext, reference: Date) {
  const seededTasks = [
    {
      taskId: MULTI_TEAM_AGENDA.managerTeamTaskId,
      teamId: MULTI_TEAM_AGENDA.managerTeamId,
      title: MULTI_TEAM_AGENDA_TITLES.managerTeamTask,
      assigneeProfileIds: [MULTI_TEAM_AGENDA.teammateProfileId],
    },
    {
      taskId: MULTI_TEAM_AGENDA.operatorTeamOwnTaskId,
      teamId: MULTI_TEAM_AGENDA.operatorTeamId,
      title: MULTI_TEAM_AGENDA_TITLES.operatorTeamOwnTask,
      assigneeProfileIds: [fixture.subjectProfileId],
    },
  ];

  for (const seeded of seededTasks) {
    const response = await api.patch(`/api/v1/tasks/${seeded.taskId}`, {
      headers: headersForTeam(seeded.teamId),
      data: {
        title: seeded.title,
        taskType: "meeting",
        body: "Invalidação de cache do seed E2E.",
        isUrgent: false,
        startAt: reference.toISOString(),
        endAt: reference.toISOString(),
        assigneeProfileIds: seeded.assigneeProfileIds,
      },
    });
    expect(
      response.ok(),
      `PATCH de invalidação falhou para ${seeded.taskId}: ${response.status()}`,
    ).toBe(true);
  }
}

async function listTaskTitlesInMemberAllScope(
  api: APIRequestContext,
  reference: Date,
): Promise<string[]> {
  const { dateFrom, dateTo } = dayWindow(reference);
  const response = await api.get(
    `/api/v1/tasks?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&teamScope=member-all`,
    { headers: headersForTeam(fixture.activeTeamId) },
  );
  if (!response.ok()) return [];
  const body = (await response.json()) as { result?: Array<{ title: string }> };
  return (body.result ?? []).map((task) => task.title);
}

test.describe("app/[supabaseId]/calendar", () => {
  test.setTimeout(180_000);

  test.beforeAll(async ({ playwright }) => {
    fixture = await seedMultiTeamAgendaFixture();
    const api = await playwright.request.newContext({ baseURL: E2E_API_BASE_URL });
    try {
      await invalidateSeededTeamTasksCache(api, fixture.referenceDate);
    } finally {
      await api.dispose();
    }
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
    await cleanupMultiTeamAgendaFixture();
    await disconnectPrisma();
  });

  test("escopo member-all: agendamentos dos outros times, com restrição de papel POR time", async ({
    page,
  }) => {
    // Arrange conferido no banco: os três agendamentos existem, em dois times
    // distintos, nenhum deles o time ativo da sessão.
    const seededTasks = await getPrisma().task.findMany({
      where: {
        id: {
          in: [
            MULTI_TEAM_AGENDA.managerTeamTaskId,
            MULTI_TEAM_AGENDA.operatorTeamOwnTaskId,
            MULTI_TEAM_AGENDA.operatorTeamOtherTaskId,
          ],
        },
      },
      select: { id: true, lead: { select: { teamId: true } } },
    });
    expect(seededTasks).toHaveLength(3);
    for (const task of seededTasks) {
      expect(task.lead.teamId).not.toBe(fixture.activeTeamId);
    }

    await expect
      .poll(() => listTaskTitlesInMemberAllScope(page.request, fixture.referenceDate), {
        message: "escopo member-all traz o agendamento do time onde o perfil é manager",
        timeout: 150_000,
      })
      .toContain(MULTI_TEAM_AGENDA_TITLES.managerTeamTask);

    const titles = await listTaskTitlesInMemberAllScope(page.request, fixture.referenceDate);

    // Time onde é MANAGER: enxerga o agendamento de outro membro (team-wide).
    expect(titles).toContain(MULTI_TEAM_AGENDA_TITLES.managerTeamTask);
    // Time (de outro master) onde é OPERATOR: enxerga o que é dele.
    expect(titles).toContain(MULTI_TEAM_AGENDA_TITLES.operatorTeamOwnTask);
    // No MESMO time onde é operator, o agendamento alheio continua invisível —
    // a restrição de papel é por time, não global.
    expect(titles).not.toContain(MULTI_TEAM_AGENDA_TITLES.operatorTeamOtherTask);
  });

  test("a página mostra o agendamento de um time que não é o ativo", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/calendar`);

    await expect(page.getByText("Calendário").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Assinatura Inativa")).toHaveCount(0);

    const crossTeamTask = page
      .getByText(MULTI_TEAM_AGENDA_TITLES.managerTeamTask, { exact: false })
      .first();
    await expect(async () => {
      if ((await crossTeamTask.count()) === 0) {
        await page.reload({ waitUntil: "domcontentloaded" });
      }
      await expect(crossTeamTask).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 150_000 });

    // O agendamento alheio do time onde o perfil é operator não pode vazar.
    await expect(
      page.getByText(MULTI_TEAM_AGENDA_TITLES.operatorTeamOtherTask, { exact: false }),
    ).toHaveCount(0);
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({
    page,
  }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/calendar`);
    await expect(page.getByText("Calendário").first()).toBeVisible({ timeout: 60_000 });

    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page);
  });
});

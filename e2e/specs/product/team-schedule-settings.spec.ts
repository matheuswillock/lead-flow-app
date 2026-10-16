import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("configuração de duração de reuniões por time", () => {
  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    expect(await findE2eMasterProfile()).not.toBeNull();
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("manager configura duração fixa e a interface permanece responsiva", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/teams`);
    await expect(page.getByRole("heading", { name: "Gerenciar times", exact: true })).toBeVisible({ timeout: 60_000 });

    const team = await getPrisma().team.findFirst({
      where: { master: { supabaseId: E2E_MASTER_SUPABASE_ID }, deletedAt: null },
      select: { id: true },
    });
    expect(team).not.toBeNull();

    await page.getByRole("button", { name: "Abrir menu" }).first().click();
    await page.getByRole("menuitem", { name: "Gerenciar" }).click();
    await page.getByRole("tab", { name: "Agendamento" }).click();
    await page.screenshot({
      path: "test-results/team-schedule-settings/before/manage-team-desktop.png",
      fullPage: true,
    });

    const update = await page.request.put(`/api/v1/teams/${team!.id}/schedule-settings`, {
      headers: {
        "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
        "x-team-id": team!.id,
      },
      data: { durationMinutes: 45 },
    });
    expect(update.ok()).toBe(true);

    await page.reload();
    await page.getByRole("button", { name: "Abrir menu" }).first().click();
    await page.getByRole("menuitem", { name: "Gerenciar" }).click();
    await page.getByRole("tab", { name: "Agendamento" }).click();
    await expect(page.getByLabel("Duração da reunião")).toHaveText(/45 minutos/);
    await page.screenshot({
      path: "test-results/team-schedule-settings/after/manage-team-desktop.png",
      fullPage: true,
    });

    await runResponsiveChecks(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({
      path: "test-results/team-schedule-settings/after/manage-team-mobile.png",
      fullPage: true,
    });
  });
});

import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../../support/db";
import { signE2eJwt } from "../../../../lib/e2e/e2e-jwt";

type CreatedRecords = {
  backofficeProfileId: string | null;
  masterProfileId: string | null;
  operatorProfileId: string | null;
  teamId: string | null;
};

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("app/backoffice/(app)/clients/[masterId] — permissões por time no dialog Editar membro", () => {
  test.setTimeout(120_000);

  const created: CreatedRecords = {
    backofficeProfileId: null,
    masterProfileId: null,
    operatorProfileId: null,
    teamId: null,
  };
  let backofficeSupabaseId = "";
  let backofficeEmail = "";
  let masterName = "";
  let masterEmail = "";
  let teamName = "";
  let operatorEmail = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    const suffix = randomUUID().slice(0, 8);

    backofficeSupabaseId = randomUUID();
    backofficeEmail = uniqueEmail("e2e.backoffice.team-perms");
    const backofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Team Perms",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true },
    });
    created.backofficeProfileId = backofficeProfile.id;

    await prisma.backofficeUser.create({
      data: {
        profileId: backofficeProfile.id,
        email: backofficeProfile.email,
        fullAccess: true,
        isActive: true,
      },
    });

    masterName = `E2E Cliente Team Perms ${suffix}`;
    masterEmail = uniqueEmail("e2e.master.team-perms");
    const masterProfile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: masterEmail,
        fullName: masterName,
        role: "manager",
        isMaster: true,
        hasPermanentSubscription: true,
      },
      select: { id: true },
    });
    created.masterProfileId = masterProfile.id;

    teamName = `E2E Time Team Perms ${suffix}`;
    const team = await prisma.team.create({
      data: { name: teamName, masterId: masterProfile.id, isDefault: true },
      select: { id: true },
    });
    created.teamId = team.id;

    // O master é membro do próprio time, como manager — cenário exato do bug.
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: masterProfile.id,
        role: "manager",
        functions: ["CLOSER"],
      },
    });

    operatorEmail = uniqueEmail("e2e.operator.team-perms");
    const operatorProfile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: operatorEmail,
        fullName: `E2E Operador Team Perms ${suffix}`,
        role: "operator",
        functions: ["SDR"],
        isMaster: false,
      },
      select: { id: true },
    });
    created.operatorProfileId = operatorProfile.id;

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: operatorProfile.id,
        role: "operator",
        functions: ["SDR"],
      },
    });
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    if (created.teamId) {
      await prisma.teamMember.deleteMany({ where: { teamId: created.teamId } }).catch(() => null);
      await prisma.team.deleteMany({ where: { id: created.teamId } }).catch(() => null);
    }
    for (const profileId of [created.operatorProfileId, created.masterProfileId]) {
      if (profileId) {
        await prisma.profile.deleteMany({ where: { id: profileId } }).catch(() => null);
      }
    }
    if (created.backofficeProfileId) {
      await prisma.backofficeUser
        .deleteMany({ where: { profileId: created.backofficeProfileId } })
        .catch(() => null);
      await prisma.profile.deleteMany({ where: { id: created.backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context, baseURL }) => {
    const token = signE2eJwt({ supabaseId: backofficeSupabaseId, email: backofficeEmail });
    await injectE2eAuthCookie(context, {
      token,
      baseUrl: baseURL ?? "http://127.0.0.1:3000",
    });
  });

  /** Abre o dialog "Editar membro" da linha do membro com o e-mail informado. */
  async function openMemberEditDialog(page: Page, memberEmail: string) {
    await page.goto(`/backoffice/clients/${created.masterProfileId}`);
    await expect(page.getByText(masterName).first()).toBeVisible({ timeout: 60_000 });

    await page.getByText(teamName).first().click();

    const memberRow = page.locator("tr", { hasText: memberEmail });
    await expect(memberRow).toBeVisible({ timeout: 30_000 });

    await memberRow.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Editar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Editar membro" })).toBeVisible({
      timeout: 30_000,
    });
    // O painel só é semeado quando o fetch dos times termina (o botão de salvar
    // fica travado enquanto isLoadingTeams). Esperar CONDIÇÃO, nunca tempo fixo.
    await expect(dialog.getByRole("button", { name: "Salvar alterações" })).toBeEnabled({
      timeout: 30_000,
    });
    return dialog;
  }

  test("Master: painel de permissões do time renderiza e é editável", async ({ page }) => {
    const dialog = await openMemberEditDialog(page, masterEmail);

    await expect(dialog.getByText("Master", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Times deste cliente" })).toBeVisible();
    await expect(dialog.getByText(teamName)).toBeVisible();

    // O defeito: para o Master o AccordionContent não era renderizado, mesmo com
    // o trigger habilitado. Estes asserts ficam vermelhos antes da correção.
    for (const label of ["Manager", "Backoffice", "Operator", "SDR", "Closer"]) {
      const control = dialog.getByRole("switch", { name: label, exact: true });
      await expect(control, `switch "${label}" deve estar visível`).toBeVisible({
        timeout: 15_000,
      });
      await expect(control, `switch "${label}" deve estar habilitado`).toBeEnabled();
    }

    // Estado inicial vindo do banco: manager + CLOSER.
    await expect(dialog.getByRole("switch", { name: "Manager", exact: true })).toBeChecked();
    await expect(dialog.getByRole("switch", { name: "Closer", exact: true })).toBeChecked();

    // Verificação visual medida: o painel a mais no dialog não pode estourar a
    // largura da viewport nem em 360px.
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(dialog.getByRole("switch", { name: "Manager", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, "overflow horizontal em 360px").toBeLessThanOrEqual(1);
    await page.screenshot({
      path: "test-results/master-team-permissions-360.png",
      fullPage: true,
    });
  });

  test("Master: alterar o papel no time persiste no banco", async ({ page }) => {
    const prisma = getPrisma();
    const dialog = await openMemberEditDialog(page, masterEmail);

    await dialog.getByRole("switch", { name: "Operator", exact: true }).click();
    await expect(dialog.getByRole("switch", { name: "Operator", exact: true })).toBeChecked();

    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Membro atualizado com sucesso")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        async () => {
          const membership = await prisma.teamMember.findFirst({
            where: { teamId: created.teamId!, profileId: created.masterProfileId! },
            select: { role: true },
          });
          return membership?.role ?? null;
        },
        { timeout: 20_000, message: "teamMember.role do master deveria virar operator" },
      )
      .toBe("operator");

    // Restaura para não contaminar os demais testes deste arquivo.
    await prisma.teamMember.updateMany({
      where: { teamId: created.teamId!, profileId: created.masterProfileId! },
      data: { role: "manager", functions: ["CLOSER"] },
    });
  });

  test("Master: remoção do time continua bloqueada", async ({ page }) => {
    const dialog = await openMemberEditDialog(page, masterEmail);

    await expect(dialog.getByRole("button", { name: "Remover" })).toBeDisabled();

    // O menu da linha não oferece "Remover do time" para o master.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    const memberRow = page.locator("tr", { hasText: masterEmail });
    await memberRow.getByRole("button").last().click();
    await expect(page.getByRole("menuitem", { name: "Remover do time" })).toHaveCount(0);
  });

  test("Não-master: painel continua editável e o toggle de membership abre/fecha o painel", async ({
    page,
  }) => {
    const dialog = await openMemberEditDialog(page, operatorEmail);

    const operatorSwitch = dialog.getByRole("switch", { name: "Operator", exact: true });
    await expect(operatorSwitch).toBeVisible({ timeout: 15_000 });
    await expect(operatorSwitch).toBeEnabled();
    await expect(operatorSwitch).toBeChecked();

    // Remoção pendente: o painel fecha, porque a membership deixa de estar ativa.
    await dialog.getByRole("button", { name: "Remover" }).click();
    await expect(dialog.getByText("Remoção pendente")).toBeVisible();
    await expect(operatorSwitch).toHaveCount(0);

    // Desfazer devolve a membership ativa — o painel volta.
    await dialog.getByRole("button", { name: "Desfazer" }).click();
    await expect(dialog.getByText("Remoção pendente")).toHaveCount(0);
    await expect(dialog.getByRole("switch", { name: "Operator", exact: true })).toBeVisible();
  });
});

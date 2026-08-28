import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { signE2eJwt } from "../../../lib/e2e/e2e-jwt";
import { API_CLIENT_BASE } from "../../../lib/route-map";

type CreatedRecords = {
  backofficeProfileId: string | null;
  masterProfileId: string | null;
  memberProfileId: string | null;
  teamId: string | null;
};

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("backoffice clients member access link", () => {
  test.setTimeout(120_000);

  const created: CreatedRecords = {
    backofficeProfileId: null,
    masterProfileId: null,
    memberProfileId: null,
    teamId: null,
  };
  let backofficeSupabaseId = "";
  let backofficeEmail = "";
  let masterName = "";
  let teamName = "";
  let memberName = "";
  let memberEmail = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    const suffix = randomUUID().slice(0, 8);

    backofficeSupabaseId = randomUUID();
    backofficeEmail = uniqueEmail("e2e.backoffice.copy-link");
    const backofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Copy Link",
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

    masterName = `E2E Cliente Copy Link ${suffix}`;
    const masterProfile = await prisma.profile.create({
      data: {
        email: uniqueEmail("e2e.master.copy-link"),
        fullName: masterName,
        role: "manager",
        isMaster: true,
        hasPermanentSubscription: true,
      },
      select: { id: true },
    });
    created.masterProfileId = masterProfile.id;

    teamName = `E2E Time Copy Link ${suffix}`;
    const team = await prisma.team.create({
      data: {
        name: teamName,
        masterId: masterProfile.id,
        isDefault: true,
      },
      select: { id: true },
    });
    created.teamId = team.id;

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: masterProfile.id,
        role: "manager",
        functions: ["CLOSER"],
      },
    });

    memberName = `E2E Membro Convite ${suffix}`;
    memberEmail = uniqueEmail("e2e.member.copy-link");
    const memberProfile = await prisma.profile.create({
      data: {
        email: memberEmail,
        fullName: memberName,
        role: "operator",
        functions: ["SDR"],
        isMaster: false,
      },
      select: { id: true },
    });
    created.memberProfileId = memberProfile.id;

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: memberProfile.id,
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
    if (created.memberProfileId) {
      await prisma.profile.deleteMany({ where: { id: created.memberProfileId } }).catch(() => null);
    }
    if (created.masterProfileId) {
      await prisma.profile.deleteMany({ where: { id: created.masterProfileId } }).catch(() => null);
    }
    if (created.backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: created.backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: created.backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context, baseURL }) => {
    const resolvedBaseUrl = baseURL ?? "http://127.0.0.1:3000";
    const token = signE2eJwt({ supabaseId: backofficeSupabaseId, email: backofficeEmail });
    await injectE2eAuthCookie(context, { token, baseUrl: resolvedBaseUrl });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: resolvedBaseUrl,
    });
  });

  test("copia link de convite pela sheet e passa pela rota autenticada", async ({ page, request, baseURL }) => {
    const resolvedBaseUrl = baseURL ?? "http://127.0.0.1:3000";
    expect(created.masterProfileId, "Cliente E2E não criado").not.toBeNull();
    expect(created.memberProfileId, "Membro E2E não criado").not.toBeNull();

    const unauthenticatedResponse = await request.post(
      `${resolvedBaseUrl}/api/v1/backoffice/members/${created.memberProfileId}/access-email`,
      { data: { mode: "invite", deliver: "link" } },
    );
    expect(unauthenticatedResponse.status()).toBe(401);

    await page.goto(`/backoffice/clients/${created.masterProfileId}`);
    await expect(page.getByText(masterName)).toBeVisible({ timeout: 60_000 });

    await page.getByText(teamName).click();
    const memberRow = page.locator("tr", { hasText: memberEmail });
    await expect(memberRow).toBeVisible({ timeout: 30_000 });

    await memberRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: /visualizar/i }).click();

    await expect(page.getByRole("button", { name: "Copiar link do convite" })).toBeVisible();

    const accessRequest = page.waitForResponse((response) => {
      return (
        response.url().includes(`${API_CLIENT_BASE}/backoffice/members/${created.memberProfileId}/access-email`) &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: "Copiar link do convite" }).click();

    const response = await accessRequest;
    expect(response.status()).toBe(200);
    const requestBody = response.request().postDataJSON() as { mode?: string; deliver?: string };
    expect(requestBody).toEqual({ mode: "invite", deliver: "link" });

    await expect(page.getByText("Link de convite copiado para a área de transferência.")).toBeVisible({
      timeout: 15_000,
    });

    const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedLink).toContain("/set-password");
    expect(copiedLink).toContain("type=invite");
  });
});

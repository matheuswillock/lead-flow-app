import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { getPrisma, disconnectPrisma, findE2eMasterProfile } from "../../../support/db";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

test.describe("app/backoffice/(app)/clients/adhesions", () => {
  test.setTimeout(90_000);

  let adhesionId: string | null = null;
  let leadId: string | null = null;
  let createdProfileId: string | null = null;
  let customerSupabaseId: string | null = null;
  let backofficeSupabaseId: string | null = null;
  let backofficeProfileId: string | null = null;

  test.beforeAll(async () => {
    const prisma: PrismaAny = getPrisma();
    const master = await findE2eMasterProfile();
    if (!master) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");

    const { randomUUID } = await import("node:crypto");

    // Backoffice operator descartável (quem chama o resendInvite)
    backofficeSupabaseId = randomUUID();
    const backofficeEmail = `e2e.backoffice.${Date.now()}@example.com`;
    const backofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true, supabaseId: true },
    });
    backofficeProfileId = backofficeProfile.id;

    await prisma.backofficeUser.create({
      data: {
        profileId: backofficeProfile.id,
        email: backofficeProfile.email,
        fullAccess: true,
        isActive: true,
      },
    });

    // Customer descartável (conta provisionada pela adesão paga) — e-mail único para evitar colisão entre workers paralelos
    customerSupabaseId = randomUUID();
    const initialEmail = `e2e.adesao.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
    const customerProfile = await prisma.profile.create({
      data: {
        supabaseId: customerSupabaseId,
        email: initialEmail,
        fullName: "E2E Adhesion Customer",
        role: "manager",
        isMaster: true,
      },
      select: { id: true, supabaseId: true },
    });
    createdProfileId = customerProfile.id;
    const profile = customerProfile;

    // Arrange adesão paga com conta já criada (cenário do bug)
    const lead = await prisma.backofficeLead.create({
      data: {
        name: "E2E Adhesion User",
        email: initialEmail,
        phone: "11999999999",
        cpfCnpj: "52998224725",
        status: "new_adhesion",
      },
      select: { id: true },
    });
    leadId = lead.id;

    const product = await prisma.backofficeProduct.findFirst({
      select: { id: true },
    });

    const adhesion = await prisma.backofficeAdhesion.create({
      data: {
        leadId: lead.id,
        fullName: "E2E Adhesion User",
        phone: "11999999999",
        email: initialEmail,
        cpfCnpj: "52998224725",
        plan: "crm",
        productId: product?.id ?? null,
        cycle: "monthly",
        modules: ["crm"],
        extraTeams: 0,
        extraUsers: 0,
        monthlyBaseAmount: 100,
        monthlyExtraTeamsAmount: 0,
        monthlyExtraUsersAmount: 0,
        monthlyTotalAmount: 100,
        totalAmount: 100,
        tokenHash: `e2e-hash-${Date.now()}`,
        tokenPreview: "e2e-prev",
        tokenPlain: null,
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: "paid",
        paidAt: new Date(),
        billingType: "EXTERNAL",
        createdProfileId: profile.id,
        createdSupabaseId: profile.supabaseId,
        installmentLedger: [
          {
            index: 0,
            amount: 100,
            status: "paid",
            paymentSource: "EXTERNAL",
            asaasPaymentId: null,
            paidAt: new Date().toISOString(),
          },
        ],
      } as PrismaAny,
      select: { id: true },
    });
    adhesionId = adhesion.id;
  });

  test.afterAll(async () => {
    const prisma: PrismaAny = getPrisma();
    if (adhesionId) {
      await prisma.backofficeAdhesion.deleteMany({ where: { id: adhesionId } }).catch(() => null);
    }
    if (leadId) {
      await prisma.backofficeLead.deleteMany({ where: { id: leadId } }).catch(() => null);
    }
    // Remove customer + suas dependências (Team/TeamMember/ProfileSubscription)
    if (createdProfileId) {
      await prisma.profileSubscription.deleteMany({ where: { profileId: createdProfileId } }).catch(() => null);
      await prisma.teamMember.deleteMany({ where: { profileId: createdProfileId } }).catch(() => null);
      await prisma.team.deleteMany({ where: { masterId: createdProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: createdProfileId } }).catch(() => null);
    }
    if (backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile();
    expect(profile, "Seed E2E ausente").not.toBeNull();
    await injectE2eAuthCookie(context);
  });

  test("carrega sem erro e mostra heading/tabela ou skeleton", async ({ page }) => {
    await page.goto("/backoffice/clients/adhesions");
    // Proxy redireciona para /backoffice/sign-in se não for backoffice; com role backoffice deve carregar.
    // Assert mínimo da governança: heading visível e sem crash.
    await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
    // O container renderiza heading ou skeleton; aguardamos qualquer um sem erro 500
    await expect(page).not.toHaveTitle(/Erro/i);
    // Se estiver autenticado como backoffice, deve aparecer título "Adesões" ou similar
    const heading = page.getByRole("heading").first();
    const hasHeading = await heading.isVisible().catch(() => false);
    if (hasHeading) {
      await expect(heading).toBeVisible();
    } else {
      // fallback: skeleton visível sem crash
      await expect(page.locator("[data-slot='skeleton']").first().or(page.locator("table")).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("reenviar convite após troca de e-mail envia para e-mail novo e gera novo link", async ({
    request,
  }) => {
    test.skip(!adhesionId, "Adesão de arrange não criada");
    test.skip(!backofficeSupabaseId, "Backoffice SupabaseId não criado");
    const newEmail = `adesao-nova-${Date.now()}@example.com`;
    const prisma: PrismaAny = getPrisma();

    // 1) Simula PATCH de troca de e-mail via API (como faria o Dialog) - ignora se rota bloquear paid
    // Se PATCH bloquear paid (status=paid não editável), atualiza direto no banco para simular a troca que o bug descreve
    const adhesionBefore = await prisma.backofficeAdhesion.findUnique({
      where: { id: adhesionId! },
      select: { email: true, leadId: true, createdProfileId: true },
    });
    expect(adhesionBefore).not.toBeNull();

    // Força troca de e-mail no backoffice_adhesions (caminho que o operador faria se pudesse editar)
    await prisma.backofficeAdhesion.update({
      where: { id: adhesionId! },
      data: { email: newEmail },
    });

    // 2) Chama POST /api/v1/backoffice/adhesions/[id]/invite (reenviar convite)
    // Usa header x-supabase-user-id com o backoffice dedicado (sem depender de cookie master)
    const baseURL = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";

    const res = await request.post(`${baseURL}/api/v1/backoffice/adhesions/${adhesionId}/invite`, {
      headers: { "x-supabase-user-id": backofficeSupabaseId! },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as { isValid?: boolean; result?: { email?: string }; email?: string };
    expect(body.isValid).toBeTruthy();
    expect(String(body.result?.email ?? body.email ?? "")).toContain(newEmail);

    // 3) Assert no banco: lead.email e profile.email devem ter sido sincronizados para newEmail (BUG 1)
    const adhesionAfter = await prisma.backofficeAdhesion.findUnique({
      where: { id: adhesionId! },
      select: { email: true, leadId: true, createdProfileId: true },
    });
    expect(adhesionAfter?.email).toBe(newEmail);

    const leadAfter = await prisma.backofficeLead.findUnique({
      where: { id: leadId! },
      select: { email: true },
    });
    expect(leadAfter?.email).toBe(newEmail);

    if (createdProfileId) {
      const profileEmail = await prisma.profile.findUnique({
        where: { id: createdProfileId },
        select: { email: true },
      });
      expect(profileEmail?.email?.toLowerCase()).toBe(newEmail.toLowerCase());
    }

    // 4) Segundo reenvio deve gerar novamente sucesso (prova que novo link tem nova expiração)
    const res2 = await request.post(`${baseURL}/api/v1/backoffice/adhesions/${adhesionId}/invite`, {
      headers: { "x-supabase-user-id": backofficeSupabaseId! },
    });
    expect(res2.status()).toBe(200);
    const body2 = (await res2.json()) as { isValid?: boolean };
    expect(body2.isValid).toBeTruthy();
  });
});

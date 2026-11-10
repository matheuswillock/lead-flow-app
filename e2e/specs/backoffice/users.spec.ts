import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

/**
 * Tela de usuários do backoffice: vínculo do Operator a contas e times.
 * A sessão é real (perfil backoffice no banco de teste); as APIs de dados da
 * tela são simuladas com `page.route`, então nenhum usuário, conta ou time
 * real é lido ou alterado.
 */

const OPERATOR = {
  id: "u-operator",
  email: "joana.suporte@corretorstudio.com.br",
  fullAccess: false,
  isActive: true,
  isSdr: true,
  isCloser: true,
  mailboxStatus: "pending_manual_action",
  mailboxAddress: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  profile: { fullName: "Joana Suporte", email: "joana.suporte@corretorstudio.com.br" },
};

const MANAGER = {
  ...OPERATOR,
  id: "u-manager",
  email: "gestor@corretorstudio.com.br",
  fullAccess: true,
  profile: { fullName: "Gestor Geral", email: "gestor@corretorstudio.com.br" },
};

const ACCOUNTS = [
  { id: "m-1", fullName: "Imobiliária Horizonte", email: "contato@horizonte.com.br" },
  { id: "m-2", fullName: "Marina Corretora", email: "marina@marinacorretora.com.br" },
];

const TEAMS: Record<string, Array<{ id: string; name: string }>> = {
  "m-1": [
    { id: "t-1", name: "Time Comercial" },
    { id: "t-2", name: "Time Lançamentos" },
  ],
  "m-2": [{ id: "t-3", name: "Time Principal" }],
};

const OPERATOR_LINKS = [
  {
    masterId: "m-1",
    masterName: ACCOUNTS[0].fullName,
    masterEmail: ACCOUNTS[0].email,
    teams: [TEAMS["m-1"][0]],
  },
];

function ok(result: unknown) {
  return { status: 200, contentType: "application/json", body: JSON.stringify({ isValid: true, errorMessages: [], result }) };
}

type MockOptions = {
  linksStatus?: number;
};

type SavedLinks = { links: Array<{ masterId: string; teamIds: string[] }> };

/** Simula as APIs usadas pela tela e devolve o que foi gravado. */
async function mockUsersApis(page: Page, options: MockOptions = {}) {
  const saved: { puts: Array<{ userId: string; body: SavedLinks }>; creates: unknown[] } = {
    puts: [],
    creates: [],
  };

  await page.route("**/api/q/backoffice/users", async (route: Route) => {
    if (route.request().method() === "POST") {
      saved.creates.push(route.request().postDataJSON());
      await route.fulfill(ok({ id: "u-new" }));
      return;
    }
    await route.fulfill(ok([OPERATOR, MANAGER]));
  });

  await page.route("**/api/q/backoffice/users/*/account-links", async (route: Route) => {
    const request = route.request();
    const userId = new URL(request.url()).pathname.split("/").at(-2) ?? "";

    if (request.method() === "PUT") {
      saved.puts.push({ userId, body: request.postDataJSON() as SavedLinks });
      await route.fulfill(ok([]));
      return;
    }
    if (options.linksStatus && options.linksStatus >= 400) {
      await route.fulfill({
        status: options.linksStatus,
        contentType: "application/json",
        body: JSON.stringify({ isValid: false, errorMessages: ["Erro simulado"], result: null }),
      });
      return;
    }
    await route.fulfill(ok(OPERATOR_LINKS));
  });

  await page.route("**/api/q/backoffice/users/*", async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill(ok(OPERATOR));
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/q/backoffice/platform-users?*", async (route: Route) => {
    const query = (new URL(route.request().url()).searchParams.get("q") ?? "").toLowerCase();
    const items = ACCOUNTS.filter((account) => `${account.fullName} ${account.email}`.toLowerCase().includes(query));
    await route.fulfill(ok({ items, pagination: { page: 1, pageSize: 8, totalItems: items.length, totalPages: 1 } }));
  });

  await page.route("**/api/q/backoffice/platform-users/*/teams", async (route: Route) => {
    const masterId = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    await route.fulfill(ok(TEAMS[masterId] ?? []));
  });

  return saved;
}

async function openEditDialog(page: Page, email: string) {
  await page.getByRole("button", { name: `Ações de ${email}` }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar usuário" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("app/backoffice/(app)/users", () => {
  test.setTimeout(120_000);

  let backofficeProfileId: string | null = null;
  let backofficeSupabaseId = "";
  let backofficeEmail = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    backofficeSupabaseId = randomUUID();
    backofficeEmail = `e2e.backoffice.users.${Date.now()}@example.com`;
    const profile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Users",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true },
    });
    backofficeProfileId = profile.id;

    await prisma.backofficeUser.create({
      data: { profileId: profile.id, email: backofficeEmail, fullAccess: true, isActive: true },
    });
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    if (backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: backofficeProfileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, { supabaseId: backofficeSupabaseId, email: backofficeEmail });
  });

  test("Operator edita as contas e times: remove um time e adiciona outra conta", async ({ page }) => {
    const saved = await mockUsersApis(page);
    await page.goto("/backoffice/users");
    await expect(page.getByRole("heading", { name: "Usuários Backoffice" })).toBeVisible({ timeout: 60_000 });

    const dialog = await openEditDialog(page, OPERATOR.email);
    const links = dialog.getByTestId("operator-account-links");
    await expect(links.getByText("Imobiliária Horizonte")).toBeVisible();
    await expect(links.getByRole("checkbox", { name: "Time Comercial" })).toBeChecked();
    await expect(links.getByRole("checkbox", { name: "Time Lançamentos" })).not.toBeChecked();

    await links.getByRole("checkbox", { name: "Time Lançamentos" }).click();
    await links.getByRole("button", { name: "Adicionar conta" }).click();
    await page.getByPlaceholder("Buscar conta por nome ou e-mail").fill("marina");
    await page.getByRole("option", { name: /Marina Corretora/ }).click();
    await links.getByRole("checkbox", { name: "Time Principal" }).click();

    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden();

    expect(saved.puts).toEqual([
      {
        userId: OPERATOR.id,
        body: {
          links: [
            { masterId: "m-1", teamIds: ["t-1", "t-2"] },
            { masterId: "m-2", teamIds: ["t-3"] },
          ],
        },
      },
    ]);
  });

  test("conta sem nenhum time marcado não é enviada", async ({ page }) => {
    const saved = await mockUsersApis(page);
    await page.goto("/backoffice/users");
    const dialog = await openEditDialog(page, OPERATOR.email);
    const links = dialog.getByTestId("operator-account-links");

    await links.getByRole("checkbox", { name: "Time Comercial" }).click();
    await expect(links.getByText("Marque ao menos um time")).toBeVisible();
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden();

    expect(saved.puts[0]?.body).toEqual({ links: [] });
  });

  test("Manager não tem a seção Contas e times", async ({ page }) => {
    await mockUsersApis(page);
    await page.goto("/backoffice/users");
    const dialog = await openEditDialog(page, MANAGER.email);

    await expect(dialog.getByRole("radio", { name: /Manager/ })).toBeChecked();
    await expect(dialog.getByTestId("operator-account-links")).toHaveCount(0);
  });

  test("falha ao carregar os vínculos mostra o erro e não grava nada", async ({ page }) => {
    const saved = await mockUsersApis(page, { linksStatus: 500 });
    await page.goto("/backoffice/users");
    const dialog = await openEditDialog(page, OPERATOR.email);
    const links = dialog.getByTestId("operator-account-links");

    await expect(links.getByText("Não foi possível carregar as contas e times")).toBeVisible();
    await expect(links.getByRole("button", { name: "Adicionar conta" })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden();
    expect(saved.puts).toHaveLength(0);
  });

  test("criar Operator salva o usuário e depois vincula a conta", async ({ page }) => {
    const saved = await mockUsersApis(page);
    await page.goto("/backoffice/users");
    await expect(page.getByRole("heading", { name: "Usuários Backoffice" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Criar Usuário" }).click();
    const dialog = page.getByRole("dialog", { name: "Criar Usuário Backoffice" });
    // O input do e-mail tem largura zero quando vazio (o sufixo é visual): foca e digita.
    await dialog.getByLabel("E-mail *").focus();
    await page.keyboard.type("novo.operator");
    await dialog.getByLabel("Nome completo *").fill("Novo Operator");
    await dialog.getByLabel("Senha temporária *").fill("senha-temporaria-1");

    const links = dialog.getByTestId("operator-account-links");
    await links.getByRole("button", { name: "Adicionar conta" }).click();
    await page.getByPlaceholder("Buscar conta por nome ou e-mail").fill("horizonte");
    await page.getByRole("option", { name: /Imobiliária Horizonte/ }).click();
    await links.getByRole("checkbox", { name: "Time Lançamentos" }).click();

    await dialog.getByRole("button", { name: "Criar Usuário" }).click();
    await expect(dialog).toBeHidden();

    expect(saved.creates).toHaveLength(1);
    expect(saved.puts).toEqual([
      { userId: "u-new", body: { links: [{ masterId: "m-1", teamIds: ["t-2"] }] } },
    ]);
  });

  test("no celular não estoura a largura e os alvos de toque do campo têm 44px", async ({ page }) => {
    await mockUsersApis(page);
    await page.goto("/backoffice/users");
    const dialog = await openEditDialog(page, OPERATOR.email);
    await expect(dialog.getByTestId("operator-account-links").getByRole("checkbox", { name: "Time Comercial" })).toBeVisible();

    // O campo novo é o escopo deste teste; os controles antigos da página têm
    // dívida própria de tamanho de toque e não entram nesta medição.
    await runResponsiveChecks(page, {
      touchTargets: {
        selector:
          '[data-testid="operator-account-links"] label[for], [data-testid="operator-account-links"] button:not([role="checkbox"])',
      },
    });
  });
});

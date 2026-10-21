import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

const CREDENTIAL_SENTINEL = "sk_e2e_SENTINEL_NEVER_RENDER_7c1d";

interface FakeCredential {
  key: string;
  isSet: boolean;
  last4: string | null;
  fingerprint: string | null;
  required: boolean;
  updatedAt: string | null;
}

interface FakeInstance {
  id: string;
  providerKey: "ASAAS" | "ABACATE_PAY";
  environment: "DEV" | "PRODUCTION";
  externalAccountContext: string;
  displayName: string;
  logoUrl: string | null;
  logoAltText: string | null;
  enabled: boolean;
  isDefault: boolean;
  rolloutState: "DISABLED" | "SANDBOX_VALIDATED" | "APPROVED" | "ACTIVE";
  killSwitch: boolean;
  configRevision: number;
  healthStatus: "UNKNOWN" | "HEALTHY" | "UNHEALTHY";
  lastHealthCheckAt: string | null;
  lastErrorCode: string | null;
  paymentCapable: boolean;
  credentials: FakeCredential[];
  settings: { requireSignature: boolean; cardEnabled: boolean };
}

const ADAPTERS = [
  {
    providerKey: "ABACATE_PAY",
    label: "Abacate Pay",
    paymentCapable: true,
    credentialSchema: [
      { key: "API_KEY", label: "Chave de API", required: true, secret: true, hint: null },
    ],
  },
  {
    providerKey: "ASAAS",
    label: "Asaas",
    paymentCapable: false,
    credentialSchema: [
      { key: "API_KEY", label: "Chave de API", required: true, secret: true, hint: null },
    ],
  },
];

function instance(overrides: Partial<FakeInstance>): FakeInstance {
  return {
    id: randomUUID(),
    providerKey: "ABACATE_PAY",
    environment: "PRODUCTION",
    externalAccountContext: "default",
    displayName: "Abacate Pay principal",
    logoUrl: null,
    logoAltText: null,
    enabled: true,
    isDefault: false,
    rolloutState: "ACTIVE",
    killSwitch: false,
    configRevision: 1,
    healthStatus: "HEALTHY",
    lastHealthCheckAt: null,
    lastErrorCode: null,
    paymentCapable: true,
    credentials: [
      { key: "API_KEY", isSet: false, last4: null, fingerprint: null, required: true, updatedAt: null },
    ],
    settings: { requireSignature: true, cardEnabled: false },
    ...overrides,
  };
}

function envelope(result: unknown) {
  return { isValid: true, successMessages: [], errorMessages: [], result };
}

async function mockProvidersApi(page: Page, state: FakeInstance[]) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/backoffice/payment-providers/config**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/payment-providers\/config/, "");
    const method = request.method();

    if (method === "GET" && path === "/adapters") return json(route, envelope({ adapters: ADAPTERS }));
    if (method === "GET" && path === "/history") return json(route, envelope({ items: [] }));
    if (method === "GET") {
      const environment = url.searchParams.get("environment");
      return json(route, envelope(state.filter((item) => item.environment === environment)));
    }

    const body = request.postDataJSON() ?? {};
    if (method === "POST" && path === "") {
      const created = instance({
        providerKey: body.providerKey,
        environment: body.environment,
        externalAccountContext: body.externalAccountContext,
        displayName: body.displayName,
        paymentCapable: body.providerKey === "ABACATE_PAY",
      });
      state.push(created);
      return json(route, envelope(created), 201);
    }
    if (method === "PUT" && path === "/credentials") {
      const target = state.find((item) => item.id === body.configId)!;
      target.credentials = target.credentials.map((c) =>
        c.key === body.key ? { ...c, isSet: true, last4: String(body.value).slice(-4), fingerprint: "fp_e2e" } : c,
      );
      target.configRevision += 1;
      return json(route, envelope(target));
    }
    if (method === "PUT") {
      const target = state.find((item) => item.id === body.id)!;
      if (body.isDefault) {
        for (const other of state) if (other.environment === target.environment) other.isDefault = false;
        target.isDefault = true;
      }
      target.configRevision += 1;
      return json(route, envelope(target));
    }
    return json(route, { isValid: false, errorMessages: ["Rota não simulada"], successMessages: [], result: null }, 404);
  });
}

async function expectNoCredentialValueInDom(page: Page) {
  const html = await page.content();
  expect(html).not.toContain(CREDENTIAL_SENTINEL);
  const values = await page.locator("input").evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  for (const value of values) expect(value).not.toContain(CREDENTIAL_SENTINEL);
}

test.describe("app/backoffice/(app)/payment-providers", () => {
  test.setTimeout(180_000);

  const suffix = randomUUID().slice(0, 8);
  let backofficeProfileId: string | null = null;
  let backofficeSupabaseId = "";
  let backofficeEmail = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    backofficeSupabaseId = randomUUID();
    backofficeEmail = `e2e.backoffice.providers.${suffix}@example.com`;
    const profile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Providers",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true },
    });
    backofficeProfileId = profile.id;
    await prisma.backofficeUser.create({
      data: { profileId: profile.id, email: profile.email, fullAccess: true, isActive: true },
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

  test("lista, cria instância, define credencial e troca o padrão sem expor o valor", async ({ page }) => {
    const state = [
      instance({ displayName: "Abacate Pay principal", isDefault: true }),
      instance({ displayName: "Abacate reserva" }),
      instance({
        providerKey: "ASAAS",
        displayName: "Asaas conta B",
        externalAccountContext: "conta-b",
        paymentCapable: false,
      }),
    ];
    await mockProvidersApi(page, state);

    await page.goto("/backoffice/payment-providers");
    await expect(page.getByRole("heading", { name: "Providers de pagamento" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Abacate Pay principal" })).toBeVisible();
    await expect(page.getByText("Somente credenciais")).toBeVisible();
    await runResponsiveChecks(page);

    // criar instância
    await page.getByRole("button", { name: "Nova instância" }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Adapter").click();
    await page.getByRole("option", { name: /^Abacate Pay/ }).click();
    await createDialog.getByLabel("Contexto da conta externa").fill("conta-c");
    await createDialog.getByLabel("Nome exibido").fill("Abacate conta C");
    await createDialog.getByRole("button", { name: "Criar instância" }).click();
    await expect(page.getByRole("heading", { name: "Abacate conta C" })).toBeVisible();

    // definir credencial
    await page.getByRole("button", { name: "Gerenciar Abacate reserva" }).click();
    const sheet = page.getByRole("dialog");
    const keyInput = sheet.getByLabel("Chave de API");
    await expect(keyInput).toHaveAttribute("type", "password");
    await keyInput.fill(CREDENTIAL_SENTINEL);
    await sheet.getByRole("button", { name: "Salvar", exact: true }).first().click();
    await expect(sheet.getByText(/Termina em 7c1d/)).toBeVisible();
    await expect(keyInput).toHaveValue("");
    await expectNoCredentialValueInDom(page);

    // tornar padrão com confirmação
    await sheet.getByRole("button", { name: "Tornar padrão" }).click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText("O padrão atual é “Abacate Pay principal”");
    await confirmation.getByRole("button", { name: "Tornar padrão" }).click();
    await expect(sheet.getByText("Esta instância já é o padrão do ambiente.")).toBeVisible();
    await expectNoCredentialValueInDom(page);
  });

  test("instância somente de credenciais não pode virar padrão", async ({ page }) => {
    await mockProvidersApi(page, [
      instance({ displayName: "Asaas conta B", providerKey: "ASAAS", paymentCapable: false }),
    ]);
    await page.goto("/backoffice/payment-providers");
    await page.getByRole("button", { name: "Gerenciar Asaas conta B" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: "Tornar padrão" })).toBeDisabled();
    await expect(sheet.getByTestId("make-default-reason")).toContainText("Somente credenciais");
  });

  test("em 360px não há overflow horizontal na lista nem no painel", async ({ page }) => {
    await mockProvidersApi(page, [instance({ displayName: "Abacate Pay principal", isDefault: true })]);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/backoffice/payment-providers");
    await page.getByRole("button", { name: "Gerenciar Abacate Pay principal" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

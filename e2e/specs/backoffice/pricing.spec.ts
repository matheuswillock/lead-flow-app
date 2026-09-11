import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function openCreatePricingDialog(page: Page) {
  await page.goto("/backoffice/pricing");
  const createButton = page.getByRole("button", { name: "Nova precificação" });
  await expect(createButton).toBeVisible({ timeout: 60_000 });
  await createButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Nova precificação")).toBeVisible();
  return dialog;
}

test.describe("app/backoffice/(app)/pricing", () => {
  test.setTimeout(180_000);

  const suffix = randomUUID().slice(0, 8);
  const productNamePrefix = `E2E Pricing ${suffix}`;
  let backofficeProfileId: string | null = null;
  let backofficeSupabaseId = "";
  let backofficeEmail = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    backofficeSupabaseId = randomUUID();
    backofficeEmail = uniqueEmail("e2e.backoffice.pricing");
    const profile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Pricing",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true },
    });
    backofficeProfileId = profile.id;

    await prisma.backofficeUser.create({
      data: {
        profileId: profile.id,
        email: profile.email,
        fullAccess: true,
        isActive: true,
      },
    });
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    await prisma.backofficeProduct
      .deleteMany({ where: { name: { startsWith: productNamePrefix } } })
      .catch(() => null);
    if (backofficeProfileId) {
      await prisma.backofficeUser
        .deleteMany({ where: { profileId: backofficeProfileId } })
        .catch(() => null);
      await prisma.profile.deleteMany({ where: { id: backofficeProfileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, {
      supabaseId: backofficeSupabaseId,
      email: backofficeEmail,
    });
  });

  test("carrega sem erro e mostra o heading e o CTA principal", async ({ page }) => {
    await page.goto("/backoffice/pricing");
    await expect(page.getByRole("heading", { name: "Precificação" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("button", { name: "Nova precificação" })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("cria precificação digitando 10.000,00 e grava 10000 no banco", async ({ page }) => {
    const productName = `${productNamePrefix} criar`;
    const dialog = await openCreatePricingDialog(page);

    await dialog.getByLabel("Nome *").fill(productName);

    const firstSlugCheckbox = dialog.getByRole("checkbox").first();
    await expect(firstSlugCheckbox).toBeVisible({ timeout: 30_000 });
    await firstSlugCheckbox.click();

    await dialog.getByRole("button", { name: "Mensal" }).click();

    const pixInput = dialog.locator("#monthly-pix");
    await pixInput.click();
    await pixInput.pressSequentially("10.000,00");
    await expect(pixInput).toHaveValue("10.000,00");
    await pixInput.press("Tab");
    await expect(pixInput).toHaveValue("R$ 10.000,00");

    const cardInput = dialog.locator("#monthly-card");
    await cardInput.click();
    await cardInput.pressSequentially("12.345,67");
    await expect(cardInput).toHaveValue("12.345,67");
    await cardInput.press("Tab");
    await expect(cardInput).toHaveValue("R$ 12.345,67");

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/backoffice/pricing") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Salvar" }).click();
    const response = await createResponse;
    expect(response.status()).toBe(201);
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const prisma = getPrisma();
    const product = await prisma.backofficeProduct.findFirst({
      where: { name: productName },
      select: {
        id: true,
        priceMonthly: true,
        paymentRules: {
          select: { paymentMethod: true, billingCycle: true, price: true },
        },
      },
    });
    expect(product).not.toBeNull();
    const pixRule = product?.paymentRules.find(
      (rule) => rule.paymentMethod === "PIX" && rule.billingCycle === "monthly",
    );
    const cardRule = product?.paymentRules.find(
      (rule) => rule.paymentMethod === "CREDIT_CARD" && rule.billingCycle === "monthly",
    );
    expect(Number(pixRule?.price)).toBe(10000);
    expect(Number(cardRule?.price)).toBe(12345.67);
    expect(Number(product?.priceMonthly)).toBe(10000);
  });

  test("digitação sequencial de 12.345,67 fica íntegra e o total usa o valor real", async ({
    page,
  }) => {
    const dialog = await openCreatePricingDialog(page);
    await dialog.getByRole("button", { name: "Mensal" }).click();

    const pixInput = dialog.locator("#monthly-pix");
    await pixInput.click();
    await pixInput.pressSequentially("12.345,67");
    // Cursor não saltou: o texto digitado permanece exatamente como digitado.
    await expect(pixInput).toHaveValue("12.345,67");
    // Total do ciclo calculado com o valor real (mensal → total = valor).
    await expect(dialog.getByText("Total PIX: R$ 12.345,67")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("edição hidrata R$ 12.345,67 e salvar sem tocar não corrompe o valor", async ({
    page,
  }) => {
    const productName = `${productNamePrefix} editar`;
    const prisma = getPrisma();
    const product = await prisma.backofficeProduct.create({
      data: {
        name: productName,
        featureSlugs: ["crm"],
        type: "PLAN",
        billingMode: "RECURRING",
        priceMonthly: 12345.67,
        isDefault: false,
        isActive: true,
        paymentRules: {
          create: [
            {
              paymentMethod: "PIX",
              billingCycle: "monthly",
              price: 12345.67,
              canInstallment: false,
              maxInstallments: 1,
              installmentSplitMode: "EQUAL",
              installmentSchedule: [],
            },
            {
              paymentMethod: "CREDIT_CARD",
              billingCycle: "monthly",
              price: 12345.67,
              canInstallment: false,
              maxInstallments: 1,
              installmentSplitMode: "EQUAL",
              installmentSchedule: [],
            },
          ],
        },
      },
      select: { id: true },
    });

    await page.goto("/backoffice/pricing");
    const actionsButton = page.getByRole("button", { name: `Ações de ${productName}` });
    await expect(actionsButton).toBeVisible({ timeout: 60_000 });
    await actionsButton.click();
    await page.getByRole("menuitem", { name: "Editar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Editar precificação")).toBeVisible();
    await expect(dialog.locator("#monthly-pix")).toHaveValue("R$ 12.345,67");
    await expect(dialog.locator("#monthly-card")).toHaveValue("R$ 12.345,67");

    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/backoffice/pricing/${product.id}`) &&
        response.request().method() === "PUT",
    );
    await dialog.getByRole("button", { name: "Salvar" }).click();
    const response = await updateResponse;
    expect(response.status()).toBe(200);
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const saved = await prisma.backofficeProduct.findUnique({
      where: { id: product.id },
      select: {
        priceMonthly: true,
        paymentRules: { select: { paymentMethod: true, price: true } },
      },
    });
    expect(Number(saved?.priceMonthly)).toBe(12345.67);
    for (const rule of saved?.paymentRules ?? []) {
      expect(Number(rule.price)).toBe(12345.67);
    }
  });
});

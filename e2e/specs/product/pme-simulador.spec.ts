import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks } from "../../support/responsive";

const QUOTE_NAME = "Cotação E2E pme-simulador";

test.describe("app/[supabaseId]/pme-simulador", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    );
  });

  test.afterAll(async () => {
    await getPrisma().planQuote.deleteMany({ where: { nome: QUOTE_NAME } });
    await disconnectPrisma();
  });

  test("abre a lista de cotações com a ação de nova cotação", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/pme-simulador`);
    await expect(page.getByRole("heading", { name: "Cotações" })).toBeVisible();
    // Lista vazia: o botão do topo e o do estado vazio.
    await expect(page.getByRole("button", { name: "Nova cotação" }).first()).toBeVisible();
  });

  test("assistente leva das vidas aos resultados da cotação", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/pme-simulador`);
    await page.getByRole("button", { name: "Nova cotação" }).first().click();

    await page.getByLabel("Nome da cotação").fill(QUOTE_NAME);
    await page.getByRole("button", { name: "Adicionar uma vida de 00 a 18 anos" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByRole("button", { name: "São Paulo" }).click();
    await page.getByRole("button", { name: "Ver operadoras" }).click();

    await expect(page.getByLabel("Nome da cotação")).toHaveValue(QUOTE_NAME);
    await expect(page.getByRole("button", { name: /Enviar ao cliente/ })).toBeDisabled();
  });

  test("breadcrumb do header global leva de volta à lista de cotações", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/pme-simulador`);
    await page.getByRole("button", { name: "Nova cotação" }).first().click();

    const header = page.locator("header").first();
    await expect(header.getByText("Nova cotação")).toBeVisible();
    await header.getByRole("link", { name: "Simulador de Planos" }).click();

    await expect(page.getByRole("heading", { name: "Cotações" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/pme-simulador$`));
  });

  test("não estoura a largura em telas pequenas", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/pme-simulador`);
    await runResponsiveChecks(page);
  });
});

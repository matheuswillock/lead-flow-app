import { expect, test, type Page } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks } from "../../support/responsive";

/**
 * Regressão: editar um contrato PJ (corporate) pela Carteira enviava o PATCH
 * para /api/v1/portfolio/[leadId]/detail sem `contractType`/`holder.razaoSocial`
 * (`CarteiraDetailModal.handleContractEditSave`). A API, sem saber que o
 * contrato é corporate, assumia `individual` e exigia CPF — campo que esse
 * tipo de contrato nunca mostra. Ver app/api/v1/portfolio/[leadId]/detail/route.ts.
 */

const CORPORATE_LEAD_ID = "e2e30000-0000-4000-8000-000000000401";
const CORPORATE_LEAD_CODE = "E2ELEADCARTEIRA01";
const CORPORATE_RAZAO_SOCIAL = "Empresa E2E Carteira LTDA";

async function seedCorporatePortfolioEntry() {
  const prisma = getPrisma();
  const profile = await findE2eMasterProfile();
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
  if (!profile.activeTeamId) throw new Error("Team E2E não encontrado");
  const teamId = profile.activeTeamId;

  await prisma.lead.deleteMany({ where: { id: CORPORATE_LEAD_ID } });
  await prisma.lead.create({
    data: {
      id: CORPORATE_LEAD_ID,
      leadCode: CORPORATE_LEAD_CODE,
      managerId: profile.id,
      teamId,
      closerId: profile.id,
      status: "contract_finalized",
      name: CORPORATE_RAZAO_SOCIAL,
      createdBy: profile.id,
      updatedBy: profile.id,
      ticket: 1500,
      soldPlan: "Plano Empresarial",
      contractDueDate: new Date("2027-01-01T00:00:00.000Z"),
    },
  });

  await prisma.leadPortfolio.create({
    data: {
      leadId: CORPORATE_LEAD_ID,
      teamId,
      portfolioStatus: "active",
      source: "crm",
    },
  });

  const finalized = await prisma.leadFinalized.create({
    data: {
      leadId: CORPORATE_LEAD_ID,
      finalizedDateAt: new Date("2026-01-05T00:00:00.000Z"),
      startDateAt: new Date("2026-01-01T00:00:00.000Z"),
      duration: 4,
      amount: 1500,
      contractType: "corporate",
      closerId: profile.id,
      operadora: "Unimed",
      productName: "Plano Empresarial",
    },
  });

  await prisma.leadFinalizedHolder.create({
    data: {
      leadFinalizedId: finalized.id,
      name: CORPORATE_RAZAO_SOCIAL,
      razaoSocial: CORPORATE_RAZAO_SOCIAL,
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      document: "",
      cnpj: "12345678000199",
    },
  });

  return { teamId };
}

/**
 * Mesma armadilha SWR do CRM (ver invalidateTeamLeadsCache em crm.spec.ts):
 * `getCachedPortfolioList`/`getCachedPortfolioDetail` usam `cacheLife({
 * revalidate: 60 })`. Um PATCH sem `holder` não cai no superRefine de
 * CPF/CNPJ — serve só para invalidar a tag via `invalidatePortfolioCache`
 * como a mutação real do app faria.
 */
async function invalidatePortfolioEntryCache(page: Page, teamId: string) {
  const headers = {
    "x-supabase-user-id": E2E_MASTER_SUPABASE_ID,
    "x-team-id": teamId,
  };
  const warmResponse = await page.request.patch(
    `/api/v1/portfolio/${CORPORATE_LEAD_ID}/detail`,
    { headers, data: { notes: "e2e warm-up" } },
  );
  expect(warmResponse.ok(), "PATCH de invalidação do cache da carteira falhou").toBe(true);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `/api/v1/portfolio/${CORPORATE_LEAD_ID}/detail`,
          { headers },
        );
        if (!response.ok()) return false;
        const body = (await response.json()) as { result?: { contractType?: string } };
        return body.result?.contractType === "corporate";
      },
      {
        message: "detalhe da carteira reflete o seed corporate após invalidação",
        timeout: 15_000,
      },
    )
    .toBe(true);
}

/**
 * Sem filtro de nome: a busca unificada da carteira envia o mesmo texto em
 * `search` e `documentSearch`, e o servidor exige os dois. Para um nome,
 * `documentSearch` nunca casa e a lista zera depois do debounce, o que deixa a
 * linha que o teste clica ser desmontada antes do clique. A linha semeada é a
 * mais recente (createdAt desc), então fica na primeira página sem filtro.
 */
async function waitForSeededPortfolioRow(page: Page, name: string) {
  await expect(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("row", { name: `Abrir ${name}` })).toBeVisible({
      timeout: 10_000,
    });
  }).toPass({ timeout: 120_000 });
}

async function openEditDialog(page: Page) {
  await page.getByRole("row", { name: `Abrir ${CORPORATE_RAZAO_SOCIAL}` }).click();
  await expect(page.getByRole("button", { name: "Editar" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Editar" }).click();
}

test.describe("app/[supabaseId]/carteira", () => {
  // 240s: o fluxo reabre o diálogo e espera a linha semeada duas vezes
  // (antes e depois do reload interno de assertReducedMotion em
  // runResponsiveChecks) — mesma fronteira SWR de revalidate:60 do CRM
  // (ver waitForSeededLeadOnBoard em crm.spec.ts), em dobro.
  test.setTimeout(240_000);

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
    const prisma = getPrisma();
    await prisma.lead.deleteMany({ where: { id: CORPORATE_LEAD_ID } });
    await disconnectPrisma();
  });

  test("editar contrato corporate pela carteira não exige CPF do titular", async ({ page }) => {
    const { teamId } = await seedCorporatePortfolioEntry();
    await invalidatePortfolioEntryCache(page, teamId);

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/carteira`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Carteira" })).toBeVisible({ timeout: 30_000 });
    await waitForSeededPortfolioRow(page, CORPORATE_RAZAO_SOCIAL);
    await openEditDialog(page);

    /**
     * Responsividade do diálogo de edição, antes do fluxo funcional (o
     * `assertReducedMotion` recarrega a página e fecha o diálogo — por isso
     * reabrimos depois). Exclui `[role="radio"]`: os círculos de
     * contractType/source são radios do Radix — a área de toque real é o
     * `<label>` ao redor, não o círculo de 16px (mesmo padrão do componente
     * nativo). Para o botão `h-9`/36px do design system (abaixo do piso de
     * 44px), mesma tolerância já aplicada em outras specs para o botão
     * padrão do shadcn (ver integrations-webhooks-outbound.spec.ts). A
     * toolbar da listagem (abas Clientes/Renovações, ordenação da tabela)
     * tem violações mais graves e pré-existentes, de todo o app, não desta
     * mudança; escopo deste teste é só o diálogo que esta correção toca.
     */
    await runResponsiveChecks(page, {
      touchTargets: { selector: '[role="dialog"] button:not([role="radio"])', minSize: 32 },
    });
    await waitForSeededPortfolioRow(page, CORPORATE_RAZAO_SOCIAL);
    await openEditDialog(page);

    const submitButton = page.getByRole("button", { name: "Salvar alterações" });
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    // O browser chama /api/q/... (API_CLIENT_BASE mascara /api/v1 — ver
    // lib/route-map/index.ts), por isso o match é pelo sufixo do path.
    const patchResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/portfolio/${CORPORATE_LEAD_ID}/detail`) &&
        response.request().method() === "PATCH",
    );
    await submitButton.click();
    const response = await patchResponse;
    const body = (await response.json()) as { isValid: boolean; errorMessages: string[] };

    expect(
      body.errorMessages,
      "contrato corporate pela carteira não deve exigir CPF do titular",
    ).not.toContain("O CPF do titular é obrigatório");
    expect(body.isValid).toBe(true);
    await expect(page.getByText("Dados atualizados com sucesso")).toBeVisible({ timeout: 10_000 });
  });

  test("busca unificada encontra o cliente pelo nome e pelo CNPJ", async ({ page }) => {
    const { teamId } = await seedCorporatePortfolioEntry();
    await invalidatePortfolioEntryCache(page, teamId);

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/carteira`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Carteira" })).toBeVisible({ timeout: 30_000 });
    const search = page.getByPlaceholder("Nome do cliente ou CPF / CNPJ / RG...");

    // Espera a resposta da própria busca: a linha sem filtro já aparece antes do debounce e não prova nada.
    const responseFor = (param: string, value: string) =>
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname.endsWith("/portfolio") && url.searchParams.get(param) === value;
      });

    const byName = responseFor("search", CORPORATE_RAZAO_SOCIAL);
    await search.fill(CORPORATE_RAZAO_SOCIAL);
    await byName;
    await expect(page.getByRole("row", { name: `Abrir ${CORPORATE_RAZAO_SOCIAL}` })).toBeVisible({
      timeout: 15_000,
    });

    const byDocument = responseFor("documentSearch", "12345678000199");
    await search.fill("12345678000199");
    await byDocument;
    await expect(page.getByRole("row", { name: `Abrir ${CORPORATE_RAZAO_SOCIAL}` })).toBeVisible({
      timeout: 15_000,
    });
  });
});

import { expect, test } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { disconnectPrisma, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

test.describe("app/cotacao/[token]", () => {
  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("mostra estado de link inexistente para um token que não existe", async ({ page }) => {
    await page.goto(`/cotacao/${randomBytes(24).toString("base64url")}`);
    await expect(page.getByText("Este link não existe ou foi removido.")).toBeVisible();
  });

  test("mostra a cotação enviada, somente leitura, a partir do snapshot", async ({ page }) => {
    const prisma = getPrisma();
    const suffix = randomUUID().slice(0, 8);
    const owner = await prisma.profile.create({
      data: { email: `e2e.cotacao.${suffix}@example.com`, supabaseId: randomUUID(), fullName: "E2E Cotação" },
    });
    const team = await prisma.team.create({ data: { name: `E2E Cotação ${suffix}`, masterId: owner.id } });
    const quote = await prisma.planQuote.create({
      data: {
        teamId: team.id,
        ownerProfileId: owner.id,
        nome: `Cotação E2E ${suffix}`,
        state: { lives: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0], uf: "SP", filters: {}, sel: [] },
      },
    });
    const token = randomBytes(24).toString("base64url");
    await prisma.planQuoteShare.create({
      data: {
        quoteId: quote.id,
        token,
        payload: {
          v: 1,
          nome: `Cotação E2E ${suffix}`,
          geradoEm: new Date().toISOString(),
          uf: "SP",
          lives: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          filters: {
            acomodacoes: [],
            coparticipacoes: [],
            contratacoes: [],
            hospitalIds: [],
            mei: false,
            respeitarMinimoVidas: true,
            valorMin: null,
            valorMax: null,
          },
          plans: [
            {
              chave: `e2e-${suffix}`,
              operadora: "Amil",
              logoPath: "/operadoras/amil.svg",
              produto: "Produto E2E",
              precos: { "00-18": 99.95 },
              plano: "Plano E2E",
              tabela: "Tabela E2E",
              acomodacao: "Apartamento",
              contratacao: "Livre",
              coparticipacao: "Sem coparticipação",
              coparticipacaoTabela: "Completa",
              aceitaMei: false,
              vidasMin: 1,
              vidasMax: 29,
              total: 199.9,
              regras: [{ tipo: "Carências", texto: "Carência de 180 dias." }],
              rede: { hospitais: [], laboratorios: [] },
            },
          ],
        },
      },
    });

    await page.goto(`/cotacao/${token}`);
    await expect(page.getByRole("heading", { name: `Cotação E2E ${suffix}` })).toBeVisible();
    await expect(page.getByText("Plano E2E")).toBeVisible();
    await expect(page.getByRole("button", { name: /Incluir|Excluir|Salvar/ })).toHaveCount(0);

    await prisma.planQuoteShare.deleteMany({ where: { token } });
    await prisma.planQuote.deleteMany({ where: { id: quote.id } });
    await prisma.team.deleteMany({ where: { id: team.id } });
    await prisma.profile.deleteMany({ where: { id: owner.id } });
  });

  test("não estoura a largura em telas pequenas", async ({ page }) => {
    await page.goto(`/cotacao/${randomBytes(24).toString("base64url")}`);
    await runResponsiveChecks(page);
  });
});

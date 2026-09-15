/**
 * app/[supabaseId]/email/campanhas/page.tsx
 *
 * PR6: copy do AlertDialog de cancelar envio.
 * develop/PR7: wizard subtrai bounce permanente e avisa.
 */

import { randomUUID } from "node:crypto"
import { expect, test, type Page, type Request } from "@playwright/test"
import { formatPermanentBounceAlert } from "@/lib/email/campaign-audience-copy"
import {
  CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY,
  CAMPAIGN_CANCEL_SENDING_UNSENT_COPY,
} from "@/lib/email/campaign-dispatch-copy"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"

test.describe("app/[supabaseId]/email/campanhas", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true")
    }, E2E_MASTER_SUPABASE_ID)
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega sem erro e mostra o heading Campanhas", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.locator("h1.text-2xl", { hasText: "Campanhas" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText("Acesso não liberado")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible()
  })

  test("AlertDialog de cancelar envio avisa que não enviados não saem", async ({ page }) => {
    const profile = await findE2eMasterProfile()
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E sem time ativo")
    }

    const prisma = getPrisma()
    const templateId = randomUUID()
    const campaignId = randomUUID()
    await prisma.emailTemplate.create({
      data: {
        id: templateId,
        versionGroupId: templateId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: "E2E cancel copy",
        subject: "Assunto E2E",
        html: "<p>Olá</p>",
        status: "published",
        versionNumber: 1,
      },
    })
    await prisma.emailCampaign.create({
      data: {
        id: campaignId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: "E2E Cancelar Envio",
        templateId,
        status: "sending",
        totalRecipients: 10,
      },
    })

    try {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
        waitUntil: "domcontentloaded",
      })
      const campaignRow = page.getByRole("row").filter({ hasText: "E2E Cancelar Envio" })
      await expect(campaignRow).toBeVisible({ timeout: 30_000 })
      const menuButton = campaignRow.getByRole("button", { name: "Abrir menu" })
      await menuButton.scrollIntoViewIfNeeded()
      await menuButton.click()
      await page.getByRole("menuitem", { name: "Cancelar envio" }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await expect(page.getByText(CAMPAIGN_CANCEL_SENDING_UNSENT_COPY)).toBeVisible()
      await expect(page.getByText(CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY)).toBeVisible()
    } finally {
      await prisma.emailCampaign.delete({ where: { id: campaignId } }).catch(() => {})
      await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
    }
  })

  test("wizard avisa bounce permanente e subtrai da audiência", async ({ page }) => {
    const profile = await findE2eMasterProfile()
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E sem time ativo")
    }

    const prisma = getPrisma()
    const templateId = randomUUID()
    const listId = randomUUID()
    const listName = "E2E Bounce Permanente"
    const templateName = "E2E Template Bounce"

    await prisma.emailTemplate.create({
      data: {
        id: templateId,
        versionGroupId: templateId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: templateName,
        subject: "Assunto E2E bounce",
        html: "<p>Olá</p>",
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
        publishedAt: new Date(),
        versionNumber: 1,
      },
    })
    await prisma.emailContactList.create({
      data: {
        id: listId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: listName,
        totalContacts: 5,
      },
    })
    await prisma.emailContact.createMany({
      data: [
        { listId, email: "ativo-a@e2e.bounce.test", name: "Ativo A" },
        { listId, email: "ativo-b@e2e.bounce.test", name: "Ativo B" },
        { listId, email: "bounce-a@e2e.bounce.test", name: "Bounce A", isBounced: true },
        { listId, email: "bounce-b@e2e.bounce.test", name: "Bounce B", isBounced: true },
        { listId, email: "bounce-c@e2e.bounce.test", name: "Bounce C", isBounced: true },
      ],
    })

    try {
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
        waitUntil: "domcontentloaded",
      })
      await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible({
        timeout: 30_000,
      })
      await page.getByRole("button", { name: /Nova Campanha/i }).click()
      await expect(page.getByRole("dialog")).toBeVisible()

      await page.getByLabel("Nome da campanha *").fill("E2E Campanha Bounce")
      await page.getByRole("button", { name: "Próxima" }).click()

      await expect(page.getByText(listName, { exact: false })).toBeVisible()
      await page.getByText(listName, { exact: false }).click()
      await page.getByRole("button", { name: "Próxima" }).click()

      await page.getByRole("combobox").click()
      await page.getByRole("option", { name: templateName }).click()
      await page.getByRole("button", { name: "Próxima" }).click()

      await expect(page.getByText(formatPermanentBounceAlert(3))).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText("Total: 2 destinatários")).toBeVisible()
      await expect(page.getByText("3 bounce permanente")).toBeVisible()
    } finally {
      await prisma.emailContact.deleteMany({ where: { listId } }).catch(() => {})
      await prisma.emailContactList.delete({ where: { id: listId } }).catch(() => {})
      await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
    }
  })

  /**
   * Adenda E1/E1b (SPEC 31, todo 9/9b) — caso Rafael 10/09: adiamento
   * silencioso e botão "Disparar" sem estado honesto.
   *
   * T-M31.11/12 (motivo visível, token de aviso — não destrutivo) e
   * T-M31.13/14 (gating do botão) rodam como unit test em
   * `getCampaignSendBlockReason.test.ts` e `campaign-dispatch-availability.test.ts`,
   * onde o cenário de teto diário quase esgotado (starvation em cascata) é
   * determinístico. Em E2E o time de seed é compartilhado entre workers
   * (contagem de envios do dia variável — ver nota de projeto sobre flake
   * sistêmico cross-worker), então os dois testes abaixo cobrem apenas os
   * caminhos que NÃO dependem do consumo do teto: o motivo persistido
   * (estático, independe de contagem) e o bloqueio de "parte já enviada"
   * (por status, não por contagem).
   */
  test.describe("adiamento visível e botão com estado honesto", () => {
    test("ficha apresenta o adiamento como falha de disparo — chip Adiada destrutivo + motivo do limite", async ({
      page,
    }) => {
      const profile = await findE2eMasterProfile()
      if (!profile?.activeTeamId) {
        throw new Error("Seed E2E sem time ativo")
      }

      const prisma = getPrisma()
      const templateId = randomUUID()
      const parentId = randomUUID()
      const subId = randomUUID()
      const deferMessage =
        "Adiada: limite diário de envio atingido (2.000/2.000) — o teto libera à meia-noite, mas os envios seguem a ordem de agendamento; partes mais antigas saem primeiro."

      await prisma.emailTemplate.create({
        data: {
          id: templateId,
          versionGroupId: templateId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Adiamento Template",
          subject: "Assunto E2E adiamento",
          html: "<p>Olá</p>",
          status: "published",
          versionNumber: 1,
        },
      })
      await prisma.emailCampaign.create({
        data: {
          id: parentId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Adiamento Pai",
          templateId,
          status: "partially_sent",
          totalRecipients: 5,
        },
      })
      await prisma.emailCampaign.create({
        data: {
          id: subId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Adiamento Pai (parte 1/1)",
          templateId,
          parentCampaignId: parentId,
          subCampaignIndex: 0,
          status: "scheduled",
          scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
          totalRecipients: 5,
          errorMessage: deferMessage,
        },
      })

      try {
        await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
          waitUntil: "domcontentloaded",
        })
        const row = page.getByRole("row").filter({ hasText: "E2E Adiamento Pai" })
        await expect(row).toBeVisible({ timeout: 30_000 })
        const menuButton = row.getByRole("button", { name: "Abrir menu" })
        await menuButton.scrollIntoViewIfNeeded()
        await menuButton.click()
        await page.getByRole("menuitem", { name: "Visualizar" }).click()

        await expect(page.getByRole("heading", { name: "E2E Adiamento Pai" })).toBeVisible()
        // A célula "Parte" mostra só o índice (subCampaignIndex), não o nome —
        // localiza a linha pelo próprio motivo, já confirmado visível.
        const motivoCell = page.getByText(deferMessage, { exact: false })
        await expect(motivoCell).toBeVisible()
        // Decisão do owner (15/09, caso Kathrein): adiamento é APRESENTADO
        // como falha de disparo — chip "Adiada" destrutivo e a linha com o
        // mesmo destaque de falha. O status interno segue `scheduled` (o
        // cron redispara sozinho), mas o operador precisa VER que não saiu
        // e o porquê.
        const motivoRow = page.getByRole("row").filter({ has: motivoCell })
        await expect(motivoRow).toHaveClass(/bg-semantic-danger-surface/)
        await expect(motivoRow.getByText("Adiada", { exact: true })).toBeVisible()

        // Verificação visual medida (MUST do agents.md): sem overflow
        // horizontal em 360px com as colunas novas (Disparado em / Motivo).
        await page.setViewportSize({ width: 360, height: 800 })
        await expect(motivoCell).toBeVisible()
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1)
      } finally {
        await prisma.emailCampaign.deleteMany({ where: { id: { in: [subId, parentId] } } })
        await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
      }
    })

    test("parte já enviada não pode ser disparada de novo — botão desabilitado com tooltip explicando o motivo", async ({
      page,
    }) => {
      const profile = await findE2eMasterProfile()
      if (!profile?.activeTeamId) {
        throw new Error("Seed E2E sem time ativo")
      }

      const prisma = getPrisma()
      const templateId = randomUUID()
      const parentId = randomUUID()
      const subId = randomUUID()

      await prisma.emailTemplate.create({
        data: {
          id: templateId,
          versionGroupId: templateId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Ja Enviada Template",
          subject: "Assunto E2E já enviada",
          html: "<p>Olá</p>",
          status: "published",
          versionNumber: 1,
        },
      })
      await prisma.emailCampaign.create({
        data: {
          id: parentId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Ja Enviada Pai",
          templateId,
          status: "sent",
          totalRecipients: 5,
          totalSent: 5,
        },
      })
      await prisma.emailCampaign.create({
        data: {
          id: subId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: "E2E Ja Enviada Pai (parte 1/1)",
          templateId,
          parentCampaignId: parentId,
          subCampaignIndex: 0,
          status: "sent",
          totalRecipients: 5,
          totalSent: 5,
          sentAt: new Date(),
        },
      })

      try {
        await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
          waitUntil: "domcontentloaded",
        })
        const row = page.getByRole("row").filter({ hasText: "E2E Ja Enviada Pai" })
        await expect(row).toBeVisible({ timeout: 30_000 })
        const menuButton = row.getByRole("button", { name: "Abrir menu" })
        await menuButton.scrollIntoViewIfNeeded()
        await menuButton.click()
        await page.getByRole("menuitem", { name: "Visualizar" }).click()

        await expect(page.getByRole("heading", { name: "E2E Ja Enviada Pai" })).toBeVisible()
        const dispatchButton = page.getByRole("button", { name: "Disparar" }).first()
        await expect(dispatchButton).toBeVisible()
        await expect(dispatchButton).toBeDisabled()

        // Tooltip acessível por foco: o botão está `disabled` (nunca recebe
        // foco de teclado sozinho), então o trigger de verdade é o `span`
        // com `tabIndex=0` que o envolve — mesmo padrão do
        // PrefillFieldIndicator (PR #1157) adaptado para elemento nativo
        // desabilitado.
        const tooltipTrigger = page.locator("span").filter({ has: dispatchButton })
        await tooltipTrigger.focus()
        await expect(
          page.getByText("Parte já enviada", { exact: false })
        ).toBeVisible({ timeout: 5_000 })
      } finally {
        await prisma.emailCampaign.deleteMany({ where: { id: { in: [subId, parentId] } } })
        await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
      }
    })
  })

  /**
   * Cadência do polling de progresso de disparo.
   *
   * O provider vive no layout autenticado, então o intervalo roda em qualquer
   * rota. Estes testes contam requisições reais em vez de julgar o código: é a
   * única forma de provar que o caso ocioso caiu sem estragar o caso de disparo.
   */
  test.describe("cadência do polling de dispatch", () => {
    /** Conta hits em /email/campaigns durante uma janela. */
    async function countCampaignPolls(page: Page, windowMs: number): Promise<number> {
      let hits = 0
      const onRequest = (request: Request) => {
        if (request.url().includes("/email/campaigns")) hits += 1
      }
      page.on("request", onRequest)
      await page.waitForTimeout(windowMs)
      page.off("request", onRequest)
      return hits
    }

    test("aba oculta não dispara polling", async ({ page }) => {
      // CampaignDispatchRealtimeContext.tsx faz UM fetch de montagem (linhas
      // 276-278) assim que o TeamContext resolve `activeTeamId`/`user.id` —
      // esse disparo é incondicional de visibilidade por desenho (só o
      // setInterval recorrente, linhas 280-319, é gated por
      // document.visibilityState; em /board sem campanha "sending" o
      // intervalo armado é o ocioso de 60s, fora do alcance desta janela).
      // Um `waitForTimeout` fixo presumia quanto tempo o TeamContext leva
      // para resolver sob carga de CI; em vez disso esperamos a CONDIÇÃO
      // real — a própria requisição de montagem começar — antes de forçar a
      // aba oculta. O listener precisa ser registrado ANTES do goto para não
      // perder uma resolução rápida (ex.: bootstrap cache já hidratado).
      const initialMountFetchStarted = page
        .waitForRequest((request) => request.url().includes("/email/campaigns"), {
          timeout: 20_000,
        })
        .catch(() => null)

      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" })

      // /board é PPR (Partial Prerendering): o shell estático responde e
      // dispara "domcontentloaded" ANTES do redirect() server-side (para
      // /crm) terminar de se resolver via navegação client-side pós-
      // hidratação. Sem esperar a URL final assentar, o page.evaluate abaixo
      // corre risco real de cair no meio dessa troca de página e estourar
      // "Execution context was destroyed" — visto na prática ao rodar com
      // --repeat-each.
      await page.waitForURL((url) => url.pathname.includes("/crm"), { timeout: 20_000 })
      await initialMountFetchStarted

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        })
        document.dispatchEvent(new Event("visibilitychange"))
      })

      // Drena antes de abrir a janela estrita: visibilitychange não cancela
      // um fetch já em voo, então a resposta daquela requisição de montagem
      // ainda pode aterrissar alguns instantes depois do evento.
      await countCampaignPolls(page, 4_000)

      const hits = await countCampaignPolls(page, 10_000)
      expect(hits, "aba oculta não deve consultar campanhas").toBe(0)
    })

    test("fora do módulo de e-mail e sem disparo, a cadência é baixa", async ({ page }) => {
      // /board não tem relação com e-mail; antes desta mudança o intervalo de 4s
      // rodava aqui do mesmo jeito, gerando ~15 requisições por minuto.
      //
      // Este teste já tolera <=1 hit — exatamente o fetch único de montagem
      // descrito no teste acima — então não sofre da mesma corrida: sem
      // campanha "sending", o intervalo recorrente que se arma aqui é o
      // ocioso de 60s, que não cabe dentro dos 12s desta janela. Avaliado e
      // mantido sem alteração ao investigar o flake de "aba oculta não
      // dispara polling".
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(3_000)

      const hits = await countCampaignPolls(page, 12_000)
      expect(hits, `esperado no máximo 1 hit em 12s, veio ${hits}`).toBeLessThanOrEqual(1)
    })
  })
})

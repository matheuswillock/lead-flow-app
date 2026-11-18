import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../support/db"
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal"
import { runResponsiveChecks } from "../../support/responsive"

const DAY_MS = 24 * 60 * 60 * 1000

async function createPastDueMaster(dueDaysAgo: number) {
  const prisma = getPrisma()
  const supabaseId = randomUUID()
  const email = `e2e.account-access.${randomUUID()}@example.com`
  // Conta real sempre teve um produto contratado antes de cair em atraso — sem isso,
  // a carência genérica não tem o que liberar em modo leitura (nada em paidProductSlugs).
  const crmProduct = await prisma.backofficeProduct.findFirstOrThrow({
    where: { isActive: true, featureSlugs: { has: "crm" } },
  })
  const profile = await prisma.profile.create({
    data: {
      email,
      supabaseId,
      fullName: "E2E Account Access Calendar",
      isMaster: true,
      subscriptionStatus: "past_due",
    },
  })
  const team = await prisma.team.create({
    data: { name: `E2E Calendar ${supabaseId.slice(0, 8)}`, masterId: profile.id },
  })
  await prisma.teamMember.create({ data: { teamId: team.id, profileId: profile.id, role: "manager" } })
  await prisma.profile.update({ where: { id: profile.id }, data: { activeTeamId: team.id } })
  await prisma.profileSubscription.create({
    data: {
      profileId: profile.id,
      productId: crmProduct.id,
      subscriptionStatus: "past_due",
      subscriptionNextDueDate: new Date(Date.now() - dueDaysAgo * DAY_MS),
    },
  })
  return { profileId: profile.id, supabaseId, email }
}

test.describe.serial("gate de acesso da conta", () => {
  let readOnlyAccount: Awaited<ReturnType<typeof createPastDueMaster>>
  let overdueAccount: Awaited<ReturnType<typeof createPastDueMaster>>
  const isolatedSupabaseId = randomUUID()
  const isolatedEmail = `e2e.account-access.${randomUUID()}@example.com`
  let isolatedProfileId: string
  let allowedMasterProfileId: string
  let allowedTeamName: string
  let readOnlyLeadName: string
  let readOnlyLeadIds: string[]

  test.beforeAll(async () => {
    const prisma = getPrisma()
    const profile = await prisma.profile.create({
      data: {
        email: isolatedEmail,
        supabaseId: isolatedSupabaseId,
        fullName: "E2E Account Access",
        isMaster: true,
        subscriptionStatus: "past_due",
      },
    })
    isolatedProfileId = profile.id

    const team = await prisma.team.create({
      data: { name: `E2E Account Access ${isolatedSupabaseId.slice(0, 8)}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, profileId: profile.id, role: "manager" },
    })
    await prisma.profile.update({ where: { id: profile.id }, data: { activeTeamId: team.id } })
    await prisma.profileSubscription.create({
      data: { profileId: profile.id, subscriptionStatus: "past_due" },
    })

    const allowedMaster = await prisma.profile.create({
      data: {
        email: `e2e.account-access.allowed.${randomUUID()}@example.com`,
        fullName: "E2E Account Access Allowed",
        isMaster: true,
        hasPermanentSubscription: true,
        // Conta com assinatura válida (não só a flag de vitalícia) — evita
        // qualquer caminho de resolução de acesso que dependa de
        // subscriptionStatus estar preenchido além de hasPermanentSubscription.
        subscriptionStatus: "active",
      },
    })
    allowedMasterProfileId = allowedMaster.id
    allowedTeamName = `E2E Account Access Allowed ${isolatedSupabaseId.slice(0, 8)}`
    const allowedTeam = await prisma.team.create({
      data: { name: allowedTeamName, masterId: allowedMaster.id },
    })
    await prisma.teamMember.create({
      data: { teamId: allowedTeam.id, profileId: profile.id, role: "manager" },
    })

    readOnlyAccount = await createPastDueMaster(10)
    // Bem além do antigo corte de 15 dias: sem data fixa de bloqueio, continua em
    // somente leitura (não vira "acesso pausado" só por tempo de atraso).
    overdueAccount = await createPastDueMaster(60)

    // Leads criados antes de qualquer visita ao CRM: a lista do time (use cache) já nasce
    // com eles. Criados só dentro do teste, ficariam invisíveis por causa do cache que o
    // teste anterior aqueceu (ver crm.spec.ts, invalidateTeamLeadsCache).
    const readOnlyTeam = await prisma.team.findFirstOrThrow({ where: { masterId: readOnlyAccount.profileId } })
    readOnlyLeadName = `Lead Somente Leitura ${randomUUID().slice(0, 6)}`
    const lead = await prisma.lead.create({
      data: {
        leadCode: `E2ERO${randomUUID().slice(0, 8).toUpperCase()}`,
        managerId: readOnlyAccount.profileId,
        teamId: readOnlyTeam.id,
        name: readOnlyLeadName,
        status: "new_opportunity",
      },
    })
    // Cliente da Carteira (sai do CRM): dá conteúdo à aba Renovações.
    const clientLead = await prisma.lead.create({
      data: {
        leadCode: `E2ERC${randomUUID().slice(0, 8).toUpperCase()}`,
        managerId: readOnlyAccount.profileId,
        teamId: readOnlyTeam.id,
        name: `Cliente Renovação ${randomUUID().slice(0, 6)}`,
        status: "contract_finalized",
        contractDueDate: new Date(Date.now() + 30 * DAY_MS),
      },
    })
    await prisma.leadPortfolio.create({
      data: { leadId: clientLead.id, teamId: readOnlyTeam.id, renewalStatus: "to_renew", renewalAmount: 1000 },
    })
    readOnlyLeadIds = [lead.id, clientLead.id]
  })

  test.afterAll(async () => {
    const prisma = getPrisma()
    await prisma.profile.delete({ where: { id: isolatedProfileId } })
    await prisma.profile.delete({ where: { id: allowedMasterProfileId } })
    await prisma.profile.delete({ where: { id: readOnlyAccount.profileId } })
    await prisma.profile.delete({ where: { id: overdueAccount.profileId } })
    await disconnectPrisma()
  })

  test("vencido há 10 dias: somente leitura em tudo que já tinha contratado (CRM); o que não tinha segue de fora", async ({ baseURL, context, page }) => {
    test.setTimeout(240_000)
    await injectE2eAuthCookie(context, { supabaseId: readOnlyAccount.supabaseId, email: readOnlyAccount.email })
    // O app abre a barra lateral pelo cookie; num navegador novo ela começa recolhida.
    await context.addCookies([{ name: "sidebar_state", value: "true", url: baseURL ?? "http://127.0.0.1:3000" }])
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: readOnlyAccount.supabaseId, version: WHATS_NEW_VERSION }
    )
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto(`/${readOnlyAccount.supabaseId}/crm`, { waitUntil: "domcontentloaded" })
    // Sidebar normal (não mais uma barra restrita dedicada): mostra tudo que o produto
    // CRM contratado inclui, e nada do que não foi contratado (ex.: WhatsApp).
    await expect(page.getByRole("link", { name: "CRM" })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole("link", { name: "Carteira" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Inbox" })).toHaveCount(0)
    await expect(page.getByTestId("read-only-banner")).toBeVisible()
    await expect(page.getByRole("link", { name: "Regularizar pagamento" })).toHaveAttribute(
      "href",
      `/${readOnlyAccount.supabaseId}/billing-grace-payment`
    )

    // Dashboard faz parte do produto CRM contratado: continua acessível em leitura.
    await page.goto(`/${readOnlyAccount.supabaseId}/dashboard`, { waitUntil: "domcontentloaded" })
    await expect(page.getByText("Próximas Reuniões")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toHaveCount(0)

    // WhatsApp não faz parte do que a conta tinha contratado: redireciona pro CRM.
    await page.goto(`/${readOnlyAccount.supabaseId}/whatsapp`, { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(new RegExp(`/${readOnlyAccount.supabaseId}/crm$`), { timeout: 30_000 })
  })

  test("somente leitura: CRM e Carteira sem ações de escrita e o lead abre só para ler", async ({ baseURL, context, page }) => {
    test.setTimeout(360_000)
    const prisma = getPrisma()
    // Sem nenhuma liberação manual: em somente leitura a própria regra de cobrança abre CRM e Carteira.
    // Leads criados no beforeAll, antes de qualquer visita ao CRM.
    const leadName = readOnlyLeadName

    try {
      await injectE2eAuthCookie(context, { supabaseId: readOnlyAccount.supabaseId, email: readOnlyAccount.email })
      await context.addCookies([{ name: "sidebar_state", value: "true", url: baseURL ?? "http://127.0.0.1:3000" }])
      await context.addInitScript(
        ({ supabaseId, version }: { supabaseId: string; version: string }) => {
          window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
        },
        { supabaseId: readOnlyAccount.supabaseId, version: WHATS_NEW_VERSION }
      )
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.goto(`/${readOnlyAccount.supabaseId}/crm`, { waitUntil: "domcontentloaded" })
      await expect(page.getByText(leadName).first()).toBeVisible({ timeout: 90_000 })
      await expect(page.getByRole("button", { name: "Adicionar novo lead" })).toHaveCount(0)
      await expect(page.locator('[draggable="true"]').filter({ hasText: leadName })).toHaveCount(0)

      // Aviso compacto: no desktop o texto fica à mostra; no celular (375px) ficam só o título e o
      // botão de pagamento, e os detalhes abrem sob demanda.
      const banner = page.getByTestId("read-only-banner")
      const bannerDetails = page.getByTestId("read-only-banner-details")
      const bannerToggle = page.getByTestId("read-only-banner-toggle")
      await expect(bannerDetails).toBeVisible()
      await expect(bannerToggle).toBeHidden()
      await page.setViewportSize({ width: 375, height: 812 })
      await expect(bannerDetails).toBeHidden()
      await expect(bannerToggle).toHaveAttribute("aria-expanded", "false")
      await expect(page.getByRole("link", { name: "Regularizar pagamento" })).toBeVisible()
      expect((await banner.boundingBox())?.height ?? 999, "altura do aviso no celular").toBeLessThanOrEqual(130)
      await bannerToggle.click()
      await expect(bannerDetails).toBeVisible()
      await expect(bannerToggle).toHaveAttribute("aria-expanded", "true")
      await bannerToggle.click()
      await expect(bannerDetails).toBeHidden()
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.getByText(leadName).first().click()
      await expect(page.getByRole("heading", { name: "Visualizar Lead" })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole("button", { name: "Adicionar atividade" })).toHaveCount(0)
      await expect(page.getByRole("heading", { name: "Editar Lead" })).toHaveCount(0)
      // O formulário só monta depois que o detalhe do lead carrega.
      await expect(page.locator('fieldset[data-read-only="true"]').first()).toBeAttached({ timeout: 150_000 })
      await expect(page.getByRole("button", { name: /Salvar/ })).toBeDisabled()

      // Em 375px: as abas do lead não podem estourar o próprio espaço e o input oculto
      // dos checkboxes (Radix) segue invisível, sem um quadradinho solto na tela.
      await page.setViewportSize({ width: 375, height: 812 })
      await page.waitForTimeout(800)
      const tabOverflows = await page
        .getByRole("tab", { name: /^(Dados|Tags|Contatos|Documentos)$/ })
        .evaluateAll((tabs) =>
          tabs.map((tab) => ({ label: tab.textContent, clipped: tab.scrollWidth > tab.clientWidth + 1 }))
        )
      expect(tabOverflows.filter((tab) => tab.clipped), "abas com texto estourando").toEqual([])
      const hiddenInputsOpacity = await page
        .locator('fieldset[data-read-only="true"] input[aria-hidden="true"]')
        .evaluateAll((inputs) => inputs.map((input) => getComputedStyle(input).opacity))
      expect(hiddenInputsOpacity.filter((opacity) => opacity !== "0"), "inputs ocultos visíveis").toEqual([])
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.keyboard.press("Escape")

      await page.goto(`/${readOnlyAccount.supabaseId}/carteira`, { waitUntil: "domcontentloaded" })
      await expect(page.getByRole("tab", { name: /Renovações/ })).toBeVisible({ timeout: 90_000 })
      await expect(page.getByRole("button", { name: "Adicionar cliente" })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Importar clientes" })).toHaveCount(0)

      // Renovações em kanban: as colunas vazias não convidam a soltar cartões.
      // Espera a lista carregar (página hidratada) antes de clicar, senão o clique se perde.
      await expect(page.getByText(/Cliente Renovação/).first()).toBeVisible({ timeout: 120_000 })
      await page.getByRole("tab", { name: /Renovações/ }).click()
      await page.getByRole("tab", { name: "Kanban" }).click()
      await expect(page.getByText("A renovar").first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText("Soltar aqui")).toHaveCount(0)
    } finally {
      await prisma.lead.deleteMany({ where: { id: { in: readOnlyLeadIds } } })
    }
  })

  test("vencido há 60 dias: sem corte fixo, continua em somente leitura (não vira acesso pausado)", async ({ context, page }) => {
    test.setTimeout(90_000)
    await injectE2eAuthCookie(context, { supabaseId: overdueAccount.supabaseId, email: overdueAccount.email })
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: overdueAccount.supabaseId, version: WHATS_NEW_VERSION }
    )

    await page.goto(`/${overdueAccount.supabaseId}/crm`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toHaveCount(0)
    await expect(page.getByTestId("read-only-banner")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("link", { name: "CRM" })).toBeVisible()
  })

  test("a API recusa escrita de leads e carteira em somente leitura, mesmo muito vencida, e deixa ler", async ({ context }) => {
    test.setTimeout(90_000)

    for (const account of [readOnlyAccount, overdueAccount]) {
      await context.clearCookies()
      await injectE2eAuthCookie(context, { supabaseId: account.supabaseId, email: account.email })

      for (const [method, path] of [
        ["POST", "/api/v1/leads"],
        ["PATCH", "/api/v1/leads/lead-inexistente/status"],
        ["DELETE", "/api/v1/leads/lead-inexistente"],
        ["POST", "/api/v1/portfolio"],
      ] as const) {
        const response = await context.request.fetch(path, { method, data: {} })

        expect(response.status(), `${method} ${path}`).toBe(403)
        expect((await response.json()).errorMessages?.[0] ?? "").toContain("somente leitura")
      }
    }

    await context.clearCookies()
    await injectE2eAuthCookie(context, { supabaseId: readOnlyAccount.supabaseId, email: readOnlyAccount.email })
    const read = await context.request.get("/api/v1/leads")
    expect(read.status()).not.toBe(403)
  })

  test("master pausado abre só a página de pagamento; o resto segue bloqueado", async ({ context, page }) => {
    test.setTimeout(90_000)
    await injectE2eAuthCookie(context, { supabaseId: isolatedSupabaseId, email: isolatedEmail })
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: isolatedSupabaseId, version: WHATS_NEW_VERSION }
    )
    await page.route("**/api/**/billing-grace-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: {
            cycles: [
              {
                cycle: "monthly",
                label: "Mensal",
                months: 1,
                periodStart: new Date().toISOString(),
                periodEnd: new Date(Date.now() + 30 * DAY_MS).toISOString(),
                planPixTotal: 59.9,
                planCardTotal: null,
                maxInstallments: 1,
                unlimitedUsers: false,
                billedUsers: [],
                accountUsers: [],
                billedTeams: [],
                extraUserPrice: 0,
                extraTeamPrice: 0,
                extraUsersTotal: 0,
                extraTeamsTotal: 0,
                pixTotal: 59.9,
                cardTotal: null,
                losesUnlimitedUsers: false,
              },
            ],
            currentCycle: "monthly",
            hasUnlimitedUsers: false,
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            cardCheckout: null,
          },
        }),
      })
    })

    await page.goto(`/${isolatedSupabaseId}/dashboard`, { waitUntil: "domcontentloaded" })
    const paymentLink = page.getByRole("link", { name: "Reativar assinatura" })
    await expect(paymentLink).toBeVisible({ timeout: 30_000 })

    // O link é renderizado no servidor; navegar direto evita clicar antes da hidratação.
    await page.goto(await paymentLink.evaluate((link) => (link as HTMLAnchorElement).href), {
      waitUntil: "domcontentloaded",
    })
    await expect(page).toHaveURL(new RegExp(`/${isolatedSupabaseId}/billing-grace-payment$`))
    await expect(page.getByRole("heading", { name: "Renove sua assinatura" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toHaveCount(0)

    await page.goto(`/${isolatedSupabaseId}/dashboard`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Próximas Reuniões")).toHaveCount(0)
  })

  test("em 360px mantém o menu restrito para trocar de time ou sair, sem expor conteúdo", async ({ context, page }) => {
    test.setTimeout(240_000)
    await injectE2eAuthCookie(context, { supabaseId: isolatedSupabaseId, email: isolatedEmail })
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: isolatedSupabaseId, version: WHATS_NEW_VERSION }
    )
    await page.setViewportSize({ width: 360, height: 800 })

    await page.goto(`/${isolatedSupabaseId}/dashboard`, { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toBeVisible({
      timeout: 30_000,
    })
    // O master (quem paga) tem uma única ação: reativar pela renovação.
    const paymentLink = page.getByRole("link", { name: "Reativar assinatura" })
    await expect(paymentLink).toHaveCount(1)
    await expect(paymentLink).toHaveAttribute("href", `/${isolatedSupabaseId}/billing-grace-payment`)
    await expect(page.getByRole("link", { name: /Fale com o time de assinaturas/ })).toHaveCount(0)
    await expect(page.getByRole("link")).toHaveCount(1)
    await expect(page.locator("header")).toHaveCount(0)
    await expect(page.getByText("Próximas Reuniões")).toHaveCount(0)
    await expect(page.getByText("CRM", { exact: true })).toHaveCount(0)

    // O título já vem no HTML do servidor: um clique antes da hidratação se perde.
    // Repete o clique até o menu abrir, sem fechá-lo depois de aberto.
    const restrictedSidebar = page.getByTestId("restricted-access-sidebar")
    await expect(async () => {
      if (!(await restrictedSidebar.isVisible())) {
        await page.getByRole("button", { name: "Abrir menu de acesso" }).click()
      }
      await expect(restrictedSidebar).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 20_000 })
    await expect(restrictedSidebar.getByText("Trocar de time")).toBeVisible()
    await expect(restrictedSidebar.getByRole("button", { name: "Sair" })).toBeVisible()

    await restrictedSidebar.getByRole("button", { name: /E2E Account Access/ }).click()
    await page.getByRole("option", { name: new RegExp(allowedTeamName) }).click()

    // Garantia de segurança real: a troca sai do estado pausado e nunca volta a
    // mostrar a tela/dado do time restrito original. Não asseremos ausência do
    // conteúdo do dashboard do time de destino (CRM/Próximas Reuniões) — esse
    // time já está liberado, então mostrar o próprio conteúdo dele assim que a
    // troca resolve é o comportamento esperado, só não dá pra garantir o
    // instante exato em que a tela de transição (TeamSwitchingScreen) ainda
    // está visível neste ambiente de teste.
    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toHaveCount(0)
    // A troca recarrega acessos e dados do time; o time liberado abre o app normal.
    await expect(page.locator("header")).toHaveCount(1, { timeout: 150_000 })

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1)
    await runResponsiveChecks(page)
  })
})

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
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

test.describe("app/[supabaseId]/email/campanhas", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION }
    )
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

    await runResponsiveChecks(page)
  })

  test("aba Analytics tem 'Aberturas reais' como manchete e o bruto como secundário", async ({
    page,
  }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas?tab=analytics`, {
      waitUntil: "domcontentloaded",
    })

    // Headline da decisão de 17/09: abertura humana vira a manchete; a taxa
    // bruta (inclui robôs/proxies do provedor) permanece visível no subtítulo.
    await expect(page.getByText(/Aberturas reais/).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/% bruta/).first()).toBeVisible()
    // A manchete antiga não pode continuar ocupando o tile do overview.
    await expect(page.getByText("Taxa de Abertura (hoje)", { exact: true })).toHaveCount(0)
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
   * Piso "agora" no agendamento do wizard.
   *
   * Bug 2026-09-15: o `DateTimePicker` aceitava data/hora no passado sem
   * resistência (o default "10:00" nascia vencido quando o wizard abria depois
   * das 10h) e a invalidação só aparecia no submit — botão desabilitado, sem
   * motivo visível em lugar nenhum. Os asserts abaixo medem o DOM
   * (`data-disabled`, `min`, `value`), não a aparência.
   */
  test.describe("agendamento não aceita passado", () => {
    /**
     * Nomes únicos por execução: o time E2E é compartilhado entre workers, e
     * sobra de uma execução anterior derrubava o seletor por strict mode.
     */
    type ScheduleFixtures = {
      templateId: string
      listId: string
      listName: string
      templateName: string
    }

    async function seedScheduleFixtures(): Promise<ScheduleFixtures> {
      const profile = await findE2eMasterProfile()
      if (!profile?.activeTeamId) throw new Error("Seed E2E sem time ativo")

      const prisma = getPrisma()
      const templateId = randomUUID()
      const listId = randomUUID()
      const suffix = templateId.slice(0, 8)
      const listName = `E2E Lista Piso ${suffix}`
      const templateName = `E2E Template Piso ${suffix}`

      await prisma.emailTemplate.create({
        data: {
          id: templateId,
          versionGroupId: templateId,
          teamId: profile.activeTeamId,
          createdBy: profile.id,
          name: templateName,
          subject: "Assunto E2E piso",
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
          totalContacts: 2,
        },
      })
      await prisma.emailContact.createMany({
        data: [
          { listId, email: "piso-a@e2e.agenda.test", name: "Piso A" },
          { listId, email: "piso-b@e2e.agenda.test", name: "Piso B" },
        ],
      })

      return { templateId, listId, listName, templateName }
    }

    async function cleanupScheduleFixtures({ templateId, listId }: ScheduleFixtures) {
      const prisma = getPrisma()
      await prisma.emailContact.deleteMany({ where: { listId } }).catch(() => {})
      await prisma.emailContactList.delete({ where: { id: listId } }).catch(() => {})
      await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
    }

    /** Leva o wizard até a aba Sub-campanhas, onde vive o picker de agendamento. */
    async function openWizardAtScheduleTab(
      page: Page,
      fixtures: ScheduleFixtures,
      campaignName: string
    ) {
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
        waitUntil: "domcontentloaded",
      })
      await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible({
        timeout: 30_000,
      })
      const dialog = page.getByRole("dialog")
      // O botão renderiza antes da hidratação: um clique que chega cedo demais
      // não tem handler e se perde em silêncio. Repete até o wizard montar, em
      // vez de esperar um tempo fixo e torcer.
      await expect(async () => {
        await page.getByRole("button", { name: /Nova Campanha/i }).click()
        await expect(dialog).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 45_000 })

      await page.getByLabel("Nome da campanha *").fill(campaignName)
      await page.getByRole("button", { name: "Próxima" }).click()

      const listOption = page.getByText(fixtures.listName, { exact: false })
      await expect(listOption).toBeVisible({ timeout: 30_000 })
      await listOption.click()
      await page.getByRole("button", { name: "Próxima" }).click()

      await expect(dialog.locator("#date-picker")).toBeVisible({ timeout: 30_000 })
      return dialog
    }

    async function selectTemplate(page: Page, fixtures: ScheduleFixtures) {
      await page.getByRole("combobox").first().click()
      await page.getByRole("option", { name: fixtures.templateName }).click()
    }

    /** Dia de hoje no calendário, em ISO — o `td` expõe `data-day`/`data-today`. */
    async function readTodayDateKey(page: Page): Promise<string> {
      const key = await page
        .locator('td[data-day][data-today="true"]')
        .first()
        .getAttribute("data-day")
      expect(key, "calendário deve marcar o dia de hoje").toBeTruthy()
      return key as string
    }

    function shiftDateKey(dateKey: string, days: number): string {
      const [year, month, day] = dateKey.split("-").map(Number)
      const shifted = new Date(Date.UTC(year, month - 1, day + days))
      return shifted.toISOString().slice(0, 10)
    }

    function subtractOneMinute(time: string): string {
      const [hours, minutes] = time.split(":").map(Number)
      const total = hours * 60 + minutes - 1
      const normalized = (total + 24 * 60) % (24 * 60)
      return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
        normalized % 60
      ).padStart(2, "0")}`
    }

    test("calendário desabilita dias passados e o horário default nunca nasce vencido", async ({
      page,
    }) => {
      const fixtures = await seedScheduleFixtures()
      try {
        const dialog = await openWizardAtScheduleTab(page, fixtures, "E2E Piso Calendario")

        await dialog.locator("#date-picker").click()
        const todayKey = await readTodayDateKey(page)
        const yesterdayKey = shiftDateKey(todayKey, -1)

        // MEDIDO no DOM: o dia anterior está desabilitado, hoje continua aberto.
        await expect(page.locator(`td[data-day="${yesterdayKey}"]`)).toHaveAttribute(
          "data-disabled",
          "true"
        )
        await expect(page.locator(`td[data-day="${todayKey}"]`)).not.toHaveAttribute(
          "data-disabled",
          "true"
        )

        await page.locator(`td[data-day="${todayKey}"] button`).click()

        // Ao escolher hoje, o piso entra como `min` e o default ("10:00") é
        // empurrado para frente em vez de nascer vencido.
        const timeInput = dialog.locator("#time-picker")
        const min = await timeInput.getAttribute("min")
        expect(min, "hoje deve receber piso de horário").toMatch(/^\d{2}:\d{2}$/)
        const value = await timeInput.inputValue()
        expect(
          value >= (min as string),
          `horário default ${value} não pode ser anterior ao piso ${min}`
        ).toBe(true)

        // O calendário segue aberto depois de escolher um dia — clicar de novo
        // no trigger fecharia o popover e destacaria as células do DOM.
        await page.locator(`td[data-day="${shiftDateKey(todayKey, 1)}"] button`).click()

        // Dia posterior ao piso não recebe restrição de horário.
        await expect(timeInput).not.toHaveAttribute("min", /.*/)
      } finally {
        await cleanupScheduleFixtures(fixtures)
      }
    })

    test("wizard de agendamento passa nas checagens responsivas", async ({ page }) => {
      const fixtures = await seedScheduleFixtures()
      try {
        await openWizardAtScheduleTab(page, fixtures, "E2E Piso Responsivo")

        await runResponsiveChecks(page)
      } finally {
        await cleanupScheduleFixtures(fixtures)
      }
    })

    test("horário vencido é apontado no campo com mensagem inline", async ({ page }) => {
      const fixtures = await seedScheduleFixtures()
      try {
        const dialog = await openWizardAtScheduleTab(page, fixtures, "E2E Piso Inline")

        await dialog.locator("#date-picker").click()
        const todayKey = await readTodayDateKey(page)
        await page.locator(`td[data-day="${todayKey}"] button`).click()

        const timeInput = dialog.locator("#time-picker")
        const min = (await timeInput.getAttribute("min")) as string
        await timeInput.fill(subtractOneMinute(min))

        // O campo vencido se explica sozinho — nunca só o botão apagado.
        await expect(dialog.getByRole("alert").filter({ hasText: "Horário já passou" })).toBeVisible()
        await expect(timeInput).toHaveAttribute("aria-invalid", "true")
        await expect(dialog.locator("#date-picker")).toHaveAttribute("aria-invalid", "true")
      } finally {
        await cleanupScheduleFixtures(fixtures)
      }
    })

    test("Revisão lista o motivo quando o agendamento vence durante o wizard", async ({ page }) => {
      const fixtures = await seedScheduleFixtures()
      try {
        // Relógio fixo às 10:00 de hoje ANTES do primeiro goto: garante folga
        // até a virada do dia para agendar à frente e depois vencer. Sem isso,
        // uma execução às 23:58 faria "piso + 2 min" virar o dia e nascer no
        // passado — exatamente o que o teste quer provocar só mais tarde.
        const frozenNow = new Date()
        frozenNow.setHours(10, 0, 0, 0)
        await page.clock.setFixedTime(frozenNow)

        const dialog = await openWizardAtScheduleTab(page, fixtures, "E2E Piso Revisao")
        await selectTemplate(page, fixtures)

        await dialog.locator("#date-picker").click()
        const todayKey = await readTodayDateKey(page)
        await page.locator(`td[data-day="${todayKey}"] button`).click()

        // Agenda poucos minutos à frente: válido agora, vencido depois do salto.
        const timeInput = dialog.locator("#time-picker")
        const min = (await timeInput.getAttribute("min")) as string
        const [hours, minutes] = min.split(":").map(Number)
        const soon = new Date(Date.UTC(2000, 0, 1, hours, minutes + 2))
        await timeInput.fill(
          `${String(soon.getUTCHours()).padStart(2, "0")}:${String(soon.getUTCMinutes()).padStart(2, "0")}`
        )

        await page.getByRole("button", { name: "Próxima" }).click()
        const confirmButton = dialog.getByRole("button", { name: /Segure para confirmar/ })
        await expect(confirmButton).toBeEnabled()
        await expect(dialog.getByText("Pendências para confirmar")).toHaveCount(0)

        // O relógio avança e o agendamento vence com o wizard aberto. O salto é
        // relativo ao tempo congelado, não ao relógio real do processo de teste.
        await page.clock.setFixedTime(new Date(frozenNow.getTime() + 10 * 60 * 1000))
        // Volta e avança de aba para forçar o re-render agora, em vez de
        // esperar o tick do piso — o assert é sobre o conteúdo, não a cadência.
        await dialog.getByRole("tab", { name: "Sub-campanhas" }).click()
        await dialog.getByRole("tab", { name: "Revisão" }).click()

        await expect(dialog.getByText("Pendências para confirmar")).toBeVisible()
        await expect(
          dialog.getByText("Data de agendamento deve ser no futuro")
        ).toBeVisible()
        await expect(confirmButton).toBeDisabled()
      } finally {
        await cleanupScheduleFixtures(fixtures)
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

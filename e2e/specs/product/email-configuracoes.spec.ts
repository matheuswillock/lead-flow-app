/**
 * app/[supabaseId]/email/configuracoes/page.tsx
 *
 * Instruções DNS do domínio personalizado: alertas por seção enquanto o
 * registro não é verificado, menu de instruções (copiar texto/prompt) e envio
 * por e-mail. Os registros DNS vêm de API externa de provedor — em E2E a rota
 * de records/verify/envio é interceptada (mesmo padrão do promote-to-lead no
 * radar.spec), com o estado do domínio seedado de verdade no banco.
 */

import { expect, test, type Page } from "@playwright/test"
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

const DOMAIN_NAME = "mail.e2e-corretor.com.br"
const DOMAIN_ID = "e2e-dom-instrucoes-dns"

const MOCK_DNS_RECORDS = [
  {
    record: "DKIM",
    type: "TXT",
    name: "resend._domainkey",
    value: "p=MIGfMA0ChaveDkimE2EInstrucoes",
    ttl: "Auto",
    status: "pending",
  },
  {
    record: "SPF",
    type: "MX",
    name: "send",
    value: "feedback-smtp.us-east-1.amazonses.com",
    priority: 10,
    ttl: "Auto",
    status: "pending",
  },
  {
    record: "SPF",
    type: "TXT",
    name: "send",
    value: "v=spf1 include:amazonses.com ~all",
    ttl: "Auto",
    status: "pending",
  },
  {
    record: "Tracking",
    type: "CNAME",
    name: "links",
    value: "custom-tracking.e2e-provider.com",
    ttl: "Auto",
    status: "not_started",
  },
]

function domainRecordsPayload() {
  return {
    isValid: true,
    successMessages: [],
    errorMessages: [],
    result: {
      domainId: DOMAIN_ID,
      domainName: DOMAIN_NAME,
      status: "pending",
      region: "us-east-1",
      connectedAt: new Date().toISOString(),
      openTracking: false,
      clickTracking: false,
      trackingSubdomain: null,
      records: MOCK_DNS_RECORDS,
      events: [],
    },
  }
}

async function resolveE2eTeamId(): Promise<string> {
  const profile = await findE2eMasterProfile()
  if (!profile?.activeTeamId) {
    throw new Error("Seed E2E sem time ativo — rode `bun run db:seed:e2e`")
  }
  return profile.activeTeamId
}

async function seedConnectedDomain(): Promise<void> {
  const teamId = await resolveE2eTeamId()
  const domainFields = {
    resendDomainId: DOMAIN_ID,
    resendDomainName: DOMAIN_NAME,
    resendDomainStatus: "pending",
    resendDomainRegion: "us-east-1",
    resendDomainConnectedAt: new Date(),
  }
  await getPrisma().emailTeamSettings.upsert({
    where: { teamId },
    update: domainFields,
    create: { teamId, ...domainFields },
  })
}

async function clearConnectedDomain(): Promise<void> {
  const teamId = await resolveE2eTeamId()
  await getPrisma().emailTeamSettings.updateMany({
    where: { teamId },
    data: {
      resendDomainId: null,
      resendDomainName: null,
      resendDomainStatus: null,
      resendDomainRegion: null,
      resendDomainConnectedAt: null,
    },
  })
}

async function mockDomainRecordsRoute(page: Page): Promise<void> {
  await page.route("**/email/settings/domain/records**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(domainRecordsPayload()),
    })
  )
}

async function gotoEmailSettings(page: Page): Promise<void> {
  await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/configuracoes`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name: "Configurações de E-mail" })).toBeVisible({
    timeout: 30_000,
  })
}

async function openDomainActionsMenu(page: Page): Promise<void> {
  await expect(page.getByText(DOMAIN_NAME, { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole("button", { name: "Ações do domínio" }).click()
}

/**
 * Serial de propósito (achado codex PR #1173): todos os testes deste arquivo
 * mutam a MESMA linha `emailTeamSettings` do master E2E — a settings é única
 * por time, então não há isolamento possível por dado. Com `fullyParallel` +
 * 2 workers, seed/clear concorrentes flakaram a primeira run do CI do #1173.
 * Trade-off conhecido do serial: um retry reroda o grupo inteiro.
 */
test.describe.configure({ mode: "serial" })

test.describe("app/[supabaseId]/email/configuracoes", () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ version, supabaseId }: { version: string; supabaseId: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { version: WHATS_NEW_VERSION, supabaseId: E2E_MASTER_SUPABASE_ID }
    )
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega configurações de e-mail autenticado e passa nas checagens responsivas", async ({
    page,
  }) => {
    await clearConnectedDomain()
    await gotoEmailSettings(page)
    await expect(page.getByText("Acesso não liberado")).toHaveCount(0)

    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page)
  })

  test.describe("com domínio conectado aguardando DNS", () => {
    test.beforeEach(async () => {
      await seedConnectedDomain()
    })

    test.afterEach(async () => {
      await clearConnectedDomain()
    })

    test("mostra alerta destrutivo por seção pendente e reinicia a verificação", async ({
      page,
    }) => {
      await mockDomainRecordsRoute(page)
      let verifyRequested = false
      await page.route("**/email/settings/domain/verify**", (route) => {
        verifyRequested = true
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: ["Verificação iniciada"],
            errorMessages: [],
            result: { status: "pending" },
          }),
        })
      })

      await gotoEmailSettings(page)

      const spfAlert = page
        .getByRole("alert")
        .filter({ hasText: "Registros de envio (SPF) não encontrados" })
      await expect(spfAlert).toBeVisible({ timeout: 30_000 })
      await expect(spfAlert).toContainText("Sem eles o disparo não é liberado")

      const dkimAlert = page
        .getByRole("alert")
        .filter({ hasText: "Registro de verificação do domínio (DKIM) não encontrado" })
      await expect(dkimAlert).toBeVisible()
      await expect(dkimAlert).toContainText("confirmar a propriedade do domínio")

      // Medido, não julgado: destrutivo tem `text-destructive` na raiz do alert.
      const spfAlertClasses = (await spfAlert.getAttribute("class")) ?? ""
      expect(spfAlertClasses).toContain("text-destructive")

      const trackingAlert = page
        .getByRole("alert")
        .filter({ hasText: "Registro de tracking pendente" })
      await expect(trackingAlert).toBeVisible()
      const trackingAlertClasses = (await trackingAlert.getAttribute("class")) ?? ""
      expect(trackingAlertClasses).not.toContain("text-destructive")

      const restartButtons = page.getByRole("button", { name: "Reiniciar verificação" })
      await expect(restartButtons).toHaveCount(2)
      await restartButtons.first().click()
      await expect(page.getByText("Verificação iniciada. Aguarde a propagação do DNS.")).toBeVisible()
      expect(verifyRequested).toBe(true)
    })

    test("copia instruções em texto puro geradas dos registros reais", async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"])
      await mockDomainRecordsRoute(page)
      await gotoEmailSettings(page)

      await openDomainActionsMenu(page)
      await page.getByRole("menuitem", { name: "Copiar instruções" }).click()
      await expect(page.getByText("Instruções copiadas")).toBeVisible()

      const copiedText = await page.evaluate(() => navigator.clipboard.readText())
      expect(copiedText).toContain(
        `Registros DNS para verificação do domínio ${DOMAIN_NAME} no Corretor Studio`
      )
      for (const record of MOCK_DNS_RECORDS) {
        expect(copiedText).toContain(record.value)
        expect(copiedText).toContain(`Nome: ${record.name}`)
      }
      expect(copiedText).toContain("Prioridade: 10")
      expect(copiedText).toContain("nuvem laranja")
      expect(copiedText).not.toMatch(/Resend/)
    })

    test("copia prompt para agente de IA com persona e regras", async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"])
      await mockDomainRecordsRoute(page)
      await gotoEmailSettings(page)

      await openDomainActionsMenu(page)
      await page.getByRole("menuitem", { name: "Copiar como prompt de IA" }).click()
      await expect(page.getByText("Prompt copiado")).toBeVisible()

      const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText())
      expect(copiedPrompt).toContain(
        `Você tem acesso ao gerenciador de DNS da hospedagem do domínio ${DOMAIN_NAME}.`
      )
      expect(copiedPrompt).toContain("nuvem laranja")
      expect(copiedPrompt).toContain("um a um")
      for (const record of MOCK_DNS_RECORDS) {
        expect(copiedPrompt).toContain(record.value)
      }
      expect(copiedPrompt).not.toMatch(/Resend/)
    })

    test("envia instruções por e-mail com validação e lock de request", async ({ page }) => {
      await mockDomainRecordsRoute(page)
      const sendRequests: Array<Record<string, unknown>> = []
      await page.route("**/email/settings/domain/send-dns-instructions**", (route) => {
        sendRequests.push(route.request().postDataJSON() as Record<string, unknown>)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: ["Instruções enviadas para hospedagem@cliente.com.br"],
            errorMessages: [],
            result: { recipientEmail: "hospedagem@cliente.com.br" },
          }),
        })
      })

      await gotoEmailSettings(page)
      await openDomainActionsMenu(page)
      await page.getByRole("menuitem", { name: "Enviar por e-mail" }).click()

      await expect(
        page.getByRole("heading", { name: "Enviar instruções por e-mail" })
      ).toBeVisible()

      const emailInput = page.getByLabel("E-mail do responsável técnico")
      await emailInput.fill("nao-e-email")
      await page.getByRole("button", { name: "Enviar instruções" }).click()
      await expect(
        page.getByText("Informe um e-mail válido para receber as instruções")
      ).toBeVisible()
      expect(sendRequests).toHaveLength(0)

      await emailInput.fill("hospedagem@cliente.com.br")
      await page.getByRole("button", { name: "Enviar instruções" }).click()
      await expect(
        page.getByText("Instruções enviadas para hospedagem@cliente.com.br")
      ).toBeVisible()

      // O cliente manda só o destinatário — conteúdo é reconstruído no servidor.
      expect(sendRequests).toEqual([{ recipientEmail: "hospedagem@cliente.com.br" }])

      await expect(
        page.getByRole("heading", { name: "Enviar instruções por e-mail" })
      ).toHaveCount(0)
    })
  })
})

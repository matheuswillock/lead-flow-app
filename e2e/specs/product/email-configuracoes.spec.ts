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

/**
 * A hospedagem é resolvida no servidor por DNS-over-HTTPS a partir dos NS do
 * domínio. Em E2E a resolução entra pelo mesmo ponto que os registros: a rota
 * de `records` já é interceptada, então o `dnsProvider` do payload é a costura.
 */
const MOCK_DNS_PROVIDER = {
  name: "HostGator",
  nameservers: ["ns1158.hostgator.com.br", "ns1159.hostgator.com.br"],
}

function domainRecordsPayload(
  dnsProvider: { name: string | null; nameservers: string[] } | null = MOCK_DNS_PROVIDER
) {
  return {
    isValid: true,
    successMessages: [],
    errorMessages: [],
    result: {
      domainId: DOMAIN_ID,
      domainName: DOMAIN_NAME,
      status: "pending",
      region: "us-east-1",
      dnsProvider,
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

async function seedConnectedDomain(status: "pending" | "verified" = "pending"): Promise<void> {
  const teamId = await resolveE2eTeamId()
  const domainFields = {
    resendDomainId: DOMAIN_ID,
    resendDomainName: DOMAIN_NAME,
    resendDomainStatus: status,
    resendDomainRegion: "us-east-1",
    resendDomainConnectedAt: new Date(),
    resendOpenTracking: status === "verified",
    resendClickTracking: false,
  }
  await getPrisma().emailTeamSettings.upsert({
    where: { teamId },
    update: domainFields,
    create: { teamId, ...domainFields },
  })
}

/** Registros todos verificados — o estado que destrava o toggle de cliques. */
const VERIFIED_DNS_RECORDS = MOCK_DNS_RECORDS.map((record) => ({
  ...record,
  status: "verified",
}))

function verifiedDomainRecordsPayload() {
  return {
    isValid: true,
    successMessages: [],
    errorMessages: [],
    result: {
      domainId: DOMAIN_ID,
      domainName: DOMAIN_NAME,
      status: "verified",
      region: "us-east-1",
      dnsProvider: MOCK_DNS_PROVIDER,
      connectedAt: new Date().toISOString(),
      openTracking: true,
      clickTracking: false,
      trackingSubdomain: "links",
      records: VERIFIED_DNS_RECORDS,
      events: [],
    },
  }
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

async function mockDomainRecordsRoute(
  page: Page,
  dnsProvider: { name: string | null; nameservers: string[] } | null = MOCK_DNS_PROVIDER
): Promise<void> {
  await page.route("**/email/settings/domain/records**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(domainRecordsPayload(dnsProvider)),
    })
  )
}

/**
 * Coluna do grid de resumo do card (Criado / Status / Hospedagem / Região).
 * Escopado no grid de propósito: "Status" também é cabeçalho da tabela de
 * registros DNS logo abaixo, e um `getByText` solto casa as duas coisas.
 */
function domainField(page: Page, label: string) {
  return page
    .locator("div.grid")
    .filter({ has: page.getByText("Hospedagem", { exact: true }) })
    .first()
    .locator("> div")
    .filter({ has: page.getByText(label, { exact: true }) })
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
      await expect(
        page.getByText("Verificação iniciada. A tela será atualizada quando o DNS responder.")
      ).toBeVisible()
      expect(verifyRequested).toBe(true)
    })

    test("mostra a hospedagem de DNS e mantém o badge de status do tamanho do texto", async ({
      page,
    }) => {
      await mockDomainRecordsRoute(page)
      await gotoEmailSettings(page)

      const hostingField = domainField(page, "Hospedagem")
      await expect(hostingField).toContainText("HostGator", { timeout: 30_000 })

      // Medido, não julgado: o badge é filho de `flex flex-col`, que estica por
      // `align-items: stretch`. A regressão aparece como badge da largura da
      // coluna inteira, não como texto errado.
      const statusBadge = domainField(page, "Status").locator("div").first()
      await expect(statusBadge).toHaveText("Pendente")

      const statusColumn = domainField(page, "Status")
      const badgeBox = await statusBadge.boundingBox()
      const columnBox = await statusColumn.boundingBox()
      expect(badgeBox, "badge de status sem caixa renderizada").not.toBeNull()
      expect(columnBox, "coluna de status sem caixa renderizada").not.toBeNull()
      expect(badgeBox!.width).toBeLessThan(columnBox!.width)

      const badgeContentWidth = await statusBadge.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const style = getComputedStyle(element)
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
        return range.getBoundingClientRect().width + padding + border
      })
      // Tolerância de 1px: arredondamento de subpixel do layout, não folga.
      expect(badgeBox!.width).toBeLessThanOrEqual(badgeContentWidth + 1)
    })

    test("mostra os nameservers crus quando a hospedagem não está no mapa", async ({ page }) => {
      await mockDomainRecordsRoute(page, {
        name: null,
        nameservers: ["ns1.provedor-local.example", "ns2.provedor-local.example"],
      })
      await gotoEmailSettings(page)

      const hostingField = domainField(page, "Hospedagem")
      await expect(hostingField).toContainText("Não identificado", { timeout: 30_000 })
      await expect(hostingField).toContainText("ns1.provedor-local.example")
    })

    test("mantém a tela intacta quando a resolução de hospedagem falha", async ({ page }) => {
      await mockDomainRecordsRoute(page, null)
      await gotoEmailSettings(page)

      // Degradação silenciosa: o campo mostra "—" e o resto do card segue igual.
      await expect(domainField(page, "Hospedagem")).toContainText("—", { timeout: 30_000 })
      await expect(page.getByText(DOMAIN_NAME, { exact: true })).toBeVisible()
      await expect(
        page.getByRole("alert").filter({ hasText: "Registros de envio (SPF) não encontrados" })
      ).toBeVisible()
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
      // Hospedagem identificada entra na narrativa: o operador sabe qual painel abrir.
      expect(copiedText).toContain(
        `Cadastre os registros abaixo no painel da HostGator, hospedagem de DNS do domínio ${DOMAIN_NAME}:`
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
        `Você tem acesso ao painel da HostGator, hospedagem de DNS do domínio ${DOMAIN_NAME}.`
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

    test("toggle de cliques fica BLOQUEADO enquanto o CNAME de Tracking não verifica", async ({
      page,
    }) => {
      await mockDomainRecordsRoute(page)
      await gotoEmailSettings(page)

      await expect(page.getByText(DOMAIN_NAME, { exact: true })).toBeVisible({ timeout: 30_000 })
      await page.getByRole("button", { name: "Configurar" }).click()

      await expect(
        page.getByRole("heading", { name: "Configurar métricas de tracking" })
      ).toBeVisible()

      const clickSwitch = page.locator("#click-tracking-switch")
      await expect(clickSwitch).toBeDisabled()
      await expect(clickSwitch).not.toBeChecked()
      await expect(
        page.getByText("O rastreio de cliques fica disponível quando o domínio", {
          exact: false,
        })
      ).toBeVisible()
    })
  })

  test.describe("com domínio verificado e CNAME de Tracking resolvendo", () => {
    test.beforeEach(async () => {
      await seedConnectedDomain("verified")
    })

    test.afterEach(async () => {
      await clearConnectedDomain()
    })

    test("liga o rastreio de cliques e envia clickTracking: true para a rota de tracking", async ({
      page,
    }) => {
      await page.route("**/email/settings/domain/records**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(verifiedDomainRecordsPayload()),
        })
      )

      const trackingRequests: Array<Record<string, unknown>> = []
      await page.route("**/email/settings/domain/tracking**", (route) => {
        trackingRequests.push(route.request().postDataJSON() as Record<string, unknown>)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: ["Métricas de tracking configuradas."],
            errorMessages: [],
            result: {
              domainId: DOMAIN_ID,
              domainName: DOMAIN_NAME,
              status: "verified",
              region: "us-east-1",
              openTracking: true,
              clickTracking: true,
              trackingSubdomain: "links",
              records: VERIFIED_DNS_RECORDS,
            },
          }),
        })
      })

      await gotoEmailSettings(page)
      await expect(page.getByText(DOMAIN_NAME, { exact: true })).toBeVisible({ timeout: 30_000 })
      await page.getByRole("button", { name: /Configurar|Alterar/ }).click()

      await expect(
        page.getByRole("heading", { name: "Configurar métricas de tracking" })
      ).toBeVisible()

      const clickSwitch = page.locator("#click-tracking-switch")
      await expect(clickSwitch).toBeEnabled()
      await clickSwitch.click()
      await expect(clickSwitch).toBeChecked()

      await page.getByRole("button", { name: "Salvar" }).click()
      await expect(
        page.getByRole("heading", { name: "Configurar métricas de tracking" })
      ).toHaveCount(0)

      // O corpo enviado é o contrato: clickTracking respeitado, não descartado.
      expect(trackingRequests).toHaveLength(1)
      expect(trackingRequests[0]).toEqual({
        trackingSubdomain: "links",
        openTracking: true,
        clickTracking: true,
      })
    })

    test("mantém o diálogo aberto e restaura o toggle quando o Resend não confirma", async ({
      page,
    }) => {
      await page.route("**/email/settings/domain/records**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(verifiedDomainRecordsPayload()),
        })
      )
      await page.route("**/email/settings/domain/tracking**", (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: false,
            successMessages: [],
            errorMessages: [
              "O Resend não confirmou a alteração das métricas de tracking. O estado atual foi sincronizado; tente novamente.",
            ],
            result: null,
          }),
        })
      )

      await gotoEmailSettings(page)
      await expect(page.getByText(DOMAIN_NAME, { exact: true })).toBeVisible({ timeout: 30_000 })
      await page.getByRole("button", { name: /Configurar|Alterar/ }).click()

      const dialogHeading = page.getByRole("heading", {
        name: "Configurar métricas de tracking",
      })
      const clickSwitch = page.locator("#click-tracking-switch")
      await clickSwitch.click()
      await expect(clickSwitch).toBeChecked()
      await page.getByRole("button", { name: "Salvar" }).click()

      await expect(dialogHeading).toBeVisible()
      await expect(clickSwitch).not.toBeChecked()
      await expect(page.getByText(/Resend não confirmou/)).toBeVisible()
    })
  })

  /**
   * Frente C — Deliverability: domínio próprio do time para servir /forms/*.
   * GET form-domain, records (fallback CNAME sem VERCEL_TOKEN) e DELETE rodam
   * pela rota REAL contra o banco; POST connect e verify são interceptados
   * porque dependem da Vercel API (mesmo padrão dos mocks de records acima).
   */
  test.describe("Domínio dos formulários", () => {
    const FORM_DOMAIN_HOSTNAME = "forms.e2e-corretor.com.br"

    async function seedFormDomain(status: "pending" | "verified" | "failed"): Promise<void> {
      const teamId = await resolveE2eTeamId()
      await getPrisma().teamFormDomain.upsert({
        where: { teamId },
        update: {
          hostname: FORM_DOMAIN_HOSTNAME,
          status,
          verifiedAt: status === "verified" ? new Date() : null,
        },
        create: {
          teamId,
          hostname: FORM_DOMAIN_HOSTNAME,
          status,
          verifiedAt: status === "verified" ? new Date() : null,
        },
      })
    }

    async function clearFormDomain(): Promise<void> {
      const teamId = await resolveE2eTeamId()
      await getPrisma().teamFormDomain.deleteMany({ where: { teamId } })
    }

    test.beforeEach(async () => {
      await clearFormDomain()
    })

    test.afterEach(async () => {
      await clearFormDomain()
      await clearConnectedDomain()
    })

    test("sugere forms.<dominio-do-time> quando há domínio de envio verificado", async ({
      page,
    }) => {
      await seedConnectedDomain("verified")
      await mockDomainRecordsRoute(page)
      await gotoEmailSettings(page)

      const input = page.getByLabel("Subdomínio dos formulários")
      await expect(input).toBeVisible({ timeout: 30_000 })
      await expect(input).toHaveValue("forms.e2e-corretor.com.br")
    })

    test("conecta o subdomínio e mostra o registro CNAME retornado", async ({ page }) => {
      let connected = false
      await page.route("**/email/settings/form-domain", (route) => {
        if (route.request().method() === "POST") {
          connected = true
          return route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              isValid: true,
              successMessages: ["Domínio de formulários conectado. Crie o registro DNS para ativar."],
              errorMessages: [],
              result: {
                formDomain: {
                  hostname: FORM_DOMAIN_HOSTNAME,
                  status: "pending",
                  verifiedAt: null,
                  lastCheckedAt: null,
                  createdAt: new Date().toISOString(),
                },
                records: [
                  {
                    record: "CNAME",
                    type: "CNAME",
                    name: "forms",
                    value: "cname.vercel-dns.com",
                    ttl: "Auto",
                    status: "pending",
                  },
                ],
              },
            }),
          })
        }
        if (route.request().method() === "GET" && connected) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              isValid: true,
              successMessages: [],
              errorMessages: [],
              result: {
                formDomain: {
                  hostname: FORM_DOMAIN_HOSTNAME,
                  status: "pending",
                  verifiedAt: null,
                  lastCheckedAt: null,
                  createdAt: new Date().toISOString(),
                },
              },
            }),
          })
        }
        return route.continue()
      })

      await gotoEmailSettings(page)

      const input = page.getByLabel("Subdomínio dos formulários")
      await expect(input).toBeVisible({ timeout: 30_000 })
      await input.fill(FORM_DOMAIN_HOSTNAME)
      await page.getByRole("button", { name: "Conectar subdomínio" }).click()

      await expect(
        page.getByText("Domínio de formulários conectado. Crie o registro DNS para ativar.")
      ).toBeVisible()
      await expect(page.getByText("cname.vercel-dns.com").first()).toBeVisible()
    })

    test("domínio pendente mostra o CNAME real (fallback sem integração) e badge do tamanho do texto", async ({
      page,
    }) => {
      await seedFormDomain("pending")
      await gotoEmailSettings(page)

      // Rota REAL de records: sem VERCEL_TOKEN o servidor devolve o CNAME padrão.
      await expect(page.getByText("cname.vercel-dns.com").first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(
        page.getByText("Crie o registro CNAME na hospedagem do seu domínio para ativar.")
      ).toBeVisible()

      const statusBadge = page.getByTestId("form-domain-status-badge")
      await expect(statusBadge).toBeVisible()
      await expect(statusBadge).toHaveText("Pendente")

      // Medido, não julgado: badge não estica além do próprio conteúdo.
      const badgeBox = await statusBadge.boundingBox()
      const badgeContentWidth = await statusBadge.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const style = getComputedStyle(element)
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
        return range.getBoundingClientRect().width + padding + border
      })
      expect(badgeBox, "badge de status sem caixa renderizada").not.toBeNull()
      expect(badgeBox!.width).toBeLessThanOrEqual(badgeContentWidth + 1)
    })

    test("verifica agora e mostra o aviso de que os links de campanha usarão o domínio", async ({
      page,
    }) => {
      await seedFormDomain("pending")
      await page.route("**/email/settings/form-domain/verify**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: [
              "Domínio verificado! Os novos disparos de campanha usarão este domínio nos links de formulário.",
            ],
            errorMessages: [],
            result: {
              formDomain: {
                hostname: FORM_DOMAIN_HOSTNAME,
                status: "verified",
                verifiedAt: new Date().toISOString(),
                lastCheckedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              },
            },
          }),
        })
      )

      await gotoEmailSettings(page)
      await expect(page.getByText(FORM_DOMAIN_HOSTNAME, { exact: true })).toBeVisible({
        timeout: 30_000,
      })

      await page.getByRole("button", { name: "Verificar agora" }).click()

      await expect(
        page.getByText(
          "Domínio verificado! Os novos disparos de campanha usarão este domínio nos links de formulário."
        )
      ).toBeVisible()
      await expect(
        page.getByText("Os novos links de campanha usarão este domínio.")
      ).toBeVisible()
    })

    test("remove o domínio com confirmação em AlertDialog (rota real)", async ({ page }) => {
      await seedFormDomain("verified")
      await gotoEmailSettings(page)

      await expect(page.getByText(FORM_DOMAIN_HOSTNAME, { exact: true })).toBeVisible({
        timeout: 30_000,
      })

      await page.getByRole("button", { name: "Ações do domínio de formulários" }).click()
      await page.getByRole("menuitem", { name: "Remover domínio" }).click()

      await expect(
        page.getByRole("heading", { name: "Remover domínio de formulários?" })
      ).toBeVisible()
      await page.getByRole("button", { name: "Remover", exact: true }).click()

      await expect(page.getByText("Domínio de formulários removido")).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByLabel("Subdomínio dos formulários")).toBeVisible()

      const teamId = await resolveE2eTeamId()
      const remaining = await getPrisma().teamFormDomain.count({ where: { teamId } })
      expect(remaining).toBe(0)
    })
  })
})

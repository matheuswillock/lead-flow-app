import { randomUUID } from "node:crypto"
import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { runResponsiveChecks } from "../../support/responsive"
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal"

const PIX_CODE = "000201PIX-E2E"
const TERMS_TEXT = "Ao pagar, você concorda com os"

type GraceState = {
  /** `completed` passa a valer no próximo GET do pagamento (a tela consulta a cada 5s). */
  status: "pending" | "completed"
  createRequests: Record<string, unknown>[]
}

function envelope(result: unknown) {
  return JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result })
}

function quotePayload() {
  return {
    cycles: [
      {
        cycle: "monthly",
        label: "Mensal",
        months: 1,
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
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
  }
}

function paymentPayload(status: GraceState["status"]) {
  return {
    id: "grace-payment-e2e",
    status,
    amountCents: 5990,
    effectivePriceCents: 5990,
    paymentInstructions: {
      brCode: PIX_CODE,
      brCodeBase64: "iVBORw0KGgo=",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    },
  }
}

async function openBillingGrace(context: BrowserContext, page: Page): Promise<GraceState> {
  await injectE2eAuthCookie(context)
  await context.addInitScript(
    ({ supabaseId, version }: { supabaseId: string; version: string }) => {
      window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
    },
    { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
  )

  const state: GraceState = { status: "pending", createRequests: [] }

  await page.route("**/api/**/billing-grace-payment**", async (route) => {
    const request = route.request()
    if (request.method() === "POST") {
      state.createRequests.push(request.postDataJSON() as Record<string, unknown>)
      await route.fulfill({ status: 201, contentType: "application/json", body: envelope(paymentPayload("pending")) })
      return
    }
    // GET com paymentId: consulta do pagamento criado. Sem ele: quote da renovação.
    const isPaymentStatus = request.url().includes("paymentId=")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope(isPaymentStatus ? paymentPayload(state.status) : quotePayload()),
    })
  })

  return state
}

test.describe("regularização da assinatura", () => {
  test("prazo e itens antes do pagamento; PIX gerado pelo envio com termos implícitos", async ({ context, page }) => {
    const state = await openBillingGrace(context, page)

    await page.goto(`/pagamento/${E2E_MASTER_SUPABASE_ID}`)
    await expect(page.getByRole("heading", { name: "Renove sua assinatura" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Período do plano" })).toBeVisible()
    await expect(page.getByText("R$ 59,90").first()).toBeAttached()

    // Fase "Plano e itens": não há envio nem aviso de termos; Continuar leva ao pagamento.
    await expect(page.getByRole("button", { name: "Gerar QR Code PIX" })).toHaveCount(0)
    await expect(page.getByText(TERMS_TEXT)).toHaveCount(0)
    await page.getByRole("button", { name: "Continuar" }).click()

    // Fase "Pagamento": o envio fica na lateral e o aviso de termos ao lado do botão.
    await expect(page.getByRole("heading", { name: "Pagamento por PIX" })).toBeVisible()
    await expect(page.getByText(TERMS_TEXT)).toBeVisible()
    await expect(page.getByRole("checkbox")).toHaveCount(0)
    expect(state.createRequests).toHaveLength(0)

    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()
    await expect(page.getByText(PIX_CODE)).toBeAttached()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible()

    expect(state.createRequests).toHaveLength(1)
    expect(state.createRequests[0]).toMatchObject({ cycle: "monthly", termsAccepted: true })
    await runResponsiveChecks(page)
  })

  test("pagamento confirmado mostra Assinatura reativada com CTA para o dashboard", async ({ context, page }) => {
    const state = await openBillingGrace(context, page)

    await page.goto(`/pagamento/${E2E_MASTER_SUPABASE_ID}`)
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()
    await expect(page.getByText(PIX_CODE)).toBeAttached()

    // O banco confirma depois do PIX gerado; a tela pega o status na próxima consulta automática.
    state.status = "completed"
    await expect(page.getByRole("heading", { name: "Assinatura reativada" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Você será levado ao Corretor Studio em 5 s.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Ir agora" })).toHaveAttribute(
      "href",
      `/${E2E_MASTER_SUPABASE_ID}/dashboard`,
    )
    await runResponsiveChecks(page)
  })
})

test.describe("acesso ao checkout de regularização", () => {
  test.setTimeout(60_000)

  test("sem sessão, leva ao login e devolve para o checkout", async ({ page }) => {
    await page.goto(`/pagamento/${E2E_MASTER_SUPABASE_ID}`, { waitUntil: "domcontentloaded" })

    await expect(page).toHaveURL(/\/sign-in\?next=/)
    expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toBe(
      `/pagamento/${E2E_MASTER_SUPABASE_ID}`,
    )
  })

  test("o dono da conta vê o checkout com cabeçalho e sem a sidebar da conta", async ({ context, page }) => {
    await injectE2eAuthCookie(context)

    await page.goto(`/pagamento/${E2E_MASTER_SUPABASE_ID}`, { waitUntil: "domcontentloaded" })

    await expect(page).toHaveURL(new RegExp(`/pagamento/${E2E_MASTER_SUPABASE_ID}$`))
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible()
    await expect(page.getByText("Navegação", { exact: true })).toHaveCount(0)
  })

  test("quem não é o dono da conta volta para o próprio dashboard", async ({ context, page }) => {
    await injectE2eAuthCookie(context)

    await page.goto(`/pagamento/${randomUUID()}`, { waitUntil: "domcontentloaded" })

    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/dashboard`))
  })
})

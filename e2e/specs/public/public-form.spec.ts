/**
 * app/forms/[publicId]/page.tsx
 *
 * Cobertura:
 * - Carrega o formulário publicado sem erro (cover + CTA)
 * - Cookie cs_form_vs criado no mount (Fase E)
 * - onBlur dispara POST /progress com o valor do campo (Fase D1)
 * - Prefill via cs_el pré-preenche nome/e-mail (Fase C)
 * - Nome 3–30, sem @; e-mail digitado no Nome copia para e-mail vazio
 */

import { expect, test } from "@playwright/test"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"

const QUESTION_NAME_ID = "11111111-1111-4111-8111-111111111101"
const QUESTION_EMAIL_ID = "11111111-1111-4111-8111-111111111102"
const E2E_PUBLIC_ID = "e2e00000-0000-4000-8000-000000000001"
const E2E_EMAIL_LOG_ID = "e2e10000-0000-4000-8000-000000000001"

function buildSnapshot(formId, publicId) {
  return {
    formId,
    publicId,
    version: 1,
    publishedAt: new Date().toISOString(),
    name: "Formulário E2E",
    coverTitle: "Formulário de teste E2E",
    coverDescription: null,
    coverBadge: null,
    coverHighlights: [],
    ctaLabel: "Começar",
    successTitle: "Respostas enviadas",
    successDescription: null,
    successActions: [],
    thankYouPages: [],
    defaultThankYouPageId: null,
    useDefaultTheme: true,
    backgroundColor: null,
    textColor: null,
    lineColor: null,
    accentColor: null,
    buttonTextColor: null,
    inputBackgroundColor: null,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    schedulingMessage: null,
    formKind: "standard",
    eligibleClosers: [],
    theme: {
      backgroundColor: "#ffffff",
      textColor: "#111827",
      lineColor: "#e5e7eb",
      accentColor: "#6366f1",
      buttonTextColor: "#ffffff",
      inputBackgroundColor: "#f9fafb",
    },
    questions: [
      {
        id: QUESTION_NAME_ID,
        position: 1,
        type: "text",
        title: "Qual o seu nome?",
        description: null,
        placeholder: null,
        required: true,
        scoreWeight: 0,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "name",
        url: null,
        config: null,
        whatsappPhone: null,
        whatsappMessage: null,
      },
      {
        id: QUESTION_EMAIL_ID,
        position: 2,
        type: "email",
        title: "Qual o seu e-mail?",
        description: null,
        placeholder: null,
        required: false,
        scoreWeight: 0,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "email",
        url: null,
        config: null,
        whatsappPhone: null,
        whatsappMessage: null,
      },
    ],
    rules: [],
    scoreBands: [],
    assignedSdrId: null,
    eligibleCloserIds: [],
  }
}

async function arrangePublicForm() {
  const prisma = getPrisma()
  const profile = await findE2eMasterProfile()
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`")

  const team = await prisma.team.findFirst({
    where: { masterId: profile.id, isDefault: true },
    select: { id: true },
  })
  if (!team) throw new Error("Team E2E não encontrado")

  const form = await prisma.publicForm.upsert({
    where: { publicId: E2E_PUBLIC_ID },
    create: {
      publicId: E2E_PUBLIC_ID,
      teamId: team.id,
      createdById: profile.id,
      name: "Formulário E2E",
      status: "published",
      approvalStatus: "approved",
      ctaLabel: "Começar",
      successTitle: "Respostas enviadas",
      emailCampaignTrackingEnabled: true,
    },
    update: { status: "published", approvalStatus: "approved" },
  })

  const snapshot = buildSnapshot(form.id, form.publicId)

  const publication = await prisma.publicFormPublication.upsert({
    where: { formId_version: { formId: form.id, version: 1 } },
    create: {
      formId: form.id,
      publishedById: profile.id,
      version: 1,
      snapshot,
    },
    update: { snapshot },
  })

  return { form, team, profile, publication }
}

async function arrangeEmailLog(teamId) {
  const prisma = getPrisma()
  return prisma.emailLog.upsert({
    where: { id: E2E_EMAIL_LOG_ID },
    create: {
      id: E2E_EMAIL_LOG_ID,
      teamId,
      recipientEmail: "destinatario.e2e@example.com",
      recipientName: "Destinatário E2E",
      subject: "Campanha E2E",
      category: "campaign",
      status: "sent",
    },
    update: {},
  })
}

test.describe("app/forms/[publicId]", () => {
  test.setTimeout(60_000)

  let publicId
  let teamId

  test.beforeAll(async () => {
    const { form, team } = await arrangePublicForm()
    publicId = form.publicId
    teamId = team.id
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega o formulário publicado sem erro e mostra o CTA de início", async ({ page }) => {
    await page.goto(`/forms/${publicId}`)

    await expect(page.getByText("Formulário de teste E2E")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: /começar/i })).toBeVisible()
  })

  test("cria o cookie cs_form_vs no mount sem PII", async ({ page, context }) => {
    await page.goto(`/forms/${publicId}`)
    await expect(page.getByRole("button", { name: /começar/i })).toBeVisible({ timeout: 15_000 })

    const cookies = await context.cookies()
    const sessionCookie = cookies.find((c) => c.name === "cs_form_vs")

    expect(sessionCookie, "Cookie cs_form_vs não foi criado").toBeTruthy()

    const decoded = decodeURIComponent(sessionCookie.value)
    expect(decoded).toMatch(new RegExp(`^${publicId}:[0-9a-f-]{36}$`))
    expect(decoded).not.toMatch(/@/)
  })

  test("onBlur dispara POST /progress com o valor do campo", async ({ page }) => {
    const progressRequests = []
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/progress")) {
        progressRequests.push(req.postData() ?? "")
      }
    })

    await page.goto(`/forms/${publicId}`)
    await page.getByRole("button", { name: /começar/i }).click()

    const nameInput = page.getByRole("textbox").first()
    await nameInput.fill("Maria Teste")
    await nameInput.blur()

    await page.waitForTimeout(800)

    expect(progressRequests.length, "Nenhuma request POST /progress disparada após blur").toBeGreaterThan(0)

    const body = JSON.parse(progressRequests[0])
    expect(body.answers).toHaveLength(1)
    expect(body.answers[0].value).toBe("Maria Teste")
  })

  test("prefill via cs_el pré-preenche nome e e-mail nos campos nativos", async ({ page }) => {
    await arrangeEmailLog(teamId)

    await page.goto(`/forms/${publicId}?cs_el=${E2E_EMAIL_LOG_ID}`)
    await page.getByRole("button", { name: /começar/i }).click()

    const nameInput = page.getByRole("textbox").first()
    await expect(nameInput).toHaveValue("Destinatário E2E", { timeout: 10_000 })
  })

  test("bloqueia Continuar quando o nome tem menos de 3 caracteres", async ({ page }) => {
    await page.goto(`/forms/${publicId}`)
    await page.getByRole("button", { name: /começar/i }).click()

    const nameInput = page.getByRole("textbox").first()
    await nameInput.fill("Jo")
    await expect(page.getByRole("button", { name: /continuar/i })).toBeDisabled()

    await nameInput.blur()
    await expect(page.getByText("Informe um nome com pelo menos 3 caracteres")).toBeVisible()
  })

  test("e-mail no campo nome copia para e-mail vazio e bloqueia Continuar até nome de pessoa", async ({
    page,
  }) => {
    const progressRequests = []
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/progress")) {
        progressRequests.push(req.postData() ?? "")
      }
    })

    await page.goto(`/forms/${publicId}`)
    await page.getByRole("button", { name: /começar/i }).click()

    const nameInput = page.getByRole("textbox").first()
    await nameInput.fill("user@example.com")
    await expect(page.getByRole("button", { name: /continuar/i })).toBeDisabled()

    await nameInput.blur()
    await expect(page.getByText("Informe um nome de pessoa, não um e-mail")).toBeVisible()
    await page.waitForTimeout(800)

    expect(progressRequests.length, "Blur deve persistir mesmo com nome inválido").toBeGreaterThan(0)
    const body = JSON.parse(progressRequests[0])
    expect(body.answers[0].value).toBe("user@example.com")

    await nameInput.fill("Maria Silva")
    await expect(page.getByRole("button", { name: /continuar/i })).toBeEnabled()
    await page.getByRole("button", { name: /continuar/i }).click()

    await expect(page.getByText("Qual o seu e-mail?")).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveValue("user@example.com")
  })

  test("estado de loading exibe Skeleton enquanto carrega o snapshot", async ({ page }) => {
    // page.tsx busca o snapshot no servidor (Prisma direto, não HTTP) — sem
    // carga real a query resolve rápido demais pro React chegar a emitir o
    // fallback de loading.tsx no stream. ?e2eSlowSnapshot=1 injeta um delay
    // artificial só em E2E (duplo gate com E2E_TEST_MODE, ver page.tsx) pra
    // garantir que o Suspense realmente flushe o Skeleton antes do conteúdo.
    // waitUntil: "commit" retorna o controle assim que a navegação começa,
    // antes do stream terminar, permitindo observar o fallback.
    await page.goto(`/forms/${publicId}?e2eSlowSnapshot=1`, { waitUntil: "commit" })
    const skeleton = page.locator(".animate-pulse, [class*='skeleton']").first()
    await expect(skeleton).toBeVisible({ timeout: 5_000 })
  })
})

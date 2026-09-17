/**
 * Roteamento multi-tenant por host dos formulários públicos (Frente C).
 *
 * Sem renderização — só request/headers com Host forjado (por isso o sufixo
 * `-api.spec.ts`): valida o branch de forms-host do proxy.ts e a guarda de
 * tenancy de app/forms/[publicId]/page.tsx.
 *
 * Isolamento: times PRÓPRIOS deste spec (não o time default do master E2E,
 * que outros specs mutam em paralelo) e hostname único por execução — evita
 * colisão entre workers e stale do cache por tag no dev server reaproveitado.
 */

import { expect, test } from "@playwright/test"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"

const RUN_SUFFIX = `${Date.now()}`
const VERIFIED_HOST = `forms.e2e-host-a-${RUN_SUFFIX}.com.br`
const UNKNOWN_HOST = `forms.e2e-desconhecido-${RUN_SUFFIX}.com.br`

const TEAM_A_NAME = "E2E Forms Host — Time A"
const TEAM_B_NAME = "E2E Forms Host — Time B"
const FORM_A_PUBLIC_ID = "e2e70000-0000-4000-8000-00000000000a"
const FORM_B_PUBLIC_ID = "e2e70000-0000-4000-8000-00000000000b"
const FORM_A_COVER_TITLE = "Formulário do Time A (host routing)"

function buildMinimalSnapshot(formId: string, publicId: string, coverTitle: string) {
  return {
    formId,
    publicId,
    version: 1,
    publishedAt: new Date().toISOString(),
    name: coverTitle,
    coverTitle,
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
    questions: [],
    rules: [],
    scoreBands: [],
    assignedSdrId: null,
    eligibleCloserIds: [],
  }
}

async function arrangeTeamWithPublishedForm(options: {
  teamName: string
  publicId: string
  coverTitle: string
}) {
  const prisma = getPrisma()
  const profile = await findE2eMasterProfile()
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`")

  let team = await prisma.team.findFirst({
    where: { masterId: profile.id, name: options.teamName },
    select: { id: true },
  })
  team ??= await prisma.team.create({
    data: { name: options.teamName, masterId: profile.id, isDefault: false },
    select: { id: true },
  })

  const form = await prisma.publicForm.upsert({
    where: { publicId: options.publicId },
    create: {
      publicId: options.publicId,
      teamId: team.id,
      createdById: profile.id,
      name: options.coverTitle,
      status: "published",
      approvalStatus: "approved",
      ctaLabel: "Começar",
      successTitle: "Respostas enviadas",
    },
    update: { teamId: team.id, status: "published", approvalStatus: "approved" },
  })

  const snapshot = buildMinimalSnapshot(form.id, form.publicId, options.coverTitle)
  await prisma.publicFormPublication.upsert({
    where: { formId_version: { formId: form.id, version: 1 } },
    create: { formId: form.id, publishedById: profile.id, version: 1, snapshot },
    update: { snapshot },
  })

  return { teamId: team.id, formId: form.id }
}

test.describe("roteamento por host dos formulários públicos", () => {
  test.setTimeout(90_000)

  let teamAId: string

  test.beforeAll(async () => {
    const teamA = await arrangeTeamWithPublishedForm({
      teamName: TEAM_A_NAME,
      publicId: FORM_A_PUBLIC_ID,
      coverTitle: FORM_A_COVER_TITLE,
    })
    teamAId = teamA.teamId

    await arrangeTeamWithPublishedForm({
      teamName: TEAM_B_NAME,
      publicId: FORM_B_PUBLIC_ID,
      coverTitle: "Formulário do Time B (host routing)",
    })

    await getPrisma().teamFormDomain.upsert({
      where: { teamId: teamAId },
      update: { hostname: VERIFIED_HOST, status: "verified", verifiedAt: new Date() },
      create: {
        teamId: teamAId,
        hostname: VERIFIED_HOST,
        status: "verified",
        verifiedAt: new Date(),
      },
    })
  })

  test.afterAll(async () => {
    const prisma = getPrisma()
    await prisma.teamFormDomain.deleteMany({ where: { teamId: teamAId } })
    await prisma.publicForm.deleteMany({
      where: { publicId: { in: [FORM_A_PUBLIC_ID, FORM_B_PUBLIC_ID] } },
    })
    await prisma.team.deleteMany({ where: { name: { in: [TEAM_A_NAME, TEAM_B_NAME] } } })
    await disconnectPrisma()
  })

  test("host verificado serve o formulário do próprio time com noindex", async ({ request }) => {
    const response = await request.get(`/forms/${FORM_A_PUBLIC_ID}`, {
      headers: { host: VERIFIED_HOST },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()["x-robots-tag"]).toContain("noindex")
    expect(await response.text()).toContain(FORM_A_COVER_TITLE)
  })

  /**
   * Com `cacheComponents: true` (PPR) o shell estático sai com status 200 e o
   * `notFound()` da guarda de tenancy acontece no streaming — o status HTTP
   * não muda mais, mas o CONTEÚDO servido é a página 404. A propriedade de
   * segurança (form do time B nunca é servido no domínio do time A) é medida
   * pelo corpo: ausência do formulário + marcador de not-found.
   */
  test("formulário de OUTRO time no host verificado serve 404 no corpo", async ({ request }) => {
    const response = await request.get(`/forms/${FORM_B_PUBLIC_ID}`, {
      headers: { host: VERIFIED_HOST },
    })

    const body = await response.text()
    expect(body).not.toContain("Formulário do Time B (host routing)")
    expect(body).toContain("404")
  })

  test("host desconhecido (sem domínio verificado) serve 404 no corpo", async ({ request }) => {
    const response = await request.get(`/forms/${FORM_A_PUBLIC_ID}`, {
      headers: { host: UNKNOWN_HOST },
    })

    const body = await response.text()
    expect(body).not.toContain(FORM_A_COVER_TITLE)
    expect(body).toContain("404")
  })

  test("rota fora de /forms/* em host custom redireciona 307 para a plataforma", async ({
    request,
  }) => {
    const response = await request.get("/sign-in", {
      headers: { host: VERIFIED_HOST },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
    const location = response.headers()["location"] ?? ""
    expect(location).toContain("/sign-in")
    expect(location).not.toContain(VERIFIED_HOST)
  })

  test("API pública mascarada do formulário responde no host custom", async ({ request }) => {
    const response = await request.get(`/api/q/public-forms/${FORM_A_PUBLIC_ID}`, {
      headers: { host: VERIFIED_HOST },
    })

    expect(response.status()).toBe(200)
    const payload = (await response.json()) as { isValid: boolean }
    expect(payload.isValid).toBe(true)
  })

  /**
   * Guarda de tenancy NAS ROTAS, não só na página. O proxy libera
   * `/api/(q|v1)/public-forms/**` em host custom sem consultar banco, e
   * `Origin` ausente passa no `isPublicFormRequestOriginAllowed` — então sem
   * `rejectPublicFormRequestOnForeignHost` daria para ler o snapshot e, pior,
   * CRIAR LEAD do time B no domínio verificado do time A.
   *
   * Aqui o status HTTP é medido de verdade (diferente da página, onde o PPR
   * devolve o shell 200 e o notFound acontece no streaming).
   */
  test("snapshot de formulário de OUTRO time é 404 na API do host custom", async ({ request }) => {
    const response = await request.get(`/api/q/public-forms/${FORM_B_PUBLIC_ID}`, {
      headers: { host: VERIFIED_HOST },
    })

    expect(response.status()).toBe(404)
    const payload = (await response.json()) as { isValid: boolean; result: unknown }
    expect(payload.isValid).toBe(false)
    expect(payload.result).toBeNull()
  })

  test("submissão de formulário de OUTRO time é recusada no host custom", async ({ request }) => {
    const response = await request.post(
      `/api/q/public-forms/${FORM_B_PUBLIC_ID}/submissions`,
      {
        headers: { host: VERIFIED_HOST, "content-type": "application/json" },
        data: {
          visitorSessionId: "e2e-host-tenancy-session",
          answers: [],
          origin: {},
        },
      },
    )

    expect(response.status()).toBe(404)

    // A prova que importa: nenhuma submissão do time B nasceu pelo host do A.
    const submissionCount = await getPrisma().publicFormSubmission.count({
      where: { form: { publicId: FORM_B_PUBLIC_ID } },
    })
    expect(submissionCount).toBe(0)
  })

  /**
   * O prefill já devolve 404 por outros motivos (parâmetro ausente), então o
   * status sozinho não discrimina — a mensagem é que prova que quem recusou
   * foi a guarda de tenancy, e não a validação de parâmetros.
   */
  test("prefill de formulário de OUTRO time é recusado pela guarda no host custom", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/q/public-forms/${FORM_B_PUBLIC_ID}/prefill`,
      { headers: { host: VERIFIED_HOST } },
    )

    expect(response.status()).toBe(404)
    const payload = (await response.json()) as { errorMessages?: string[] }
    expect(payload.errorMessages).toContain("Formulário não encontrado")
  })

  test("progresso de formulário de OUTRO time é recusado no host custom", async ({ request }) => {
    const response = await request.post(`/api/q/public-forms/${FORM_B_PUBLIC_ID}/progress`, {
      headers: { host: VERIFIED_HOST, "content-type": "application/json" },
      data: {
        visitorSessionId: "e2e-host-tenancy-session",
        answers: [],
      },
    })

    expect(response.status()).toBe(404)
  })

  test("evento de métrica de formulário de OUTRO time é recusado no host custom", async ({
    request,
  }) => {
    const response = await request.post(`/api/q/public-forms/${FORM_B_PUBLIC_ID}/events`, {
      headers: { host: VERIFIED_HOST, "content-type": "application/json" },
      data: {
        visitorSessionId: "e2e-host-tenancy-session",
        eventType: "form_view",
        eventKey: "e2e-host-tenancy-event",
      },
    })

    expect(response.status()).toBe(404)
  })

  test("host desconhecido é 404 na API mesmo para formulário existente", async ({ request }) => {
    const response = await request.get(`/api/q/public-forms/${FORM_A_PUBLIC_ID}`, {
      headers: { host: UNKNOWN_HOST },
    })

    expect(response.status()).toBe(404)
  })

  /** O caminho normal (host da plataforma) não pode ter sido estreitado. */
  test("host da plataforma segue servindo a API de qualquer formulário", async ({ request }) => {
    const response = await request.get(`/api/q/public-forms/${FORM_B_PUBLIC_ID}`)

    expect(response.status()).toBe(200)
    const payload = (await response.json()) as { isValid: boolean }
    expect(payload.isValid).toBe(true)
  })

  test("API fora do escopo do formulário redireciona no host custom", async ({ request }) => {
    const response = await request.get("/api/q/leads", {
      headers: { host: VERIFIED_HOST },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
  })
})

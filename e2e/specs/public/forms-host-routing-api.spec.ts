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

  test("formulário de OUTRO time no host verificado responde 404", async ({ request }) => {
    const response = await request.get(`/forms/${FORM_B_PUBLIC_ID}`, {
      headers: { host: VERIFIED_HOST },
    })

    expect(response.status()).toBe(404)
  })

  test("host desconhecido (sem domínio verificado) responde 404", async ({ request }) => {
    const response = await request.get(`/forms/${FORM_A_PUBLIC_ID}`, {
      headers: { host: UNKNOWN_HOST },
    })

    expect(response.status()).toBe(404)
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

  test("API fora do escopo do formulário redireciona no host custom", async ({ request }) => {
    const response = await request.get("/api/q/leads", {
      headers: { host: VERIFIED_HOST },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
  })
})

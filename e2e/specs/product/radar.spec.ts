/**
 * app/[supabaseId]/radar/page.tsx
 *
 * Cobertura:
 * - Página autenticada carrega o heading Radar
 * - Estado vazio ou lista de perfis (sem crash)
 * - CTA de segmentos funciona
 * - Aba Formulários no detalhe do perfil com badges Completo / Incompleto /
 *   Iniciou sem nenhuma resposta
 */

import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"
import { PUBLIC_FORM_RADAR_SOURCE_TYPE } from "../../../lib/radar/map-public-form-metric-to-radar-event"

const E2E_RADAR_PROFILE_ID = "e2e20000-0000-4000-8000-000000000201"
const RELATED_LEADS_PROFILE_ID = "e2e20000-0000-4000-8000-000000000231"
const RELATED_LEAD_OPEN_ID = "e2e20000-0000-4000-8000-000000000232"
const RELATED_LEAD_LOST_ID = "e2e20000-0000-4000-8000-000000000233"
const RELATED_LEAD_OPEN_CODE = "E2ERELATEDOPEN01"
const RELATED_LEAD_LOST_CODE = "E2ERELATEDLOST01"
const RELATED_LEADS_PROFILE_DISPLAY_NAME = "Vladicea Leads Relacionados E2E"
const FORM_COMPLETE_ID = "e2e20000-0000-4000-8000-000000000211"
const FORM_INCOMPLETE_ID = "e2e20000-0000-4000-8000-000000000212"
const FORM_STARTED_ID = "e2e20000-0000-4000-8000-000000000213"
const FORM_COMPLETE_PUBLIC_ID = "e2e20000-0000-4000-8000-000000000221"
const FORM_INCOMPLETE_PUBLIC_ID = "e2e20000-0000-4000-8000-000000000222"
const FORM_STARTED_PUBLIC_ID = "e2e20000-0000-4000-8000-000000000223"
const PROFILE_DISPLAY_NAME = "Ana Formulários Radar"

async function grantRadarBeta(profileId: string) {
  const prisma = getPrisma()
  const radarFeature = await prisma.backofficeFeature.findUnique({
    where: { slug: "radar" },
    select: { id: true },
  })
  if (!radarFeature) {
    throw new Error("Feature radar ausente no catálogo — rode `bun run db:seed:e2e`")
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: {
        featureId: radarFeature.id,
        profileId,
        grantType: "BETA",
      },
    },
    create: {
      featureId: radarFeature.id,
      profileId,
      grantType: "BETA",
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
    update: {
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
  })
}

async function upsertForm(input: {
  id: string
  publicId: string
  name: string
  teamId: string
  createdById: string
}) {
  const prisma = getPrisma()
  return prisma.publicForm.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      publicId: input.publicId,
      teamId: input.teamId,
      createdById: input.createdById,
      name: input.name,
      status: "published",
      approvalStatus: "approved",
      ctaLabel: "Começar",
      successTitle: "Respostas enviadas",
    },
    update: {
      name: input.name,
      status: "published",
      approvalStatus: "approved",
    },
  })
}

async function arrangeRadarFormsProfile() {
  const prisma = getPrisma()
  const profile = await findE2eMasterProfile()
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`")
  if (!profile.activeTeamId) throw new Error("Team E2E não encontrado")

  await grantRadarBeta(profile.id)

  const teamId = profile.activeTeamId
  await upsertForm({
    id: FORM_COMPLETE_ID,
    publicId: FORM_COMPLETE_PUBLIC_ID,
    name: "Qualificação Completa E2E",
    teamId,
    createdById: profile.id,
  })
  await upsertForm({
    id: FORM_INCOMPLETE_ID,
    publicId: FORM_INCOMPLETE_PUBLIC_ID,
    name: "Qualificação Incompleta E2E",
    teamId,
    createdById: profile.id,
  })
  await upsertForm({
    id: FORM_STARTED_ID,
    publicId: FORM_STARTED_PUBLIC_ID,
    name: "Qualificação Sem Resposta E2E",
    teamId,
    createdById: profile.id,
  })

  await prisma.radarEvent.deleteMany({ where: { profileId: E2E_RADAR_PROFILE_ID } })
  await prisma.radarIdentity.deleteMany({ where: { profileId: E2E_RADAR_PROFILE_ID } })
  await prisma.radarChannelConsent.deleteMany({ where: { profileId: E2E_RADAR_PROFILE_ID } })
  await prisma.radarSourceLink.deleteMany({ where: { profileId: E2E_RADAR_PROFILE_ID } })

  await prisma.radarProfile.upsert({
    where: { id: E2E_RADAR_PROFILE_ID },
    create: {
      id: E2E_RADAR_PROFILE_ID,
      teamId,
      displayName: PROFILE_DISPLAY_NAME,
      normalizedName: "ana formularios radar",
      displayPhone: "11988887777",
      normalizedPhone: "5511988887777",
      primaryEmail: "ana.formularios.radar@example.com",
      normalizedPrimaryEmail: "ana.formularios.radar@example.com",
      lastSeenAt: new Date(),
      engagementScore: 100,
      engagementBand: "hot",
    },
    update: {
      displayName: PROFILE_DISPLAY_NAME,
      lastSeenAt: new Date(),
      engagementScore: 100,
      engagementBand: "hot",
    },
  })

  const now = new Date("2026-08-20T15:00:00.000Z")
  await prisma.radarEvent.createMany({
    data: [
      {
        profileId: E2E_RADAR_PROFILE_ID,
        teamId,
        eventType: "form.started",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${FORM_COMPLETE_ID}-started`,
        occurredAt: now,
        metadata: { formId: FORM_COMPLETE_ID },
      },
      {
        profileId: E2E_RADAR_PROFILE_ID,
        teamId,
        eventType: "form.completed",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${FORM_COMPLETE_ID}-completed`,
        occurredAt: new Date(now.getTime() + 60_000),
        metadata: { formId: FORM_COMPLETE_ID },
      },
      {
        profileId: E2E_RADAR_PROFILE_ID,
        teamId,
        eventType: "form.started",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${FORM_INCOMPLETE_ID}-started`,
        occurredAt: new Date(now.getTime() + 120_000),
        metadata: { formId: FORM_INCOMPLETE_ID },
      },
      {
        profileId: E2E_RADAR_PROFILE_ID,
        teamId,
        eventType: "form.question_answered",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${FORM_INCOMPLETE_ID}-answered`,
        occurredAt: new Date(now.getTime() + 180_000),
        metadata: { formId: FORM_INCOMPLETE_ID, questionId: "q-name" },
      },
      {
        profileId: E2E_RADAR_PROFILE_ID,
        teamId,
        eventType: "form.started",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${FORM_STARTED_ID}-started`,
        occurredAt: new Date(now.getTime() + 240_000),
        metadata: { formId: FORM_STARTED_ID },
      },
    ],
  })

  return { profile, teamId }
}

/**
 * Regra 2/3 (adenda 31/08, pós-#1107): um perfil pode ter N leads vinculados
 * (histórico) — a seção "Leads no CRM" do perfil unificado precisa listar
 * todos. Dois leads reais no banco, dois vínculos `radarIdentity` (type
 * `lead_id`) para o MESMO perfil — cenário que só é possível porque
 * `linkLeadIdentity` deixou de recusar o segundo vínculo.
 */
async function arrangeRelatedLeadsProfile() {
  const prisma = getPrisma()
  const profile = await findE2eMasterProfile()
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`")
  if (!profile.activeTeamId) throw new Error("Team E2E não encontrado")
  const teamId = profile.activeTeamId

  await grantRadarBeta(profile.id)

  await prisma.radarIdentity.deleteMany({ where: { profileId: RELATED_LEADS_PROFILE_ID } })
  await prisma.lead.deleteMany({
    where: { id: { in: [RELATED_LEAD_OPEN_ID, RELATED_LEAD_LOST_ID] } },
  })
  await prisma.radarEvent.deleteMany({ where: { profileId: RELATED_LEADS_PROFILE_ID } })
  await prisma.radarChannelConsent.deleteMany({ where: { profileId: RELATED_LEADS_PROFILE_ID } })
  await prisma.radarSourceLink.deleteMany({ where: { profileId: RELATED_LEADS_PROFILE_ID } })

  await prisma.radarProfile.upsert({
    where: { id: RELATED_LEADS_PROFILE_ID },
    create: {
      id: RELATED_LEADS_PROFILE_ID,
      teamId,
      displayName: RELATED_LEADS_PROFILE_DISPLAY_NAME,
      normalizedName: "vladicea leads relacionados e2e",
      displayPhone: "11977776666",
      normalizedPhone: "5511977776666",
      primaryEmail: "vladicea.relacionados.e2e@example.com",
      normalizedPrimaryEmail: "vladicea.relacionados.e2e@example.com",
      lastSeenAt: new Date(),
      engagementScore: 80,
      engagementBand: "warm",
    },
    update: {
      displayName: RELATED_LEADS_PROFILE_DISPLAY_NAME,
      lastSeenAt: new Date(),
    },
  })

  await prisma.lead.create({
    data: {
      id: RELATED_LEAD_LOST_ID,
      leadCode: RELATED_LEAD_LOST_CODE,
      managerId: profile.id,
      teamId,
      status: "opportunityLost",
      name: "vladicea (perdido)",
      createdBy: profile.id,
      updatedBy: profile.id,
    },
  })
  await prisma.lead.create({
    data: {
      id: RELATED_LEAD_OPEN_ID,
      leadCode: RELATED_LEAD_OPEN_CODE,
      managerId: profile.id,
      teamId,
      status: "new_opportunity",
      name: "vladicea (reaberto)",
      createdBy: profile.id,
      updatedBy: profile.id,
    },
  })

  // Vínculo do lead perdido nasce PRIMEIRO — vínculo mais recente (regra 2)
  // é o do lead reaberto, então a UI precisa mostrar os dois, não só o topo.
  await prisma.radarIdentity.create({
    data: {
      teamId,
      profileId: RELATED_LEADS_PROFILE_ID,
      type: "lead_id",
      value: RELATED_LEAD_LOST_ID,
      normalizedValue: RELATED_LEAD_LOST_ID,
      source: "public_form_radar_gate",
      isPrimary: false,
      createdAt: new Date("2026-08-11T10:00:00.000Z"),
    },
  })
  await prisma.radarIdentity.create({
    data: {
      teamId,
      profileId: RELATED_LEADS_PROFILE_ID,
      type: "lead_id",
      value: RELATED_LEAD_OPEN_ID,
      normalizedValue: RELATED_LEAD_OPEN_ID,
      source: "public_form_radar_gate",
      isPrimary: false,
      createdAt: new Date("2026-08-31T14:00:00.000Z"),
    },
  })

  return { profile, teamId }
}

test.describe("app/[supabaseId]/radar", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true")
    }, E2E_MASTER_SUPABASE_ID)
    await arrangeRadarFormsProfile()
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega o Radar autenticado com heading e CTA de segmentos", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/radar`, { waitUntil: "domcontentloaded" })

    await expect(page.locator("h1.text-xl", { hasText: "Radar" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Acesso não liberado")).toHaveCount(0)
    await expect(page.getByText("Você não tem acesso a esta funcionalidade.")).toHaveCount(0)
    await expect(page.getByText("Assinatura Inativa")).toHaveCount(0)

    const emptyState = page.getByText("Nenhum perfil encontrado")
    const profileName = page.getByText(PROFILE_DISPLAY_NAME)
    await expect(emptyState.or(profileName).first()).toBeVisible({ timeout: 30_000 })

    const segmentosTab = page.getByRole("tab", { name: "Segmentos" })
    await expect(segmentosTab).toBeVisible({ timeout: 15_000 })
    await segmentosTab.click()
    await expect(page.getByText("Segmentos do sistema")).toBeVisible()
  })

  test("mostra badges Completo, Incompleto e Iniciou sem nenhuma resposta na aba Formulários", async ({
    page,
  }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/radar?perfil=${E2E_RADAR_PROFILE_ID}`, {
      waitUntil: "domcontentloaded",
    })

    await expect(page.locator("h1.text-xl", { hasText: "Radar" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Detalhe do perfil" })).toBeVisible()

    await page.getByRole("tab", { name: "Formulários" }).click()

    const formsTab = page.getByRole("tabpanel", { name: "Formulários" })
    const completeCard = formsTab.locator("div.rounded-md.border").filter({
      hasText: "Qualificação Completa E2E",
    })
    const incompleteCard = formsTab.locator("div.rounded-md.border").filter({
      hasText: "Qualificação Incompleta E2E",
    })
    const startedCard = formsTab.locator("div.rounded-md.border").filter({
      hasText: "Qualificação Sem Resposta E2E",
    })

    await expect(completeCard.getByText("Completo", { exact: true })).toBeVisible()
    await expect(incompleteCard.getByText("Incompleto", { exact: true })).toBeVisible()
    await expect(startedCard.getByText("Iniciou sem nenhuma resposta", { exact: true })).toBeVisible()
  })

  /**
   * Adenda do owner (31/08, pós-#1107) — regra 2/3: o vínculo perfil↔lead virou
   * histórico. Um perfil com 2 leads vinculados (um `new_opportunity`, um
   * `opportunityLost` — o mesmo par do caso real "vladicea" da nota do vault)
   * precisa mostrar os DOIS na seção "Leads no CRM", não só o mais recente.
   */
  test("mostra os dois leads vinculados na seção Leads no CRM do perfil unificado", async ({
    page,
  }) => {
    await arrangeRelatedLeadsProfile()

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/radar?perfil=${RELATED_LEADS_PROFILE_ID}`, {
      waitUntil: "domcontentloaded",
    })

    await expect(page.getByRole("heading", { name: "Detalhe do perfil" })).toBeVisible({
      timeout: 30_000,
    })

    await page.getByRole("tab", { name: "Leads no CRM" }).click()
    const leadsTab = page.getByRole("tabpanel", { name: "Leads no CRM" })

    const openCard = leadsTab.locator("a").filter({ hasText: RELATED_LEAD_OPEN_CODE })
    const lostCard = leadsTab.locator("a").filter({ hasText: RELATED_LEAD_LOST_CODE })

    await expect(openCard).toBeVisible({ timeout: 15_000 })
    await expect(openCard.getByText("Nova oportunidade", { exact: true })).toBeVisible()
    await expect(lostCard).toBeVisible()
    await expect(lostCard.getByText("Perdido", { exact: true })).toBeVisible()
  })

  /**
   * SPEC 11 E1 / auditoria CDP §4 R5 — duplicata na promoção é fluxo, não beco.
   *
   * O backend devolve 409 com `requiresDuplicateConfirmation` + candidatos, o
   * `parseOutput` preserva o `result` e a UI precisa oferecer saída. Antes o
   * usuário via só a mensagem de erro e ficava sem caminho para confirmar.
   *
   * A promoção é interceptada para produzir o 409 de forma determinística —
   * fabricar uma duplicata real dependeria da régua de matching do CRM, que é
   * outro assunto (D2b).
   */
  test("duplicata na promoção abre confirmação com candidatos e permite criar assim mesmo", async ({
    page,
  }) => {
    let confirmedWithFlag = false

    await page.route("**/promote-to-lead**", async (route) => {
      const body = route.request().postData()
      const confirmed = Boolean(body && JSON.parse(body).confirmDuplicate === true)

      if (!confirmed) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: false,
            successMessages: [],
            errorMessages: ["Possível lead duplicado neste time"],
            result: {
              requiresDuplicateConfirmation: true,
              duplicateCandidates: [
                {
                  id: "e2e-lead-dup-1",
                  name: "Maria Duplicada",
                  phone: "(11) 98888-7777",
                  email: "maria@dup.com",
                },
              ],
            },
          }),
        })
        return
      }

      confirmedWithFlag = true
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          successMessages: ["Lead criado e vinculado ao perfil Radar"],
          errorMessages: [],
          result: { leadId: "e2e-lead-dup-created", radarProfileId: E2E_RADAR_PROFILE_ID },
        }),
      })
    })

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/radar?perfil=${E2E_RADAR_PROFILE_ID}`, {
      waitUntil: "domcontentloaded",
    })

    const promoteButton = page.getByRole("button", { name: "Promover a Lead" })
    await expect(promoteButton).toBeVisible({ timeout: 45_000 })
    await promoteButton.click()

    // O botão abre primeiro a confirmação da própria promoção; a duplicata só
    // aparece depois que a chamada acontece.
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmar promoção" })
      .click()

    // Escopado ao diálogo de DUPLICATA: o de confirmação da promoção continua
    // montado atrás, então `getByRole("alertdialog")` casa os dois e qualquer
    // asserção de visibilidade viraria corrida entre eles.
    const duplicateTitle = page.getByText("Já existe lead parecido. Criar mesmo assim?")
    await expect(duplicateTitle).toBeVisible({ timeout: 15_000 })

    const duplicateDialog = page.getByRole("alertdialog").filter({ hasText: "Já existe lead" })
    await expect(duplicateDialog.getByText("Maria Duplicada")).toBeVisible()
    await expect(duplicateDialog.getByText("(11) 98888-7777 · maria@dup.com")).toBeVisible()

    // 360px sem overflow horizontal, com o diálogo aberto.
    await page.setViewportSize({ width: 360, height: 800 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true)

    // A saída funciona e reenvia com o flag — é isso que destrava o usuário.
    await duplicateDialog.getByRole("button", { name: "Criar assim mesmo" }).click()
    await expect(duplicateTitle).toBeHidden({ timeout: 15_000 })
    expect(confirmedWithFlag).toBe(true)
  })

  test("cancelar a confirmação de duplicata não promove", async ({ page }) => {
    let promoteCalls = 0

    await page.route("**/promote-to-lead**", async (route) => {
      promoteCalls += 1
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: false,
          successMessages: [],
          errorMessages: ["Possível lead duplicado neste time"],
          result: { requiresDuplicateConfirmation: true, duplicateCandidates: [] },
        }),
      })
    })

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/radar?perfil=${E2E_RADAR_PROFILE_ID}`, {
      waitUntil: "domcontentloaded",
    })

    const promoteButton = page.getByRole("button", { name: "Promover a Lead" })
    await expect(promoteButton).toBeVisible({ timeout: 45_000 })
    await promoteButton.click()

    // O botão abre primeiro a confirmação da própria promoção; a duplicata só
    // aparece depois que a chamada acontece.
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmar promoção" })
      .click()

    // Sem candidatos o diálogo ainda precisa explicar o conflito, não ficar mudo.
    const duplicateMessage = page.getByText(
      "O CRM apontou um possível lead duplicado para este perfil."
    )
    await expect(duplicateMessage).toBeVisible({ timeout: 15_000 })

    const duplicateDialog = page.getByRole("alertdialog").filter({ hasText: "Já existe lead" })
    await duplicateDialog.getByRole("button", { name: "Cancelar" }).click()

    // Some o diálogo de duplicata — a confirmação da promoção segue aberta
    // atrás, então asserir "nenhum alertdialog" seria falso.
    await expect(duplicateMessage).toBeHidden({ timeout: 15_000 })
    expect(promoteCalls).toBe(1)
  })
})

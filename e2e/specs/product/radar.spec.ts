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
    await expect(formsTab.getByText("Qualificação Completa E2E")).toBeVisible()
    await expect(formsTab.getByText("Completo")).toBeVisible()
    await expect(formsTab.getByText("Qualificação Incompleta E2E")).toBeVisible()
    await expect(formsTab.getByText("Incompleto")).toBeVisible()
    await expect(formsTab.getByText("Qualificação Sem Resposta E2E")).toBeVisible()
    await expect(formsTab.getByText("Iniciou sem nenhuma resposta")).toBeVisible()
  })
})

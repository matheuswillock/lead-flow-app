/**
 * Landing pages publicadas para specs E2E.
 *
 * O seed E2E não cria landing pages, então as specs de `/conversao/[id]`
 * (documentos legais e fluxos dos templates) eram puladas por falta de dados
 * (`E2E_PUBLIC_LANDING_PAGE_ID`, `E2E_BLACK_AND_WHITE_LANDING_ID`,
 * `E2E_ALVORA_LANDING_ID`). `arrangeLandingFixtures` cria tudo uma vez, no
 * `globalSetup` do Playwright (`e2e/global-setup.ts`), com IDs fixos: arrumar
 * dentro de cada spec faria workers paralelos disputarem as mesmas linhas.
 *
 * O formato gravado é o de produção: o formulário vira uma
 * `PublicFormPublication` e a landing, uma `LandingPagePublication` cujo
 * snapshot é montado como `LandingPageRepository.publish`. Não passa pelo caso
 * de uso `publish` porque ele exige um subdomínio studio verificado.
 */

import { findE2eMasterProfile, getPrisma } from "./db"
import { buildPublicFormSnapshot, type PublicFormFixtureQuestionIds } from "./public-form-fixture"

export type LandingTemplateSlug = "black-and-white" | "alvora"

export type LandingFixture = {
  templateSlug: LandingTemplateSlug
  name: string
  /** Nome da marca exibido no cabeçalho do template (`identity.tradeName`). */
  brandName: string
  /** `publicId` da landing: é o que vai em `/conversao/[landingPageId]`. */
  publicId: string
  landingId: string
  formId: string
  formPublicId: string
  questionIds: PublicFormFixtureQuestionIds
}

/** UUIDs estáveis e válidos: `kind` separa os fixtures, `slot` as linhas de cada um. */
function fixtureId(kind: number, slot: number): string {
  return `e2e20000-0000-4000-8000-${String(kind).padStart(4, "0")}${String(slot).padStart(8, "0")}`
}

function createFixture(
  kind: number,
  templateSlug: LandingTemplateSlug,
  name: string,
  brandName: string,
): LandingFixture {
  return {
    templateSlug,
    name,
    brandName,
    landingId: fixtureId(kind, 1),
    publicId: fixtureId(kind, 2),
    formId: fixtureId(kind, 3),
    formPublicId: fixtureId(kind, 4),
    questionIds: {
      name: fixtureId(kind, 11),
      email: fixtureId(kind, 12),
      phone: fixtureId(kind, 13),
    },
  }
}

export const E2E_LANDING_FIXTURES = {
  blackAndWhite: createFixture(1, "black-and-white", "Landing E2E Black and White", "Black and White E2E"),
  alvora: createFixture(2, "alvora", "Landing E2E Alvorá", "Alvorá E2E"),
} as const

export const E2E_LANDING_FIXTURE_LIST: LandingFixture[] = Object.values(E2E_LANDING_FIXTURES)

const OFFER = { enabled: false, badge: "", percentage: null, title: "", items: [], disclaimer: "" }

/** Conteúdo mínimo e válido, no formato que o wizard de landing pages salva. */
function buildContent(fixture: LandingFixture) {
  const brand = fixture.brandName
  return {
    brandName: brand,
    heroTitle: "Compare planos de saúde com contexto",
    heroDescription: "Landing de teste E2E.",
    footerText: `© ${brand}`,
    templateConfig: {
      templateSlug: fixture.templateSlug,
      identity: { tradeName: brand, legalName: `${brand} Corretora Ltda`, cnpj: "", logoUrl: null, copyright: `© ${brand}` },
      contact: {
        phoneDisplay: "11987654321",
        phoneE164: "11987654321",
        whatsappE164: "11987654321",
        whatsappMessage: "Olá! Vim pela página.",
        email: "contato.e2e@example.com",
        businessHours: "Seg a Sex, 9h às 18h",
      },
      seo: { title: `${brand} | Planos de saúde`, description: "Landing de teste E2E." },
    },
  }
}

async function findDefaultTeamId(masterProfileId: string): Promise<string> {
  const team = await getPrisma().team.findFirst({
    where: { masterId: masterProfileId, isDefault: true },
    select: { id: true },
  })
  if (!team) throw new Error("Team E2E não encontrado — rode `bun run db:seed:e2e`")
  return team.id
}

export async function arrangeLandingFixture(fixture: LandingFixture): Promise<void> {
  const prisma = getPrisma()
  const profile = await findE2eMasterProfile()
  if (!profile) throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`")
  const teamId = await findDefaultTeamId(profile.id)

  const form = await prisma.publicForm.upsert({
    where: { publicId: fixture.formPublicId },
    create: {
      id: fixture.formId,
      publicId: fixture.formPublicId,
      teamId,
      createdById: profile.id,
      name: `Formulário ${fixture.name}`,
      status: "published",
      approvalStatus: "approved",
      ctaLabel: "Começar",
      successTitle: "Respostas enviadas",
      emailCampaignTrackingEnabled: true,
    },
    update: { status: "published", approvalStatus: "approved" },
  })

  const formSnapshot = buildPublicFormSnapshot({
    formId: form.id,
    publicId: form.publicId,
    name: form.name,
    coverTitle: `Formulário ${fixture.name}`,
    questionIds: fixture.questionIds,
  })

  await prisma.publicFormQuestion.createMany({
    data: formSnapshot.questions.map((question) => ({
      id: question.id,
      formId: form.id,
      type: question.type,
      title: question.title,
      required: question.required,
      scoreWeight: question.scoreWeight,
      position: question.position,
      mappingTarget: question.mappingTarget,
      mappingKey: question.mappingKey,
    })),
    skipDuplicates: true,
  })

  const formPublication = await prisma.publicFormPublication.upsert({
    where: { formId_version: { formId: form.id, version: 1 } },
    create: { formId: form.id, publishedById: profile.id, version: 1, snapshot: formSnapshot },
    update: { snapshot: formSnapshot, endedAt: null },
  })

  const content = buildContent(fixture)
  const landing = await prisma.landingPage.upsert({
    where: { publicId: fixture.publicId },
    create: {
      id: fixture.landingId,
      publicId: fixture.publicId,
      teamId,
      publicFormId: form.id,
      createdById: profile.id,
      name: fixture.name,
      status: "published",
      templateSlug: fixture.templateSlug,
      content,
      offer: OFFER,
    },
    update: { status: "published", templateSlug: fixture.templateSlug, content, offer: OFFER, publicFormId: form.id },
  })

  const landingSnapshot = {
    landingPageId: landing.id,
    publicId: landing.publicId,
    version: 1,
    publishedAt: new Date().toISOString(),
    name: landing.name,
    templateSlug: landing.templateSlug,
    content,
    offer: OFFER,
    formPublicationId: formPublication.id,
    form: formSnapshot,
  }

  const publication = await prisma.landingPagePublication.upsert({
    where: { landingPageId_version: { landingPageId: landing.id, version: 1 } },
    create: { landingPageId: landing.id, publishedById: profile.id, version: 1, snapshot: landingSnapshot },
    update: { snapshot: landingSnapshot, endedAt: null },
  })
  await prisma.landingPagePublication.update({
    where: { id: publication.id },
    data: { snapshot: { ...landingSnapshot, publicationId: publication.id } },
  })
}

export async function arrangeLandingFixtures(): Promise<void> {
  for (const fixture of E2E_LANDING_FIXTURE_LIST) {
    await arrangeLandingFixture(fixture)
  }
}

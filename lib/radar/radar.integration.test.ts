import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test"
import { randomUUID } from "crypto"
import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const RUN_INTEGRATION = process.env.RADAR_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

/**
 * Importados dinamicamente (só quando RUN_INTEGRATION) para que `bun run test`
 * (sem RADAR_INTEGRATION_TEST) nunca carregue módulos reais como
 * EmailCampaignUseCase — um import estático aqui já bastaria para disputar,
 * fora de ordem, com o `mock.module("@/app/api/infra/data/prisma", ...)` de
 * outros arquivos de teste (ex.: EmailCreditService.test.ts) rodando no mesmo
 * processo do bun test, quebrando testes completamente não relacionados.
 */
let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let radarService: typeof import("@/app/api/services/radar/RadarService").radarService
let radarRepository: typeof import("@/app/api/infra/data/repositories/radar/RadarRepository").radarRepository
let profileMatchesRadarSegment: typeof import("@/lib/radar/segment-rules").profileMatchesRadarSegment
let normalizeRadarEmail: typeof import("@/lib/radar/normalization").normalizeRadarEmail
let normalizeRadarPhone: typeof import("@/lib/radar/normalization").normalizeRadarPhone
let normalizeRadarName: typeof import("@/lib/radar/normalization").normalizeRadarName
let formatDisplayPhone: typeof import("@/lib/radar/normalization").formatDisplayPhone
let syncLeadToRadarUseCase: typeof import("@/app/api/useCases/radar/SyncLeadToRadarUseCase").syncLeadToRadarUseCase
let syncPortfolioToRadarUseCase: typeof import("@/app/api/useCases/radar/SyncPortfolioToRadarUseCase").syncPortfolioToRadarUseCase
let syncEmailContactToRadarUseCase: typeof import("@/app/api/useCases/radar/SyncEmailContactToRadarUseCase").syncEmailContactToRadarUseCase
let teamHasRadarFeature: typeof import("@/lib/radar/team-has-radar-feature").teamHasRadarFeature
let radarSegmentQueryService: typeof import("@/app/api/services/radar/RadarSegmentQueryService").radarSegmentQueryService
let teamRadarSegmentService: typeof import("@/app/api/services/radar/TeamRadarSegmentService").teamRadarSegmentService
let EmailCampaignUseCase: typeof import("@/app/api/useCases/email/EmailCampaignUseCase").EmailCampaignUseCase
let EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB: typeof import("@/lib/email/campaign-limits").EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB
let customerDataPlatformUseCase: typeof import("@/app/api/useCases/radar/RadarUseCase").customerDataPlatformUseCase
let listRadarSegmentEmailRecipients: typeof import("@/lib/radar/list-segment-recipients").listRadarSegmentEmailRecipients
let parseRadarSegmentRules: typeof import("@/lib/radar/segment-dsl").parseRadarSegmentRules

if (RUN_INTEGRATION) {
  // `mock.module` é global ao processo, então precisa ficar DENTRO do guard:
  // registrado no topo, ele valeria também quando este arquivo é apenas
  // carregado-e-pulado, e sobrescreveria os mocks instrumentados que outros
  // testes instalam para os mesmos módulos (public-stats, MetricsUseCase.tags).
  //
  // Alguém no grafo de imports puxa `server-only`, que lança fora do runtime
  // do Next e derrubava o arquivo antes do primeiro teste rodar.
  mock.module("server-only", () => ({}))

  // `cacheTag`/`cacheLife` exigem o runtime do Next (`cacheComponents`) e
  // lançam no bun test. Fora do Next a diretiva `"use cache"` já é inerte.
  mock.module("next/cache", () => ({
    cacheTag: () => undefined,
    cacheLife: () => undefined,
    revalidateTag: () => undefined,
  }))

  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ radarService } = await import("@/app/api/services/radar/RadarService"))
  ;({ radarRepository } = await import("@/app/api/infra/data/repositories/radar/RadarRepository"))
  ;({ profileMatchesRadarSegment } = await import("@/lib/radar/segment-rules"))
  ;({ normalizeRadarEmail, normalizeRadarPhone, normalizeRadarName, formatDisplayPhone } = await import(
    "@/lib/radar/normalization"
  ))
  ;({ syncLeadToRadarUseCase } = await import("@/app/api/useCases/radar/SyncLeadToRadarUseCase"))
  ;({ syncPortfolioToRadarUseCase } = await import("@/app/api/useCases/radar/SyncPortfolioToRadarUseCase"))
  ;({ syncEmailContactToRadarUseCase } = await import("@/app/api/useCases/radar/SyncEmailContactToRadarUseCase"))
  ;({ teamHasRadarFeature } = await import("@/lib/radar/team-has-radar-feature"))
  ;({ radarSegmentQueryService } = await import("@/app/api/services/radar/RadarSegmentQueryService"))
  ;({ teamRadarSegmentService } = await import("@/app/api/services/radar/TeamRadarSegmentService"))
  ;({ EmailCampaignUseCase } = await import("@/app/api/useCases/email/EmailCampaignUseCase"))
  ;({ EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } = await import("@/lib/email/campaign-limits"))
  ;({ customerDataPlatformUseCase } = await import("@/app/api/useCases/radar/RadarUseCase"))
  ;({ listRadarSegmentEmailRecipients } = await import("@/lib/radar/list-segment-recipients"))
  ;({ parseRadarSegmentRules } = await import("@/lib/radar/segment-dsl"))
}

  const scope = {
    teamId: "",
    ctx: { profileId: "", teamMember: { role: "manager", functions: [] as string[] } },
  }
  const otherScope = {
    teamId: "",
    ctx: { profileId: "", teamMember: { role: "manager", functions: [] as string[] } },
  }
let leadId = ""
let profileId = ""

describe.skipIf(!RUN_INTEGRATION)("CustomerDataPlatform integration", () => {
  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-${suffix}@example.com`,
        supabaseId: randomUUID(),
        fullName: "Radar Tester",
        isMaster: true,
      },
    })

    const team = await prisma.team.create({
      data: {
        id: randomUUID(),
        name: `CDP Test ${suffix}`,
        masterId: profile.id,
      },
    })
    const otherTeam = await prisma.team.create({
      data: {
        id: randomUUID(),
        name: `CDP Other ${suffix}`,
        masterId: profile.id,
      },
    })

    await prisma.teamMember.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        profileId: profile.id,
        role: "manager",
      },
    })

    scope.teamId = team.id
    scope.ctx = {
      profileId: profile.id,
      teamMember: { role: "manager", functions: [] },
    }
    otherScope.teamId = otherTeam.id
    otherScope.ctx = {
      profileId: profile.id,
      teamMember: { role: "manager", functions: [] },
    }

    const lead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-${suffix}`,
        managerId: profile.id,
        teamId: team.id,
        name: "Lead Radar",
        phone: `1199999${String(Date.now()).slice(-4)}`,
        email: `lead-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    leadId = lead.id
  })

  afterAll(async () => {
    if (!scope.teamId) return
    await prisma.radarEvent.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.radarChannelConsent.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.radarIdentity.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.radarSourceLink.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.radarProfile.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.lead.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.team.deleteMany({ where: { id: { in: [scope.teamId, otherScope.teamId] } } })
  })

  it("syncFromCrm cria perfil com identity e source link", async () => {
    const first = await radarService.syncFromCrm(scope, { leadId })
    expect(first.created + first.enriched).toBeGreaterThanOrEqual(1)

    const profile = await prisma.radarProfile.findFirst({
      where: { teamId: scope.teamId },
      include: { identities: true, sourceLinks: true },
    })
    expect(profile).not.toBeNull()
    profileId = profile!.id
    expect(profile!.identities.some((item) => item.type === "lead_id")).toBe(true)
    expect(profile!.sourceLinks.some((item) => item.sourceType === "crm_lead")).toBe(true)
  })

  it("re-sync CRM é idempotente", async () => {
    const second = await radarService.syncFromCrm(scope, { leadId })
    expect(second.created).toBe(0)
  })

  it("syncFromCrm grava lead.milestone.* junto com lead.status_changed para os 4 status de marco (D5/E2)", async () => {
    // E2: nascimento em new_opportunity NÃO emite milestone; os outros 3 marcos
    // emitem no nascimento; transição real para new_opportunity emite.
    const birthCases: Array<{
      status: string
      expectedMilestone: string | null
    }> = [
      { status: "new_opportunity", expectedMilestone: null },
      { status: "invoicePayment", expectedMilestone: "lead.milestone.invoice_payment" },
      { status: "future_sale", expectedMilestone: "lead.milestone.future_sale" },
      { status: "contract_finalized", expectedMilestone: "lead.milestone.contract_finalized" },
    ]

    for (const [index, { status, expectedMilestone }] of birthCases.entries()) {
      const suffix = randomUUID().slice(0, 8)
      const phone = `1199${index}${String(Date.now()).slice(-6)}`
      const milestoneLead = await prisma.lead.create({
        data: {
          id: randomUUID(),
          leadCode: `Radar-milestone-${suffix}`,
          managerId: scope.ctx.profileId,
          teamId: scope.teamId,
          name: "Lead Marco",
          phone,
          email: `milestone-${suffix}@example.com`,
          status: status as never,
        },
      })

      try {
        await radarService.syncFromCrm(scope, { leadId: milestoneLead.id })

        const statusChangedEvent = await prisma.radarEvent.findFirst({
          where: {
            teamId: scope.teamId,
            sourceType: "crm_lead",
            sourceId: `${milestoneLead.id}:${status}`,
            eventType: "lead.status_changed",
          },
        })
        expect(statusChangedEvent).not.toBeNull()

        const milestoneEvent = await prisma.radarEvent.findFirst({
          where: {
            teamId: scope.teamId,
            sourceType: "crm_lead",
            sourceId: `${milestoneLead.id}:${status}:milestone`,
            eventType: expectedMilestone ?? "lead.milestone.new_opportunity",
          },
        })
        if (status === "new_opportunity") {
          expect(milestoneEvent).toBeNull()
        } else {
          expect(milestoneEvent).not.toBeNull()
        }
      } finally {
        await prisma.radarEvent.deleteMany({
          where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
        })
        await prisma.radarIdentity.deleteMany({
          where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
        })
        await prisma.radarSourceLink.deleteMany({
          where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
        })
        await prisma.radarProfile.deleteMany({
          where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
        })
        await prisma.lead.delete({ where: { id: milestoneLead.id } })
      }
    }

    // Transição real: lead nasce em outro status e depois vai para new_opportunity.
    const transitionSuffix = randomUUID().slice(0, 8)
    const transitionPhone = `11995${String(Date.now()).slice(-6)}`
    const bornAt = new Date("2026-08-01T12:00:00.000Z")
    const enteredNewOpportunityAt = new Date("2026-08-05T15:00:00.000Z")
    const transitionLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-milestone-transition-${transitionSuffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Marco Transicao",
        phone: transitionPhone,
        email: `milestone-transition-${transitionSuffix}@example.com`,
        status: "scheduled",
        createdAt: bornAt,
        statusEnteredAt: bornAt,
      },
    })

    try {
      await prisma.lead.update({
        where: { id: transitionLead.id },
        data: {
          status: "new_opportunity",
          statusEnteredAt: enteredNewOpportunityAt,
        },
      })
      await radarService.syncFromCrm(scope, { leadId: transitionLead.id })

      const statusChangedEvent = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          sourceType: "crm_lead",
          sourceId: `${transitionLead.id}:new_opportunity`,
          eventType: "lead.status_changed",
        },
      })
      expect(statusChangedEvent).not.toBeNull()

      const milestoneEvent = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          sourceType: "crm_lead",
          sourceId: `${transitionLead.id}:new_opportunity:milestone`,
          eventType: "lead.milestone.new_opportunity",
        },
      })
      expect(milestoneEvent).not.toBeNull()
    } finally {
      await prisma.radarEvent.deleteMany({
        where: {
          profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transitionPhone) },
        },
      })
      await prisma.radarIdentity.deleteMany({
        where: {
          profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transitionPhone) },
        },
      })
      await prisma.radarSourceLink.deleteMany({
        where: {
          profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transitionPhone) },
        },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transitionPhone) },
      })
      await prisma.lead.delete({ where: { id: transitionLead.id } })
    }
  })

  it("lead que perde o telefone válido e muda para status de marco também gera o marco (branch só-com-e-mail, D5 fix review PR #561)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const sharedEmail = `email-only-milestone-${suffix}@example.com`
    const phone = `1199989${String(Date.now()).slice(-6)}`

    const milestoneLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-email-only-milestone-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Email Only",
        phone,
        email: sharedEmail,
        status: "new_opportunity",
      },
    })

    try {
      // 1º sync: telefone válido, cria o perfil e a identidade email (D8).
      await radarService.syncFromCrm(scope, { leadId: milestoneLead.id })

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
      })
      expect(profile).not.toBeNull()

      // Telefone é limpo (ex.: anonimização) e o status muda para um marco —
      // 2º sync cai no branch "só-com-e-mail" de syncFromCrm, que só acha o
      // perfil via identidade email, sem passar por resolveProfileForPhone.
      await prisma.lead.update({
        where: { id: milestoneLead.id },
        data: { phone: null, status: "contract_finalized" },
      })
      await radarService.syncFromCrm(scope, { leadId: milestoneLead.id })

      const statusChangedEvent = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          profileId: profile!.id,
          sourceType: "crm_lead",
          sourceId: `${milestoneLead.id}:contract_finalized`,
          eventType: "lead.status_changed",
        },
      })
      expect(statusChangedEvent).not.toBeNull()

      const milestoneEvent = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          profileId: profile!.id,
          sourceType: "crm_lead",
          sourceId: `${milestoneLead.id}:contract_finalized:milestone`,
          eventType: "lead.milestone.contract_finalized",
        },
      })
      expect(milestoneEvent).not.toBeNull()
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
      })
      await prisma.lead.delete({ where: { id: milestoneLead.id } })
    }
  })

  it("re-sync do mesmo status de marco não duplica o RadarEvent (D5)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phone = `1199990${String(Date.now()).slice(-6)}`
    const milestoneLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-milestone-idem-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Marco Idempotente",
        phone,
        email: `milestone-idem-${suffix}@example.com`,
        status: "contract_finalized",
      },
    })

    try {
      await radarService.syncFromCrm(scope, { leadId: milestoneLead.id })
      await radarService.syncFromCrm(scope, { leadId: milestoneLead.id })

      const milestoneEventsCount = await prisma.radarEvent.count({
        where: {
          teamId: scope.teamId,
          sourceType: "crm_lead",
          sourceId: `${milestoneLead.id}:contract_finalized:milestone`,
          eventType: "lead.milestone.contract_finalized",
        },
      })
      expect(milestoneEventsCount).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
      })
      await prisma.lead.delete({ where: { id: milestoneLead.id } })
    }
  })

  it("profile.first_contact é gravado exatamente uma vez quando um perfil nasce via CRM (D5)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phone = `1199991${String(Date.now()).slice(-6)}`
    const firstContactLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-first-contact-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Primeiro Contato",
        phone,
        email: `first-contact-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })

    try {
      await radarService.syncFromCrm(scope, { leadId: firstContactLead.id })
      await radarService.syncFromCrm(scope, { leadId: firstContactLead.id })

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
      })
      expect(profile).not.toBeNull()

      const firstContactEventsCount = await prisma.radarEvent.count({
        where: { teamId: scope.teamId, profileId: profile!.id, eventType: "profile.first_contact" },
      })
      expect(firstContactEventsCount).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(phone) },
      })
      await prisma.lead.delete({ where: { id: firstContactLead.id } })
    }
  })

  it("profile.first_contact é gravado exatamente uma vez quando um perfil email-only nasce (D5)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const list = await prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: scope.teamId,
        createdBy: scope.ctx.profileId,
        name: `Lista First Contact ${suffix}`,
      },
    })
    const contact = await prisma.emailContact.create({
      data: {
        id: randomUUID(),
        listId: list.id,
        email: `first-contact-email-${suffix}@example.com`,
        name: null,
      },
    })

    try {
      await radarService.syncFromEmail(scope, { emailContactId: contact.id })
      await radarService.syncFromEmail(scope, { emailContactId: contact.id })

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      expect(profile).not.toBeNull()

      const firstContactEventsCount = await prisma.radarEvent.count({
        where: { teamId: scope.teamId, profileId: profile!.id, eventType: "profile.first_contact" },
      })
      expect(firstContactEventsCount).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarChannelConsent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      await prisma.emailContact.delete({ where: { id: contact.id } })
      await prisma.emailContactList.delete({ where: { id: list.id } })
    }
  })

  it("conflito de telefone: sync WhatsApp com nome divergente reusa o perfil do CRM sem migrar a identidade phone (D8)", async () => {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { phone: true, name: true },
    })
    const normalizedPhone = normalizeRadarPhone(lead.phone)

    const profilesBefore = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

    const conflictingConversation: WhatsAppConversationSelect = {
      id: randomUUID(),
      teamId: scope.teamId,
      configId: randomUUID(),
      leadId: null,
      externalChatId: null,
      contactPhone: lead.phone!,
      contactName: "Maria S.",
      contactNameSource: "whatsapp",
      contactAvatarUrl: null,
      normalizedPhone,
      assignedProfileId: null,
      createdByProfileId: null,
      lastMessageAt: new Date(),
      lastMessagePreview: null,
      unreadCount: 0,
      isArchived: false,
      handoffMode: "bot",
      welcomeSentAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await radarService.syncWhatsappConversationToRadar(scope.teamId, conflictingConversation)

    const profilesAfter = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })
    expect(profilesAfter).toBe(profilesBefore)

    const identity = await prisma.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId: scope.teamId, type: "phone", normalizedValue: normalizedPhone },
      },
    })
    expect(identity?.profileId).toBe(profileId)

    const originalProfile = await prisma.radarProfile.findUnique({ where: { id: profileId } })
    expect(originalProfile?.displayName).toBe(lead.name)
  })

  it("lead só-com-e-mail sem perfil existente conta em deferred, sem criar perfil (D8, Parte 2)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const emailOnlyLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-deferred-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Sem Telefone",
        phone: null,
        email: `deferred-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })

    try {
      const result = await radarService.syncFromCrm(scope, { leadId: emailOnlyLead.id })
      expect(result.deferred).toBe(1)
      expect(result.created).toBe(0)
      expect(result.enriched).toBe(0)

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(emailOnlyLead.email) },
      })
      expect(profile).toBeNull()
    } finally {
      await prisma.lead.delete({ where: { id: emailOnlyLead.id } })
    }
  })

  it("push inline (SyncLeadToRadarUseCase) é idempotente frente ao batch — não duplica identidade/evento/perfil", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const inlineLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-inline-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Inline",
        phone: `1199998${phoneDigits}`,
        email: `inline-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })

    try {
      // Simula o backfill batch rodando primeiro.
      const batchResult = await radarService.syncFromCrm(scope, { leadId: inlineLead.id })
      expect(batchResult.created).toBe(1)

      const profileAfterBatch = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(inlineLead.phone) },
      })
      expect(profileAfterBatch).not.toBeNull()

      const identitiesAfterBatch = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const eventsAfterBatch = await prisma.radarEvent.count({ where: { profileId: profileAfterBatch!.id } })
      const profilesCountAfterBatch = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      // Push inline chega depois (ex.: updateLeadStatus disparou o fire-and-forget).
      const inlineResult = await syncLeadToRadarUseCase.execute({
        leadId: inlineLead.id,
        teamId: scope.teamId,
      })
      expect(inlineResult.isValid).toBe(true)

      const identitiesAfterInline = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const eventsAfterInline = await prisma.radarEvent.count({ where: { profileId: profileAfterBatch!.id } })
      const profilesCountAfterInline = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      expect(identitiesAfterInline).toBe(identitiesAfterBatch)
      expect(eventsAfterInline).toBe(eventsAfterBatch)
      expect(profilesCountAfterInline).toBe(profilesCountAfterBatch)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(inlineLead.phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(inlineLead.phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(inlineLead.phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(inlineLead.phone) },
      })
      await prisma.lead.delete({ where: { id: inlineLead.id } })
    }
  })

  it("push inline (SyncPortfolioToRadarUseCase) é idempotente frente ao batch — não duplica identidade/evento/perfil (D3)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const portfolioLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-portfolio-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Carteira",
        phone: `1199997${phoneDigits}`,
        email: `portfolio-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    const portfolio = await prisma.leadPortfolio.create({
      data: {
        id: randomUUID(),
        leadId: portfolioLead.id,
        teamId: scope.teamId,
        portfolioStatus: "active",
        renewalStatus: "to_renew",
        source: "crm",
      },
    })

    try {
      // Simula o backfill batch rodando primeiro.
      const batchResult = await radarService.syncFromPortfolio(scope, { portfolioId: portfolio.id })
      expect(batchResult.created).toBe(1)

      const profileAfterBatch = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(portfolioLead.phone) },
      })
      expect(profileAfterBatch).not.toBeNull()

      const identitiesAfterBatch = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const eventsAfterBatch = await prisma.radarEvent.count({ where: { profileId: profileAfterBatch!.id } })
      const profilesCountAfterBatch = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      // Push inline chega depois (ex.: updatePortfolioEntry disparou o fire-and-forget).
      const inlineResult = await syncPortfolioToRadarUseCase.execute({
        portfolioId: portfolio.id,
        teamId: scope.teamId,
      })
      expect(inlineResult.isValid).toBe(true)

      const identitiesAfterInline = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const eventsAfterInline = await prisma.radarEvent.count({ where: { profileId: profileAfterBatch!.id } })
      const profilesCountAfterInline = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      expect(identitiesAfterInline).toBe(identitiesAfterBatch)
      expect(eventsAfterInline).toBe(eventsAfterBatch)
      expect(profilesCountAfterInline).toBe(profilesCountAfterBatch)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(portfolioLead.phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(portfolioLead.phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(portfolioLead.phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(portfolioLead.phone) },
      })
      // LeadPortfolio tem onDelete: Cascade a partir de Lead — apagar o lead remove a carteira junto.
      await prisma.lead.delete({ where: { id: portfolioLead.id } })
    }
  })

  it("carteira renovada gera RadarEvent portfolio.renewed (D3)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const renewedLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-renewed-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Renovado",
        phone: `1199996${phoneDigits}`,
        email: `renewed-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    const portfolio = await prisma.leadPortfolio.create({
      data: {
        id: randomUUID(),
        leadId: renewedLead.id,
        teamId: scope.teamId,
        portfolioStatus: "active",
        renewalStatus: "renewed",
        source: "crm",
      },
    })

    try {
      await radarService.syncFromPortfolio(scope, { portfolioId: portfolio.id })

      const event = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          sourceType: "portfolio",
          sourceId: `${portfolio.id}:renewed`,
          eventType: "portfolio.renewed",
        },
      })
      expect(event).not.toBeNull()

      // Edição não relacionada avança updatedAt enquanto renewalStatus segue
      // "renewed" — re-sync não deve criar um segundo evento (regressão do
      // bug reportado na review da PR #540: dedupe por sourceId+eventType,
      // não por occurredAt, que muda a cada edição).
      await prisma.leadPortfolio.update({
        where: { id: portfolio.id },
        data: { note: "edição não relacionada" },
      })
      await radarService.syncFromPortfolio(scope, { portfolioId: portfolio.id })

      const renewedEventsCount = await prisma.radarEvent.count({
        where: {
          teamId: scope.teamId,
          sourceType: "portfolio",
          sourceId: `${portfolio.id}:renewed`,
          eventType: "portfolio.renewed",
        },
      })
      expect(renewedEventsCount).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(renewedLead.phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(renewedLead.phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(renewedLead.phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(renewedLead.phone) },
      })
      await prisma.lead.delete({ where: { id: renewedLead.id } })
    }
  })

  it("carteira com troca de corretagem gera RadarEvent portfolio.brokerage_transfer (D3)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const transferLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-transfer-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Troca Corretagem",
        phone: `1199995${phoneDigits}`,
        email: `transfer-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    const portfolio = await prisma.leadPortfolio.create({
      data: {
        id: randomUUID(),
        leadId: transferLead.id,
        teamId: scope.teamId,
        portfolioStatus: "active",
        renewalStatus: "to_renew",
        source: "brokerage_transfer",
      },
    })

    try {
      await radarService.syncFromPortfolio(scope, { portfolioId: portfolio.id })

      const event = await prisma.radarEvent.findFirst({
        where: {
          teamId: scope.teamId,
          sourceType: "portfolio",
          sourceId: `${portfolio.id}:brokerage_transfer`,
          eventType: "portfolio.brokerage_transfer",
        },
      })
      expect(event).not.toBeNull()
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transferLead.phone) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transferLead.phone) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transferLead.phone) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPhone: normalizeRadarPhone(transferLead.phone) },
      })
      await prisma.lead.delete({ where: { id: transferLead.id } })
    }
  })

  it("EmailContact sem Lead correspondente gera perfil email-only (D4)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const list = await prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: scope.teamId,
        createdBy: scope.ctx.profileId,
        name: `Lista D4 ${suffix}`,
      },
    })
    const contact = await prisma.emailContact.create({
      data: {
        id: randomUUID(),
        listId: list.id,
        email: `email-only-${suffix}@example.com`,
        name: "Contato Email Only",
      },
    })

    try {
      const result = await radarService.syncFromEmail(scope, { emailContactId: contact.id })
      expect(result.created).toBe(1)

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      expect(profile).not.toBeNull()
      expect(profile?.normalizedPhone).toBeNull()
      expect(profile?.displayPhone).toBeNull()
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarChannelConsent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      await prisma.emailContact.delete({ where: { id: contact.id } })
      await prisma.emailContactList.delete({ where: { id: list.id } })
    }
  })

  it("perfil email-only é promovido (não duplicado) quando um telefone real chega para o mesmo e-mail (D4)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const sharedEmail = `promote-${suffix}@example.com`
    const list = await prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: scope.teamId,
        createdBy: scope.ctx.profileId,
        name: `Lista Promoção ${suffix}`,
      },
    })
    const contact = await prisma.emailContact.create({
      data: {
        id: randomUUID(),
        listId: list.id,
        email: sharedEmail,
        name: "Contato A Promover",
      },
    })

    let promotedLead: Awaited<ReturnType<typeof prisma.lead.create>> | null = null
    try {
      const emailOnlyResult = await radarService.syncFromEmail(scope, { emailContactId: contact.id })
      expect(emailOnlyResult.created).toBe(1)

      const emailOnlyProfile = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) },
      })
      expect(emailOnlyProfile).not.toBeNull()
      expect(emailOnlyProfile?.normalizedPhone).toBeNull()

      const phoneDigits = String(Date.now()).slice(-4)
      promotedLead = await prisma.lead.create({
        data: {
          id: randomUUID(),
          leadCode: `Radar-promote-${suffix}`,
          managerId: scope.ctx.profileId,
          teamId: scope.teamId,
          name: "Lead Promovido",
          phone: `1199994${phoneDigits}`,
          email: sharedEmail,
          status: "new_opportunity",
        },
      })

      const crmResult = await radarService.syncFromCrm(scope, { leadId: promotedLead.id })
      expect(crmResult.created).toBe(0)
      expect(crmResult.enriched).toBe(1)

      const promotedProfile = await prisma.radarProfile.findUnique({ where: { id: emailOnlyProfile!.id } })
      expect(promotedProfile?.normalizedPhone).toBe(normalizeRadarPhone(promotedLead.phone!))

      const profilesWithEmail = await prisma.radarProfile.count({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) },
      })
      expect(profilesWithEmail).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarChannelConsent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) },
      })
      await prisma.emailContact.delete({ where: { id: contact.id } })
      await prisma.emailContactList.delete({ where: { id: list.id } })
      if (promotedLead) {
        await prisma.lead.delete({ where: { id: promotedLead.id } })
      }
    }
  })

  it("handleEmailWebhookEvent cria perfil email-only no primeiro evento sem Lead/perfil prévio, quando o time tem o add-on Radar (D4, fix review PR #553)", async () => {
    const suffix = randomUUID().slice(0, 8)
    // scope.teamId (usado no resto do describe) não tem o add-on Radar — de
    // propósito, para o teste de gate de feature. Este teste precisa do
    // caminho inverso (feature LIGADA), então cria seu próprio time com
    // hasPermanentSubscription: true no master, o mesmo campo que
    // teamHasProductFeature checa para liberar qualquer feature paga.
    const radarProfile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-webhook-master-${suffix}@example.com`,
        supabaseId: randomUUID(),
        fullName: "Radar Webhook Master",
        isMaster: true,
        hasPermanentSubscription: true,
      },
    })
    const radarTeam = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar Webhook Team ${suffix}`, masterId: radarProfile.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: radarTeam.id, profileId: radarProfile.id, role: "manager" },
    })

    const recipientEmail = `webhook-only-${suffix}@example.com`

    try {
      await radarService.handleEmailWebhookEvent({
        teamId: radarTeam.id,
        recipientEmail,
        recipientName: "Destinatário Webhook",
        logId: randomUUID(),
        eventType: "opened",
        occurredAt: new Date(),
      })

      const profile = await prisma.radarProfile.findFirst({
        where: { teamId: radarTeam.id, normalizedPrimaryEmail: normalizeRadarEmail(recipientEmail) },
      })
      expect(profile).not.toBeNull()
      expect(profile?.normalizedPhone).toBeNull()

      const event = await prisma.radarEvent.findFirst({
        where: { teamId: radarTeam.id, profileId: profile!.id, eventType: "email.opened" },
      })
      expect(event).not.toBeNull()
    } finally {
      await prisma.radarEvent.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.radarIdentity.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.radarSourceLink.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.radarChannelConsent.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.radarProfile.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.teamMember.deleteMany({ where: { teamId: radarTeam.id } })
      await prisma.team.delete({ where: { id: radarTeam.id } })
      await prisma.profile.delete({ where: { id: radarProfile.id } })
    }
  })

  it("push inline (SyncEmailContactToRadarUseCase) é idempotente frente ao batch — não duplica identidade/evento/perfil (D4)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const list = await prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: scope.teamId,
        createdBy: scope.ctx.profileId,
        name: `Lista Inline ${suffix}`,
      },
    })
    const contact = await prisma.emailContact.create({
      data: {
        id: randomUUID(),
        listId: list.id,
        email: `inline-contact-${suffix}@example.com`,
        name: "Contato Inline",
      },
    })

    try {
      // Simula o backfill batch rodando primeiro.
      const batchResult = await radarService.syncFromEmail(scope, { emailContactId: contact.id })
      expect(batchResult.created).toBe(1)

      const profileAfterBatch = await prisma.radarProfile.findFirst({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      expect(profileAfterBatch).not.toBeNull()

      const identitiesAfterBatch = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const sourceLinksAfterBatch = await prisma.radarSourceLink.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const profilesCountAfterBatch = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      // Push inline chega depois (ex.: EmailContactListUseCase.addContact disparou o fire-and-forget).
      const inlineResult = await syncEmailContactToRadarUseCase.execute({
        emailContactId: contact.id,
        teamId: scope.teamId,
      })
      expect(inlineResult.isValid).toBe(true)

      const identitiesAfterInline = await prisma.radarIdentity.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const sourceLinksAfterInline = await prisma.radarSourceLink.count({
        where: { profileId: profileAfterBatch!.id },
      })
      const profilesCountAfterInline = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })

      expect(identitiesAfterInline).toBe(identitiesAfterBatch)
      expect(sourceLinksAfterInline).toBe(sourceLinksAfterBatch)
      expect(profilesCountAfterInline).toBe(profilesCountAfterBatch)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarChannelConsent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(contact.email) },
      })
      await prisma.emailContact.delete({ where: { id: contact.id } })
      await prisma.emailContactList.delete({ where: { id: list.id } })
    }
  })

  it("funde perfis quando telefone e e-mail já pertencem a donos diferentes (D4, fix review PR #553)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const sharedEmail = `merge-${suffix}@example.com`
    const sharedPhone = `1199993${phoneDigits}`
    const normalizedPhone = normalizeRadarPhone(sharedPhone)

    // Perfil A: nasce só com telefone (ex.: WhatsApp), sem e-mail.
    const { profile: phoneProfile } = await radarRepository.resolveProfileForPhone({
      teamId: scope.teamId,
      normalizedPhone,
      normalizedName: normalizeRadarName("Contato WhatsApp"),
      displayName: "Contato WhatsApp",
      displayPhone: formatDisplayPhone(sharedPhone),
      phoneValue: sharedPhone,
      phoneSource: "whatsapp",
    })

    // Perfil B: nasce email-only (ex.: EmailContact), com o MESMO e-mail que
    // depois vai chegar junto do telefone do perfil A.
    const { profile: emailProfile } = await radarRepository.resolveProfileForEmail({
      teamId: scope.teamId,
      normalizedEmail: normalizeRadarEmail(sharedEmail),
      emailValue: sharedEmail,
      displayName: "Contato E-mail",
      normalizedName: normalizeRadarName("Contato E-mail"),
      emailSource: "email_contact",
    })
    expect(emailProfile.id).not.toBe(phoneProfile.id)

    await radarRepository.upsertIdentity({
      profileId: emailProfile.id,
      teamId: scope.teamId,
      type: "email",
      value: sharedEmail,
      normalizedValue: normalizeRadarEmail(sharedEmail),
      source: "email",
    })
    await radarRepository.upsertSourceLink({
      profileId: emailProfile.id,
      teamId: scope.teamId,
      sourceType: "email_contact",
      sourceId: `merge-source-${suffix}`,
    })
    await radarRepository.appendEventIfNew({
      profileId: emailProfile.id,
      teamId: scope.teamId,
      eventType: "email.opened",
      sourceType: "email_log",
      sourceId: `merge-event-${suffix}`,
      occurredAt: new Date(),
    })

    try {
      // Um Lead chega com o telefone do perfil A e o e-mail do perfil B —
      // resolveProfileForPhone deve fundir B em A, não deixar B órfão.
      const { profile: mergedProfile, wasExisting } = await radarRepository.resolveProfileForPhone({
        teamId: scope.teamId,
        normalizedPhone,
        normalizedName: normalizeRadarName("Contato WhatsApp"),
        displayName: "Contato WhatsApp",
        displayPhone: formatDisplayPhone(sharedPhone),
        phoneValue: sharedPhone,
        phoneSource: "crm",
        primaryEmail: sharedEmail,
        normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail),
      })
      expect(wasExisting).toBe(true)
      expect(mergedProfile.id).toBe(phoneProfile.id)
      expect(mergedProfile.normalizedPrimaryEmail).toBe(normalizeRadarEmail(sharedEmail))

      const losingProfileStillExists = await prisma.radarProfile.findUnique({ where: { id: emailProfile.id } })
      expect(losingProfileStillExists).toBeNull()

      const movedEmailIdentity = await prisma.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: scope.teamId,
            type: "email",
            normalizedValue: normalizeRadarEmail(sharedEmail),
          },
        },
      })
      expect(movedEmailIdentity?.profileId).toBe(phoneProfile.id)

      const movedSourceLink = await prisma.radarSourceLink.findFirst({
        where: { teamId: scope.teamId, sourceType: "email_contact", sourceId: `merge-source-${suffix}` },
      })
      expect(movedSourceLink?.profileId).toBe(phoneProfile.id)

      const movedEvent = await prisma.radarEvent.findFirst({
        where: { teamId: scope.teamId, sourceType: "email_log", sourceId: `merge-event-${suffix}` },
      })
      expect(movedEvent?.profileId).toBe(phoneProfile.id)

      // D5 (fix review PR #561): phoneProfile e emailProfile nasceram cada um
      // com seu próprio profile.first_contact (sourceId = profile.id, nunca
      // igual entre os dois) — a fusão precisa manter só 1, não os 2.
      const firstContactEvents = await prisma.radarEvent.findMany({
        where: { teamId: scope.teamId, profileId: phoneProfile.id, eventType: "profile.first_contact" },
      })
      expect(firstContactEvents).toHaveLength(1)
    } finally {
      await prisma.radarEvent.deleteMany({ where: { profileId: phoneProfile.id } })
      await prisma.radarIdentity.deleteMany({ where: { profileId: phoneProfile.id } })
      await prisma.radarSourceLink.deleteMany({ where: { profileId: phoneProfile.id } })
      await prisma.radarChannelConsent.deleteMany({ where: { profileId: phoneProfile.id } })
      await prisma.radarProfile.deleteMany({ where: { id: phoneProfile.id } })
    }
  })

  it("sync de CRM (telefone+e-mail) e sync de contato de e-mail concorrentes para o mesmo e-mail não duplicam perfil (D4, fix review PR #553)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const phoneDigits = String(Date.now()).slice(-4)
    const sharedEmail = `race-${suffix}@example.com`
    const sharedPhone = `1199992${phoneDigits}`

    const raceLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-race-${suffix}`,
        managerId: scope.ctx.profileId,
        teamId: scope.teamId,
        name: "Lead Concorrente",
        phone: sharedPhone,
        email: sharedEmail,
        status: "new_opportunity",
      },
    })
    const list = await prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: scope.teamId,
        createdBy: scope.ctx.profileId,
        name: `Lista Concorrente ${suffix}`,
      },
    })
    // Sem `name` — força processEmailContactForRadar a cair no caminho
    // resolveProfileForEmail (sem isso, findLeadPhoneByEmail acharia o
    // telefone do raceLead acima e os dois caminhos convergiriam em
    // resolveProfileForPhone, deixando de testar a corrida real entre os
    // dois locks descrita na review da PR #553).
    const contact = await prisma.emailContact.create({
      data: { id: randomUUID(), listId: list.id, email: sharedEmail, name: null },
    })

    try {
      await Promise.all([
        radarService.syncFromCrm(scope, { leadId: raceLead.id }),
        radarService.syncFromEmail(scope, { emailContactId: contact.id }),
      ])

      const profilesWithEmail = await prisma.radarProfile.count({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) },
      })
      expect(profilesWithEmail).toBe(1)
    } finally {
      await prisma.radarEvent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarIdentity.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarSourceLink.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarChannelConsent.deleteMany({
        where: { profile: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) } },
      })
      await prisma.radarProfile.deleteMany({
        where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(sharedEmail) },
      })
      await prisma.emailContact.delete({ where: { id: contact.id } })
      await prisma.emailContactList.delete({ where: { id: list.id } })
      await prisma.lead.delete({ where: { id: raceLead.id } })
    }
  })

  it("handleEmailWebhookEvent respeita o gate de feature — time sem add-on não gera perfil (D4, fix review PR #553)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const recipientEmail = `no-feature-${suffix}@example.com`

    await radarService.handleEmailWebhookEvent({
      teamId: scope.teamId,
      recipientEmail,
      recipientName: "Sem Add-on",
      logId: randomUUID(),
      eventType: "opened",
      occurredAt: new Date(),
    })

    const profile = await prisma.radarProfile.findFirst({
      where: { teamId: scope.teamId, normalizedPrimaryEmail: normalizeRadarEmail(recipientEmail) },
    })
    expect(profile).toBeNull()
  })

  it("time sem add-on Radar: gate de feature nega (teamHasRadarFeature)", async () => {
    const hasFeature = await teamHasRadarFeature(scope.teamId)
    expect(hasFeature).toBe(false)
  })

  it("countSegments reflete opened_not_clicked por campanha", async () => {
    const campaignId = randomUUID()
    await prisma.radarEvent.createMany({
      data: [
        {
          id: randomUUID(),
          profileId,
          teamId: scope.teamId,
          eventType: "email.opened",
          sourceType: "email_log",
          sourceId: randomUUID(),
          occurredAt: new Date(),
          metadata: { campaignId },
        },
      ],
    })

    const segments = await radarService.countSegments(scope)
    const openedNotClicked = segments.find((item) => item.slug === "opened_not_clicked")
    expect(openedNotClicked?.count ?? 0).toBeGreaterThanOrEqual(1)

    expect(
      profileMatchesRadarSegment(
        {
          normalizedPrimaryEmail: "lead@example.com",
          consents: [{ status: "allowed" }],
          sourceLinks: [],
          identities: [{ type: "lead_id", normalizedValue: leadId }],
          events: [
            {
              eventType: "email.opened",
              occurredAt: new Date(),
              metadata: { campaignId },
            },
          ],
        },
        "opened_not_clicked",
        new Map()
      )
    ).toBe(true)
  })

  it("countFixedSegmentsSQL não lança 'operator does not exist: uuid = text' (RADAR_AUDIT.md B5)", async () => {
    // teamId chega como string do TypeScript; a coluna é uuid. $queryRaw envia o
    // parâmetro como bind tipado text — sem ::uuid explícito no SQL, o Postgres
    // rejeita a comparação com 42883 para TODO teamId, derrubando
    // /api/v1/radar/segments para todos os times (achado B5).
    await expect(radarRepository.countFixedSegmentsSQL(scope.teamId, 30)).resolves.toBeInstanceOf(Map)
  })

  it("time B não vê perfis do time A", async () => {
    const countA = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })
    const countB = await prisma.radarProfile.count({ where: { teamId: otherScope.teamId } })
    expect(countA).toBeGreaterThan(0)
    expect(countB).toBe(0)
  })
})

describe.skipIf(!RUN_INTEGRATION)("RadarSegmentQueryService (C4)", () => {
  const segScope = {
    teamId: "",
    ctx: { profileId: "", teamMember: { role: "manager", functions: [] as string[] } },
  }
  let definitionId = ""
  let matchingProfileId = ""
  let nonMatchingProfileId = ""

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-seg-${suffix}@example.com`,
        supabaseId: randomUUID(),
        fullName: "Radar Segment Tester",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar Segment Test ${suffix}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: team.id, profileId: profile.id, role: "manager" },
    })
    segScope.teamId = team.id
    segScope.ctx = { profileId: profile.id, teamMember: { role: "manager", functions: [] } }

    const definition = await prisma.leadCustomFieldDefinition.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        createdBy: profile.id,
        key: `plano_${suffix}`,
        label: "Plano",
        type: "text",
      },
    })
    definitionId = definition.id

    const matchingLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `RadarSeg-match-${suffix}`,
        managerId: profile.id,
        teamId: team.id,
        name: "Lead Match",
        phone: `1188887${String(Date.now()).slice(-4)}`,
        email: `match-${suffix}@example.com`,
        status: "scheduled",
      },
    })
    await prisma.leadCustomFieldValue.create({
      data: { id: randomUUID(), leadId: matchingLead.id, definitionId, value: "premium" },
    })

    const nonMatchingLead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `RadarSeg-nomatch-${suffix}`,
        managerId: profile.id,
        teamId: team.id,
        name: "Lead No Match",
        phone: `1188886${String(Date.now()).slice(-4)}`,
        email: `nomatch-${suffix}@example.com`,
        status: "disqualified",
      },
    })
    await prisma.leadCustomFieldValue.create({
      data: { id: randomUUID(), leadId: nonMatchingLead.id, definitionId, value: "basic" },
    })

    const matchResult = await radarService.syncFromCrm(segScope, { leadId: matchingLead.id })
    expect(matchResult.created).toBe(1)
    const noMatchResult = await radarService.syncFromCrm(segScope, { leadId: nonMatchingLead.id })
    expect(noMatchResult.created).toBe(1)

    const matchingProfile = await prisma.radarProfile.findFirstOrThrow({
      where: { teamId: team.id, normalizedPhone: normalizeRadarPhone(matchingLead.phone) },
    })
    matchingProfileId = matchingProfile.id
    const nonMatchingProfile = await prisma.radarProfile.findFirstOrThrow({
      where: { teamId: team.id, normalizedPhone: normalizeRadarPhone(nonMatchingLead.phone) },
    })
    nonMatchingProfileId = nonMatchingProfile.id

    await prisma.radarChannelConsent.create({
      data: { id: randomUUID(), profileId: matchingProfileId, teamId: team.id, channel: "email", status: "allowed" },
    })
    await prisma.radarEvent.create({
      data: {
        id: randomUUID(),
        profileId: matchingProfileId,
        teamId: team.id,
        eventType: "email.opened",
        sourceType: "email_log",
        sourceId: randomUUID(),
        occurredAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    if (!segScope.teamId) return
    await prisma.radarEvent.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.radarChannelConsent.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.radarIdentity.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.radarSourceLink.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.radarProfile.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.leadCustomFieldValue.deleteMany({ where: { definitionId } })
    await prisma.leadCustomFieldDefinition.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.lead.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId: segScope.teamId } })
    await prisma.team.deleteMany({ where: { id: segScope.teamId } })
  })

  it("lead_custom_field: eq resolve via subconsulta em Lead", async () => {
    const ids = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [{ kind: "lead_custom_field", definitionId, operator: "eq", value: "premium" }],
    })
    expect(ids).toEqual([matchingProfileId])
  })

  it("lead_status: resolve via subconsulta em Lead", async () => {
    const count = await radarSegmentQueryService.countProfiles(segScope, {
      match: "all",
      conditions: [{ kind: "lead_status", statuses: ["disqualified"] }],
    })
    expect(count).toBe(1)
    const ids = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [{ kind: "lead_status", statuses: ["disqualified"] }],
    })
    expect(ids).toEqual([nonMatchingProfileId])
  })

  it("consent: filtra por channel + status", async () => {
    const ids = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [{ kind: "consent", channel: "email", status: "allowed" }],
    })
    expect(ids).toEqual([matchingProfileId])
  })

  it("event: occurred filtra quem tem o evento; not_occurred filtra quem não tem", async () => {
    const occurredIds = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [{ kind: "event", eventType: "email.opened", occurrence: "occurred" }],
    })
    expect(occurredIds).toEqual([matchingProfileId])

    const notOccurredIds = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [{ kind: "event", eventType: "email.opened", occurrence: "not_occurred" }],
    })
    expect(notOccurredIds.sort()).toEqual([nonMatchingProfileId].sort())
  })

  it("match all: combina lead_custom_field + event (subconsulta + relação) — só o perfil que satisfaz ambos", async () => {
    const ids = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "all",
      conditions: [
        { kind: "lead_custom_field", definitionId, operator: "eq", value: "premium" },
        { kind: "event", eventType: "email.opened", occurrence: "occurred" },
      ],
    })
    expect(ids).toEqual([matchingProfileId])
  })

  it("match any: união de condições que cada perfil satisfaz isoladamente", async () => {
    const ids = await radarSegmentQueryService.listProfileIds(segScope, {
      match: "any",
      conditions: [
        { kind: "lead_custom_field", definitionId, operator: "eq", value: "premium" },
        { kind: "lead_status", statuses: ["disqualified"] },
      ],
    })
    expect(ids.sort()).toEqual([matchingProfileId, nonMatchingProfileId].sort())
  })

  it("condição de lead_custom_field sem lead correspondente resulta em zero perfis", async () => {
    const count = await radarSegmentQueryService.countProfiles(segScope, {
      match: "all",
      conditions: [{ kind: "lead_custom_field", definitionId, operator: "eq", value: "inexistente" }],
    })
    expect(count).toBe(0)
  })

  it("previewCustomSegmentCount (C5): conta regras ainda não salvas (rascunho do builder) sem exigir um TeamRadarSegment persistido", async () => {
    const result = await customerDataPlatformUseCase.previewCustomSegmentCount(segScope.teamId, segScope.ctx, {
      match: "all",
      conditions: [{ kind: "lead_custom_field", definitionId, operator: "eq", value: "premium" }],
    })
    expect(result.isValid).toBe(true)
    expect((result.result as { count: number }).count).toBe(1)
  })

  it("previewCustomSegmentCount (C5): regras inválidas retornam isValid false sem lançar exceção", async () => {
    const result = await customerDataPlatformUseCase.previewCustomSegmentCount(segScope.teamId, segScope.ctx, {
      match: "all",
      conditions: [],
    })
    expect(result.isValid).toBe(false)
    expect(result.result).toBeNull()
  })
})

describe.skipIf(!RUN_INTEGRATION)("Custom segment como audiência de campanha (D11)", () => {
  const RECIPIENT_COUNT = EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB + 1
  let teamId = ""
  let ctx: TeamAccess
  let templateId = ""
  let oversizedSegmentId = ""

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const supabaseId = randomUUID()
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-campaign-${suffix}@example.com`,
        supabaseId,
        fullName: "Radar Campaign Tester",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar Campaign Test ${suffix}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: team.id, profileId: profile.id, role: "manager" },
    })
    teamId = team.id
    ctx = {
      supabaseId,
      teamId: team.id,
      profileId: profile.id,
      profileEmail: profile.email,
      profileName: profile.fullName,
      isMaster: true,
      managerId: profile.id,
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
      canViewAllTeams: false,
      userTimezone: "America/Sao_Paulo",
      teamMember: { role: "manager", functions: [] },
    }

    const templateGroupId = randomUUID()
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateGroupId,
        teamId: team.id,
        createdBy: profile.id,
        name: "Template Radar Campaign Test",
        subject: "Assunto de teste",
        html: "<p>Olá</p>",
        editorMode: "html",
        versionGroupId: templateGroupId,
        versionNumber: 1,
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
      },
    })
    templateId = template.id

    const segment = await teamRadarSegmentService.create(team.id, profile.id, {
      name: `Segmento oversized ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["scheduled"] }] },
    })
    oversizedSegmentId = segment.id

    const leads = Array.from({ length: RECIPIENT_COUNT }, (_, index) => ({
      id: randomUUID(),
      leadCode: `RadarCampaign-${suffix}-${index}`,
      managerId: profile.id,
      teamId: team.id,
      name: `Lead Oversized ${index}`,
      status: "scheduled" as const,
    }))
    await prisma.lead.createMany({ data: leads })

    const profiles = leads.map((lead, index) => ({
      id: randomUUID(),
      teamId: team.id,
      displayName: lead.name,
      normalizedName: `lead oversized ${index}`,
      displayPhone: "",
      normalizedPhone: `999${suffix}${String(index).padStart(5, "0")}`,
      primaryEmail: `oversized-${suffix}-${index}@example.com`,
      normalizedPrimaryEmail: `oversized-${suffix}-${index}@example.com`,
    }))
    await prisma.radarProfile.createMany({ data: profiles })

    await prisma.radarIdentity.createMany({
      data: profiles.map((profile, index) => ({
        id: randomUUID(),
        profileId: profile.id,
        teamId: team.id,
        type: "lead_id" as const,
        value: leads[index].id,
        normalizedValue: leads[index].id,
        source: "crm",
        isPrimary: true,
      })),
    })
  })

  afterAll(async () => {
    if (!teamId) return
    await prisma.emailCampaign.deleteMany({ where: { teamId } })
    await prisma.emailTemplate.deleteMany({ where: { teamId } })
    await prisma.teamRadarSegment.deleteMany({ where: { teamId } })
    await prisma.radarIdentity.deleteMany({ where: { teamId } })
    await prisma.radarProfile.deleteMany({ where: { teamId } })
    await prisma.lead.deleteMany({ where: { teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId } })
    await prisma.team.deleteMany({ where: { id: teamId } })
  })

  it("segmento custom com >2000 perfis é rejeitado na criação da campanha com a mensagem padrão", async () => {
    const emailCampaignUseCase = new EmailCampaignUseCase()
    const result = await emailCampaignUseCase.create(
      {
        name: "Campanha segmento custom oversized",
        templateId,
        radarSegmentSlug: `custom:${oversizedSegmentId}`,
      },
      ctx
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessages[0]).toContain(String(EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB))

    const campaign = await prisma.emailCampaign.findFirst({ where: { teamId, radarSegmentSlug: `custom:${oversizedSegmentId}` } })
    expect(campaign).toBeNull()
  })
})

describe.skipIf(!RUN_INTEGRATION)("Fixes de review C4 (visibilidade, delete guard, paginação)", () => {
  let teamId = ""
  let ctx: TeamAccess
  let templateId = ""

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const supabaseId = randomUUID()
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-fix-${suffix}@example.com`,
        supabaseId,
        fullName: "Radar Fix Tester",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar Fix Test ${suffix}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: team.id, profileId: profile.id, role: "manager" },
    })
    teamId = team.id
    ctx = {
      supabaseId,
      teamId: team.id,
      profileId: profile.id,
      profileEmail: profile.email,
      profileName: profile.fullName,
      isMaster: true,
      managerId: profile.id,
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
      canViewAllTeams: false,
      userTimezone: "America/Sao_Paulo",
      teamMember: { role: "manager", functions: [] },
    }

    const templateGroupId = randomUUID()
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateGroupId,
        teamId: team.id,
        createdBy: profile.id,
        name: "Template Radar Fix Test",
        subject: "Assunto de teste",
        html: "<p>Olá</p>",
        editorMode: "html",
        versionGroupId: templateGroupId,
        versionNumber: 1,
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
      },
    })
    templateId = template.id
  })

  afterAll(async () => {
    if (!teamId) return
    await prisma.emailCampaign.deleteMany({ where: { teamId } })
    await prisma.emailTemplate.deleteMany({ where: { teamId } })
    await prisma.teamRadarSegment.deleteMany({ where: { teamId } })
    await prisma.radarIdentity.deleteMany({ where: { teamId } })
    await prisma.radarProfile.deleteMany({ where: { teamId } })
    await prisma.lead.deleteMany({ where: { teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId } })
    await prisma.team.deleteMany({ where: { id: teamId } })
  })

  it("segmento desativado some da listagem de audiência mas continua visível na gestão", async () => {
    const suffix = randomUUID().slice(0, 8)
    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: `Segmento visibilidade ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["scheduled"] }] },
    })

    await teamRadarSegmentService.update(teamId, segment.id, { isActive: false })

    const allSegments = await teamRadarSegmentService.listByTeam(teamId)
    expect(allSegments.some((s) => s.id === segment.id)).toBe(true)

    const activeOnly = await teamRadarSegmentService.listByTeam(teamId, { onlyActive: true })
    expect(activeOnly.some((s) => s.id === segment.id)).toBe(false)

    const managementList = await customerDataPlatformUseCase.listCustomSegments(teamId, ctx)
    expect(managementList.isValid).toBe(true)
    const managementItems = managementList.result as Array<{ id: string }>
    expect(managementItems.some((s) => s.id === segment.id)).toBe(true)

    const audienceOverview = await customerDataPlatformUseCase.listSegments(teamId, ctx)
    const audienceSegments = (audienceOverview.result as { segments: Array<{ slug: string }> }).segments
    expect(audienceSegments.some((s) => s.slug === `custom:${segment.id}`)).toBe(false)
  })

  it("excluir segmento referenciado por campanha ativa desativa em vez de excluir; sem referência exclui de fato", async () => {
    const suffix = randomUUID().slice(0, 8)
    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: `Segmento delete guard ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["scheduled"] }] },
    })

    const campaign = await prisma.emailCampaign.create({
      data: {
        id: randomUUID(),
        teamId,
        createdBy: ctx.profileId,
        name: `Campanha delete guard ${suffix}`,
        templateId,
        radarSegmentSlug: `custom:${segment.id}`,
        status: "sent",
      },
    })

    const firstAttempt = await teamRadarSegmentService.remove(teamId, segment.id)
    expect(firstAttempt).toEqual({ removed: true, softDeleted: true })

    const stillExists = await prisma.teamRadarSegment.findUnique({ where: { id: segment.id } })
    expect(stillExists?.isActive).toBe(false)

    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "archived" } })

    const secondAttempt = await teamRadarSegmentService.remove(teamId, segment.id)
    expect(secondAttempt).toEqual({ removed: true, softDeleted: false })

    const gone = await prisma.teamRadarSegment.findUnique({ where: { id: segment.id } })
    expect(gone).toBeNull()
  })

  it("segmento desativado (referenciado por campanha) continua resolvendo destinatários — só some quando excluído de fato", async () => {
    const suffix = randomUUID().slice(0, 8)
    const lead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `RadarFixRecipients-${suffix}`,
        managerId: ctx.profileId,
        teamId,
        name: "Lead Recipients Fix",
        phone: `977${suffix}${String(Date.now()).slice(-4)}`,
        email: `recipients-fix-${suffix}@example.com`,
        // Status distinto de "scheduled" para não vazar na contagem do
        // teste de paginação (mesmo time, mesma condição lead_status).
        status: "no_show",
      },
    })
    const profile = await prisma.radarProfile.create({
      data: {
        id: randomUUID(),
        teamId,
        displayName: lead.name,
        normalizedName: `lead recipients fix ${suffix}`,
        displayPhone: lead.phone!,
        normalizedPhone: normalizeRadarPhone(lead.phone),
        primaryEmail: lead.email,
        normalizedPrimaryEmail: normalizeRadarEmail(lead.email),
      },
    })
    await prisma.radarIdentity.create({
      data: {
        id: randomUUID(),
        profileId: profile.id,
        teamId,
        type: "lead_id",
        value: lead.id,
        normalizedValue: lead.id,
        source: "crm",
        isPrimary: true,
      },
    })

    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: `Segmento resolução pós-delete ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["no_show"] }] },
    })
    const slug = `custom:${segment.id}`

    const beforeDelete = await listRadarSegmentEmailRecipients(teamId, slug)
    expect(beforeDelete.map((r) => r.email)).toEqual([normalizeRadarEmail(lead.email)])

    const campaign = await prisma.emailCampaign.create({
      data: {
        id: randomUUID(),
        teamId,
        createdBy: ctx.profileId,
        name: `Campanha resolução pós-delete ${suffix}`,
        templateId,
        radarSegmentSlug: slug,
        status: "scheduled",
      },
    })

    const removed = await teamRadarSegmentService.remove(teamId, segment.id)
    expect(removed).toEqual({ removed: true, softDeleted: true })

    // Desativado, mas ainda referenciado por uma campanha pendente — a
    // resolução de destinatários precisa continuar funcionando.
    const afterSoftDelete = await listRadarSegmentEmailRecipients(teamId, slug)
    expect(afterSoftDelete.map((r) => r.email)).toEqual([normalizeRadarEmail(lead.email)])

    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "archived" } })
    await teamRadarSegmentService.remove(teamId, segment.id)

    const afterHardDelete = await listRadarSegmentEmailRecipients(teamId, slug)
    expect(afterHardDelete).toEqual([])
  })

  it("criação de campanha e exclusão concorrentes do mesmo segmento nunca deixam custom:{id} órfão", async () => {
    const suffix = randomUUID().slice(0, 8)
    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: `Segmento concorrência ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["scheduled"] }] },
    })

    const useCase = new EmailCampaignUseCase()
    const [createResult, removeResult] = await Promise.all([
      useCase.create(
        { name: `Campanha concorrência ${suffix}`, templateId, radarSegmentSlug: `custom:${segment.id}` },
        ctx
      ),
      teamRadarSegmentService.remove(teamId, segment.id),
    ])

    if (createResult.isValid) {
      // create venceu o pg_advisory_xact_lock primeiro: a exclusão, ao rodar
      // depois, encontra a campanha recém-criada referenciando o segmento e
      // desativa em vez de excluir.
      expect(removeResult.softDeleted).toBe(true)
      const stillThere = await prisma.teamRadarSegment.findUnique({ where: { id: segment.id } })
      expect(stillThere?.isActive).toBe(false)
    } else {
      // remove venceu o lock primeiro: excluiu o segmento antes do insert da
      // campanha, que é rejeitada na revalidação — nunca fica órfã.
      expect(createResult.errorMessages).toContain("Segmento Radar inválido")
      const campaign = await prisma.emailCampaign.findFirst({
        where: { teamId, radarSegmentSlug: `custom:${segment.id}` },
      })
      expect(campaign).toBeNull()
    }
  })

  it("listCustomSegmentProfiles pagina no banco (total correto, páginas sem sobreposição)", async () => {
    const suffix = randomUUID().slice(0, 8)
    const MATCH_COUNT = 5
    const PAGE_SIZE = 3

    const leads = Array.from({ length: MATCH_COUNT }, (_, index) => ({
      id: randomUUID(),
      leadCode: `RadarFixPage-${suffix}-${index}`,
      managerId: ctx.profileId,
      teamId,
      name: `Lead Pagination ${index}`,
      status: "scheduled" as const,
    }))
    await prisma.lead.createMany({ data: leads })

    const profiles = leads.map((lead, index) => ({
      id: randomUUID(),
      teamId,
      displayName: lead.name,
      normalizedName: `lead pagination ${suffix} ${index}`,
      displayPhone: "",
      normalizedPhone: `988${suffix}${String(index).padStart(5, "0")}`,
    }))
    await prisma.radarProfile.createMany({ data: profiles })
    await prisma.radarIdentity.createMany({
      data: profiles.map((profile, index) => ({
        id: randomUUID(),
        profileId: profile.id,
        teamId,
        type: "lead_id" as const,
        value: leads[index].id,
        normalizedValue: leads[index].id,
        source: "crm",
        isPrimary: true,
      })),
    })

    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: `Segmento paginação ${suffix}`,
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["scheduled"] }] },
    })

    const page1 = await customerDataPlatformUseCase.listCustomSegmentProfiles(teamId, ctx, segment.id, 1, PAGE_SIZE)
    const page2 = await customerDataPlatformUseCase.listCustomSegmentProfiles(teamId, ctx, segment.id, 2, PAGE_SIZE)

    const result1 = page1.result as { items: Array<{ id: string }>; total: number }
    const result2 = page2.result as { items: Array<{ id: string }>; total: number }

    expect(result1.total).toBe(MATCH_COUNT)
    expect(result2.total).toBe(MATCH_COUNT)
    expect(result1.items).toHaveLength(PAGE_SIZE)
    expect(result2.items).toHaveLength(MATCH_COUNT - PAGE_SIZE)

    const ids1 = new Set(result1.items.map((item) => item.id))
    const ids2 = new Set(result2.items.map((item) => item.id))
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false)
    }
  })
})

describe.skipIf(!RUN_INTEGRATION)("C6 — regressão ponta a ponta (lead → perfil inline → segmento → campanha)", () => {
  let teamId = ""
  let ctx: TeamAccess
  let templateId = ""
  let segmentId = ""
  let leadId = ""

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const supabaseId = randomUUID()
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-e2e-${suffix}@example.com`,
        supabaseId,
        fullName: "Radar E2E Tester",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar E2E Test ${suffix}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: team.id, profileId: profile.id, role: "manager" },
    })
    teamId = team.id
    ctx = {
      supabaseId,
      teamId: team.id,
      profileId: profile.id,
      profileEmail: profile.email,
      profileName: profile.fullName,
      isMaster: true,
      managerId: profile.id,
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
      canViewAllTeams: false,
      userTimezone: "America/Sao_Paulo",
      teamMember: { role: "manager", functions: [] },
    }

    const templateGroupId = randomUUID()
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateGroupId,
        teamId: team.id,
        createdBy: profile.id,
        name: "Template Radar E2E Test",
        subject: "Assunto de teste",
        html: "<p>Olá</p>",
        editorMode: "html",
        versionGroupId: templateGroupId,
        versionNumber: 1,
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
      },
    })
    templateId = template.id

    const lead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `Radar-e2e-${suffix}`,
        managerId: profile.id,
        teamId: team.id,
        name: "Lead E2E",
        phone: `1198888${String(Date.now()).slice(-4)}`,
        email: `lead-e2e-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    leadId = lead.id
  })

  afterAll(async () => {
    if (!teamId) return
    await prisma.emailCampaign.deleteMany({ where: { teamId } })
    await prisma.emailTemplate.deleteMany({ where: { teamId } })
    await prisma.teamRadarSegment.deleteMany({ where: { teamId } })
    await prisma.radarIdentity.deleteMany({ where: { teamId } })
    await prisma.radarProfile.deleteMany({ where: { teamId } })
    await prisma.lead.deleteMany({ where: { teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId } })
    await prisma.team.deleteMany({ where: { id: teamId } })
  })

  it("lead criado → perfil nasce inline (C3) → segmento dinâmico encontra (C4) → campanha resolve o destinatário respeitando o limite (D11)", async () => {
    // 1. Push inline (C3) — mesmo caminho que updateLeadStatus dispara fire-and-forget.
    const syncResult = await syncLeadToRadarUseCase.execute({ leadId, teamId })
    expect(syncResult.isValid).toBe(true)

    const profile = await prisma.radarProfile.findFirst({
      where: { teamId, identities: { some: { type: "lead_id", normalizedValue: leadId } } },
    })
    expect(profile).not.toBeNull()
    expect(profile!.normalizedPrimaryEmail).not.toBeNull()

    // 2. Segmento dinâmico (C4) — regra casa com o status do lead recém-criado.
    const segment = await teamRadarSegmentService.create(teamId, ctx.profileId, {
      name: "Segmento E2E novas oportunidades",
      rules: { match: "all", conditions: [{ kind: "lead_status", statuses: ["new_opportunity"] }] },
    })
    segmentId = segment.id
    const rules = parseRadarSegmentRules(segment.rulesJson)

    const count = await radarSegmentQueryService.countProfiles(
      { teamId, ctx: { profileId: ctx.profileId, teamMember: ctx.teamMember } },
      rules
    )
    expect(count).toBe(1)

    const profileIds = await radarSegmentQueryService.listProfileIds(
      { teamId, ctx: { profileId: ctx.profileId, teamMember: ctx.teamMember } },
      rules
    )
    expect(profileIds).toEqual([profile!.id])

    // 3. Campanha (D11) — audiência ≤ EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB é aceita (nunca hardcoded 2000).
    const emailCampaignUseCase = new EmailCampaignUseCase()
    const campaignResult = await emailCampaignUseCase.create(
      {
        name: "Campanha E2E segmento dinâmico",
        templateId,
        radarSegmentSlug: `custom:${segmentId}`,
      },
      ctx
    )
    expect(campaignResult.isValid).toBe(true)

    const campaign = await prisma.emailCampaign.findFirst({
      where: { teamId, radarSegmentSlug: `custom:${segmentId}` },
    })
    expect(campaign).not.toBeNull()

    const recipients = await listRadarSegmentEmailRecipients(teamId, `custom:${segmentId}`)
    expect(recipients.map((recipient) => recipient.email)).toContain(profile!.normalizedPrimaryEmail!)
  })
})

/**
 * T-R2.3 — o lote agregado precisa dar exatamente o mesmo número que o cálculo
 * por perfil. Trocar 2 queries/perfil por 2 queries/lote só vale se o resultado
 * for idêntico; senão o backfill "termina" gravando score errado na base toda.
 */
describe.skipIf(!RUN_INTEGRATION)("T-R2.3 — lote agregado === cálculo unitário", () => {
  let teamId = ""
  const profileIds: string[] = []

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const owner = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-backfill-${suffix}@example.com`,
        supabaseId: randomUUID(),
        fullName: "Radar Backfill Tester",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { id: randomUUID(), name: `Radar Backfill ${suffix}`, masterId: owner.id },
    })
    await prisma.teamMember.create({
      data: { id: randomUUID(), teamId: team.id, profileId: owner.id, role: "manager" },
    })
    teamId = team.id

    const now = Date.now()
    // Perfis com volumes de evento diferentes, para os scores não colidirem por acaso.
    for (let index = 0; index < 4; index += 1) {
      const profile = await prisma.radarProfile.create({
        data: {
          id: randomUUID(),
          teamId: team.id,
          displayName: `Backfill Perfil ${index}`,
          normalizedName: normalizeRadarName(`Backfill Perfil ${index}`),
          displayPhone: formatDisplayPhone(`551190000${100 + index}`),
          normalizedPhone: normalizeRadarPhone(`551190000${100 + index}`),
          primaryEmail: `backfill-${index}-${suffix}@example.com`,
          normalizedPrimaryEmail: normalizeRadarEmail(`backfill-${index}-${suffix}@example.com`),
          lastSeenAt: new Date(now - index * 60 * 60 * 1000),
        },
      })
      profileIds.push(profile.id)

      for (let event = 0; event <= index; event += 1) {
        await prisma.radarEvent.create({
          data: {
            id: randomUUID(),
            teamId: team.id,
            profileId: profile.id,
            eventType: event % 2 === 0 ? "email.opened" : "email.clicked",
            sourceType: "email_campaign",
            sourceId: `${randomUUID()}:${event}`,
            occurredAt: new Date(now - event * 24 * 60 * 60 * 1000),
            metadata: { campaignId: randomUUID() },
          },
        })
      }
    }
  })

  it("gera score e banda idênticos ao caminho por perfil", async () => {
    const unitResults = new Map<string, { score: number; band: string | null }>()
    for (const profileId of profileIds) {
      const result = await radarRepository.updateEngagementScore(profileId, teamId)
      unitResults.set(profileId, { score: result.score, band: result.band })
    }

    // Zera para garantir que a escrita do lote é o que estamos medindo.
    await prisma.radarProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { engagementScore: null, engagementBand: null },
    })

    const updated = await radarRepository.updateEngagementScoresBatch(
      profileIds.map((id) => ({ id, teamId }))
    )
    expect(updated).toBe(profileIds.length)

    const stored = await prisma.radarProfile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, engagementScore: true, engagementBand: true },
    })

    expect(stored).toHaveLength(profileIds.length)
    for (const profile of stored) {
      const expected = unitResults.get(profile.id)!
      expect({
        id: profile.id,
        score: profile.engagementScore,
        band: profile.engagementBand,
      }).toEqual({ id: profile.id, score: expected.score, band: expected.band })
    }

    // Sem isso o teste passaria com todo mundo em zero.
    expect(new Set(stored.map((profile) => profile.engagementScore)).size).toBeGreaterThan(1)
  })

  it("não vaza evento de outro time para dentro do score", async () => {
    const otherOwner = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `radar-backfill-other-${randomUUID().slice(0, 8)}@example.com`,
        supabaseId: randomUUID(),
        fullName: "Outro Time",
        isMaster: true,
      },
    })
    const otherTeam = await prisma.team.create({
      data: { id: randomUUID(), name: `Outro Time ${randomUUID().slice(0, 6)}`, masterId: otherOwner.id },
    })

    const target = profileIds[0]!
    const before = await radarRepository.updateEngagementScoresBatch([{ id: target, teamId }])
    expect(before).toBe(1)
    const scoreBefore = (
      await prisma.radarProfile.findUniqueOrThrow({
        where: { id: target },
        select: { engagementScore: true },
      })
    ).engagementScore

    // Evento com o profileId certo mas teamId de outro time: o agrupamento tem
    // de descartar, como o `where` por perfil descartava.
    await prisma.radarEvent.create({
      data: {
        id: randomUUID(),
        teamId: otherTeam.id,
        profileId: target,
        eventType: "email.clicked",
        sourceType: "email_campaign",
        sourceId: `${randomUUID()}:cross-team`,
        occurredAt: new Date(),
        metadata: { campaignId: randomUUID() },
      },
    })

    await radarRepository.updateEngagementScoresBatch([{ id: target, teamId }])
    const scoreAfter = (
      await prisma.radarProfile.findUniqueOrThrow({
        where: { id: target },
        select: { engagementScore: true },
      })
    ).engagementScore

    expect(scoreAfter).toBe(scoreBefore)
  })
})

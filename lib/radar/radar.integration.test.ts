import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { radarService } from "@/app/api/services/radar/RadarService"
import { profileMatchesRadarSegment } from "@/lib/radar/segment-rules"
import { normalizeRadarEmail, normalizeRadarPhone } from "@/lib/radar/normalization"
import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"

const RUN_INTEGRATION = process.env.RADAR_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

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

  it("time B não vê perfis do time A", async () => {
    const countA = await prisma.radarProfile.count({ where: { teamId: scope.teamId } })
    const countB = await prisma.radarProfile.count({ where: { teamId: otherScope.teamId } })
    expect(countA).toBeGreaterThan(0)
    expect(countB).toBe(0)
  })
})

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { radarService } from "@/app/api/services/radar/RadarService"
import { profileMatchesRadarSegment } from "@/lib/radar/segment-rules"
import { normalizeRadarEmail, normalizeRadarPhone } from "@/lib/radar/normalization"
import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { radarSegmentQueryService } from "@/app/api/services/radar/RadarSegmentQueryService"
import { teamRadarSegmentService } from "@/app/api/services/radar/TeamRadarSegmentService"
import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

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

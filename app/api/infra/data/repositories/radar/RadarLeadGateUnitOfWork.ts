import { ActivityType, LeadStatus, Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IRadarLeadGateUnitOfWork,
  RadarCrmIdentityMatch,
  RadarLeadGateProfile,
  RadarLeadGateTransaction,
  RadarLeadGatePromotionResult,
} from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"
import { normalizeLeadPhoneDigits } from "@/lib/masks"

class PrismaRadarLeadGateTransaction implements RadarLeadGateTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async reloadProfile(
    teamId: string,
    radarProfileId: string,
  ): Promise<RadarLeadGateProfile | null> {
    const profile = await this.transaction.radarProfile.findFirst({
      where: { id: radarProfileId, teamId },
      select: {
        id: true,
        teamId: true,
        displayName: true,
        normalizedName: true,
        displayPhone: true,
        normalizedPhone: true,
        primaryEmail: true,
        normalizedPrimaryEmail: true,
        identities: {
          where: { type: "lead_id" },
          select: { value: true, normalizedValue: true },
          take: 1,
        },
      },
    })
    if (!profile) return null

    const leadIdentity = profile.identities[0]
    return {
      id: profile.id,
      teamId: profile.teamId,
      displayName: profile.displayName,
      normalizedName: profile.normalizedName,
      displayPhone: profile.displayPhone,
      normalizedPhone: profile.normalizedPhone,
      primaryEmail: profile.primaryEmail,
      normalizedPrimaryEmail: profile.normalizedPrimaryEmail,
      leadId: leadIdentity?.value ?? leadIdentity?.normalizedValue ?? null,
    }
  }

  async findIdentityMatches(profile: RadarLeadGateProfile): Promise<RadarCrmIdentityMatch> {
    const normalizedPhone = normalizeLeadPhoneDigits(
      profile.normalizedPhone ?? profile.displayPhone ?? "",
    )
    const phoneSuffix = normalizedPhone.slice(-11)
    const normalizedEmail =
      profile.normalizedPrimaryEmail ?? profile.primaryEmail?.toLowerCase() ?? null

    const [leadIdMatch, phoneMatch, emailMatch] = await Promise.all([
      profile.leadId
        ? this.transaction.lead.findFirst({
            where: { id: profile.leadId, teamId: profile.teamId, deletedAt: null },
            select: { id: true },
          })
        : null,
      phoneSuffix.length >= 10
        ? this.transaction.lead.findFirst({
            where: {
              teamId: profile.teamId,
              deletedAt: null,
              OR: [
                ...(profile.displayPhone ? [{ phone: profile.displayPhone }] : []),
                ...(profile.normalizedPhone ? [{ phone: profile.normalizedPhone }] : []),
                { phone: { contains: phoneSuffix } },
              ],
            },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
        : null,
      normalizedEmail
        ? this.transaction.lead.findFirst({
            where: {
              teamId: profile.teamId,
              deletedAt: null,
              email: { equals: normalizedEmail, mode: "insensitive" },
            },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
        : null,
    ])

    return {
      leadIdMatch: leadIdMatch?.id ?? null,
      phoneMatch: phoneMatch?.id ?? null,
      emailMatch: emailMatch?.id ?? null,
    }
  }

  async createOrUpdateFromRadarProfile(input: {
    teamId: string
    profile: RadarLeadGateProfile
    existingLeadId: string | null
  }): Promise<RadarLeadGatePromotionResult> {
    const phone = input.profile.displayPhone ?? input.profile.normalizedPhone
    const email = input.profile.primaryEmail ?? input.profile.normalizedPrimaryEmail

    if (input.existingLeadId) {
      await this.transaction.lead.update({
        where: { id: input.existingLeadId },
        data: {
          name: input.profile.displayName,
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          updatedAt: new Date(),
        },
      })
      return { leadId: input.existingLeadId, created: false }
    }

    const team = await this.transaction.team.findUnique({
      where: { id: input.teamId },
      select: { masterId: true },
    })
    if (!team) throw new Error("Time do perfil Radar não encontrado")

    const stableProfileCode = input.profile.id.replaceAll("-", "").slice(0, 12).toUpperCase()
    const lead = await this.transaction.lead.create({
      data: {
        leadCode: `R${stableProfileCode}`,
        managerId: team.masterId,
        teamId: input.teamId,
        status: LeadStatus.new_opportunity,
        name: input.profile.displayName,
        phone,
        email,
        originChannel: "public_form",
        originMetadata: {
          source: "radar_public_form_gate",
          radarProfileId: input.profile.id,
        },
        createdBy: team.masterId,
        updatedBy: team.masterId,
        activities: {
          create: {
            type: ActivityType.note,
            body: "Lead criado pelo Radar a partir de formulário público",
            payload: {
              kind: "lead_creation",
              channel: "public_form",
              radarProfileId: input.profile.id,
            },
          },
        },
      },
      select: { id: true },
    })
    return { leadId: lead.id, created: true }
  }

  async linkLeadIdentity(input: {
    teamId: string
    radarProfileId: string
    leadId: string
    source: string
  }): Promise<void> {
    const existing = await this.transaction.radarIdentity.findFirst({
      where: { teamId: input.teamId, profileId: input.radarProfileId, type: "lead_id" },
      select: { normalizedValue: true },
    })
    if (existing?.normalizedValue === input.leadId) return
    if (existing) throw new Error("Perfil Radar já está vinculado a outro lead")

    await this.transaction.radarIdentity.create({
      data: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        type: "lead_id",
        value: input.leadId,
        normalizedValue: input.leadId,
        source: input.source,
        isPrimary: false,
      },
    })
  }

  async appendGateEvent(input: {
    teamId: string
    radarProfileId: string
    eventType: "radar.crm_identity_conflict" | "radar.crm_lead_created" | "radar.crm_lead_attached"
    eventId: string
    metadata: Record<string, string | boolean | null>
  }): Promise<void> {
    const existing = await this.transaction.radarEvent.findFirst({
      where: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        eventType: input.eventType,
        sourceType: "public_form_lead_gate",
        sourceId: input.eventId,
      },
      select: { id: true },
    })
    if (existing) return

    await this.transaction.radarEvent.create({
      data: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        eventType: input.eventType,
        sourceType: "public_form_lead_gate",
        sourceId: input.eventId,
        occurredAt: new Date(),
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    })
  }

  async attachLeadToPendingSubmissions(input: {
    formId: string
    visitorSessionId: string
    leadId: string
  }): Promise<void> {
    await this.transaction.publicFormSubmission.updateMany({
      where: {
        formId: input.formId,
        visitorSessionId: input.visitorSessionId,
        leadId: null,
      },
      data: { leadId: input.leadId },
    })
  }
}

export class RadarLeadGateUnitOfWork implements IRadarLeadGateUnitOfWork {
  constructor(private readonly database: PrismaClient = prisma) {}

  execute<T>(
    input: { teamId: string; radarProfileId: string },
    work: (transaction: RadarLeadGateTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(
      async (transaction) => {
        const lockKey = `radar-form-lead-gate:${input.teamId}:${input.radarProfileId}`
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
        return work(new PrismaRadarLeadGateTransaction(transaction))
      },
      { timeout: 15_000 },
    )
  }
}

export const radarLeadGateUnitOfWork = new RadarLeadGateUnitOfWork()

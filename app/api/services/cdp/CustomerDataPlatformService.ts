import type {
  CustomerConsentReason,
  CustomerConsentStatus,
  EmailEventType,
  Prisma,
  RenewalStatus,
} from "@prisma/client"
import {
  cdpRepository,
  type CdpTeamScope,
} from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import {
  whatsAppRepository,
} from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import type {
  WhatsAppConversationSelect,
  WhatsAppMessageSelect,
} from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import {
  PORTFOLIO_RENEWAL_WINDOW_DAYS,
  RECENT_CAMPAIGN_WINDOW_DAYS,
  type CdpSegmentSlug,
} from "@/lib/cdp/segment-config"
import { buildEmailEventMetadata, profileMatchesCdpSegment } from "@/lib/cdp/segment-rules"
import type { CdpSyncFilters } from "@/lib/cdp/sync-filters"
import { CDP_PRIMARY_SEGMENT_PRIORITY } from "@/lib/cdp/field-catalog"
import {
  buildProfileDataMap,
  getLeadIdFromProfile,
  type CdpResolvableLead,
  type CdpResolvableProfile,
} from "@/lib/cdp/resolve-field-value"
import { resolveInterpolationValuesForProfile } from "@/lib/cdp/resolve-recipient-interpolation"
import {
  formatDisplayPhone,
  isValidCdpPrimaryIdentity,
  normalizeCdpDocument,
  normalizeCdpEmail,
  normalizeCdpName,
  normalizeCdpPhone,
} from "@/lib/cdp/normalization"
import type { LeadStatus } from "@prisma/client"

function toSegmentLeadStatusMap(raw: Map<string, LeadStatus | null>): Map<string, string> {
  return new Map(
    [...raw.entries()].flatMap(([key, status]) => (status ? [[key, status] as const] : []))
  )
}

const EMAIL_EVENT_MAP: Record<EmailEventType, string> = {
  sent: "email.sent",
  delivered: "email.delivered",
  opened: "email.opened",
  clicked: "email.clicked",
  bounced: "email.bounced",
  complained: "email.complained",
  delivery_delayed: "email.delivery_delayed",
  unsubscribed: "email.unsubscribed",
  failed: "email.failed",
  suppressed: "email.suppressed",
}

export type SyncCounters = {
  created: number
  enriched: number
  skipped: number
  errors: string[]
}

export type SegmentCount = {
  slug: CdpSegmentSlug
  name: string
  description: string
  count: number
}

const SEGMENT_META: Record<CdpSegmentSlug, { name: string; description: string }> = {
  email_marketable: {
    name: "Aptos para e-mail",
    description: "E-mail válido com consentimento permitido",
  },
  email_blocked: {
    name: "Bloqueados",
    description: "Bloqueados por unsubscribe, bounce ou complaint",
  },
  opened_not_clicked: {
    name: "Abriram e não clicaram",
    description: "Abriram campanha sem clique subsequente",
  },
  clicked_not_closed: {
    name: "Clicaram e não fecharam",
    description: "Clicaram em campanha sem fechamento em carteira ou CRM",
  },
  portfolio_renewal_due: {
    name: "Carteira próxima de renovação",
    description: "Clientes com renovação nos próximos 60 dias",
  },
  inactive_recent_campaign: {
    name: "Sem campanha recente",
    description: "Sem envio de campanha nos últimos 60 dias",
  },
}

function emptyCounters(): SyncCounters {
  return { created: 0, enriched: 0, skipped: 0, errors: [] }
}

function consentFromEmailFlags(flags: {
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
}): { status: CustomerConsentStatus; reason: CustomerConsentReason | null } {
  if (flags.isComplained) return { status: "blocked", reason: "complaint" }
  if (flags.isBounced) return { status: "blocked", reason: "bounce" }
  if (flags.isUnsubscribed) return { status: "blocked", reason: "unsubscribe" }
  return { status: "allowed", reason: "imported" }
}

export class CustomerDataPlatformService {
  async syncFromCrm(scope: CdpTeamScope, filters: CdpSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const leads = await cdpRepository.findLeadsForCdpSync(scope.teamId, filters)

    for (const lead of leads) {
      try {
        if (!isValidCdpPrimaryIdentity(lead.phone, lead.name)) {
          counters.skipped += 1
          continue
        }

        const normalizedPhone = normalizeCdpPhone(lead.phone)
        const normalizedName = normalizeCdpName(lead.name)
        const normalizedEmail = lead.email ? normalizeCdpEmail(lead.email) : null
        const normalizedDocument = lead.cnpj ? normalizeCdpDocument(lead.cnpj) : null

        const existing = await cdpRepository.findProfileByPrimaryKey(
          scope.teamId,
          normalizedPhone,
          normalizedName
        )

        const profile = await cdpRepository.upsertProfile({
          teamId: scope.teamId,
          displayName: lead.name.trim(),
          normalizedName,
          displayPhone: formatDisplayPhone(lead.phone),
          normalizedPhone,
          primaryEmail: lead.email,
          normalizedPrimaryEmail: normalizedEmail,
          primaryDocument: lead.cnpj,
          normalizedPrimaryDocument: normalizedDocument,
          lastSeenAt: lead.updatedAt,
        })

        if (existing) counters.enriched += 1
        else counters.created += 1

        await cdpRepository.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "phone",
          value: lead.phone,
          normalizedValue: normalizedPhone,
          source: "crm",
          isPrimary: true,
        })

        if (normalizedEmail) {
          await cdpRepository.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "email",
            value: lead.email,
            normalizedValue: normalizedEmail,
            source: "crm",
          })
        }

        if (normalizedDocument) {
          await cdpRepository.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "document",
            value: lead.cnpj,
            normalizedValue: normalizedDocument,
            source: "crm",
          })
        }

        await cdpRepository.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "lead_id",
          value: lead.id,
          normalizedValue: lead.id,
          source: "crm",
        })

        await cdpRepository.upsertSourceLink({
          profileId: profile.id,
          teamId: scope.teamId,
          sourceType: "crm_lead",
          sourceId: lead.id,
          sourceMetadata: { status: lead.status },
        })

        await cdpRepository.appendEventIfNew({
          profileId: profile.id,
          teamId: scope.teamId,
          eventType: "lead.created",
          sourceType: "crm_lead",
          sourceId: lead.id,
          occurredAt: lead.createdAt,
        })

        await cdpRepository.appendEventIfNew({
          profileId: profile.id,
          teamId: scope.teamId,
          eventType: "lead.status_changed",
          sourceType: "crm_lead",
          sourceId: `${lead.id}:${lead.status}`,
          occurredAt: lead.statusEnteredAt,
          metadata: { status: lead.status },
        })
      } catch (error) {
        counters.errors.push(`lead:${lead.id}`)
        console.error("[CustomerDataPlatformService][syncFromCrm]", lead.id, error)
      }
    }

    return counters
  }

  async syncFromPortfolio(scope: CdpTeamScope, filters: CdpSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const portfolios = await cdpRepository.findPortfoliosForCdpSync(scope.teamId, filters)

    for (const entry of portfolios) {
      try {
        const lead = entry.lead
        if (!isValidCdpPrimaryIdentity(lead.phone, lead.name)) {
          counters.skipped += 1
          continue
        }

        const normalizedPhone = normalizeCdpPhone(lead.phone)
        const normalizedName = normalizeCdpName(lead.name)
        const existing = await cdpRepository.findProfileByPrimaryKey(
          scope.teamId,
          normalizedPhone,
          normalizedName
        )

        const profile = await cdpRepository.upsertProfile({
          teamId: scope.teamId,
          displayName: lead.name.trim(),
          normalizedName,
          displayPhone: formatDisplayPhone(lead.phone),
          normalizedPhone,
          primaryEmail: lead.email,
          normalizedPrimaryEmail: lead.email ? normalizeCdpEmail(lead.email) : null,
          primaryDocument: lead.cnpj,
          normalizedPrimaryDocument: lead.cnpj ? normalizeCdpDocument(lead.cnpj) : null,
          lastSeenAt: entry.updatedAt,
        })

        if (existing) counters.enriched += 1
        else counters.created += 1

        await cdpRepository.upsertSourceLink({
          profileId: profile.id,
          teamId: scope.teamId,
          sourceType: "portfolio",
          sourceId: entry.id,
          sourceMetadata: {
            portfolioStatus: entry.portfolioStatus,
            renewalStatus: entry.renewalStatus,
            renewalAmount: entry.renewalAmount,
          },
        })

        await cdpRepository.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "portfolio_id",
          value: entry.id,
          normalizedValue: entry.id,
          source: "portfolio",
        })

        await cdpRepository.appendEventIfNew({
          profileId: profile.id,
          teamId: scope.teamId,
          eventType: "portfolio.created",
          sourceType: "portfolio",
          sourceId: entry.id,
          occurredAt: entry.createdAt,
        })

        if (this.isRenewalDue(entry.renewalStatus, lead.contractDueDate)) {
          await cdpRepository.appendEventIfNew({
            profileId: profile.id,
            teamId: scope.teamId,
            eventType: "portfolio.renewal_due",
            sourceType: "portfolio",
            sourceId: `${entry.id}:renewal`,
            occurredAt: entry.updatedAt,
            metadata: { renewalStatus: entry.renewalStatus },
          })
        }
      } catch (error) {
        counters.errors.push(`portfolio:${entry.id}`)
        console.error("[CustomerDataPlatformService][syncFromPortfolio]", entry.id, error)
      }
    }

    return counters
  }

  async syncFromEmail(scope: CdpTeamScope, filters: CdpSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const lists = await cdpRepository.findEmailContactLists(scope.teamId)

    for (const list of lists) {
      const contacts = await cdpRepository.findEmailContacts(list.id)

      for (const contact of contacts) {
        try {
          const normalizedEmail = normalizeCdpEmail(contact.email)
          let profile = await cdpRepository.findProfileByEmail(scope.teamId, normalizedEmail)

          if (!profile && contact.name) {
            const phoneFromCustom = await cdpRepository.findLeadPhoneByEmail(scope.teamId, normalizedEmail)
            if (phoneFromCustom && isValidCdpPrimaryIdentity(phoneFromCustom.phone, contact.name)) {
              profile = await cdpRepository.upsertProfile({
                teamId: scope.teamId,
                displayName: contact.name.trim(),
                normalizedName: normalizeCdpName(contact.name),
                displayPhone: formatDisplayPhone(phoneFromCustom.phone),
                normalizedPhone: normalizeCdpPhone(phoneFromCustom.phone),
                primaryEmail: contact.email,
                normalizedPrimaryEmail: normalizedEmail,
                lastSeenAt: contact.updatedAt,
              })
              counters.created += 1
            }
          }

          if (!profile) {
            counters.skipped += 1
            continue
          }

          counters.enriched += 1

          await cdpRepository.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "email",
            value: contact.email,
            normalizedValue: normalizedEmail,
            source: "email",
          })

          await cdpRepository.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "email_contact_id",
            value: contact.id,
            normalizedValue: contact.id,
            source: "email",
          })

          await cdpRepository.upsertSourceLink({
            profileId: profile.id,
            teamId: scope.teamId,
            sourceType: "email_contact",
            sourceId: contact.id,
          })

          const consent = consentFromEmailFlags(contact)
          await cdpRepository.upsertConsent({
            profileId: profile.id,
            teamId: scope.teamId,
            channel: "email",
            status: consent.status,
            reason: consent.reason,
            sourceType: "email_contact",
            sourceId: contact.id,
          })
        } catch (error) {
          counters.errors.push(`contact:${contact.id}`)
          console.error("[CustomerDataPlatformService][syncFromEmail] contact", contact.id, error)
        }
      }
    }

    const logs = await cdpRepository.findEmailLogsForCdpSync(scope.teamId, filters)

    for (const log of logs) {
      try {
        const normalizedEmail = normalizeCdpEmail(log.recipientEmail)
        const profile = await cdpRepository.findProfileByEmail(scope.teamId, normalizedEmail)
        if (!profile) continue

        for (const event of log.events) {
          const eventType = EMAIL_EVENT_MAP[event.type]
          if (!eventType) continue

          await cdpRepository.appendEventIfNew({
            profileId: profile.id,
            teamId: scope.teamId,
            eventType,
            sourceType: "email_log",
            sourceId: event.id,
            occurredAt: event.occurredAt,
            metadata: buildEmailEventMetadata(
              log.campaignId,
              (event.metadata as Record<string, unknown> | null) ?? undefined
            ),
          })

          if (event.type === "bounced" || event.type === "complained" || event.type === "unsubscribed") {
            const reason: CustomerConsentReason =
              event.type === "bounced" ? "bounce" : event.type === "complained" ? "complaint" : "unsubscribe"
            await cdpRepository.upsertConsent({
              profileId: profile.id,
              teamId: scope.teamId,
              channel: "email",
              status: "blocked",
              reason,
              sourceType: "email_log",
              sourceId: log.id,
            })
          }
        }
      } catch (error) {
        counters.errors.push(`log:${log.id}`)
        console.error("[CustomerDataPlatformService][syncFromEmail] log", log.id, error)
      }
    }

    return counters
  }

  async syncWhatsappMessageToCdp(input: {
    teamId: string
    message: WhatsAppMessageSelect
    conversation: WhatsAppConversationSelect
  }): Promise<void> {
    const displayName = input.conversation.contactName ?? input.conversation.contactPhone
    if (!isValidCdpPrimaryIdentity(input.conversation.contactPhone, displayName)) return

    const normalizedPhone = normalizeCdpPhone(input.conversation.contactPhone)
    const normalizedName = normalizeCdpName(displayName)

    const profile = await cdpRepository.upsertProfile({
      teamId: input.teamId,
      displayName: displayName.trim(),
      normalizedName,
      displayPhone: formatDisplayPhone(input.conversation.contactPhone),
      normalizedPhone,
      lastSeenAt: input.message.sentAt ?? input.message.createdAt,
    })

    await cdpRepository.upsertIdentity({
      profileId: profile.id,
      teamId: input.teamId,
      type: "phone",
      value: input.conversation.contactPhone,
      normalizedValue: normalizedPhone,
      source: "whatsapp",
      isPrimary: true,
    })

    await cdpRepository.upsertIdentity({
      profileId: profile.id,
      teamId: input.teamId,
      type: "whatsapp_contact_id",
      value: input.conversation.id,
      normalizedValue: input.conversation.id,
      source: "whatsapp",
    })

    await cdpRepository.upsertSourceLink({
      profileId: profile.id,
      teamId: input.teamId,
      sourceType: "whatsapp_contact",
      sourceId: input.conversation.id,
    })

    await cdpRepository.upsertConsent({
      profileId: profile.id,
      teamId: input.teamId,
      channel: "whatsapp",
      status: "unknown",
      reason: null,
      sourceType: "whatsapp_contact",
      sourceId: input.conversation.id,
    })

    const eventType =
      input.message.direction === "OUTBOUND" ? "whatsapp.message_sent" : "whatsapp.message_received"
    const preview =
      input.message.contentText ?? input.message.caption ?? input.message.messageType ?? ""

    if (!input.message.providerMessageId) return

    await cdpRepository.appendEventIfNew({
      profileId: profile.id,
      teamId: input.teamId,
      eventType,
      sourceType: "whatsapp_message",
      sourceId: input.message.providerMessageId,
      occurredAt: input.message.sentAt ?? input.message.createdAt,
      metadata: {
        conversationId: input.conversation.id,
        direction: input.message.direction,
        preview,
        sentAt: (input.message.sentAt ?? input.message.createdAt).toISOString(),
      },
    })
  }

  async syncWhatsappConversationToCdp(
    teamId: string,
    conversation: WhatsAppConversationSelect
  ): Promise<void> {
    const displayName = conversation.contactName ?? conversation.contactPhone
    if (!isValidCdpPrimaryIdentity(conversation.contactPhone, displayName)) return

    const normalizedPhone = normalizeCdpPhone(conversation.contactPhone)
    const normalizedName = normalizeCdpName(displayName)

    const profile = await cdpRepository.upsertProfile({
      teamId,
      displayName: displayName.trim(),
      normalizedName,
      displayPhone: formatDisplayPhone(conversation.contactPhone),
      normalizedPhone,
      lastSeenAt: conversation.lastMessageAt ?? conversation.updatedAt,
    })

    await cdpRepository.upsertIdentity({
      profileId: profile.id,
      teamId,
      type: "phone",
      value: conversation.contactPhone,
      normalizedValue: normalizedPhone,
      source: "whatsapp",
      isPrimary: true,
    })

    await cdpRepository.upsertIdentity({
      profileId: profile.id,
      teamId,
      type: "whatsapp_contact_id",
      value: conversation.id,
      normalizedValue: conversation.id,
      source: "whatsapp",
    })

    await cdpRepository.upsertSourceLink({
      profileId: profile.id,
      teamId,
      sourceType: "whatsapp_contact",
      sourceId: conversation.id,
    })

    await cdpRepository.upsertConsent({
      profileId: profile.id,
      teamId,
      channel: "whatsapp",
      status: "unknown",
      reason: null,
      sourceType: "whatsapp_contact",
      sourceId: conversation.id,
    })

    await cdpRepository.appendEventIfNew({
      profileId: profile.id,
      teamId,
      eventType: "whatsapp.contact_created",
      sourceType: "whatsapp_contact",
      sourceId: conversation.id,
      occurredAt: conversation.createdAt,
    })
  }

  async syncFromWhatsapp(
    teamId: string,
    options?: { since?: Date }
  ): Promise<SyncCounters> {
    const counters = emptyCounters()
    const since =
      options?.since ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const conversations = await whatsAppRepository.listConversationsForTeam(teamId)
    const conversationById = new Map(conversations.map((item) => [item.id, item]))

    for (const conversation of conversations) {
      try {
        await this.syncWhatsappConversationToCdp(teamId, conversation)
        counters.enriched += 1
      } catch (error) {
        counters.errors.push(`conversation:${conversation.id}`)
        console.error("[CustomerDataPlatformService][syncFromWhatsapp] conversation", conversation.id, error)
      }
    }

    const messages = await whatsAppRepository.listMessagesSince({
      teamId,
      since,
    })

    for (const message of messages) {
      const conversation = conversationById.get(message.conversationId)
      if (!conversation) {
        counters.skipped += 1
        continue
      }

      try {
        await this.syncWhatsappMessageToCdp({
          teamId,
          message,
          conversation,
        })
        counters.enriched += 1
      } catch (error) {
        counters.errors.push(`message:${message.id}`)
        console.error("[CustomerDataPlatformService][syncFromWhatsapp] message", message.id, error)
      }
    }

    return counters
  }

  async countSegments(scope: CdpTeamScope): Promise<SegmentCount[]> {
    const profiles = await cdpRepository.listProfilesForSegmentation(scope.teamId)

    const rawLeadStatuses = await cdpRepository.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )
    const leadStatuses = toSegmentLeadStatusMap(rawLeadStatuses)

    const counts: Record<CdpSegmentSlug, number> = {
      email_marketable: 0,
      email_blocked: 0,
      opened_not_clicked: 0,
      clicked_not_closed: 0,
      portfolio_renewal_due: 0,
      inactive_recent_campaign: 0,
    }

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

    for (const profile of profiles) {
      for (const slug of Object.keys(counts) as CdpSegmentSlug[]) {
        if (profileMatchesCdpSegment(profile, slug, leadStatuses, now, recentMs)) {
          counts[slug] += 1
        }
      }
    }

    return (Object.keys(SEGMENT_META) as CdpSegmentSlug[]).map((slug) => ({
      slug,
      ...SEGMENT_META[slug],
      count: counts[slug],
    }))
  }

  async listSegmentProfileIds(scope: CdpTeamScope, segment: CdpSegmentSlug): Promise<string[]> {
    const segments = await this.countSegments(scope)
    if (!segments.find((s) => s.slug === segment)) return []

    const profiles = await cdpRepository.listProfilesForSegmentation(scope.teamId)

    const rawLeadStatuses = await cdpRepository.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )
    const leadStatuses = toSegmentLeadStatusMap(rawLeadStatuses)

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const ids: string[] = []

    for (const profile of profiles) {
      if (profileMatchesCdpSegment(profile, segment, leadStatuses, now, recentMs)) {
        ids.push(profile.id)
      }
    }

    return ids
  }

  async getMetrics(scope: CdpTeamScope) {
    const [totalProfiles, segments] = await Promise.all([
      cdpRepository.countProfiles(scope),
      this.countSegments(scope),
    ])

    const marketable = segments.find((s) => s.slug === "email_marketable")?.count ?? 0
    const blocked = segments.find((s) => s.slug === "email_blocked")?.count ?? 0
    const engaged = segments.find((s) => s.slug === "opened_not_clicked")?.count ?? 0

    return { totalProfiles, marketable, blocked, engaged }
  }

  async handleEmailWebhookEvent(input: {
    teamId: string
    recipientEmail: string
    recipientName?: string | null
    logId: string
    campaignId?: string | null
    eventType: EmailEventType
    occurredAt: Date
    metadata?: Record<string, unknown>
  }) {
    const normalizedEmail = normalizeCdpEmail(input.recipientEmail)
    let profile = await cdpRepository.findProfileByEmail(input.teamId, normalizedEmail)

    if (!profile && input.recipientName) {
      const lead = await cdpRepository.findLeadPhoneByEmail(input.teamId, normalizedEmail)
      if (lead?.phone && isValidCdpPrimaryIdentity(lead.phone, input.recipientName)) {
        profile = await cdpRepository.upsertProfile({
          teamId: input.teamId,
          displayName: input.recipientName.trim(),
          normalizedName: normalizeCdpName(input.recipientName),
          displayPhone: formatDisplayPhone(lead.phone),
          normalizedPhone: normalizeCdpPhone(lead.phone),
          primaryEmail: input.recipientEmail,
          normalizedPrimaryEmail: normalizedEmail,
          lastSeenAt: input.occurredAt,
        })
      }
    }

    if (!profile) return

    const mapped = EMAIL_EVENT_MAP[input.eventType]
    if (!mapped) return

    await cdpRepository.appendEventIfNew({
      profileId: profile.id,
      teamId: input.teamId,
      eventType: mapped,
      sourceType: "email_log",
      sourceId: input.logId,
      occurredAt: input.occurredAt,
      metadata: buildEmailEventMetadata(input.campaignId, input.metadata) as Prisma.InputJsonValue,
    })

    if (input.eventType === "bounced" || input.eventType === "complained" || input.eventType === "unsubscribed") {
      const reason: CustomerConsentReason =
        input.eventType === "bounced"
          ? "bounce"
          : input.eventType === "complained"
            ? "complaint"
            : "unsubscribe"
      await cdpRepository.upsertConsent({
        profileId: profile.id,
        teamId: input.teamId,
        channel: "email",
        status: "blocked",
        reason,
        sourceType: "email_log",
        sourceId: input.logId,
      })
    }
  }

  private isRenewalDue(renewalStatus: RenewalStatus, contractDueDate: Date | null) {
    if (renewalStatus === "renewed" || renewalStatus === "lost") return false
    if (!contractDueDate) return renewalStatus === "to_renew" || renewalStatus === "contacted"

    const windowMs = PORTFOLIO_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const diff = contractDueDate.getTime() - Date.now()
    return diff >= 0 && diff <= windowMs
  }

  async syncProfileDataForTeam(scope: CdpTeamScope) {
    const variables = await cdpRepository.listCdpEmailVariables(scope.teamId)
    if (variables.length === 0) return { updated: 0 }

    const profiles = await cdpRepository.listProfilesForProfileDataSync(scope.teamId)
    const leadIds = profiles
      .map((profile) => getLeadIdFromProfile(profile as CdpResolvableProfile))
      .filter((id): id is string => Boolean(id))
    const leadsById = await cdpRepository.findLeadsForCdpFieldResolution(scope.teamId, leadIds)

    let updated = 0
    for (const profile of profiles) {
      const leadId = getLeadIdFromProfile(profile as CdpResolvableProfile)
      const lead = leadId ? (leadsById.get(leadId) as CdpResolvableLead) : null
      const profileData = buildProfileDataMap(variables, profile as CdpResolvableProfile, lead)
      await cdpRepository.updateProfileData(profile.id, scope.teamId, profileData)
      updated += 1
    }

    return { updated }
  }

  async resolvePrimarySegmentSlug(
    scope: CdpTeamScope,
    profileId: string
  ): Promise<CdpSegmentSlug | null> {
    const profiles = await cdpRepository.listProfilesForSegmentationByIds(scope.teamId, [profileId])
    const profile = profiles[0]
    if (!profile) return null

    const leadStatuses = toSegmentLeadStatusMap(
      await cdpRepository.findLeadStatuses(
      scope.teamId,
      profile.identities.map((identity) => identity.normalizedValue)
    )
    )

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

    for (const slug of CDP_PRIMARY_SEGMENT_PRIORITY) {
      if (profileMatchesCdpSegment(profile, slug, leadStatuses, now, recentMs)) {
        return slug
      }
    }

    return null
  }

  async resolvePrimarySegmentsForProfiles(scope: CdpTeamScope, profileIds: string[]) {
    if (profileIds.length === 0) return new Map<string, CdpSegmentSlug>()

    const profiles = await cdpRepository.listProfilesForSegmentationByIds(scope.teamId, profileIds)
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
    const leadStatuses = toSegmentLeadStatusMap(
      await cdpRepository.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
    )
    )

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const result = new Map<string, CdpSegmentSlug>()

    for (const profileId of profileIds) {
      const profile = profileMap.get(profileId)
      if (!profile) continue

      for (const slug of CDP_PRIMARY_SEGMENT_PRIORITY) {
        if (profileMatchesCdpSegment(profile, slug, leadStatuses, now, recentMs)) {
          result.set(profileId, slug)
          break
        }
      }
    }

    return result
  }

  async previewInterpolation(
    scope: CdpTeamScope,
    profileId: string,
    variableKeys: string[]
  ) {
    const profile = await cdpRepository.getProfileDetailWithCtx(scope, profileId)
    if (!profile) return null

    const variables = await cdpRepository.listCdpEmailVariables(scope.teamId)
    const filtered =
      variableKeys.length > 0
        ? variables.filter((variable) => variableKeys.includes(variable.key))
        : variables

    const leadId = getLeadIdFromProfile(profile as CdpResolvableProfile)
    const leadsById = leadId
      ? await cdpRepository.findLeadsForCdpFieldResolution(scope.teamId, [leadId])
      : new Map()
    const lead = leadId ? ((leadsById.get(leadId) as CdpResolvableLead) ?? null) : null

    return resolveInterpolationValuesForProfile(
      filtered,
      profile as CdpResolvableProfile,
      lead
    )
  }
}

export const customerDataPlatformService = new CustomerDataPlatformService()

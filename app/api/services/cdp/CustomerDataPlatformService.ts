import type {
  CustomerConsentReason,
  CustomerConsentStatus,
  CustomerSourceType,
  EmailEventType,
  LeadStatus,
  Prisma,
  RenewalStatus,
} from "@prisma/client"
import {
  cdpRepository,
  type CdpTeamScope,
} from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import {
  CRM_CLOSED_STATUSES,
  PORTFOLIO_RENEWAL_WINDOW_DAYS,
  RECENT_CAMPAIGN_WINDOW_DAYS,
  type CdpSegmentSlug,
} from "@/lib/cdp/segment-config"
import {
  formatDisplayPhone,
  isValidCdpPrimaryIdentity,
  normalizeCdpDocument,
  normalizeCdpEmail,
  normalizeCdpName,
  normalizeCdpPhone,
} from "@/lib/cdp/normalization"

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
  async syncFromCrm(scope: CdpTeamScope): Promise<SyncCounters> {
    const counters = emptyCounters()
    const leads = await cdpRepository.findLeadsForCdpSync(scope.teamId)

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

  async syncFromPortfolio(scope: CdpTeamScope): Promise<SyncCounters> {
    const counters = emptyCounters()
    const portfolios = await cdpRepository.findPortfoliosForCdpSync(scope.teamId)

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

  async syncFromEmail(scope: CdpTeamScope): Promise<SyncCounters> {
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

    const logs = await cdpRepository.findEmailLogsForCdpSync(scope.teamId)

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
            metadata: event.metadata ?? undefined,
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

  async countSegments(scope: CdpTeamScope): Promise<SegmentCount[]> {
    const profiles = await cdpRepository.listProfilesForSegmentation(scope.teamId)

    const leadStatuses = await cdpRepository.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )

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
      const emailConsent = profile.consents[0]
      const hasEmail = Boolean(profile.normalizedPrimaryEmail)
      const isBlocked = emailConsent?.status === "blocked"
      const isAllowed = hasEmail && (!emailConsent || emailConsent.status === "allowed")

      if (isAllowed) counts.email_marketable += 1
      if (isBlocked) counts.email_blocked += 1

      const emailEvents = profile.events.filter((e) => e.eventType.startsWith("email."))
      const hasOpened = emailEvents.some((e) => e.eventType === "email.opened")
      const hasClicked = emailEvents.some((e) => e.eventType === "email.clicked")
      if (hasOpened && !hasClicked) counts.opened_not_clicked += 1

      const hasPortfolio = profile.sourceLinks.some((l) => l.sourceType === "portfolio")
      const leadId = profile.identities[0]?.normalizedValue
      const leadStatus = leadId ? (leadStatuses.get(leadId) as LeadStatus | undefined) : undefined
      const isClosed =
        hasPortfolio ||
        (leadStatus ? CRM_CLOSED_STATUSES.includes(leadStatus as LeadStatus) : false)
      if (hasClicked && !isClosed) counts.clicked_not_closed += 1

      const renewalDue = profile.events.some((e) => e.eventType === "portfolio.renewal_due")
      if (renewalDue || this.hasPortfolioRenewalLink(profile.sourceLinks)) {
        counts.portfolio_renewal_due += 1
      }

      const recentSent = emailEvents.some(
        (e) => e.eventType === "email.sent" && now - e.occurredAt.getTime() <= recentMs
      )
      if (!recentSent) counts.inactive_recent_campaign += 1
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

    const leadStatuses = await cdpRepository.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const ids: string[] = []

    for (const profile of profiles) {
      if (this.profileMatchesSegment(profile, segment, leadStatuses, now, recentMs)) {
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
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
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

  private profileMatchesSegment(
    profile: {
      id: string
      normalizedPrimaryEmail: string | null
      consents: { status: string }[]
      sourceLinks: { sourceType: CustomerSourceType; sourceMetadata: unknown }[]
      events: { eventType: string; occurredAt: Date }[]
      identities: { normalizedValue: string }[]
    },
    segment: CdpSegmentSlug,
    leadStatuses: Map<string, string>,
    now: number,
    recentMs: number
  ) {
    const emailConsent = profile.consents[0]
    const hasEmail = Boolean(profile.normalizedPrimaryEmail)
    const emailEvents = profile.events.filter((e) => e.eventType.startsWith("email."))
    const hasOpened = emailEvents.some((e) => e.eventType === "email.opened")
    const hasClicked = emailEvents.some((e) => e.eventType === "email.clicked")
    const hasPortfolio = profile.sourceLinks.some((l) => l.sourceType === "portfolio")
    const leadId = profile.identities[0]?.normalizedValue
    const leadStatus = leadId ? (leadStatuses.get(leadId) as LeadStatus | undefined) : undefined
    const isClosed =
      hasPortfolio || (leadStatus ? CRM_CLOSED_STATUSES.includes(leadStatus) : false)
    const recentSent = emailEvents.some(
      (e) => e.eventType === "email.sent" && now - e.occurredAt.getTime() <= recentMs
    )

    switch (segment) {
      case "email_marketable":
        return hasEmail && (!emailConsent || emailConsent.status === "allowed")
      case "email_blocked":
        return emailConsent?.status === "blocked"
      case "opened_not_clicked":
        return hasOpened && !hasClicked
      case "clicked_not_closed":
        return hasClicked && !isClosed
      case "portfolio_renewal_due":
        return (
          profile.events.some((e) => e.eventType === "portfolio.renewal_due") ||
          this.hasPortfolioRenewalLink(profile.sourceLinks)
        )
      case "inactive_recent_campaign":
        return !recentSent
      default:
        return false
    }
  }

  private isRenewalDue(renewalStatus: RenewalStatus, contractDueDate: Date | null) {
    if (renewalStatus === "renewed" || renewalStatus === "lost") return false
    if (!contractDueDate) return renewalStatus === "to_renew" || renewalStatus === "contacted"

    const windowMs = PORTFOLIO_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const diff = contractDueDate.getTime() - Date.now()
    return diff >= 0 && diff <= windowMs
  }

  private hasPortfolioRenewalLink(
    links: { sourceType: CustomerSourceType; sourceMetadata: unknown }[]
  ) {
    return links.some((link) => {
      if (link.sourceType !== "portfolio") return false
      const meta = link.sourceMetadata as { renewalStatus?: string } | null
      return meta?.renewalStatus === "to_renew" || meta?.renewalStatus === "contacted"
    })
  }
}

export const customerDataPlatformService = new CustomerDataPlatformService()

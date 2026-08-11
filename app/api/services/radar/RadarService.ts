import {
  LeadStatus,
  type RadarConsentReason,
  type RadarConsentStatus,
  type EmailEventType,
  type Prisma,
  type RenewalStatus,
} from "@prisma/client"
import {
  RadarRepository,
  radarRepository,
  type RadarTeamScope,
} from "@/app/api/infra/data/repositories/radar/RadarRepository"
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
  type RadarSegmentSlug,
} from "@/lib/radar/segment-config"
import { buildEmailEventMetadata, profileMatchesRadarSegment } from "@/lib/radar/segment-rules"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"
import { RADAR_PRIMARY_SEGMENT_PRIORITY } from "@/lib/radar/field-catalog"
import {
  buildProfileDataMap,
  getLeadIdFromProfile,
  type RadarResolvableLead,
  type RadarResolvableProfile,
} from "@/lib/radar/resolve-field-value"
import { resolveInterpolationValuesForProfile } from "@/lib/radar/resolve-recipient-interpolation"
import { resolveGenderUpdateFromEmailContact } from "@/lib/radar/email-contact-gender"
import type { RadarGender, RadarGenderSource } from "@/lib/radar/gender"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { resolveLeadStatusMilestoneEventType } from "@/lib/radar/lead-milestone-map"
import {
  formatDisplayPhone,
  isValidRadarPrimaryIdentity,
  normalizeRadarDocument,
  normalizeRadarEmail,
  normalizeRadarName,
  normalizeRadarPhone,
} from "@/lib/radar/normalization"

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
  /**
   * Leads sem telefone válido mas com e-mail para o qual ainda não existe
   * perfil Radar — o perfil segue exigindo telefone para nascer (D8), então
   * esses leads não geram perfil nem identidade; ficam "adiados" até que um
   * perfil com aquele e-mail exista (via outra fonte) ou o lead ganhe telefone.
   */
  deferred: number
  errors: string[]
}

export type SegmentCount = {
  slug: RadarSegmentSlug
  name: string
  description: string
  count: number
}

const SEGMENT_META: Record<RadarSegmentSlug, { name: string; description: string }> = {
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
  engaged_no_lead: {
    name: "Engajados sem Lead",
    description: "Interagiram por e-mail ou formulário sem lead vinculado no CRM",
  },
  portfolio_renewal_due: {
    name: "Carteira próxima de renovação",
    description: "Clientes com renovação nos próximos 60 dias",
  },
  inactive_recent_campaign: {
    name: "Sem campanha recente",
    description: "Sem envio de campanha nos últimos 60 dias",
  },
  portfolio_clients: {
    name: "Carteira",
    description: "Perfis vinculados à carteira de clientes",
  },
  crm_clients: {
    name: "CRM",
    description: "Perfis com identidade de lead no CRM",
  },
}

function emptyCounters(): SyncCounters {
  return { created: 0, enriched: 0, skipped: 0, deferred: 0, errors: [] }
}

function consentFromEmailFlags(flags: {
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
}): { status: RadarConsentStatus; reason: RadarConsentReason | null } {
  if (flags.isComplained) return { status: "blocked", reason: "complaint" }
  if (flags.isBounced) return { status: "blocked", reason: "bounce" }
  if (flags.isUnsubscribed) return { status: "blocked", reason: "unsubscribe" }
  return { status: "allowed", reason: "imported" }
}

export class RadarService {
  constructor(private readonly repo: RadarRepository = radarRepository) {}
  /**
   * D5 (fix review PR #561): compartilhado pelos 2 caminhos de `syncFromCrm`
   * (lead com telefone válido e lead só-com-e-mail que já tem perfil via
   * identidade) — antes só o caminho com telefone emitia `lead.status_changed`
   * e o marco de status; o caminho só-com-e-mail dava `continue` antes de
   * chegar lá, então mudanças de status de leads só-com-e-mail nunca geravam
   * marco nenhum.
   */
  private async appendLeadStatusEvents(
    scope: RadarTeamScope,
    profileId: string,
    lead: { id: string; status: LeadStatus | null; statusEnteredAt: Date; createdAt: Date }
  ): Promise<void> {
    if (!lead.status) return

    await this.repo.appendEventIfNew({
      profileId,
      teamId: scope.teamId,
      eventType: "lead.status_changed",
      sourceType: "crm_lead",
      sourceId: `${lead.id}:${lead.status}`,
      occurredAt: lead.statusEnteredAt,
      metadata: { status: lead.status },
    })

    // E2: milestone new_opportunity só em transição real (não no nascimento).
    const milestoneEventType = resolveLeadStatusMilestoneEventType(
      lead.status,
      lead.createdAt,
      lead.statusEnteredAt
    )
    if (milestoneEventType) {
      const bornInNewOpportunity =
        lead.status === LeadStatus.new_opportunity &&
        lead.createdAt.getTime() === lead.statusEnteredAt.getTime()
      if (!bornInNewOpportunity) {
        await this.repo.appendEventIfNew({
          profileId,
          teamId: scope.teamId,
          eventType: milestoneEventType,
          sourceType: "crm_lead",
          sourceId: `${lead.id}:${lead.status}:milestone`,
          occurredAt: lead.statusEnteredAt,
          metadata: { status: lead.status },
        })
      }
    }
  }

  async syncFromCrm(scope: RadarTeamScope, filters: RadarSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const leads = await this.repo.findLeadsForRadarSync(scope.teamId, filters)

    for (const lead of leads) {
      try {
        if (!isValidRadarPrimaryIdentity(lead.phone, lead.name)) {
          const normalizedEmail = lead.email ? normalizeRadarEmail(lead.email) : null
          if (!normalizedEmail) {
            counters.skipped += 1
            continue
          }

          // Lead só-com-e-mail: o perfil segue exigindo telefone para nascer
          // (D8). Resolve o dono pela identidade email (chave única
          // [teamId, type, normalizedValue]), não por RadarProfile.
          // normalizedPrimaryEmail — esse campo não é único, então dois
          // perfis podem compartilhar o mesmo e-mail e um findFirst
          // arbitrário poderia anexar o lead ao perfil errado. Sem uma
          // identidade email inequívoca, o lead fica "adiado" (nunca
          // adivinha um perfil ambíguo).
          const existingByEmailIdentity = await this.repo.findProfileByIdentity(
            scope.teamId,
            "email",
            normalizedEmail
          )
          if (!existingByEmailIdentity) {
            counters.deferred += 1
            continue
          }

          await this.repo.upsertIdentity({
            profileId: existingByEmailIdentity.profileId,
            teamId: scope.teamId,
            type: "lead_id",
            value: lead.id,
            normalizedValue: lead.id,
            source: "crm",
          })

          await this.repo.upsertSourceLink({
            profileId: existingByEmailIdentity.profileId,
            teamId: scope.teamId,
            sourceType: "crm_lead",
            sourceId: lead.id,
            sourceMetadata: { status: lead.status },
          })

          await this.repo.appendEventIfNew({
            profileId: existingByEmailIdentity.profileId,
            teamId: scope.teamId,
            eventType: "lead.created",
            sourceType: "crm_lead",
            sourceId: lead.id,
            occurredAt: lead.createdAt,
          })

          await this.appendLeadStatusEvents(scope, existingByEmailIdentity.profileId, lead)

          counters.enriched += 1
          continue
        }

        const normalizedPhone = normalizeRadarPhone(lead.phone)
        const normalizedName = normalizeRadarName(lead.name)
        const normalizedEmail = lead.email ? normalizeRadarEmail(lead.email) : null
        const normalizedDocument = lead.cnpj ? normalizeRadarDocument(lead.cnpj) : null

        const { profile, wasExisting } = await this.repo.resolveProfileForPhone({
          teamId: scope.teamId,
          displayName: lead.name.trim(),
          normalizedName,
          displayPhone: formatDisplayPhone(lead.phone),
          normalizedPhone,
          phoneValue: lead.phone,
          phoneSource: "crm",
          primaryEmail: lead.email,
          normalizedPrimaryEmail: normalizedEmail,
          primaryDocument: lead.cnpj,
          normalizedPrimaryDocument: normalizedDocument,
          lastSeenAt: lead.updatedAt,
        })

        if (wasExisting) counters.enriched += 1
        else counters.created += 1

        if (normalizedEmail) {
          await this.repo.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "email",
            value: lead.email,
            normalizedValue: normalizedEmail,
            source: "crm",
          })
        }

        if (normalizedDocument) {
          await this.repo.upsertIdentity({
            profileId: profile.id,
            teamId: scope.teamId,
            type: "document",
            value: lead.cnpj,
            normalizedValue: normalizedDocument,
            source: "crm",
          })
        }

        await this.repo.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "lead_id",
          value: lead.id,
          normalizedValue: lead.id,
          source: "crm",
        })

        await this.repo.upsertSourceLink({
          profileId: profile.id,
          teamId: scope.teamId,
          sourceType: "crm_lead",
          sourceId: lead.id,
          sourceMetadata: { status: lead.status },
        })

        await this.repo.appendEventIfNew({
          profileId: profile.id,
          teamId: scope.teamId,
          eventType: "lead.created",
          sourceType: "crm_lead",
          sourceId: lead.id,
          occurredAt: lead.createdAt,
        })

        await this.appendLeadStatusEvents(scope, profile.id, lead)
      } catch (error) {
        counters.errors.push(`lead:${lead.id}`)
        console.error("[RadarService][syncFromCrm]", lead.id, error)
      }
    }

    return counters
  }

  async syncFromPortfolio(scope: RadarTeamScope, filters: RadarSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const portfolios = await this.repo.findPortfoliosForRadarSync(scope.teamId, filters)

    for (const entry of portfolios) {
      try {
        const lead = entry.lead
        if (!isValidRadarPrimaryIdentity(lead.phone, lead.name)) {
          counters.skipped += 1
          continue
        }

        const normalizedPhone = normalizeRadarPhone(lead.phone)
        const normalizedName = normalizeRadarName(lead.name)

        const { profile, wasExisting } = await this.repo.resolveProfileForPhone({
          teamId: scope.teamId,
          displayName: lead.name.trim(),
          normalizedName,
          displayPhone: formatDisplayPhone(lead.phone),
          normalizedPhone,
          phoneValue: lead.phone,
          phoneSource: "portfolio",
          primaryEmail: lead.email,
          normalizedPrimaryEmail: lead.email ? normalizeRadarEmail(lead.email) : null,
          primaryDocument: lead.cnpj,
          normalizedPrimaryDocument: lead.cnpj ? normalizeRadarDocument(lead.cnpj) : null,
          lastSeenAt: entry.updatedAt,
        })

        if (wasExisting) counters.enriched += 1
        else counters.created += 1

        await this.repo.upsertSourceLink({
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

        await this.repo.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "portfolio_id",
          value: entry.id,
          normalizedValue: entry.id,
          source: "portfolio",
        })

        // D13: clientes criados só na carteira não passam pelo sync CRM;
        // anexar lead_id aqui habilita portfolio_field + aba Contratos.
        await this.repo.upsertIdentity({
          profileId: profile.id,
          teamId: scope.teamId,
          type: "lead_id",
          value: lead.id,
          normalizedValue: lead.id,
          source: "portfolio",
        })

        await this.repo.appendEventIfNew({
          profileId: profile.id,
          teamId: scope.teamId,
          eventType: "portfolio.created",
          sourceType: "portfolio",
          sourceId: entry.id,
          occurredAt: entry.createdAt,
        })

        if (this.isRenewalDue(entry.renewalStatus, lead.contractDueDate)) {
          await this.repo.appendEventIfNew({
            profileId: profile.id,
            teamId: scope.teamId,
            eventType: "portfolio.renewal_due",
            sourceType: "portfolio",
            sourceId: `${entry.id}:renewal`,
            occurredAt: entry.updatedAt,
            metadata: { renewalStatus: entry.renewalStatus },
          })
        }

        if (entry.renewalStatus === "renewed") {
          const alreadyRenewed = await this.repo.hasEventEverOccurredForSource(
            scope.teamId,
            "portfolio",
            `${entry.id}:renewed`,
            "portfolio.renewed"
          )
          if (!alreadyRenewed) {
            await this.repo.appendEventIfNew({
              profileId: profile.id,
              teamId: scope.teamId,
              eventType: "portfolio.renewed",
              sourceType: "portfolio",
              sourceId: `${entry.id}:renewed`,
              occurredAt: entry.updatedAt,
              metadata: { renewalStatus: entry.renewalStatus },
            })
          }
        }

        if (entry.source === "brokerage_transfer") {
          const alreadyTransferred = await this.repo.hasEventEverOccurredForSource(
            scope.teamId,
            "portfolio",
            `${entry.id}:brokerage_transfer`,
            "portfolio.brokerage_transfer"
          )
          if (!alreadyTransferred) {
            await this.repo.appendEventIfNew({
              profileId: profile.id,
              teamId: scope.teamId,
              eventType: "portfolio.brokerage_transfer",
              sourceType: "portfolio",
              sourceId: `${entry.id}:brokerage_transfer`,
              occurredAt: entry.updatedAt,
              metadata: { source: entry.source },
            })
          }
        }
      } catch (error) {
        counters.errors.push(`portfolio:${entry.id}`)
        console.error("[RadarService][syncFromPortfolio]", entry.id, error)
      }
    }

    return counters
  }

  async syncFromFinalized(scope: RadarTeamScope, filters: RadarSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()
    const finalizedRows = await this.repo.findFinalizedForRadarSync(scope.teamId, filters)

    for (const entry of finalizedRows) {
      try {
        if (entry.holder) {
          // Corporativo: finalize exige CNPJ e permite document (CPF) vazio.
          const holderDocument = entry.holder.document?.trim() || entry.holder.cnpj?.trim() || null
          const synced = await this.syncContractPartyToRadar({
            scope,
            identityType: "contract_holder",
            partyId: entry.holder.id,
            name: entry.holder.name,
            document: holderDocument,
            birthDate: entry.holder.birthDate,
            finalizedId: entry.id,
            leadId: entry.leadId,
            lastSeenAt: entry.updatedAt,
            role: "holder",
          })
          if (synced === "skipped") counters.skipped += 1
          else if (synced === "created") counters.created += 1
          else counters.enriched += 1
        }

        for (const dependent of entry.dependents) {
          const synced = await this.syncContractPartyToRadar({
            scope,
            identityType: "contract_dependent",
            partyId: dependent.id,
            name: dependent.name,
            document: dependent.document,
            birthDate: dependent.birthDate,
            finalizedId: entry.id,
            leadId: entry.leadId,
            lastSeenAt: entry.updatedAt,
            role: "dependent",
            parentesco: dependent.parentesco,
          })
          if (synced === "skipped") counters.skipped += 1
          else if (synced === "created") counters.created += 1
          else counters.enriched += 1
        }
      } catch (error) {
        counters.errors.push(`finalized:${entry.id}`)
        console.error("[RadarService][syncFromFinalized]", entry.id, error)
      }
    }

    return counters
  }

  /**
   * D14: perfil Radar para titular/dependente de contrato, chaveado por documento.
   * Dependente sem `document` não gera perfil (retorna "skipped").
   */
  private async syncContractPartyToRadar(input: {
    scope: RadarTeamScope
    identityType: "contract_holder" | "contract_dependent"
    partyId: string
    name: string
    document: string | null | undefined
    birthDate: Date
    finalizedId: string
    leadId: string
    lastSeenAt: Date
    role: "holder" | "dependent"
    parentesco?: string
  }): Promise<"created" | "enriched" | "skipped"> {
    const normalizedDocument = normalizeRadarDocument(input.document)
    const displayName = input.name.trim()
    const normalizedName = normalizeRadarName(displayName)

    const existingLink = await this.repo.findSourceLinkBySource({
      teamId: input.scope.teamId,
      sourceType: "lead_finalized",
      sourceId: input.partyId,
    })

    // Documento/nome limpos no portfólio: remove source link + identidade
    // obsoleta para o party não permanecer pesquisável/segmentável.
    if (!normalizedDocument || !normalizedName) {
      if (existingLink) {
        await this.repo.deleteSourceLinkById(existingLink.id)
        await this.repo.removeObsoleteContractIdentity({
          teamId: input.scope.teamId,
          profileId: existingLink.profileId,
          identityType: input.identityType,
          keepNormalizedDocument: null,
        })
        await this.repo.deleteOrphanRadarProfileIfEmpty({
          teamId: input.scope.teamId,
          profileId: existingLink.profileId,
        })
      }
      return "skipped"
    }

    const { profile, wasExisting } = await this.repo.resolveProfileForDocument({
      teamId: input.scope.teamId,
      identityType: input.identityType,
      normalizedDocument,
      documentValue: input.document!.trim(),
      displayName,
      normalizedName,
      documentSource: "lead_finalized",
      lastSeenAt: input.lastSeenAt,
    })

    // Documento corrigido: o source link aponta ao perfil antigo com a identidade
    // obsoleta — remove-a antes de mover o link para o perfil do novo documento.
    const obsoleteProfileId =
      existingLink && existingLink.profileId !== profile.id ? existingLink.profileId : null

    if (obsoleteProfileId) {
      await this.repo.removeObsoleteContractIdentity({
        teamId: input.scope.teamId,
        profileId: obsoleteProfileId,
        identityType: input.identityType,
        keepNormalizedDocument: normalizedDocument,
      })
    }

    await this.repo.upsertIdentity({
      profileId: profile.id,
      teamId: input.scope.teamId,
      type: input.identityType,
      value: input.document!.trim(),
      normalizedValue: normalizedDocument,
      source: "lead_finalized",
      isPrimary: true,
    })

    await this.repo.upsertSourceLink({
      profileId: profile.id,
      teamId: input.scope.teamId,
      sourceType: "lead_finalized",
      sourceId: input.partyId,
      sourceMetadata: {
        role: input.role,
        finalizedId: input.finalizedId,
        leadId: input.leadId,
        birthDate: input.birthDate.toISOString(),
        ...(input.parentesco ? { parentesco: input.parentesco } : {}),
      },
    })

    await this.repo.appendEventIfNew({
      profileId: profile.id,
      teamId: input.scope.teamId,
      eventType:
        input.role === "holder" ? "contract.holder_linked" : "contract.dependent_linked",
      sourceType: "lead_finalized",
      sourceId: input.partyId,
      occurredAt: input.lastSeenAt,
      metadata: {
        finalizedId: input.finalizedId,
        leadId: input.leadId,
      },
    })

    // Após mover o source link, remove o perfil antigo se ficou sem identidades/links.
    if (obsoleteProfileId) {
      await this.repo.deleteOrphanRadarProfileIfEmpty({
        teamId: input.scope.teamId,
        profileId: obsoleteProfileId,
      })
    }

    return wasExisting ? "enriched" : "created"
  }

  private async processEmailContactForRadar(
    scope: RadarTeamScope,
    contact: {
      id: string
      email: string
      name: string | null
      isUnsubscribed: boolean
      isBounced: boolean
      isComplained: boolean
      updatedAt: Date
      customFields: Prisma.JsonValue
    },
    counters: SyncCounters
  ): Promise<void> {
    try {
      const normalizedEmail = normalizeRadarEmail(contact.email)

      const phoneFromCustom = contact.name
        ? await this.repo.findLeadPhoneByEmail(scope.teamId, normalizedEmail)
        : null
      const hasValidPhone = Boolean(
        contact.name && phoneFromCustom && isValidRadarPrimaryIdentity(phoneFromCustom.phone, contact.name)
      )

      const resolved = hasValidPhone
        ? await this.repo.resolveProfileForPhone({
            teamId: scope.teamId,
            normalizedPhone: normalizeRadarPhone(phoneFromCustom!.phone),
            normalizedName: normalizeRadarName(contact.name!),
            displayName: contact.name!.trim(),
            displayPhone: formatDisplayPhone(phoneFromCustom!.phone),
            phoneValue: phoneFromCustom!.phone,
            phoneSource: "email",
            primaryEmail: contact.email,
            normalizedPrimaryEmail: normalizedEmail,
            lastSeenAt: contact.updatedAt,
          })
        : await this.repo.resolveProfileForEmail({
            teamId: scope.teamId,
            normalizedEmail,
            emailValue: contact.email,
            displayName: contact.name?.trim() ?? null,
            normalizedName: contact.name ? normalizeRadarName(contact.name) : null,
            emailSource: "email_contact",
            lastSeenAt: contact.updatedAt,
          })

      const profile = resolved.profile
      if (resolved.wasExisting) counters.enriched += 1
      else counters.created += 1

      await this.repo.upsertIdentity({
        profileId: profile.id,
        teamId: scope.teamId,
        type: "email",
        value: contact.email,
        normalizedValue: normalizedEmail,
        source: "email",
      })

      await this.repo.upsertIdentity({
        profileId: profile.id,
        teamId: scope.teamId,
        type: "email_contact_id",
        value: contact.id,
        normalizedValue: contact.id,
        source: "email",
      })

      await this.repo.upsertSourceLink({
        profileId: profile.id,
        teamId: scope.teamId,
        sourceType: "email_contact",
        sourceId: contact.id,
        sourceMetadata: (contact.customFields as Prisma.InputJsonValue | null) ?? undefined,
      })

      const consent = consentFromEmailFlags(contact)
      await this.repo.upsertConsent({
        profileId: profile.id,
        teamId: scope.teamId,
        channel: "email",
        status: consent.status,
        reason: consent.reason,
        sourceType: "email_contact",
        sourceId: contact.id,
      })

      const genderUpdate = resolveGenderUpdateFromEmailContact(
        {
          gender: (profile.gender as RadarGender | null) ?? null,
          genderSource: (profile.genderSource as RadarGenderSource | null) ?? null,
        },
        contact.customFields
      )
      if (
        genderUpdate &&
        (genderUpdate.gender === "male" || genderUpdate.gender === "female") &&
        (genderUpdate.genderSource === "mapped" || genderUpdate.genderSource === "inferred")
      ) {
        await this.repo.updateProfileGender(
          profile.id,
          scope.teamId,
          genderUpdate.gender,
          genderUpdate.genderSource
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      counters.errors.push(`contact:${contact.id}:${message}`)
      console.error(
        `[RadarService][syncFromEmail] contact ${contact.id} error=${message}`,
        error
      )
    }
  }

  async syncFromEmail(scope: RadarTeamScope, filters: RadarSyncFilters = {}): Promise<SyncCounters> {
    const counters = emptyCounters()

    if (filters.emailContactId) {
      const contact = await this.repo.findEmailContactById(filters.emailContactId)
      if (contact && contact.list.teamId === scope.teamId) {
        await this.processEmailContactForRadar(scope, contact, counters)
      }
      return counters
    }

    const lists = await this.repo.findEmailContactLists(scope.teamId)

    for (const list of lists) {
      const contacts = await this.repo.findEmailContacts(list.id)

      for (const contact of contacts) {
        await this.processEmailContactForRadar(scope, contact, counters)
      }
    }

    const logs = await this.repo.findEmailLogsForRadarSync(scope.teamId, filters)

    for (const log of logs) {
      try {
        const normalizedEmail = normalizeRadarEmail(log.recipientEmail)
        const profile = await this.repo.findProfileByEmail(scope.teamId, normalizedEmail)
        if (!profile) continue

        for (const event of log.events) {
          const eventType = EMAIL_EVENT_MAP[event.type]
          if (!eventType) continue

          await this.repo.appendEventIfNew({
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
            const reason: RadarConsentReason =
              event.type === "bounced" ? "bounce" : event.type === "complained" ? "complaint" : "unsubscribe"
            await this.repo.upsertConsent({
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
        console.error("[RadarService][syncFromEmail] log", log.id, error)
      }
    }

    return counters
  }

  async syncWhatsappMessageToRadar(input: {
    teamId: string
    message: WhatsAppMessageSelect
    conversation: WhatsAppConversationSelect
  }): Promise<void> {
    const displayName = input.conversation.contactName ?? input.conversation.contactPhone
    if (!isValidRadarPrimaryIdentity(input.conversation.contactPhone, displayName)) return

    const normalizedPhone = normalizeRadarPhone(input.conversation.contactPhone)
    const normalizedName = normalizeRadarName(displayName)

    const { profile } = await this.repo.resolveProfileForPhone({
      teamId: input.teamId,
      displayName: displayName.trim(),
      normalizedName,
      displayPhone: formatDisplayPhone(input.conversation.contactPhone),
      normalizedPhone,
      phoneValue: input.conversation.contactPhone,
      phoneSource: "whatsapp",
      lastSeenAt: input.message.sentAt ?? input.message.createdAt,
    })

    await this.repo.upsertIdentity({
      profileId: profile.id,
      teamId: input.teamId,
      type: "whatsapp_contact_id",
      value: input.conversation.id,
      normalizedValue: input.conversation.id,
      source: "whatsapp",
    })

    await this.repo.upsertSourceLink({
      profileId: profile.id,
      teamId: input.teamId,
      sourceType: "whatsapp_contact",
      sourceId: input.conversation.id,
    })

    await this.repo.upsertConsent({
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

    await this.repo.appendEventIfNew({
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

  async syncWhatsappConversationToRadar(
    teamId: string,
    conversation: WhatsAppConversationSelect
  ): Promise<void> {
    const displayName = conversation.contactName ?? conversation.contactPhone
    if (!isValidRadarPrimaryIdentity(conversation.contactPhone, displayName)) return

    const normalizedPhone = normalizeRadarPhone(conversation.contactPhone)
    const normalizedName = normalizeRadarName(displayName)

    const { profile } = await this.repo.resolveProfileForPhone({
      teamId,
      displayName: displayName.trim(),
      normalizedName,
      displayPhone: formatDisplayPhone(conversation.contactPhone),
      normalizedPhone,
      phoneValue: conversation.contactPhone,
      phoneSource: "whatsapp",
      lastSeenAt: conversation.lastMessageAt ?? conversation.updatedAt,
    })

    await this.repo.upsertIdentity({
      profileId: profile.id,
      teamId,
      type: "whatsapp_contact_id",
      value: conversation.id,
      normalizedValue: conversation.id,
      source: "whatsapp",
    })

    await this.repo.upsertSourceLink({
      profileId: profile.id,
      teamId,
      sourceType: "whatsapp_contact",
      sourceId: conversation.id,
    })

    await this.repo.upsertConsent({
      profileId: profile.id,
      teamId,
      channel: "whatsapp",
      status: "unknown",
      reason: null,
      sourceType: "whatsapp_contact",
      sourceId: conversation.id,
    })

    await this.repo.appendEventIfNew({
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
        await this.syncWhatsappConversationToRadar(teamId, conversation)
        counters.enriched += 1
      } catch (error) {
        counters.errors.push(`conversation:${conversation.id}`)
        console.error("[RadarService][syncFromWhatsapp] conversation", conversation.id, error)
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
        await this.syncWhatsappMessageToRadar({
          teamId,
          message,
          conversation,
        })
        counters.enriched += 1
      } catch (error) {
        counters.errors.push(`message:${message.id}`)
        console.error("[RadarService][syncFromWhatsapp] message", message.id, error)
      }
    }

    return counters
  }

  async countSegments(scope: RadarTeamScope): Promise<SegmentCount[]> {
    // Fase 2: usa agregação SQL em vez de varredura em memória
    const sqlCounts = await this.repo.countFixedSegmentsSQL(
      scope.teamId,
      RECENT_CAMPAIGN_WINDOW_DAYS
    )

    return (Object.keys(SEGMENT_META) as RadarSegmentSlug[]).map((slug) => ({
      slug,
      ...SEGMENT_META[slug],
      count: sqlCounts.get(slug) ?? 0,
    }))
  }

  /**
   * Contagem legada em memória — mantida temporariamente para validação
   * comparativa. Remove após validar equivalência dos números em produção.
   */
  async countSegmentsLegacy(scope: RadarTeamScope): Promise<SegmentCount[]> {
    const profiles = await this.repo.listProfilesForSegmentation(scope.teamId)

    const rawLeadStatuses = await this.repo.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )
    const leadStatuses = toSegmentLeadStatusMap(rawLeadStatuses)

    const counts: Record<RadarSegmentSlug, number> = {
      email_marketable: 0,
      email_blocked: 0,
      opened_not_clicked: 0,
      clicked_not_closed: 0,
      engaged_no_lead: 0,
      portfolio_renewal_due: 0,
      inactive_recent_campaign: 0,
      portfolio_clients: 0,
      crm_clients: 0,
    }

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

    for (const profile of profiles) {
      for (const slug of Object.keys(counts) as RadarSegmentSlug[]) {
        if (profileMatchesRadarSegment(profile, slug, leadStatuses, now, recentMs)) {
          counts[slug] += 1
        }
      }
    }

    return (Object.keys(SEGMENT_META) as RadarSegmentSlug[]).map((slug) => ({
      slug,
      ...SEGMENT_META[slug],
      count: counts[slug],
    }))
  }

  async listSegmentProfileIds(scope: RadarTeamScope, segment: RadarSegmentSlug): Promise<string[]> {
    const segments = await this.countSegments(scope)
    if (!segments.find((s) => s.slug === segment)) return []

    const profiles = await this.repo.listProfilesForSegmentation(scope.teamId)

    const rawLeadStatuses = await this.repo.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((p) => p.identities.map((i) => i.normalizedValue))
    )
    const leadStatuses = toSegmentLeadStatusMap(rawLeadStatuses)

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const ids: string[] = []

    for (const profile of profiles) {
      if (profileMatchesRadarSegment(profile, segment, leadStatuses, now, recentMs)) {
        ids.push(profile.id)
      }
    }

    return ids
  }

  async listCampaignSegmentProfileIds(scope: RadarTeamScope, campaignId: string): Promise<string[]> {
    return this.repo.findProfileIdsByEmailCampaign(scope.teamId, campaignId)
  }

  async getMetrics(scope: RadarTeamScope, precomputedSegments?: SegmentCount[]) {
    const [totalProfiles, segments] = await Promise.all([
      this.repo.countProfiles(scope),
      precomputedSegments ? Promise.resolve(precomputedSegments) : this.countSegments(scope),
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
    if (!(await teamHasRadarFeature(input.teamId))) return

    const normalizedEmail = normalizeRadarEmail(input.recipientEmail)

    const lead = input.recipientName
      ? await this.repo.findLeadPhoneByEmail(input.teamId, normalizedEmail)
      : null
    const hasValidPhone = Boolean(
      input.recipientName && lead?.phone && isValidRadarPrimaryIdentity(lead.phone, input.recipientName)
    )

    const resolved = hasValidPhone
      ? await this.repo.resolveProfileForPhone({
          teamId: input.teamId,
          normalizedPhone: normalizeRadarPhone(lead!.phone),
          normalizedName: normalizeRadarName(input.recipientName!),
          displayName: input.recipientName!.trim(),
          displayPhone: formatDisplayPhone(lead!.phone),
          phoneValue: lead!.phone,
          phoneSource: "email",
          primaryEmail: input.recipientEmail,
          normalizedPrimaryEmail: normalizedEmail,
          lastSeenAt: input.occurredAt,
        })
      : await this.repo.resolveProfileForEmail({
          teamId: input.teamId,
          normalizedEmail,
          emailValue: input.recipientEmail,
          displayName: input.recipientName?.trim() ?? null,
          normalizedName: input.recipientName ? normalizeRadarName(input.recipientName) : null,
          emailSource: "email_log",
          lastSeenAt: input.occurredAt,
        })

    const profile = resolved.profile

    const mapped = EMAIL_EVENT_MAP[input.eventType]
    if (!mapped) return

    await this.repo.appendEventIfNew({
      profileId: profile.id,
      teamId: input.teamId,
      eventType: mapped,
      sourceType: "email_log",
      sourceId: input.logId,
      occurredAt: input.occurredAt,
      metadata: buildEmailEventMetadata(input.campaignId, input.metadata) as Prisma.InputJsonValue,
    })

    if (input.eventType === "bounced" || input.eventType === "complained" || input.eventType === "unsubscribed") {
      const reason: RadarConsentReason =
        input.eventType === "bounced"
          ? "bounce"
          : input.eventType === "complained"
            ? "complaint"
            : "unsubscribe"
      await this.repo.upsertConsent({
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

  async syncProfileDataForTeam(scope: RadarTeamScope) {
    const variables = await this.repo.listRadarEmailVariables(scope.teamId)
    if (variables.length === 0) return { updated: 0 }

    const profiles = await this.repo.listProfilesForProfileDataSync(scope.teamId)
    const leadIds = profiles
      .map((profile) => getLeadIdFromProfile(profile as RadarResolvableProfile))
      .filter((id): id is string => Boolean(id))
    const leadsById = await this.repo.findLeadsForRadarFieldResolution(scope.teamId, leadIds)

    let updated = 0
    for (const profile of profiles) {
      const leadId = getLeadIdFromProfile(profile as RadarResolvableProfile)
      const lead = leadId ? (leadsById.get(leadId) as RadarResolvableLead) : null
      const profileData = buildProfileDataMap(variables, profile as RadarResolvableProfile, lead)
      await this.repo.updateProfileData(profile.id, scope.teamId, profileData)
      updated += 1
    }

    return { updated }
  }

  async resolvePrimarySegmentSlug(
    scope: RadarTeamScope,
    profileId: string
  ): Promise<RadarSegmentSlug | null> {
    const profiles = await this.repo.listProfilesForSegmentationByIds(scope.teamId, [profileId])
    const profile = profiles[0]
    if (!profile) return null

    const leadStatuses = toSegmentLeadStatusMap(
      await this.repo.findLeadStatuses(
      scope.teamId,
      profile.identities.map((identity) => identity.normalizedValue)
    )
    )

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

    for (const slug of RADAR_PRIMARY_SEGMENT_PRIORITY) {
      if (profileMatchesRadarSegment(profile, slug, leadStatuses, now, recentMs)) {
        return slug
      }
    }

    return null
  }

  async resolvePrimarySegmentsForProfiles(scope: RadarTeamScope, profileIds: string[]) {
    if (profileIds.length === 0) return new Map<string, RadarSegmentSlug>()

    const profiles = await this.repo.listProfilesForSegmentationByIds(scope.teamId, profileIds)
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
    const leadStatuses = toSegmentLeadStatusMap(
      await this.repo.findLeadStatuses(
      scope.teamId,
      profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
    )
    )

    const now = Date.now()
    const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const result = new Map<string, RadarSegmentSlug>()

    for (const profileId of profileIds) {
      const profile = profileMap.get(profileId)
      if (!profile) continue

      for (const slug of RADAR_PRIMARY_SEGMENT_PRIORITY) {
        if (profileMatchesRadarSegment(profile, slug, leadStatuses, now, recentMs)) {
          result.set(profileId, slug)
          break
        }
      }
    }

    return result
  }

  async previewInterpolation(
    scope: RadarTeamScope,
    profileId: string,
    variableKeys: string[]
  ) {
    const profile = await this.repo.getProfileDetailWithCtx(scope, profileId)
    if (!profile) return null

    const variables = await this.repo.listRadarEmailVariables(scope.teamId)
    const filtered =
      variableKeys.length > 0
        ? variables.filter((variable) => variableKeys.includes(variable.key))
        : variables

    const leadId = getLeadIdFromProfile(profile as RadarResolvableProfile)
    const leadsById = leadId
      ? await this.repo.findLeadsForRadarFieldResolution(scope.teamId, [leadId])
      : new Map()
    const lead = leadId ? ((leadsById.get(leadId) as RadarResolvableLead) ?? null) : null

    return resolveInterpolationValuesForProfile(
      filtered,
      profile as RadarResolvableProfile,
      lead
    )
  }
}

export const radarService = new RadarService()

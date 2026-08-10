import type {
  RadarChannel,
  RadarConsentReason,
  RadarConsentStatus,
  RadarIdentityType,
  RadarSourceType,
  LeadStatus,
  Prisma,
} from "@prisma/client"
import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma"
import type { PrismaClient } from "@prisma/client"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"
import { RADAR_EXPORT_MAX_ROWS } from "@/lib/radar/exportRadarProfiles"
import {
  DEFAULT_ENGAGEMENT_CONFIG,
  DEFAULT_FORM_ENGAGEMENT_SCORE_RULES,
  computeEngagementScore,
  rankTopEngagementEvents,
  type EngagementBand,
  type EngagementConfig,
  type FormEngagementScoreRule,
  type WeightMap,
} from "@/lib/radar/engagement-score"

const ENGAGEMENT_CACHE_TTL_MS = 5 * 60 * 1000

type EngagementWeightsConfigCache = {
  weights: WeightMap
  config: EngagementConfig
  formRules: FormEngagementScoreRule[]
  expiresAt: number
}

let engagementWeightsConfigCache: EngagementWeightsConfigCache | null = null

export type RadarTeamScope = {
  teamId: string
  ctx: TeamContext
}

export type UpsertProfileInput = {
  teamId: string
  displayName: string
  normalizedName: string
  displayPhone: string
  normalizedPhone: string
  primaryEmail?: string | null
  normalizedPrimaryEmail?: string | null
  primaryDocument?: string | null
  normalizedPrimaryDocument?: string | null
  lastSeenAt?: Date
}

export type UpsertIdentityInput = {
  profileId: string
  teamId: string
  type: RadarIdentityType
  value?: string | null
  normalizedValue: string
  source: string
  isPrimary?: boolean
}

export type UpsertSourceLinkInput = {
  profileId: string
  teamId: string
  sourceType: RadarSourceType
  sourceId: string
  sourceMetadata?: Prisma.InputJsonValue
}

export type AppendEventInput = {
  profileId: string
  teamId: string
  eventType: string
  sourceType: string
  sourceId?: string | null
  occurredAt: Date
  metadata?: Prisma.InputJsonValue
}

export type UpsertConsentInput = {
  profileId: string
  teamId: string
  channel: RadarChannel
  status: RadarConsentStatus
  reason?: RadarConsentReason | null
  sourceType?: string | null
  sourceId?: string | null
}

const profileListSelect = {
  id: true,
  teamId: true,
  displayName: true,
  displayPhone: true,
  primaryEmail: true,
  normalizedPrimaryEmail: true,
  primaryDocument: true,
  lastSeenAt: true,
  engagementScore: true,
  engagementBand: true,
  createdAt: true,
  updatedAt: true,
} as const

export class RadarRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  async upsertProfile(input: UpsertProfileInput) {
    const existing = await this.db.radarProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: {
          teamId: input.teamId,
          normalizedPhone: input.normalizedPhone,
          normalizedName: input.normalizedName,
        },
      },
      select: {
        id: true,
        primaryEmail: true,
        normalizedPrimaryEmail: true,
        primaryDocument: true,
        normalizedPrimaryDocument: true,
      },
    })

    return this.db.radarProfile.upsert({
      where: {
        teamId_normalizedPhone_normalizedName: {
          teamId: input.teamId,
          normalizedPhone: input.normalizedPhone,
          normalizedName: input.normalizedName,
        },
      },
      create: {
        teamId: input.teamId,
        displayName: input.displayName,
        normalizedName: input.normalizedName,
        displayPhone: input.displayPhone,
        normalizedPhone: input.normalizedPhone,
        primaryEmail: input.primaryEmail ?? null,
        normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? null,
        primaryDocument: input.primaryDocument ?? null,
        normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? null,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
      update: {
        displayName: input.displayName || undefined,
        displayPhone: input.displayPhone || undefined,
        primaryEmail: input.primaryEmail ?? existing?.primaryEmail ?? undefined,
        normalizedPrimaryEmail:
          input.normalizedPrimaryEmail ?? existing?.normalizedPrimaryEmail ?? undefined,
        primaryDocument: input.primaryDocument ?? existing?.primaryDocument ?? undefined,
        normalizedPrimaryDocument:
          input.normalizedPrimaryDocument ?? existing?.normalizedPrimaryDocument ?? undefined,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
    })
  }

  /**
   * Lookup por identidade — usado para resolver o dono de uma identidade
   * (ex.: email) através da chave única `[teamId, type, normalizedValue]`
   * em vez de campos não-únicos do perfil (ver `findProfileByEmail`, que
   * pode ser ambíguo quando dois perfis compartilham o mesmo e-mail).
   */
  async findProfileByIdentity(teamId: string, type: RadarIdentityType, normalizedValue: string) {
    return this.db.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId, type, normalizedValue },
      },
      select: { profileId: true },
    })
  }

  /**
   * E3: funde `losingProfileId` em `winningProfileId` e recalcula o engagement
   * score do vencedor. Abre transação própria — entrypoint público para call
   * sites externos (ex.: MergeLeadsUseCase / E3b). O auto-merge em
   * `resolveProfileForPhone` usa `mergeProfilesWithTx` + score pós-commit.
   */
  async mergeProfiles(
    teamId: string,
    losingProfileId: string,
    winningProfileId: string
  ): Promise<void> {
    if (losingProfileId === winningProfileId) return

    await prisma.$transaction(async (tx) => {
      await this.mergeProfilesWithTx(tx, teamId, losingProfileId, winningProfileId)
    })

    await this.updateEngagementScore(winningProfileId, teamId)
  }

  /**
   * D4: funde `losingProfileId` em `winningProfileId` quando o telefone e o
   * e-mail resolvidos apontam para dois perfis diferentes já existentes
   * (ex.: um perfil nasceu email-only via EmailContact/webhook, e depois um
   * Lead com o mesmo e-mail + telefone real aparece, mas o telefone já
   * pertence a um terceiro perfil criado antes via WhatsApp). Move
   * identidades/eventos/links/consentimentos para o vencedor (com dedupe
   * por chave única onde ela é escopada por team, não por perfil) e apaga
   * o perdedor. Sempre roda dentro da transação já travada pelo chamador.
   * Não recalcula score aqui — `updateEngagementScore` usa o client global e
   * não enxergaria writes ainda não commitados; o caller pós-commit chama.
   */
  private async mergeProfilesWithTx(
    tx: Prisma.TransactionClient,
    teamId: string,
    losingProfileId: string,
    winningProfileId: string
  ): Promise<void> {
    await tx.radarIdentity.updateMany({
      where: { profileId: losingProfileId },
      data: { profileId: winningProfileId },
    })

    const losingSourceLinks = await tx.radarSourceLink.findMany({
      where: { profileId: losingProfileId },
      select: { id: true, sourceType: true, sourceId: true },
    })
    for (const link of losingSourceLinks) {
      const conflict = await tx.radarSourceLink.findFirst({
        where: { teamId, sourceType: link.sourceType, sourceId: link.sourceId, profileId: winningProfileId },
        select: { id: true },
      })
      if (conflict) {
        await tx.radarSourceLink.delete({ where: { id: link.id } })
      } else {
        await tx.radarSourceLink.update({ where: { id: link.id }, data: { profileId: winningProfileId } })
      }
    }

    const losingEvents = await tx.radarEvent.findMany({
      where: { profileId: losingProfileId },
      select: { id: true, sourceType: true, sourceId: true, eventType: true, occurredAt: true },
    })
    for (const event of losingEvents) {
      // D5 (fix review PR #561): profile.first_contact usa o próprio
      // profileId como sourceId — perdedor e vencedor sempre têm sourceId
      // diferente entre si, então o dedupe genérico abaixo (que exige
      // sourceId igual) nunca encontraria o conflito. Mantém só o mais
      // antigo dos dois "primeiro contato".
      if (event.eventType === "profile.first_contact") {
        const existingFirstContact = await tx.radarEvent.findFirst({
          where: { teamId, profileId: winningProfileId, eventType: "profile.first_contact" },
          select: { id: true, occurredAt: true },
        })
        if (!existingFirstContact) {
          await tx.radarEvent.update({ where: { id: event.id }, data: { profileId: winningProfileId } })
        } else if (event.occurredAt < existingFirstContact.occurredAt) {
          await tx.radarEvent.delete({ where: { id: existingFirstContact.id } })
          await tx.radarEvent.update({ where: { id: event.id }, data: { profileId: winningProfileId } })
        } else {
          await tx.radarEvent.delete({ where: { id: event.id } })
        }
        continue
      }

      const conflict = await tx.radarEvent.findFirst({
        where: {
          teamId,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          profileId: winningProfileId,
        },
        select: { id: true },
      })
      if (conflict) {
        await tx.radarEvent.delete({ where: { id: event.id } })
      } else {
        await tx.radarEvent.update({ where: { id: event.id }, data: { profileId: winningProfileId } })
      }
    }

    const consentRank: Record<RadarConsentStatus, number> = { blocked: 2, unknown: 0, allowed: 1 }
    const losingConsents = await tx.radarChannelConsent.findMany({ where: { profileId: losingProfileId } })
    for (const consent of losingConsents) {
      const existing = await tx.radarChannelConsent.findUnique({
        where: { profileId_channel: { profileId: winningProfileId, channel: consent.channel } },
      })
      if (!existing) {
        await tx.radarChannelConsent.update({
          where: { id: consent.id },
          data: { profileId: winningProfileId },
        })
      } else {
        // Mais restritivo vence — nunca desbloqueia silenciosamente um canal
        // que já estava bloqueado no perfil vencedor.
        if (consentRank[consent.status] > consentRank[existing.status]) {
          await tx.radarChannelConsent.update({
            where: { id: existing.id },
            data: { status: consent.status, reason: consent.reason ?? undefined },
          })
        }
        await tx.radarChannelConsent.delete({ where: { id: consent.id } })
      }
    }

    await tx.radarProfile.delete({ where: { id: losingProfileId } })
  }

  /**
   * Resolve (ou cria) o perfil dono de um telefone de forma atômica — lock
   * advisory por (teamId, phone) fecha a corrida em que duas syncs
   * concorrentes (ex.: CRM + WhatsApp) para o mesmo telefone com nomes
   * diferentes veem "sem identidade" ao mesmo tempo, cada uma cria um
   * perfil via a chave natural `[teamId, normalizedPhone, normalizedName]`
   * (que diverge por nome), e a identidade phone acaba migrando
   * silenciosamente entre eles no upsert seguinte. A identidade phone é
   * reivindicada dentro da MESMA transação que resolve/cria o perfil (D8).
   * Quando o perfil já existe (dono da identidade), displayName/
   * normalizedName NÃO são sobrescritos — o perfil mantém seu nome
   * original mesmo que a fonte atual traga um nome diferente.
   */
  async resolveProfileForPhone(input: {
    teamId: string
    normalizedPhone: string
    normalizedName: string
    displayName: string
    displayPhone: string
    phoneValue: string | null
    phoneSource: string
    primaryEmail?: string | null
    normalizedPrimaryEmail?: string | null
    primaryDocument?: string | null
    normalizedPrimaryDocument?: string | null
    lastSeenAt?: Date
  }) {
    let mergedWinningProfileId: string | null = null

    const result = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.teamId} || ':' || ${input.normalizedPhone}))`

      // D4: quando um e-mail acompanha o telefone, também trava o lock por
      // e-mail (mesma chave usada por resolveProfileForEmail) — sem isso,
      // uma chamada concorrente a resolveProfileForEmail para o mesmo
      // e-mail (ex.: contato de lista + webhook chegando ao mesmo tempo)
      // não seria serializada contra esta transação e as duas poderiam
      // criar perfis duplicados para a mesma pessoa. Ordem fixa (telefone
      // sempre primeiro) evita deadlock, já que resolveProfileForEmail
      // nunca trava o lock de telefone.
      if (input.normalizedPrimaryEmail) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.teamId} || ':' || ${input.normalizedPrimaryEmail}))`
      }

      const existingByIdentity = await tx.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "phone",
            normalizedValue: input.normalizedPhone,
          },
        },
        select: { profileId: true },
      })

      if (existingByIdentity) {
        if (input.normalizedPrimaryEmail) {
          const emailOwner = await tx.radarIdentity.findUnique({
            where: {
              teamId_type_normalizedValue: {
                teamId: input.teamId,
                type: "email",
                normalizedValue: input.normalizedPrimaryEmail,
              },
            },
            select: { profileId: true },
          })

          if (emailOwner && emailOwner.profileId !== existingByIdentity.profileId) {
            await this.mergeProfilesWithTx(
              tx,
              input.teamId,
              emailOwner.profileId,
              existingByIdentity.profileId
            )
            mergedWinningProfileId = existingByIdentity.profileId
          }
        }

        const existingProfile = await tx.radarProfile.findUnique({
          where: { id: existingByIdentity.profileId },
          select: {
            primaryEmail: true,
            normalizedPrimaryEmail: true,
            primaryDocument: true,
            normalizedPrimaryDocument: true,
          },
        })

        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: {
            displayPhone: input.displayPhone || undefined,
            primaryEmail: input.primaryEmail ?? existingProfile?.primaryEmail ?? undefined,
            normalizedPrimaryEmail:
              input.normalizedPrimaryEmail ?? existingProfile?.normalizedPrimaryEmail ?? undefined,
            primaryDocument: input.primaryDocument ?? existingProfile?.primaryDocument ?? undefined,
            normalizedPrimaryDocument:
              input.normalizedPrimaryDocument ?? existingProfile?.normalizedPrimaryDocument ?? undefined,
            lastSeenAt: input.lastSeenAt ?? new Date(),
          },
        })

        return { profile, wasExisting: true }
      }

      // D4: telefone chegando pela primeira vez para um e-mail que já tem
      // perfil email-only — promove o mesmo perfil (nunca cria uma segunda
      // linha via chave natural telefone+nome). "Promover" = a identidade
      // phone passa a apontar para o profileId que já existia por e-mail.
      if (input.normalizedPrimaryEmail) {
        const existingByEmailIdentity = await tx.radarIdentity.findUnique({
          where: {
            teamId_type_normalizedValue: {
              teamId: input.teamId,
              type: "email",
              normalizedValue: input.normalizedPrimaryEmail,
            },
          },
          select: { profileId: true },
        })

        if (existingByEmailIdentity) {
          const profile = await tx.radarProfile.update({
            where: { id: existingByEmailIdentity.profileId },
            data: {
              normalizedPhone: input.normalizedPhone,
              displayPhone: input.displayPhone || undefined,
              lastSeenAt: input.lastSeenAt ?? new Date(),
            },
          })

          await tx.radarIdentity.upsert({
            where: {
              teamId_type_normalizedValue: {
                teamId: input.teamId,
                type: "phone",
                normalizedValue: input.normalizedPhone,
              },
            },
            create: {
              profileId: profile.id,
              teamId: input.teamId,
              type: "phone",
              value: input.phoneValue,
              normalizedValue: input.normalizedPhone,
              source: input.phoneSource,
              isPrimary: true,
            },
            update: {
              profileId: profile.id,
              value: input.phoneValue ?? undefined,
              source: input.phoneSource,
              isPrimary: true,
            },
          })

          return { profile, wasExisting: true }
        }
      }

      const existingByKey = await tx.radarProfile.findUnique({
        where: {
          teamId_normalizedPhone_normalizedName: {
            teamId: input.teamId,
            normalizedPhone: input.normalizedPhone,
            normalizedName: input.normalizedName,
          },
        },
        select: { id: true },
      })

      const profile = await tx.radarProfile.upsert({
        where: {
          teamId_normalizedPhone_normalizedName: {
            teamId: input.teamId,
            normalizedPhone: input.normalizedPhone,
            normalizedName: input.normalizedName,
          },
        },
        create: {
          teamId: input.teamId,
          displayName: input.displayName,
          normalizedName: input.normalizedName,
          displayPhone: input.displayPhone,
          normalizedPhone: input.normalizedPhone,
          primaryEmail: input.primaryEmail ?? null,
          normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? null,
          primaryDocument: input.primaryDocument ?? null,
          normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? null,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
        update: {
          displayName: input.displayName || undefined,
          displayPhone: input.displayPhone || undefined,
          primaryEmail: input.primaryEmail ?? undefined,
          normalizedPrimaryEmail: input.normalizedPrimaryEmail ?? undefined,
          primaryDocument: input.primaryDocument ?? undefined,
          normalizedPrimaryDocument: input.normalizedPrimaryDocument ?? undefined,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
      })

      await tx.radarIdentity.upsert({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "phone",
            normalizedValue: input.normalizedPhone,
          },
        },
        create: {
          profileId: profile.id,
          teamId: input.teamId,
          type: "phone",
          value: input.phoneValue,
          normalizedValue: input.normalizedPhone,
          source: input.phoneSource,
          isPrimary: true,
        },
        update: {
          profileId: profile.id,
          value: input.phoneValue ?? undefined,
          source: input.phoneSource,
          isPrimary: true,
        },
      })

      if (!existingByKey) {
        // D5: "primeiro contato" — profile.id é sempre novo neste ponto,
        // então uma segunda ocorrência para o mesmo perfil é estruturalmente
        // impossível; não precisa de appendEventIfNew/dedupe.
        await tx.radarEvent.create({
          data: {
            profileId: profile.id,
            teamId: input.teamId,
            eventType: "profile.first_contact",
            sourceType: "profile",
            sourceId: profile.id,
            occurredAt: input.lastSeenAt ?? new Date(),
          },
        })
      }

      return { profile, wasExisting: Boolean(existingByKey) }
    })

    // E3a: score pós-commit — mergeProfilesWithTx não recalcula (client global
    // não vê writes da tx aberta).
    if (mergedWinningProfileId) {
      await this.updateEngagementScore(mergedWinningProfileId, input.teamId)
    }

    return result
  }

  /**
   * Resolve (ou cria) um perfil "email-only" (D4) — mesmo princípio de
   * `resolveProfileForPhone`, mas sem telefone disponível. `RadarProfile`
   * não tem chave natural para "só e-mail" (só `[teamId, normalizedPhone,
   * normalizedName]`, que exige telefone), então o lock advisory em
   * `(teamId, normalizedEmail)` é a única proteção contra corrida — suficiente
   * porque tudo roda dentro da mesma transação. Quando o caller já tem um
   * telefone válido disponível, deve chamar `resolveProfileForPhone`
   * diretamente (que agora também promove um perfil email-only existente,
   * ver bloco acima) em vez deste método.
   */
  async resolveProfileForEmail(input: {
    teamId: string
    normalizedEmail: string
    emailValue: string
    displayName: string | null
    normalizedName: string | null
    emailSource: string
    lastSeenAt?: Date
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.teamId} || ':' || ${input.normalizedEmail}))`

      const existingByIdentity = await tx.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "email",
            normalizedValue: input.normalizedEmail,
          },
        },
        select: { profileId: true },
      })

      if (existingByIdentity) {
        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: { lastSeenAt: input.lastSeenAt ?? new Date() },
        })
        return { profile, wasExisting: true }
      }

      const profile = await tx.radarProfile.create({
        data: {
          teamId: input.teamId,
          displayName: input.displayName || input.emailValue,
          normalizedName: input.normalizedName || input.normalizedEmail,
          normalizedPhone: null,
          displayPhone: null,
          primaryEmail: input.emailValue,
          normalizedPrimaryEmail: input.normalizedEmail,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
      })

      await tx.radarIdentity.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          type: "email",
          value: input.emailValue,
          normalizedValue: input.normalizedEmail,
          source: input.emailSource,
          isPrimary: true,
        },
      })

      // D5: "primeiro contato" — este branch só é alcançado quando é uma
      // criação genuína (o branch existingByIdentity acima já retorna
      // antes), então profile.id é sempre novo aqui.
      await tx.radarEvent.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          eventType: "profile.first_contact",
          sourceType: "profile",
          sourceId: profile.id,
          occurredAt: input.lastSeenAt ?? new Date(),
        },
      })

      return { profile, wasExisting: false }
    })
  }

  /**
   * Resolve (ou cria) um perfil anônimo identificado apenas por uma sessão de visitante (D8).
   * Usa o mesmo padrão de lock advisory que `resolveProfileForEmail` para evitar corridas.
   */
  async resolveProfileForVisitorSession(input: {
    teamId: string
    visitorSession: string
    lastSeenAt?: Date
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.teamId} || ':vs:' || ${input.visitorSession}))`

      const existingByIdentity = await tx.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: "visitor_session",
            normalizedValue: input.visitorSession,
          },
        },
        select: { profileId: true },
      })

      if (existingByIdentity) {
        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: { lastSeenAt: input.lastSeenAt ?? new Date() },
        })
        return { profile, wasExisting: true }
      }

      const profile = await tx.radarProfile.create({
        data: {
          teamId: input.teamId,
          displayName: "Visitante Anônimo",
          normalizedName: "visitante anonimo",
          normalizedPhone: null,
          displayPhone: null,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
      })

      await tx.radarIdentity.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          type: "visitor_session",
          value: input.visitorSession,
          normalizedValue: input.visitorSession,
          source: "pixel_hit",
          isPrimary: true,
        },
      })

      await tx.radarEvent.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          eventType: "profile.first_contact",
          sourceType: "profile",
          sourceId: profile.id,
          occurredAt: input.lastSeenAt ?? new Date(),
        },
      })

      return { profile, wasExisting: false }
    })
  }

  /**
   * Resolve (ou cria) um perfil chaveado por documento (D14) — titulares e
   * dependentes de `LeadFinalized` não têm telefone/e-mail. Lock advisory em
   * `(teamId, identityType, normalizedDocument)` evita corrida; a identidade
   * `contract_holder`/`contract_dependent` é a chave natural.
   */
  async resolveProfileForDocument(input: {
    teamId: string
    identityType: Extract<RadarIdentityType, "contract_holder" | "contract_dependent">
    normalizedDocument: string
    documentValue: string
    displayName: string
    normalizedName: string
    documentSource: string
    lastSeenAt?: Date
  }) {
    return this.db.$transaction(async (tx) => {
      const lockKey = `${input.teamId}:${input.identityType}:${input.normalizedDocument}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      const existingByIdentity = await tx.radarIdentity.findUnique({
        where: {
          teamId_type_normalizedValue: {
            teamId: input.teamId,
            type: input.identityType,
            normalizedValue: input.normalizedDocument,
          },
        },
        select: { profileId: true },
      })

      if (existingByIdentity) {
        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: {
            lastSeenAt: input.lastSeenAt ?? new Date(),
            displayName: input.displayName,
            normalizedName: input.normalizedName,
            primaryDocument: input.documentValue,
            normalizedPrimaryDocument: input.normalizedDocument,
          },
        })
        return { profile, wasExisting: true }
      }

      const profile = await tx.radarProfile.create({
        data: {
          teamId: input.teamId,
          displayName: input.displayName,
          normalizedName: input.normalizedName,
          normalizedPhone: null,
          displayPhone: null,
          primaryDocument: input.documentValue,
          normalizedPrimaryDocument: input.normalizedDocument,
          lastSeenAt: input.lastSeenAt ?? new Date(),
        },
      })

      await tx.radarIdentity.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          type: input.identityType,
          value: input.documentValue,
          normalizedValue: input.normalizedDocument,
          source: input.documentSource,
          isPrimary: true,
        },
      })

      await tx.radarEvent.create({
        data: {
          profileId: profile.id,
          teamId: input.teamId,
          eventType: "profile.first_contact",
          sourceType: "profile",
          sourceId: profile.id,
          occurredAt: input.lastSeenAt ?? new Date(),
        },
      })

      return { profile, wasExisting: false }
    })
  }

  async upsertIdentity(input: UpsertIdentityInput) {
    return this.db.radarIdentity.upsert({
      where: {
        teamId_type_normalizedValue: {
          teamId: input.teamId,
          type: input.type,
          normalizedValue: input.normalizedValue,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        type: input.type,
        value: input.value ?? null,
        normalizedValue: input.normalizedValue,
        source: input.source,
        isPrimary: input.isPrimary ?? false,
      },
      update: {
        profileId: input.profileId,
        value: input.value ?? undefined,
        source: input.source,
        isPrimary: input.isPrimary ?? undefined,
      },
    })
  }

  async upsertSourceLink(input: UpsertSourceLinkInput) {
    return this.db.radarSourceLink.upsert({
      where: {
        teamId_sourceType_sourceId: {
          teamId: input.teamId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceMetadata: input.sourceMetadata,
        firstLinkedAt: new Date(),
        lastSyncedAt: new Date(),
      },
      update: {
        profileId: input.profileId,
        sourceMetadata: input.sourceMetadata,
        lastSyncedAt: new Date(),
      },
    })
  }

  async hasDuplicateEvent(
    teamId: string,
    sourceType: string,
    sourceId: string | null | undefined,
    eventType: string,
    occurredAt: Date
  ) {
    if (!sourceId) return false
    const duplicate = await this.db.radarEvent.findFirst({
      where: { teamId, sourceType, sourceId, eventType, occurredAt },
      select: { id: true },
    })
    return Boolean(duplicate)
  }

  /**
   * Checa se um evento já ocorreu para essa entidade em QUALQUER `occurredAt`
   * — ao contrário de `hasDuplicateEvent`, que dedupa por ocorrência exata
   * (mesmo `occurredAt`). Usado por marcos "de uma vez só" (ex.: portfolio.
   * renewed/brokerage_transfer) cujo `occurredAt` vem de `updatedAt` da
   * entidade — um campo mutável que avança em qualquer edição não
   * relacionada, o que faria `appendEventIfNew` (dedupe por ocorrência)
   * criar um evento novo a cada edição. Aqui, uma vez registrado, nunca
   * mais se repete.
   */
  async hasEventEverOccurredForSource(teamId: string, sourceType: string, sourceId: string, eventType: string) {
    const existing = await this.db.radarEvent.findFirst({
      where: { teamId, sourceType, sourceId, eventType },
      select: { id: true },
    })
    return Boolean(existing)
  }

  async appendEventIfNew(input: AppendEventInput) {
    if (
      input.sourceId &&
      (await this.hasDuplicateEvent(
        input.teamId,
        input.sourceType,
        input.sourceId,
        input.eventType,
        input.occurredAt
      ))
    ) {
      return null
    }

    try {
      const created = await this.db.radarEvent.create({
        data: {
          profileId: input.profileId,
          teamId: input.teamId,
          eventType: input.eventType,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          occurredAt: input.occurredAt,
          metadata: input.metadata,
        },
      })
      void this.updateEngagementScore(input.profileId, input.teamId).catch((error) => {
        console.error("[RadarRepository][updateEngagementScore]", error)
      })
      return created
    } catch {
      return null
    }
  }

  /**
   * D8: dedupe por `(sourceType, sourceId, eventType)` ignorando `occurredAt`.
   * Usado ao espelhar `PublicFormMetricEvent.eventKey` (@unique) como `sourceId`
   * — retries fire-and-forget não devem gerar `RadarEvent` duplicado só porque
   * o relógio avançou.
   *
   * A unique do banco inclui `occurredAt`, então check-then-insert sem lock
   * permite corrida: dois retries com `occurredAt` distintos passam o findFirst
   * e ambos inserem. Serializamos por source key via `pg_advisory_xact_lock`
   * (mesmo padrão de `resolveProfileForVisitorSession`).
   */
  async appendEventIfNewBySourceKey(input: AppendEventInput) {
    if (!input.sourceId) {
      try {
        const created = await this.db.radarEvent.create({
          data: {
            profileId: input.profileId,
            teamId: input.teamId,
            eventType: input.eventType,
            sourceType: input.sourceType,
            sourceId: null,
            occurredAt: input.occurredAt,
            metadata: input.metadata,
          },
        })
        void this.updateEngagementScore(input.profileId, input.teamId).catch((error) => {
          console.error("[RadarRepository][updateEngagementScore]", error)
        })
        return created
      } catch {
        return null
      }
    }

    const sourceId = input.sourceId
    const created = await this.db.$transaction(async (tx) => {
      const lockKey = `${input.teamId}:evt:${input.sourceType}:${sourceId}:${input.eventType}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      const existing = await tx.radarEvent.findFirst({
        where: {
          teamId: input.teamId,
          sourceType: input.sourceType,
          sourceId,
          eventType: input.eventType,
        },
        select: { id: true },
      })
      if (existing) return null

      try {
        return await tx.radarEvent.create({
          data: {
            profileId: input.profileId,
            teamId: input.teamId,
            eventType: input.eventType,
            sourceType: input.sourceType,
            sourceId,
            occurredAt: input.occurredAt,
            metadata: input.metadata,
          },
        })
      } catch {
        return null
      }
    })

    // Fora da transação/advisory lock — não participa do dedupe.
    if (created) {
      void this.updateEngagementScore(input.profileId, input.teamId).catch((error) => {
        console.error("[RadarRepository][updateEngagementScore]", error)
      })
    }
    return created
  }

  /**
   * D19: recalcula `engagementScore`/`engagementBand` do perfil a partir dos
   * eventos dentro de `windowOldDays`. Pesos + config backoffice com cache 5 min.
   */
  async updateEngagementScore(profileId: string, teamId: string) {
    const { weights, config, formRules } = await this.loadEngagementWeightsAndConfig()

    const since = new Date(Date.now() - config.windowOldDays * 24 * 60 * 60 * 1000)
    const events = await this.db.radarEvent.findMany({
      where: {
        profileId,
        teamId,
        occurredAt: { gte: since },
      },
      select: {
        eventType: true,
        occurredAt: true,
        metadata: true,
      },
    })

    const { score, band } = computeEngagementScore(events, weights, config, new Date(), formRules)

    await this.db.radarProfile.updateMany({
      where: { id: profileId, teamId },
      data: {
        engagementScore: score,
        engagementBand: band,
      },
    })

    return { score, band }
  }

  /**
   * D19-D: resolve perfil via identidade `lead_id` e devolve score/banda + top eventos.
   */
  async getLeadRadarEngagementWithCtx(scope: RadarTeamScope, leadId: string) {
    const identity = await this.findProfileByIdentity(scope.teamId, "lead_id", leadId)
    if (!identity) {
      return { notFound: true as const }
    }

    const profile = await this.db.radarProfile.findFirst({
      where: { id: identity.profileId, teamId: scope.teamId },
      select: {
        id: true,
        engagementScore: true,
        engagementBand: true,
      },
    })
    if (!profile) {
      return { notFound: true as const }
    }

    const { weights, config, formRules } = await this.loadEngagementWeightsAndConfig()
    const since = new Date(Date.now() - config.windowOldDays * 24 * 60 * 60 * 1000)
    const events = await this.db.radarEvent.findMany({
      where: {
        profileId: profile.id,
        teamId: scope.teamId,
        occurredAt: { gte: since },
      },
      select: {
        eventType: true,
        occurredAt: true,
        metadata: true,
      },
    })

    let score = profile.engagementScore
    let band = profile.engagementBand as EngagementBand | null
    if (score == null || band == null) {
      const computed = computeEngagementScore(events, weights, config, new Date(), formRules)
      score = computed.score
      band = computed.band
    }

    const topEvents = rankTopEngagementEvents(events, weights, config, 3, new Date(), formRules).map(
      (item) => ({
        eventType: item.eventType,
        occurredAt: item.occurredAt.toISOString(),
        contribution: Math.round(item.contribution * 100) / 100,
      })
    )

    return {
      notFound: false as const,
      profileId: profile.id,
      score,
      band,
      topEvents,
    }
  }

  /**
   * D19-C: pagina perfis de todos os times para backfill de engajamento.
   * Cursor por `id` evita skip em tabelas grandes.
   */
  async listProfilesForEngagementBackfill(params: {
    take: number
    cursorId?: string | null
  }): Promise<Array<{ id: string; teamId: string }>> {
    return this.db.radarProfile.findMany({
      where: params.cursorId ? { id: { gt: params.cursorId } } : undefined,
      select: { id: true, teamId: true },
      orderBy: { id: "asc" },
      take: params.take,
    })
  }

  private async loadEngagementWeightsAndConfig(): Promise<{
    weights: WeightMap
    config: EngagementConfig
    formRules: FormEngagementScoreRule[]
  }> {
    const now = Date.now()
    if (engagementWeightsConfigCache && engagementWeightsConfigCache.expiresAt > now) {
      return {
        weights: engagementWeightsConfigCache.weights,
        config: engagementWeightsConfigCache.config,
        formRules: engagementWeightsConfigCache.formRules,
      }
    }

    const [weightRows, configRow, formRuleRows] = await withPrismaRetry(
      () =>
        Promise.all([
          this.db.backofficeRadarEngagementWeight.findMany({
            where: { isActive: true },
            select: { eventType: true, weight: true },
          }),
          this.db.backofficeRadarEngagementConfig.findFirst({
            where: { isActive: true },
            select: {
              windowRecentDays: true,
              windowMidDays: true,
              windowOldDays: true,
              recentMultiplier: true,
              oldMultiplier: true,
              hotThreshold: true,
              warmThreshold: true,
              lukewarmThreshold: true,
            },
            orderBy: { updatedAt: "desc" },
          }),
          this.db.backofficeFormEngagementScoreRule.findMany({
            where: { isActive: true },
            select: {
              minPercent: true,
              maxPercent: true,
              multiplier: true,
              label: true,
              isActive: true,
            },
            orderBy: { minPercent: "asc" },
          }),
        ]),
      { label: "loadEngagementWeightsAndConfig", retries: 2 }
    )

    const weights: WeightMap = {}
    for (const row of weightRows) {
      weights[row.eventType] = row.weight
    }

    const config: EngagementConfig = configRow
      ? {
          windowRecentDays: configRow.windowRecentDays,
          windowMidDays: configRow.windowMidDays,
          windowOldDays: configRow.windowOldDays,
          recentMultiplier: configRow.recentMultiplier,
          oldMultiplier: configRow.oldMultiplier,
          hotThreshold: configRow.hotThreshold,
          warmThreshold: configRow.warmThreshold,
          lukewarmThreshold: configRow.lukewarmThreshold,
        }
      : DEFAULT_ENGAGEMENT_CONFIG

    const formRules: FormEngagementScoreRule[] =
      formRuleRows.length > 0
        ? formRuleRows.map((row) => ({
            minPercent: row.minPercent,
            maxPercent: row.maxPercent,
            multiplier: row.multiplier,
            label: row.label,
            isActive: row.isActive,
          }))
        : DEFAULT_FORM_ENGAGEMENT_SCORE_RULES

    engagementWeightsConfigCache = {
      weights,
      config,
      formRules,
      expiresAt: now + ENGAGEMENT_CACHE_TTL_MS,
    }

    return { weights, config, formRules }
  }

  async upsertConsent(input: UpsertConsentInput) {
    return this.db.radarChannelConsent.upsert({
      where: {
        profileId_channel: {
          profileId: input.profileId,
          channel: input.channel,
        },
      },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        channel: input.channel,
        status: input.status,
        reason: input.reason ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      },
      update: {
        status: input.status,
        reason: input.reason ?? undefined,
        sourceType: input.sourceType ?? undefined,
        sourceId: input.sourceId ?? undefined,
      },
    })
  }

  /**
   * C6 EXPLAIN (50k rows / 16 teams): the `teamId` + `lastSeenAt` range + `ORDER BY
   * lastSeenAt DESC` combination is served by a Bitmap Index Scan on one of the
   * `@@index([teamId, ...])` composites — no seq scan at this scale. The free-text
   * `search` OR (`displayName`/`displayPhone`/`primaryEmail` `contains`) necessarily
   * seq-scans the team's rows regardless of indexing — a leading-wildcard match
   * can't use a plain btree index (would need `pg_trgm`), which isn't justified by
   * current team sizes; no additional index proven necessary today.
   */
  async listProfilesWithCtx(
    scope: RadarTeamScope,
    params: {
      search?: string
      consent?: RadarConsentStatus
      sourceType?: RadarSourceType
      channel?: RadarChannel
      lastSeenFrom?: Date
      lastSeenTo?: Date
      skip: number
      take: number
      sort?: "engagementScore" | "lastSeenAt"
      order?: "asc" | "desc"
    }
  ) {
    const where = this.buildListProfilesWhere(scope, params)
    const sortField = params.sort === "lastSeenAt" ? "lastSeenAt" : "engagementScore"
    const sortOrder = params.order === "asc" ? "asc" : "desc"

    const [items, total] = await Promise.all([
      this.db.radarProfile.findMany({
        where,
        select: {
          ...profileListSelect,
          consents: {
            where: { channel: "email" },
            select: { status: true, reason: true, channel: true },
          },
          sourceLinks: {
            select: { sourceType: true },
            take: 5,
          },
        },
        orderBy: { [sortField]: { sort: sortOrder, nulls: "last" } },
        skip: params.skip,
        take: params.take,
      }),
      this.db.radarProfile.count({ where }),
    ])

    return { items, total }
  }

  private buildListProfilesWhere(
    scope: RadarTeamScope,
    params: {
      search?: string
      consent?: RadarConsentStatus
      sourceType?: RadarSourceType
      channel?: RadarChannel
      lastSeenFrom?: Date
      lastSeenTo?: Date
    }
  ): Prisma.RadarProfileWhereInput {
    return {
      teamId: scope.teamId,
      ...(params.search && {
        OR: [
          { displayName: { contains: params.search, mode: "insensitive" } },
          { displayPhone: { contains: params.search } },
          { primaryEmail: { contains: params.search, mode: "insensitive" } },
        ],
      }),
      ...(params.sourceType && {
        sourceLinks: { some: { sourceType: params.sourceType } },
      }),
      ...(params.consent || params.channel
        ? {
            consents: {
              some: {
                ...(params.channel ? { channel: params.channel } : { channel: "email" }),
                ...(params.consent ? { status: params.consent } : {}),
              },
            },
          }
        : {}),
      ...(params.lastSeenFrom || params.lastSeenTo
        ? {
            lastSeenAt: {
              ...(params.lastSeenFrom ? { gte: params.lastSeenFrom } : {}),
              ...(params.lastSeenTo ? { lte: params.lastSeenTo } : {}),
            },
          }
        : {}),
    }
  }

  private readonly exportProfileSelect = {
    id: true,
    displayName: true,
    displayPhone: true,
    primaryEmail: true,
    primaryDocument: true,
    lastSeenAt: true,
    identities: {
      select: {
        type: true,
        value: true,
        normalizedValue: true,
      },
      orderBy: { type: "asc" as const },
    },
    events: {
      select: {
        eventType: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" as const },
      take: 1,
    },
  }

  /**
   * D16: lista perfis filtrados para export (até `RADAR_EXPORT_MAX_ROWS`),
   * com identidades e o evento mais recente.
   */
  async listProfilesForExportWithCtx(
    scope: RadarTeamScope,
    params: {
      search?: string
      consent?: RadarConsentStatus
      sourceType?: RadarSourceType
      channel?: RadarChannel
      lastSeenFrom?: Date
      lastSeenTo?: Date
    }
  ) {
    const where = this.buildListProfilesWhere(scope, params)

    const [items, total] = await Promise.all([
      this.db.radarProfile.findMany({
        where,
        select: this.exportProfileSelect,
        orderBy: { lastSeenAt: "desc" },
        take: RADAR_EXPORT_MAX_ROWS,
      }),
      this.db.radarProfile.count({ where }),
    ])

    return { items, total }
  }

  /**
   * D16: carrega perfis por ids (ordem preservada) para export de segmento.
   */
  async listProfilesForExportByIdsWithCtx(scope: RadarTeamScope, profileIds: string[]) {
    if (profileIds.length === 0) return []

    const cappedIds = profileIds.slice(0, RADAR_EXPORT_MAX_ROWS)
    const items = await this.db.radarProfile.findMany({
      where: { teamId: scope.teamId, id: { in: cappedIds } },
      select: this.exportProfileSelect,
    })

    const byId = new Map(items.map((item) => [item.id, item]))
    return cappedIds.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item))
  }

  async getProfileDetailWithCtx(scope: RadarTeamScope, profileId: string) {
    return this.db.radarProfile.findFirst({
      where: { id: profileId, teamId: scope.teamId },
      select: {
        ...profileListSelect,
        normalizedName: true,
        normalizedPhone: true,
        normalizedPrimaryDocument: true,
        profileData: true,
        identities: {
          orderBy: { type: "asc" },
        },
        sourceLinks: {
          orderBy: { lastSyncedAt: "desc" },
        },
        consents: true,
        events: {
          orderBy: { occurredAt: "desc" },
          take: 10,
        },
      },
    })
  }

  async listProfileEventsWithCtx(
    scope: RadarTeamScope,
    profileId: string,
    skip: number,
    take: number
  ) {
    const where = { profileId, teamId: scope.teamId }
    const [items, total] = await Promise.all([
      this.db.radarEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take,
      }),
      this.db.radarEvent.count({ where }),
    ])
    return { items, total }
  }

  async countProfiles(scope: RadarTeamScope) {
    return this.db.radarProfile.count({ where: { teamId: scope.teamId } })
  }

  /**
   * D9: verifica se o perfil existe e pertence ao time (scoped).
   * Usado antes de agrupar eventos para distinguir "perfil inexistente" de "perfil sem eventos".
   */
  async profileExistsInScope(scope: RadarTeamScope, profileId: string): Promise<boolean> {
    const row = await this.db.radarProfile.findFirst({
      where: { id: profileId, teamId: scope.teamId },
      select: { id: true },
    })
    return row !== null
  }

  /**
   * E4: marcadores leves (eventType + occurredAt) para agregar pontos de contato
   * como pares distintos canal × dia calendário no use case.
   */
  async listProfileTouchpointEventMarkers(scope: RadarTeamScope, profileId: string) {
    return this.db.radarEvent.findMany({
      where: { profileId, teamId: scope.teamId },
      select: { eventType: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    })
  }

  /** D17: `SELECT DISTINCT eventType` escopado pelo time, ordenado alfabeticamente. */
  async listDistinctEventTypes(scope: RadarTeamScope): Promise<string[]> {
    const rows = await this.db.radarEvent.findMany({
      where: { teamId: scope.teamId },
      distinct: ["eventType"],
      select: { eventType: true },
      orderBy: { eventType: "asc" },
    })
    return rows.map((row) => row.eventType)
  }

  /**
   * Perfis com ≥1 `RadarEvent` `email.*` cujo `metadata.campaignId` coincide
   * com a campanha (audiência virtual `campaign:{id}`).
   */
  async findProfileIdsByEmailCampaign(teamId: string, campaignId: string): Promise<string[]> {
    const rows = await this.db.radarEvent.findMany({
      where: {
        teamId,
        eventType: { startsWith: "email." },
        metadata: { path: ["campaignId"], equals: campaignId },
      },
      distinct: ["profileId"],
      select: { profileId: true },
    })
    return rows.map((row) => row.profileId)
  }

  async findEmailCampaignName(teamId: string, campaignId: string): Promise<string | null> {
    const campaign = await this.db.emailCampaign.findFirst({
      where: { id: campaignId, teamId },
      select: { name: true },
    })
    return campaign?.name ?? null
  }

  /** Campanhas do time para o Select do builder (id + nome). */
  async listEmailCampaignOptions(teamId: string): Promise<Array<{ id: string; name: string }>> {
    return this.db.emailCampaign.findMany({
      where: { teamId },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    })
  }

  /**
   * D17: carrega assignedTo/closerId dos leads associados a um perfil,
   * com nomes resolvidos via Profile (assignee/closer).
   */
  async findLeadAssigneesByIds(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return []

    return this.db.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: {
        id: true,
        leadCode: true,
        assignedTo: true,
        closerId: true,
        assignee: { select: { id: true, fullName: true, email: true } },
        closer: { select: { id: true, fullName: true, email: true } },
      },
    })
  }

  async findLeadsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return this.db.lead.findMany({
      where: {
        teamId,
        ...(filters.leadId ? { id: filters.leadId } : {}),
        ...(filters.updatedSince ? { updatedAt: { gte: filters.updatedSince } } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        cnpj: true,
        status: true,
        createdAt: true,
        statusEnteredAt: true,
        updatedAt: true,
      },
    })
  }

  async findPortfoliosForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return this.db.leadPortfolio.findMany({
      where: {
        teamId,
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.portfolioId ? { id: filters.portfolioId } : {}),
        ...(filters.updatedSince ? { updatedAt: { gte: filters.updatedSince } } : {}),
      },
      select: {
        id: true,
        leadId: true,
        renewalStatus: true,
        portfolioStatus: true,
        renewalAmount: true,
        source: true,
        updatedAt: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            cnpj: true,
            contractDueDate: true,
            status: true,
          },
        },
      },
    })
  }

  async findFinalizedForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return this.db.leadFinalized.findMany({
      where: {
        lead: { teamId },
        ...(filters.finalizedId ? { id: filters.finalizedId } : {}),
        ...(filters.leadIds && filters.leadIds.length > 0
          ? { leadId: { in: filters.leadIds } }
          : filters.leadId
            ? { leadId: filters.leadId }
            : {}),
        ...(filters.updatedSince ? { updatedAt: { gte: filters.updatedSince } } : {}),
      },
      select: {
        id: true,
        leadId: true,
        finalizedDateAt: true,
        updatedAt: true,
        createdAt: true,
        holder: {
          select: {
            id: true,
            name: true,
            document: true,
            cnpj: true,
            birthDate: true,
          },
        },
        dependents: {
          select: {
            id: true,
            name: true,
            document: true,
            birthDate: true,
            parentesco: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  }

  async findEmailContactLists(teamId: string) {
    return this.db.emailContactList.findMany({
      where: { teamId },
      select: { id: true },
    })
  }

  async findEmailContacts(listId: string) {
    return this.db.emailContact.findMany({
      where: { listId },
      select: {
        id: true,
        email: true,
        name: true,
        isUnsubscribed: true,
        isBounced: true,
        isComplained: true,
        updatedAt: true,
        customFields: true,
      },
    })
  }

  async findEmailContactById(contactId: string) {
    return this.db.emailContact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        email: true,
        name: true,
        isUnsubscribed: true,
        isBounced: true,
        isComplained: true,
        updatedAt: true,
        customFields: true,
        list: { select: { teamId: true } },
      },
    })
  }

  async findEmailLogsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return this.db.emailLog.findMany({
      where: {
        teamId,
        ...(filters.emailLogSince ? { sentAt: { gte: filters.emailLogSince } } : {}),
      },
      select: {
        id: true,
        recipientEmail: true,
        campaignId: true,
        sentAt: true,
        events: {
          select: { id: true, type: true, occurredAt: true, metadata: true },
        },
      },
      take: 5000,
      orderBy: { sentAt: "desc" },
    })
  }

  async findProfileByPrimaryKey(teamId: string, normalizedPhone: string, normalizedName: string) {
    return this.db.radarProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: { teamId, normalizedPhone, normalizedName },
      },
      select: { id: true },
    })
  }

  async findProfileByEmail(teamId: string, normalizedEmail: string) {
    if (!normalizedEmail) return null
    return this.db.radarProfile.findFirst({
      where: { teamId, normalizedPrimaryEmail: normalizedEmail },
    })
  }

  async findLeadPhoneByEmail(teamId: string, normalizedEmail: string) {
    const lead = await this.db.lead.findFirst({
      where: { teamId, email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { phone: true },
    })
    return lead?.phone ? { phone: lead.phone } : null
  }

  async findLeadStatuses(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map<string, LeadStatus | null>()

    const leads = await this.db.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: { id: true, status: true },
    })

    return new Map(leads.map((lead) => [lead.id, lead.status]))
  }

  // C6 EXPLAIN: see doc comment on RadarSegmentQueryService — teamId-scoped filter
  // uses an existing composite index; consent/event relation filters seq-scan their
  // own tables, naturally bounded by profile count per team.
  async countProfilesByWhere(where: Prisma.RadarProfileWhereInput): Promise<number> {
    return this.db.radarProfile.count({ where })
  }

  async listProfileIdsByWhere(
    where: Prisma.RadarProfileWhereInput,
    pagination?: { skip: number; take: number }
  ): Promise<string[]> {
    const profiles = await this.db.radarProfile.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "asc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
    return profiles.map((profile) => profile.id)
  }

  async findLeadIdsByWhere(where: Prisma.LeadWhereInput): Promise<string[]> {
    const leads = await this.db.lead.findMany({ where, select: { id: true } })
    return leads.map((lead) => lead.id)
  }

  /**
   * D13: retorna `leadId`s e `portfolioId`s de `LeadPortfolio` que batem o where —
   * usados para projetar perfis via identidades `lead_id` / `portfolio_id`.
   */
  async findPortfolioProfileIdsByWhere(
    where: Prisma.LeadPortfolioWhereInput
  ): Promise<{ leadIds: string[]; portfolioIds: string[] }> {
    const rows = await this.db.leadPortfolio.findMany({ where, select: { id: true, leadId: true } })
    return {
      leadIds: [...new Set(rows.map((row) => row.leadId))],
      portfolioIds: rows.map((row) => row.id),
    }
  }

  /**
   * D13: retorna `leadId`s de `LeadFinalized` que batem o where —
   * usados para projetar perfis via identidade `lead_id`.
   */
  async findFinalizedProfileIdsByWhere(where: Prisma.LeadFinalizedWhereInput): Promise<string[]> {
    const rows = await this.db.leadFinalized.findMany({ where, select: { leadId: true } })
    return [...new Set(rows.map((row) => row.leadId))]
  }

  /**
   * D13/D14: contratos atuais (`LeadPortfolio`) + histórico (`LeadFinalized` com
   * holder/dependentes) do perfil. Resolve via `lead_id` / `portfolio_id`,
   * identidades `contract_holder`/`contract_dependent` (documento/CNPJ) e
   * `leadId` em source links `lead_finalized` (perfis syncFromFinalized).
   */
  async findContractsForProfile(scope: RadarTeamScope, profileId: string) {
    const [identities, sourceLinks] = await Promise.all([
      this.db.radarIdentity.findMany({
        where: {
          profileId,
          teamId: scope.teamId,
          type: { in: ["lead_id", "portfolio_id", "contract_holder", "contract_dependent"] },
        },
        select: { type: true, normalizedValue: true },
      }),
      this.db.radarSourceLink.findMany({
        where: {
          profileId,
          teamId: scope.teamId,
          sourceType: "lead_finalized",
        },
        select: { sourceMetadata: true },
      }),
    ])

    const leadIdSet = new Set(
      identities
        .filter((identity) => identity.type === "lead_id")
        .map((identity) => identity.normalizedValue)
    )
    const portfolioIds = identities
      .filter((identity) => identity.type === "portfolio_id")
      .map((identity) => identity.normalizedValue)
    const contractDocuments = identities
      .filter(
        (identity) =>
          identity.type === "contract_holder" || identity.type === "contract_dependent"
      )
      .map((identity) => identity.normalizedValue)
      .filter(Boolean)

    for (const link of sourceLinks) {
      const meta = link.sourceMetadata as { leadId?: unknown } | null
      if (typeof meta?.leadId === "string" && meta.leadId.length > 0) {
        leadIdSet.add(meta.leadId)
      }
    }

    if (contractDocuments.length > 0) {
      const byDocument = await this.db.leadFinalized.findMany({
        where: {
          lead: { teamId: scope.teamId },
          OR: [
            { holder: { document: { in: contractDocuments } } },
            { holder: { cnpj: { in: contractDocuments } } },
            { dependents: { some: { document: { in: contractDocuments } } } },
          ],
        },
        select: { leadId: true },
      })
      for (const row of byDocument) {
        leadIdSet.add(row.leadId)
      }
    }

    const leadIds = [...leadIdSet]

    if (leadIds.length === 0 && portfolioIds.length === 0) {
      return { portfolios: [] as const, finalized: [] as const }
    }

    const portfolioWhere: Prisma.LeadPortfolioWhereInput =
      leadIds.length > 0 && portfolioIds.length > 0
        ? { teamId: scope.teamId, OR: [{ leadId: { in: leadIds } }, { id: { in: portfolioIds } }] }
        : leadIds.length > 0
          ? { teamId: scope.teamId, leadId: { in: leadIds } }
          : { teamId: scope.teamId, id: { in: portfolioIds } }

    const portfolios = await this.db.leadPortfolio.findMany({
      where: portfolioWhere,
      select: {
        id: true,
        leadId: true,
        portfolioStatus: true,
        renewalStatus: true,
        renewalAmount: true,
        source: true,
        note: true,
        lastContactAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    const resolvedLeadIds = [...new Set([...leadIds, ...portfolios.map((row) => row.leadId)])]
    const finalized =
      resolvedLeadIds.length === 0
        ? []
        : await this.db.leadFinalized.findMany({
            where: { leadId: { in: resolvedLeadIds }, lead: { teamId: scope.teamId } },
            select: {
              id: true,
              leadId: true,
              finalizedDateAt: true,
              startDateAt: true,
              amount: true,
              contractType: true,
              operadora: true,
              productName: true,
              notes: true,
              createdAt: true,
              holder: {
                select: {
                  id: true,
                  name: true,
                  razaoSocial: true,
                  birthDate: true,
                  document: true,
                  cnpj: true,
                },
              },
              dependents: {
                select: {
                  id: true,
                  name: true,
                  birthDate: true,
                  parentesco: true,
                  document: true,
                },
                orderBy: { name: "asc" },
              },
            },
            orderBy: { finalizedDateAt: "desc" },
          })

    return { portfolios, finalized }
  }

  async findEmailContactIdsByListIds(teamId: string, listIds: string[]): Promise<string[]> {
    const contacts = await this.db.emailContact.findMany({
      where: { listId: { in: listIds }, list: { teamId } },
      select: { id: true },
    })
    return contacts.map((contact) => contact.id)
  }

  /**
   * D6: `customFields` é um Json livre (chaves vêm do cabeçalho do arquivo
   * importado, sem catálogo fixo) — diferente de `LeadCustomFieldValue`
   * (linha EAV por definição), não dá pra filtrar via um path Prisma
   * confiável para "chave ausente" (is_empty/not_empty). Filtra em memória
   * sobre os contatos do team — aceitável no volume atual (import limitado
   * a `EMAIL_CONTACT_IMPORT_MAX_ROWS` por vez).
   */
  async findEmailContactIdsByCustomField(
    teamId: string,
    fieldKey: string,
    operator: "eq" | "neq" | "contains" | "is_empty" | "not_empty",
    value: unknown
  ): Promise<string[]> {
    const contacts = await this.db.emailContact.findMany({
      where: { list: { teamId } },
      select: { id: true, customFields: true },
    })

    const normalizedValue = value == null ? "" : String(value).toLowerCase()

    const matches = contacts.filter((contact) => {
      const customFields = (contact.customFields ?? {}) as Record<string, unknown>
      const raw = customFields[fieldKey]
      const fieldValue = raw == null ? "" : String(raw)

      switch (operator) {
        case "is_empty":
          return fieldValue === ""
        case "not_empty":
          return fieldValue !== ""
        case "eq":
          return fieldValue.toLowerCase() === normalizedValue
        case "neq":
          return fieldValue.toLowerCase() !== normalizedValue
        case "contains":
          return fieldValue.toLowerCase().includes(normalizedValue)
      }
    })

    return matches.map((contact) => contact.id)
  }

  async listProfilesForSegmentationByIds(teamId: string, profileIds: string[]) {
    const uniqueIds = [...new Set(profileIds.filter(Boolean))]
    if (uniqueIds.length === 0) return []

    return this.db.radarProfile.findMany({
      where: { teamId, id: { in: uniqueIds } },
      select: {
        id: true,
        displayName: true,
        normalizedPrimaryEmail: true,
        consents: { where: { channel: "email" }, select: { status: true, reason: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        events: {
          select: { eventType: true, occurredAt: true, metadata: true, sourceType: true, sourceId: true },
        },
        identities: {
          where: { type: "lead_id" },
          select: { type: true, normalizedValue: true },
        },
      },
    })
  }

  async listProfilesForSegmentation(teamId: string) {
    return this.db.radarProfile.findMany({
      where: { teamId },
      select: {
        id: true,
        displayName: true,
        normalizedPrimaryEmail: true,
        consents: { where: { channel: "email" }, select: { status: true, reason: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        events: {
          select: { eventType: true, occurredAt: true, metadata: true, sourceType: true, sourceId: true },
        },
        identities: {
          where: { type: "lead_id" },
          select: { type: true, normalizedValue: true },
        },
      },
    })
  }

  async listRadarEmailVariables(teamId: string) {
    return this.db.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR" },
      select: { key: true, radarFieldKey: true, defaultValue: true },
    })
  }

  async findLeadsForRadarFieldResolution(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map()

    const leads = await this.db.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: {
        id: true,
        status: true,
        currentHealthPlan: true,
        soldPlan: true,
        contractDueDate: true,
        referenceHospital: true,
      },
    })

    return new Map(leads.map((lead) => [lead.id, lead]))
  }

  async listProfilesForProfileDataSync(teamId: string) {
    return this.db.radarProfile.findMany({
      where: { teamId },
      select: {
        id: true,
        displayName: true,
        displayPhone: true,
        primaryEmail: true,
        primaryDocument: true,
        lastSeenAt: true,
        consents: { select: { channel: true, status: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        identities: { select: { type: true, normalizedValue: true } },
      },
    })
  }

  async updateProfileData(profileId: string, teamId: string, profileData: Prisma.InputJsonValue) {
    return this.db.radarProfile.updateMany({
      where: { id: profileId, teamId },
      data: { profileData },
    })
  }

  async findProfilesForInterpolationByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return []

    return this.db.radarProfile.findMany({
      where: { teamId, normalizedPrimaryEmail: { in: unique } },
      select: {
        normalizedPrimaryEmail: true,
        displayName: true,
        displayPhone: true,
        primaryEmail: true,
        primaryDocument: true,
        lastSeenAt: true,
        consents: { select: { channel: true, status: true } },
        sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
        identities: { select: { type: true, normalizedValue: true } },
      },
    })
  }

  async findProfileDataByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return new Map<string, Record<string, string>>()

    const profiles = await this.db.radarProfile.findMany({
      where: { teamId, normalizedPrimaryEmail: { in: unique } },
      select: { normalizedPrimaryEmail: true, profileData: true },
    })

    const map = new Map<string, Record<string, string>>()
    for (const profile of profiles) {
      if (!profile.normalizedPrimaryEmail) continue
      const data = profile.profileData
      if (data && typeof data === "object" && !Array.isArray(data)) {
        map.set(
          profile.normalizedPrimaryEmail,
          Object.fromEntries(
            Object.entries(data as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")])
          )
        )
      }
    }
    return map
  }

  async findRadarVariableFallbacks(teamId: string) {
    return this.db.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR", defaultValue: { not: null } },
      select: { key: true, defaultValue: true },
    })
  }

  async findPixelConfigByTeamId(teamId: string) {
    return this.db.teamRadarPixelConfig.findUnique({
      where: { teamId },
      select: { publicToken: true, allowedOrigins: true, lastUsedAt: true },
    })
  }

  async upsertPixelConfig(teamId: string, profileId: string, data: { publicToken: string; allowedOrigins: string[] }) {
    return this.db.teamRadarPixelConfig.upsert({
      where: { teamId },
      create: { teamId, publicToken: data.publicToken, allowedOrigins: data.allowedOrigins, updatedByProfileId: profileId },
      update: { allowedOrigins: data.allowedOrigins, updatedByProfileId: profileId },
      select: { publicToken: true, allowedOrigins: true, lastUsedAt: true },
    })
  }

  async deletePixelConfig(teamId: string) {
    await this.db.teamRadarPixelConfig.deleteMany({ where: { teamId } })
  }

  async findPixelHitLogs(teamId: string, limit: number) {
    return this.db.teamRadarPixelHitLog.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, teamId: true, eventType: true, visitorSession: true, origin: true, userAgent: true, metadata: true, createdAt: true },
    })
  }

  async findPixelConfigByPublicToken(publicToken: string): Promise<{ teamId: string; allowedOrigins: string[] } | null> {
    return this.db.teamRadarPixelConfig.findUnique({
      where: { publicToken },
      select: { teamId: true, allowedOrigins: true },
    })
  }

  async touchPixelLastUsed(teamId: string) {
    await this.db.teamRadarPixelConfig.update({ where: { teamId }, data: { lastUsedAt: new Date() } })
  }

  async logPixelHit(input: {
    teamId: string
    eventType: string
    visitorSession: string
    origin: string | null
    userAgent: string | null
    metadata?: object
  }) {
    await this.db.teamRadarPixelHitLog.create({
      data: {
        teamId: input.teamId,
        eventType: input.eventType,
        visitorSession: input.visitorSession,
        origin: input.origin,
        userAgent: input.userAgent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  }

  async findSourceLinkBySource(input: {
    teamId: string
    sourceType: RadarSourceType
    sourceId: string
  }) {
    return this.db.radarSourceLink.findUnique({
      where: {
        teamId_sourceType_sourceId: {
          teamId: input.teamId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      select: { id: true, profileId: true },
    })
  }

  async deleteSourceLinkById(id: string) {
    await this.db.radarSourceLink.deleteMany({ where: { id } })
  }

  /**
   * D14: ao corrigir o documento de um titular/dependente, remove a identidade
   * obsoleta do perfil anterior (evita fantasma com documento antigo no Radar).
   * Quando `keepNormalizedDocument` é `null`, remove todas as identidades do tipo.
   */
  async removeObsoleteContractIdentity(input: {
    teamId: string
    profileId: string
    identityType: Extract<RadarIdentityType, "contract_holder" | "contract_dependent">
    keepNormalizedDocument: string | null
  }) {
    const identities = await this.db.radarIdentity.findMany({
      where: {
        teamId: input.teamId,
        profileId: input.profileId,
        type: input.identityType,
      },
      select: { id: true, normalizedValue: true },
    })

    const obsolete =
      input.keepNormalizedDocument === null
        ? identities
        : identities.filter(
            (identity) => identity.normalizedValue !== input.keepNormalizedDocument
          )
    if (obsolete.length === 0) return { removed: 0 }

    await this.db.radarIdentity.deleteMany({
      where: { id: { in: obsolete.map((identity) => identity.id) } },
    })

    const profile = await this.db.radarProfile.findUnique({
      where: { id: input.profileId },
      select: { normalizedPrimaryDocument: true },
    })
    if (
      profile?.normalizedPrimaryDocument &&
      obsolete.some((identity) => identity.normalizedValue === profile.normalizedPrimaryDocument)
    ) {
      await this.db.radarProfile.update({
        where: { id: input.profileId },
        data: { primaryDocument: null, normalizedPrimaryDocument: null },
      })
    }

    return { removed: obsolete.length }
  }

  /**
   * D14: remove perfil fantasma após correção de documento — só quando não
   * restam identidades nem source links (preserva perfis ainda referenciados).
   */
  async deleteOrphanRadarProfileIfEmpty(input: { teamId: string; profileId: string }) {
    const profile = await this.db.radarProfile.findFirst({
      where: { id: input.profileId, teamId: input.teamId },
      select: {
        id: true,
        _count: { select: { identities: true, sourceLinks: true } },
      },
    })
    if (!profile) return { deleted: false }
    if (profile._count.identities > 0 || profile._count.sourceLinks > 0) {
      return { deleted: false }
    }

    await this.db.radarProfile.delete({ where: { id: profile.id } })
    return { deleted: true }
  }

  async getProfileNormalizedDocument(
    teamId: string,
    profileId: string
  ): Promise<{ found: false } | { found: true; doc: string | null }> {
    const profile = await this.db.radarProfile.findFirst({
      where: { id: profileId, teamId },
      select: { normalizedPrimaryDocument: true },
    })
    if (!profile) return { found: false }
    return { found: true, doc: profile.normalizedPrimaryDocument }
  }

  /**
   * D14: histórico de contratos por documento — titular OU dependente.
   * Perfis `contract_dependent` têm o doc em LeadFinalizedDependent, não no holder.
   */
  async findFinalizedContractsByNormalizedDocument(teamId: string, doc: string) {
    return this.db.leadFinalized.findMany({
      where: {
        lead: { teamId },
        OR: [
          { holder: { document: doc } },
          { holder: { cnpj: doc } },
          { dependents: { some: { document: doc } } },
        ],
      },
      select: {
        id: true,
        leadId: true,
        finalizedDateAt: true,
        amount: true,
        contractType: true,
        operadora: true,
        productName: true,
        createdAt: true,
        holder: {
          select: {
            id: true,
            name: true,
            document: true,
            cnpj: true,
            birthDate: true,
          },
        },
        dependents: {
          select: {
            id: true,
            name: true,
            document: true,
            birthDate: true,
            parentesco: true,
          },
          orderBy: { name: "asc" },
        },
        lead: {
          select: {
            id: true,
            portfolio: {
              select: {
                id: true,
                portfolioStatus: true,
                renewalStatus: true,
                renewalAmount: true,
                source: true,
                lastContactAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { finalizedDateAt: "desc" },
    })
  }

  /**
   * Fase 2: calcula as 8 contagens de segmentos fixos do Radar com agregação
   * SQL nativa (Postgres) usando CTEs, substituindo varredura em memória.
   * Retorna Map<slug, count> para preservar compatibilidade com o fluxo existente.
   */
  async countFixedSegmentsSQL(
    teamId: string,
    recentWindowDays: number = 30
  ): Promise<Map<string, number>> {
    const recentWindowMs = recentWindowDays * 24 * 60 * 60 * 1000
    const recentThreshold = new Date(Date.now() - recentWindowMs)

    const result = await this.db.$queryRaw<
      Array<{
        email_marketable: bigint
        email_blocked: bigint
        opened_not_clicked: bigint
        clicked_not_closed: bigint
        portfolio_renewal_due: bigint
        inactive_recent_campaign: bigint
        portfolio_clients: bigint
        crm_clients: bigint
      }>
    >`
      WITH profile_base AS (
        SELECT
          p.id,
          p."normalizedPrimaryEmail",
          EXISTS(
            SELECT 1 FROM "corretor_studio_radar_channel_consents" c
            WHERE c."profileId" = p.id AND c."teamId" = ${teamId}
              AND c."channel" = 'email' AND c."status" = 'blocked'
          ) AS has_blocked_consent,
          EXISTS(
            SELECT 1 FROM "corretor_studio_radar_channel_consents" c
            WHERE c."profileId" = p.id AND c."teamId" = ${teamId}
              AND c."channel" = 'email' AND c."status" = 'allowed'
          ) AS has_allowed_consent,
          EXISTS(
            SELECT 1 FROM "corretor_studio_radar_source_links" sl
            WHERE sl."profileId" = p.id AND sl."teamId" = ${teamId}
              AND sl."sourceType" = 'portfolio'
          ) AS has_portfolio,
          EXISTS(
            SELECT 1 FROM "corretor_studio_radar_identities" i
            WHERE i."profileId" = p.id AND i."teamId" = ${teamId}
              AND i."type" = 'lead_id'
          ) AS has_lead_id,
          EXISTS(
            SELECT 1 FROM "corretor_studio_radar_events" e
            WHERE e."profileId" = p.id AND e."teamId" = ${teamId}
              AND e."eventType" = 'email.sent'
              AND e."occurredAt" >= ${recentThreshold}
          ) AS has_recent_sent
        FROM "corretor_studio_radar_profiles" p
        WHERE p."teamId" = ${teamId}
      ),
      email_events AS (
        SELECT
          e."profileId",
          e."eventType",
          e."occurredAt",
          e."metadata"
        FROM "corretor_studio_radar_events" e
        WHERE e."teamId" = ${teamId}
          AND e."eventType" IN ('email.opened', 'email.clicked')
          AND e."occurredAt" >= ${recentThreshold}
      ),
      campaign_opens AS (
        SELECT DISTINCT
          ee."profileId",
          ee."metadata"->>'campaignId' AS campaign_id
        FROM email_events ee
        WHERE ee."eventType" = 'email.opened'
          AND ee."metadata"->>'campaignId' IS NOT NULL
      ),
      campaign_clicks AS (
        SELECT DISTINCT
          ee."profileId",
          ee."metadata"->>'campaignId' AS campaign_id
        FROM email_events ee
        WHERE ee."eventType" = 'email.clicked'
          AND ee."metadata"->>'campaignId' IS NOT NULL
      ),
      opened_not_clicked_profiles AS (
        SELECT DISTINCT co."profileId"
        FROM campaign_opens co
        LEFT JOIN campaign_clicks cc
          ON co."profileId" = cc."profileId"
          AND co.campaign_id = cc.campaign_id
        WHERE cc."profileId" IS NULL
      ),
      clicked_profiles AS (
        SELECT DISTINCT ee."profileId"
        FROM email_events ee
        WHERE ee."eventType" = 'email.clicked'
          AND ee."metadata"->>'campaignId' IS NOT NULL
      ),
      closed_profiles AS (
        SELECT p.id
        FROM "corretor_studio_radar_profiles" p
        WHERE p."teamId" = ${teamId}
          AND (
            EXISTS(
              SELECT 1 FROM "corretor_studio_radar_source_links" sl
              WHERE sl."profileId" = p.id AND sl."teamId" = ${teamId}
                AND sl."sourceType" = 'portfolio'
            )
            OR EXISTS(
              SELECT 1 FROM "corretor_studio_radar_identities" i
              INNER JOIN "corretor_studio_leads" l ON i."normalizedValue" = l.id::text
              WHERE i."profileId" = p.id AND i."teamId" = ${teamId}
                AND i."type" = 'lead_id'
                AND l."teamId" = ${teamId}
                AND l."status" IN ('WON', 'PAID')
            )
          )
      ),
      clicked_not_closed_profiles AS (
        SELECT cp."profileId"
        FROM clicked_profiles cp
        LEFT JOIN closed_profiles clp ON cp."profileId" = clp.id
        WHERE clp.id IS NULL
      ),
      renewal_due_profiles AS (
        SELECT DISTINCT p.id
        FROM "corretor_studio_radar_profiles" p
        WHERE p."teamId" = ${teamId}
          AND (
            EXISTS(
              SELECT 1 FROM "corretor_studio_radar_events" e
              WHERE e."profileId" = p.id AND e."teamId" = ${teamId}
                AND e."eventType" = 'portfolio.renewal_due'
            )
            OR EXISTS(
              SELECT 1 FROM "corretor_studio_radar_source_links" sl
              WHERE sl."profileId" = p.id AND sl."teamId" = ${teamId}
                AND sl."sourceType" = 'portfolio'
                AND sl."sourceMetadata"->>'renewalStatus' IN ('to_renew', 'contacted')
            )
          )
      )
      SELECT
        COUNT(*) FILTER (
          WHERE pb."normalizedPrimaryEmail" IS NOT NULL
            AND pb."normalizedPrimaryEmail" != ''
            AND (NOT pb.has_blocked_consent)
            AND (pb.has_allowed_consent OR NOT EXISTS(
              SELECT 1 FROM "corretor_studio_radar_channel_consents" c
              WHERE c."profileId" = pb.id AND c."teamId" = ${teamId}
                AND c."channel" = 'email'
            ))
        ) AS email_marketable,
        COUNT(*) FILTER (WHERE pb.has_blocked_consent) AS email_blocked,
        COUNT(oncp."profileId") AS opened_not_clicked,
        COUNT(cncp."profileId") AS clicked_not_closed,
        COUNT(rdp.id) AS portfolio_renewal_due,
        COUNT(*) FILTER (WHERE NOT pb.has_recent_sent) AS inactive_recent_campaign,
        COUNT(*) FILTER (WHERE pb.has_portfolio) AS portfolio_clients,
        COUNT(*) FILTER (WHERE pb.has_lead_id) AS crm_clients
      FROM profile_base pb
      LEFT JOIN opened_not_clicked_profiles oncp ON pb.id = oncp."profileId"
      LEFT JOIN clicked_not_closed_profiles cncp ON pb.id = cncp."profileId"
      LEFT JOIN renewal_due_profiles rdp ON pb.id = rdp.id
    `

    const row = result[0]
    if (!row) {
      return new Map()
    }

    return new Map([
      ["email_marketable", Number(row.email_marketable)],
      ["email_blocked", Number(row.email_blocked)],
      ["opened_not_clicked", Number(row.opened_not_clicked)],
      ["clicked_not_closed", Number(row.clicked_not_closed)],
      ["portfolio_renewal_due", Number(row.portfolio_renewal_due)],
      ["inactive_recent_campaign", Number(row.inactive_recent_campaign)],
      ["portfolio_clients", Number(row.portfolio_clients)],
      ["crm_clients", Number(row.crm_clients)],
    ])
  }
}

export const radarRepository = new RadarRepository()

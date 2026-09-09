import {
  Prisma,
  type RadarChannel,
  type RadarConsentReason,
  type RadarConsentStatus,
  type RadarIdentityType,
  type RadarProfile,
  type RadarSourceType,
  type LeadStatus,
} from "@prisma/client"
import { randomUUID } from "node:crypto"
import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma"
import type { PrismaClient } from "@prisma/client"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"
import { RADAR_EXPORT_MAX_ROWS } from "@/lib/radar/exportRadarProfiles"
import { allowedCurrentSourcesForGenderWrite, type RadarGenderSource } from "@/lib/radar/gender"
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
import {
  publishRadarEngagementScoreUpdate,
  RADAR_ENGAGEMENT_SCORE_QUEUE_PUBLISH_FAILED_TAG,
} from "@/lib/queues/radar-engagement-score-updates"
import {
  buildFixedSegmentCountSql,
  buildFixedSegmentCountsSql,
  buildFixedSegmentProfileIdsSql,
} from "@/lib/radar/fixed-segment-sql"
import { RADAR_SEGMENT_SLUGS, type RadarSegmentSlug } from "@/lib/radar/segment-config"
import {
  isPendingLeadIdentity,
  PENDING_LEAD_IDENTITY_PREFIX,
  PENDING_LEAD_IDENTITY_STALE_MS,
} from "@/lib/radar/lead-identity"
import { escapeLikePattern } from "@/lib/prisma/escape-like-pattern"
import { findManyByInChunks } from "@/lib/prisma/chunked-in-query"
import { PUBLIC_FORM_RADAR_SOURCE_TYPE } from "@/lib/radar/map-public-form-metric-to-radar-event"
import { normalizeRadarName } from "@/lib/radar/normalization"
import { isUsableRadarDisplayName } from "@/lib/radar/usable-radar-name"
import {
  decideEmailProfileMatch,
  pickCompatibleEmailColumnCandidate,
} from "@/lib/radar/email-profile-match"
import { applyPublicFormAnswerRevision } from "@/lib/radar/public-form-materialization"
import { projectPublicFormAnswerIdentity } from "@/lib/radar/public-form-identity-projection"
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"
import type {
  MaterializePublicFormAnswerInput,
  MaterializePublicFormAnswerResult,
  ReconcileAnsweredEmailInput,
  ReconcileAnsweredEmailResult,
} from "@/app/api/infra/data/repositories/radar/IRadarPublicFormMaterializationRepository"

const ENGAGEMENT_CACHE_TTL_MS = 5 * 60 * 1000
const TRANSIENT_PRISMA_ERROR_CODES = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"])

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

export type RadarProfileMergeResult = {
  winningProfileId: string
  merged: boolean
  conflict: boolean
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
  gender: true,
  genderSource: true,
  createdAt: true,
  updatedAt: true,
} as const

export class RadarRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async runWithTransientPrismaRetry<T>(
    operation: () => Promise<T>,
    label: string,
    retries = 2,
  ): Promise<T> {
    const delayMs = 150
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        const code =
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : (error as { code?: string } | null)?.code

        const isTransient = !!code && TRANSIENT_PRISMA_ERROR_CODES.has(code)
        const hasRetriesLeft = attempt < retries

        if (!isTransient || !hasRetriesLeft) {
          throw error
        }

        console.warn(
          `[RadarRepository][${label}] Transient error (${code}). Retrying (${attempt + 1}/${retries})...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        await this.db.$connect()
      }
    }

    throw lastError
  }

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
   * E3c: o vínculo `RadarIdentity` do tipo `lead_id` não é FK — é um UUID
   * solto (regra 1:N do PR #1114: um perfil pode ter várias identidades
   * `lead_id`, uma por lead do CRM já vinculado). Quando `MergeLeadsUseCase`
   * apaga `sourceLeadId` no merge de CRM, a identidade que apontava pra ele
   * fica presa a um lead morto — a seção "Leads no CRM" do perfil aponta pra
   * um registro que não existe mais.
   *
   * Chamado sempre, depois do merge de perfis Radar (se ele rodou):
   * - Nenhuma identidade `lead_id = sourceLeadId`: no-op (nada a corrigir).
   * - Existe, e ninguém tem `lead_id = targetLeadId` ainda: reaponta o
   *   valor da identidade para `targetLeadId` (perfil não perde o vínculo).
   * - Existe, e algum perfil já tem `lead_id = targetLeadId` — inclusive o
   *   próprio, se o merge de perfis acima já uniu os dois: a identidade do
   *   lead alvo já é o vínculo válido; apaga a de origem para não duplicar
   *   `lead_id` no mesmo par perfil↔lead.
   */
  async reconcileLeadIdentityAfterMerge(
    teamId: string,
    sourceLeadId: string,
    targetLeadId: string,
  ): Promise<void> {
    const sourceIdentity = await this.db.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId, type: "lead_id", normalizedValue: sourceLeadId },
      },
      select: { id: true },
    })
    if (!sourceIdentity) return

    const targetIdentity = await this.db.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId, type: "lead_id", normalizedValue: targetLeadId },
      },
      select: { id: true },
    })

    if (targetIdentity) {
      await this.db.radarIdentity.delete({ where: { id: sourceIdentity.id } })
      return
    }

    // `value` e `normalizedValue` sempre andam juntos nos writes de `lead_id`
    // (ver `RadarLeadGateUnitOfWork.linkLeadIdentity`), e o gate resolve o
    // lead com preferência pelo `value` (`getProfile`: `value ??
    // normalizedValue`). Atualizar só o normalizado deixaria o `value` preso
    // ao UUID do lead deletado — exatamente o vínculo morto que este método
    // existe para corrigir.
    await this.db.radarIdentity.update({
      where: { id: sourceIdentity.id },
      data: { value: targetLeadId, normalizedValue: targetLeadId },
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
    winningProfileId: string,
  ): Promise<void> {
    if (losingProfileId === winningProfileId) return

    const result = await this.db.$transaction(async (tx) => {
      return this.mergeProfilesWithTx(
        tx,
        teamId,
        losingProfileId,
        winningProfileId,
        "merge_crm_confirmed",
      )
    })

    if (result.merged) await this.updateEngagementScore(winningProfileId, teamId)
  }

  async mergePublicFormProfiles(
    teamId: string,
    losingProfileId: string,
    winningProfileId: string,
  ): Promise<RadarProfileMergeResult> {
    if (losingProfileId === winningProfileId) {
      return { winningProfileId, merged: false, conflict: false }
    }
    const result = await this.db.$transaction((tx) =>
      this.mergeProfilesWithTx(
        tx,
        teamId,
        losingProfileId,
        winningProfileId,
        "preserve_distinct_leads",
      ),
    )
    if (result.merged) await this.updateEngagementScore(result.winningProfileId, teamId)
    return result
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
    winningProfileId: string,
    leadConflictPolicy:
      | "preserve_distinct_leads"
      | "merge_crm_confirmed" = "preserve_distinct_leads",
  ): Promise<RadarProfileMergeResult> {
    const leadIdentities = await tx.radarIdentity.findMany({
      where: {
        teamId,
        profileId: { in: [losingProfileId, winningProfileId] },
        type: "lead_id",
      },
      select: { profileId: true, normalizedValue: true },
    })
    const losingLeadId = leadIdentities.find(
      (identity) => identity.profileId === losingProfileId,
    )?.normalizedValue
    const winningLeadId = leadIdentities.find(
      (identity) => identity.profileId === winningProfileId,
    )?.normalizedValue
    if (
      leadConflictPolicy === "preserve_distinct_leads" &&
      losingLeadId &&
      winningLeadId &&
      losingLeadId !== winningLeadId
    ) {
      return { winningProfileId, merged: false, conflict: true }
    }

    if (losingLeadId && !winningLeadId) {
      const requestedWinnerId = winningProfileId
      winningProfileId = losingProfileId
      losingProfileId = requestedWinnerId
    }

    const [losingProfile, winningProfile] = await Promise.all([
      tx.radarProfile.findUnique({
        where: { id: losingProfileId },
        select: {
          displayName: true,
          normalizedName: true,
          displayPhone: true,
          normalizedPhone: true,
          primaryEmail: true,
          normalizedPrimaryEmail: true,
        },
      }),
      tx.radarProfile.findUnique({
        where: { id: winningProfileId },
        select: {
          displayName: true,
          normalizedName: true,
          displayPhone: true,
          normalizedPhone: true,
          primaryEmail: true,
          normalizedPrimaryEmail: true,
        },
      }),
    ])
    if (!losingProfile || !winningProfile) {
      throw new Error("Perfil Radar não encontrado durante merge")
    }

    const winnerHasUsableName =
      Boolean(winningProfile.displayName.trim()) &&
      winningProfile.displayName !== "Visitante Anônimo"
    // Adenda E6b (02/09, caso KKJ/perfil 86426c89): o placeholder "Visitante
    // Anônimo" do PERDEDOR não é um nome usável — sem este guard espelhado, o
    // vencedor recém-identificado (telefone/e-mail conhecidos, `displayName`
    // ainda vazio) herdava o rótulo literal de anônimo em vez de ficar sem
    // nome (o que deixaria a herança do destinatário da campanha, adenda E1b
    // do lado do perfil, decidir o nome de verdade).
    const loserHasUsableName =
      Boolean(losingProfile.displayName.trim()) &&
      losingProfile.displayName !== "Visitante Anônimo"
    await tx.radarProfile.update({
      where: { id: winningProfileId },
      data: {
        ...(!winnerHasUsableName && loserHasUsableName
          ? {
              displayName: losingProfile.displayName,
              normalizedName: losingProfile.normalizedName,
            }
          : {}),
        displayPhone: winningProfile.displayPhone ?? losingProfile.displayPhone ?? undefined,
        normalizedPhone:
          winningProfile.normalizedPhone ?? losingProfile.normalizedPhone ?? undefined,
        primaryEmail: winningProfile.primaryEmail ?? losingProfile.primaryEmail ?? undefined,
        normalizedPrimaryEmail:
          winningProfile.normalizedPrimaryEmail ??
          losingProfile.normalizedPrimaryEmail ??
          undefined,
      },
    })

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
        where: {
          teamId,
          sourceType: link.sourceType,
          sourceId: link.sourceId,
          profileId: winningProfileId,
        },
        select: { id: true },
      })
      if (conflict) {
        await tx.radarSourceLink.delete({ where: { id: link.id } })
      } else {
        await tx.radarSourceLink.update({
          where: { id: link.id },
          data: { profileId: winningProfileId },
        })
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
          await tx.radarEvent.update({
            where: { id: event.id },
            data: { profileId: winningProfileId },
          })
        } else if (event.occurredAt < existingFirstContact.occurredAt) {
          await tx.radarEvent.delete({ where: { id: existingFirstContact.id } })
          await tx.radarEvent.update({
            where: { id: event.id },
            data: { profileId: winningProfileId },
          })
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
        await tx.radarEvent.update({
          where: { id: event.id },
          data: { profileId: winningProfileId },
        })
      }
    }

    const consentRank: Record<RadarConsentStatus, number> = { blocked: 2, unknown: 0, allowed: 1 }
    const losingConsents = await tx.radarChannelConsent.findMany({
      where: { profileId: losingProfileId },
    })
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
    return { winningProfileId, merged: true, conflict: false }
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
   * Achado #7 (code review 2026-08-19): quando o perfil já existe (dono da
   * identidade), displayName/normalizedName aceitam o valor mais recente
   * não-vazio da fonte atual (mesma política de resolveProfileForDocument)
   * -- antes, este caminho nunca sobrescrevia, entao uma correcao de nome
   * digitada depois de o telefone ja ter criado o perfil era silenciosamente
   * ignorada.
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
        let resolvedProfileId = existingByIdentity.profileId
        // Achado 2026-09-03 (caso PIMENTAS/KKJ): `false` só quando ninguém
        // reivindicou o e-mail ainda — nesse caso este bloco precisa
        // reivindicar a RadarIdentity abaixo (ver comentário na claim). Quando
        // já existe dono (mesmo perfil, ou perfil diferente com/sem merge),
        // a claim já está — ou permanece, no caso de conflito — correta e não
        // deve ser tocada aqui.
        let emailIdentityAlreadyOwned = false
        // `false` somente quando a guarda de e-mail compartilhado recusou o
        // merge: a claim ficou com o dono divergente e o chamador MUST NOT
        // reivindicá-la por fora (mesmo contrato de resolveProfileForEmail).
        let emailIdentityClaimed = true
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

          if (emailOwner) {
            emailIdentityAlreadyOwned = true
            if (emailOwner.profileId !== existingByIdentity.profileId) {
              // Guarda de e-mail compartilhado (achados cursor/codex no PR
              // #1155): fundir sem olhar quem é o dono transformaria caixa
              // postal compartilhada (contato@empresa) em fusão de pessoas
              // diferentes. Só funde quando o dono do e-mail NÃO é uma pessoa
              // estabelecida com nome divergente (mesma régua de
              // `decideEmailProfileMatch`); caso contrário a claim continua
              // com o dono e este perfil segue separado — a coluna registra o
              // e-mail compartilhado, sem claim.
              const emailOwnerProfile = await tx.radarProfile.findUnique({
                where: { id: emailOwner.profileId },
                select: { displayName: true, normalizedName: true, normalizedPhone: true },
              })
              const ownerDecision = decideEmailProfileMatch({
                candidate: {
                  displayName: emailOwnerProfile?.displayName ?? null,
                  normalizedName: emailOwnerProfile?.normalizedName ?? null,
                  normalizedPhone: emailOwnerProfile?.normalizedPhone ?? null,
                },
                incomingNormalizedName: input.normalizedName,
              })
              if (ownerDecision.action === "enrich") {
                const mergeResult = await this.mergeProfilesWithTx(
                  tx,
                  input.teamId,
                  emailOwner.profileId,
                  existingByIdentity.profileId,
                )
                resolvedProfileId = mergeResult.winningProfileId
                if (mergeResult.merged) mergedWinningProfileId = mergeResult.winningProfileId
              } else {
                emailIdentityClaimed = false
              }
            }
          }
        }

        const existingProfile = await tx.radarProfile.findUnique({
          where: { id: resolvedProfileId },
          select: {
            primaryEmail: true,
            normalizedPrimaryEmail: true,
            primaryDocument: true,
            normalizedPrimaryDocument: true,
            displayName: true,
            normalizedName: true,
          },
        })

        const profile = await tx.radarProfile.update({
          where: { id: resolvedProfileId },
          data: {
            displayPhone: input.displayPhone || undefined,
            primaryEmail: input.primaryEmail ?? existingProfile?.primaryEmail ?? undefined,
            normalizedPrimaryEmail:
              input.normalizedPrimaryEmail ?? existingProfile?.normalizedPrimaryEmail ?? undefined,
            primaryDocument: input.primaryDocument ?? existingProfile?.primaryDocument ?? undefined,
            normalizedPrimaryDocument:
              input.normalizedPrimaryDocument ??
              existingProfile?.normalizedPrimaryDocument ??
              undefined,
            displayName: input.displayName || existingProfile?.displayName || undefined,
            normalizedName: input.normalizedName || existingProfile?.normalizedName || undefined,
            lastSeenAt: input.lastSeenAt ?? new Date(),
          },
        })

        // Achado 2026-09-03 (caso PIMENTAS/KKJ): sem esta claim, um perfil
        // resolvido por telefone ficava com `normalizedPrimaryEmail`
        // preenchido só na COLUNA — `resolveProfileForEmail` só enxerga a
        // `RadarIdentity` exclusiva, nunca a coluna, então um contato de
        // e-mail chegando depois não encontrava o dono e criava um segundo
        // perfil para a mesma pessoa (3.163 pares medidos em produção).
        if (input.normalizedPrimaryEmail && !emailIdentityAlreadyOwned) {
          await tx.radarIdentity.upsert({
            where: {
              teamId_type_normalizedValue: {
                teamId: input.teamId,
                type: "email",
                normalizedValue: input.normalizedPrimaryEmail,
              },
            },
            create: {
              profileId: resolvedProfileId,
              teamId: input.teamId,
              type: "email",
              value: input.primaryEmail ?? null,
              normalizedValue: input.normalizedPrimaryEmail,
              source: input.phoneSource,
              isPrimary: false,
            },
            update: {
              profileId: resolvedProfileId,
              value: input.primaryEmail ?? undefined,
              source: input.phoneSource,
            },
          })
        }

        return { profile, wasExisting: true, emailIdentityClaimed }
      }

      // D4: telefone chegando pela primeira vez para um e-mail que já tem
      // perfil email-only — promove o mesmo perfil (nunca cria uma segunda
      // linha via chave natural telefone+nome). "Promover" = a identidade
      // phone passa a apontar para o profileId que já existia por e-mail.
      //
      // Guarda de e-mail compartilhado (achados cursor/codex no PR #1155):
      // se o dono do e-mail é uma pessoa ESTABELECIDA divergente (nome
      // próprio usável diferente + telefone próprio), promover colaria o
      // telefone do contato novo no perfil da outra pessoa. Nesse caso o
      // contato novo segue para o upsert por telefone+nome abaixo e a claim
      // de e-mail continua com o dono original (flag consumida na claim
      // final).
      let emailOwnedByDivergentProfile = false
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
          const emailOwnerProfile = await tx.radarProfile.findUnique({
            where: { id: existingByEmailIdentity.profileId },
            select: { displayName: true, normalizedName: true, normalizedPhone: true },
          })
          const ownerDecision = decideEmailProfileMatch({
            candidate: {
              displayName: emailOwnerProfile?.displayName ?? null,
              normalizedName: emailOwnerProfile?.normalizedName ?? null,
              normalizedPhone: emailOwnerProfile?.normalizedPhone ?? null,
            },
            incomingNormalizedName: input.normalizedName,
          })
          if (ownerDecision.action === "create_separate") {
            emailOwnedByDivergentProfile = true
          }
        }

        if (existingByEmailIdentity && !emailOwnedByDivergentProfile) {
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

          return { profile, wasExisting: true, emailIdentityClaimed: true }
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

      // Achado 2026-09-03 (caso PIMENTAS/KKJ): mesma claim que o bloco acima
      // faz para telefone, agora para e-mail — sem isso este perfil nascia
      // com `normalizedPrimaryEmail` só na coluna, sem `RadarIdentity`
      // correspondente, e um contato de e-mail chegando depois criava um
      // segundo perfil (`resolveProfileForEmail` só enxerga a identidade
      // exclusiva). Seguro reivindicar aqui: se o e-mail já estivesse
      // reivindicado por outro perfil, o bloco "D4" acima teria promovido
      // aquele perfil e retornado — OU marcado
      // `emailOwnedByDivergentProfile` (dono estabelecido divergente, caixa
      // postal compartilhada), caso em que a claim continua com o dono e
      // este perfil fica só com a coluna.
      if (input.normalizedPrimaryEmail && !emailOwnedByDivergentProfile) {
        await tx.radarIdentity.upsert({
          where: {
            teamId_type_normalizedValue: {
              teamId: input.teamId,
              type: "email",
              normalizedValue: input.normalizedPrimaryEmail,
            },
          },
          create: {
            profileId: profile.id,
            teamId: input.teamId,
            type: "email",
            value: input.primaryEmail ?? null,
            normalizedValue: input.normalizedPrimaryEmail,
            source: input.phoneSource,
            isPrimary: false,
          },
          update: {
            profileId: profile.id,
            value: input.primaryEmail ?? undefined,
            source: input.phoneSource,
          },
        })
      }

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

      return {
        profile,
        wasExisting: Boolean(existingByKey),
        // `false` = a claim ficou com o dono estabelecido divergente (guarda
        // D4 acima); o chamador MUST NOT reivindicar por fora.
        emailIdentityClaimed: !emailOwnedByDivergentProfile,
      }
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
  }): Promise<{ profile: RadarProfile; wasExisting: boolean; emailIdentityClaimed: boolean }> {
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
        // Achado codex PR #1155 (P1): com `resolveProfileForPhone` agora
        // reivindicando identidades de e-mail, o dono da claim pode ser uma
        // pessoa estabelecida DIFERENTE usando a mesma caixa postal —
        // enriquecer sem checar divergência anexaria contato/consentimento/
        // gênero do contato novo ao perfil da outra pessoa. Mesma guarda do
        // fallback por coluna.
        const ownerProfile = await tx.radarProfile.findUnique({
          where: { id: existingByIdentity.profileId },
          select: { displayName: true, normalizedName: true, normalizedPhone: true },
        })
        const ownerDecision = decideEmailProfileMatch({
          candidate: {
            displayName: ownerProfile?.displayName ?? null,
            normalizedName: ownerProfile?.normalizedName ?? null,
            normalizedPhone: ownerProfile?.normalizedPhone ?? null,
          },
          incomingNormalizedName: input.normalizedName,
        })

        if (ownerDecision.action === "enrich") {
          const profile = await this.enrichEmailOnlyProfileWithTx(tx, existingByIdentity.profileId, input)
          return { profile, wasExisting: true, emailIdentityClaimed: true }
        }

        // Dono estabelecido divergente: antes de criar mais um perfil,
        // procura um "secundário" compatível da mesma caixa postal (pela
        // coluna, excluindo o dono) — sem isso cada novo sync do mesmo
        // contato secundário criaria outro perfil. A claim NUNCA sai do
        // dono (`emailIdentityClaimed: false`).
        const compatibleSecondary = await this.findCompatibleEmailColumnProfileWithTx(
          tx,
          input,
          existingByIdentity.profileId,
        )
        if (compatibleSecondary) {
          const profile = await this.enrichEmailOnlyProfileWithTx(tx, compatibleSecondary.id, input)
          return { profile, wasExisting: true, emailIdentityClaimed: false }
        }
        const profile = await this.createEmailOnlyProfileWithTx(tx, input)
        return { profile, wasExisting: false, emailIdentityClaimed: false }
      }

      // Achado 2026-09-03 (caso PIMENTAS/KKJ): a `RadarIdentity` exclusiva
      // pode não existir mesmo quando alguém já "dono" deste e-mail — perfis
      // resolvidos por telefone (import de base, carteira) preenchiam a
      // COLUNA `normalizedPrimaryEmail` sem reivindicar a identidade (lacuna
      // fechada em `resolveProfileForPhone`, mas dados anteriores ao fix e
      // qualquer outro caminho não coberto continuam órfãos). Sem este
      // fallback, um contato de e-mail chegando depois nunca encontrava o
      // dono e criava um segundo perfil para a mesma pessoa — 3.163 pares
      // medidos em produção.
      const columnCandidates = await this.findEmailColumnCandidatesWithTx(
        tx,
        input.teamId,
        input.normalizedEmail,
      )

      if (columnCandidates.length > 0) {
        // Achado codex PR #1155 (P2): com mais de um perfil legado para o
        // mesmo e-mail, o mais antigo pode ser justamente o divergente —
        // `findFirst` asc escolhia só ele e recriava um duplicado a cada
        // sync. A seleção olha TODOS os candidatos: primeiro nome idêntico,
        // depois o primeiro enriquecível pela guarda.
        const compatible = pickCompatibleEmailColumnCandidate(columnCandidates, input.normalizedName)

        if (compatible) {
          const profile = await this.enrichEmailOnlyProfileWithTx(tx, compatible.id, input)
          await tx.radarIdentity.upsert({
            where: {
              teamId_type_normalizedValue: {
                teamId: input.teamId,
                type: "email",
                normalizedValue: input.normalizedEmail,
              },
            },
            create: {
              profileId: profile.id,
              teamId: input.teamId,
              type: "email",
              value: input.emailValue,
              normalizedValue: input.normalizedEmail,
              source: input.emailSource,
              isPrimary: true,
            },
            update: { profileId: profile.id, value: input.emailValue, source: input.emailSource },
          })
          return { profile, wasExisting: true, emailIdentityClaimed: true }
        }

        // Nenhum candidato compatível: e-mail compartilhado por pessoas
        // diferentes (todos os perfis existentes têm nome E telefone
        // próprios, divergentes do contato atual) — cria um perfil separado
        // e NÃO reivindica a `RadarIdentity` de e-mail, que continua
        // exclusiva do dono original (o schema não permite dois donos para o
        // mesmo `[teamId, type, normalizedValue]`). O CALLER MUST respeitar
        // `emailIdentityClaimed: false` e não chamar `upsertIdentity` por
        // cima — senão rouba a claim do dono original sem passar por merge.
        const profile = await this.createEmailOnlyProfileWithTx(tx, input)
        return { profile, wasExisting: false, emailIdentityClaimed: false }
      }

      const profile = await this.createEmailOnlyProfileWithTx(tx, input)
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
      return { profile, wasExisting: false, emailIdentityClaimed: true }
    })
  }

  /**
   * Achado codex PR #1148 (P2), par do E6b: sem isto, o nome recém-conhecido
   * (ex.: destinatário da campanha) era descartado e perfis antigos com
   * nome-placeholder nunca recebiam nome. Só entra quando o nome existente
   * NÃO é usável (`isUsableRadarDisplayName`) — identidade digitada real
   * nunca é sobrescrita pela inferida. Extraído para ser reusado pelo
   * fallback por coluna (achado 2026-09-03, caso PIMENTAS/KKJ) sem duplicar a
   * regra de herança de nome.
   */
  private async enrichEmailOnlyProfileWithTx(
    tx: Prisma.TransactionClient,
    profileId: string,
    input: { displayName: string | null; lastSeenAt?: Date },
  ) {
    let inheritedName: string | null = null
    if (input.displayName?.trim()) {
      const existingProfile = await tx.radarProfile.findUnique({
        where: { id: profileId },
        select: { displayName: true },
      })
      if (!isUsableRadarDisplayName(existingProfile?.displayName)) {
        inheritedName = input.displayName.trim()
      }
    }
    return tx.radarProfile.update({
      where: { id: profileId },
      data: {
        lastSeenAt: input.lastSeenAt ?? new Date(),
        ...(inheritedName
          ? { displayName: inheritedName, normalizedName: normalizeRadarName(inheritedName) }
          : {}),
      },
    })
  }

  /**
   * Candidatos legados da mesma caixa postal — perfis com o e-mail na COLUNA
   * `normalizedPrimaryEmail` (com ou sem a `RadarIdentity` exclusiva; o
   * chamador exclui o dono da claim quando ele existe). Ordem por
   * `createdAt` asc para a seleção ser determinística.
   */
  private async findEmailColumnCandidatesWithTx(
    tx: Prisma.TransactionClient,
    teamId: string,
    normalizedEmail: string,
    excludeProfileId?: string,
  ) {
    return tx.radarProfile.findMany({
      where: {
        teamId,
        normalizedPrimaryEmail: normalizedEmail,
        ...(excludeProfileId ? { id: { not: excludeProfileId } } : {}),
      },
      select: { id: true, displayName: true, normalizedName: true, normalizedPhone: true },
      orderBy: { createdAt: "asc" },
    })
  }

  private async findCompatibleEmailColumnProfileWithTx(
    tx: Prisma.TransactionClient,
    input: { teamId: string; normalizedEmail: string; normalizedName: string | null },
    excludeProfileId: string,
  ) {
    const candidates = await this.findEmailColumnCandidatesWithTx(
      tx,
      input.teamId,
      input.normalizedEmail,
      excludeProfileId,
    )
    return pickCompatibleEmailColumnCandidate(candidates, input.normalizedName)
  }

  /** D5: "primeiro contato" — sempre um perfil genuinamente novo. */
  private async createEmailOnlyProfileWithTx(
    tx: Prisma.TransactionClient,
    input: {
      teamId: string
      normalizedEmail: string
      emailValue: string
      displayName: string | null
      normalizedName: string | null
      lastSeenAt?: Date
    },
  ) {
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

    return profile
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
        // Achado #7 (code review 2026-08-19): mesma política de
        // resolveProfileForPhone -- aceita o nome mais recente não-vazio,
        // nunca sobrescreve com string vazia (não derruba um nome já bom
        // com dado ausente da fonte atual).
        const existingProfile = await tx.radarProfile.findUnique({
          where: { id: existingByIdentity.profileId },
          select: { displayName: true, normalizedName: true },
        })
        const profile = await tx.radarProfile.update({
          where: { id: existingByIdentity.profileId },
          data: {
            lastSeenAt: input.lastSeenAt ?? new Date(),
            displayName: input.displayName || existingProfile?.displayName || undefined,
            normalizedName: input.normalizedName || existingProfile?.normalizedName || undefined,
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
    occurredAt: Date,
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
  async hasEventEverOccurredForSource(
    teamId: string,
    sourceType: string,
    sourceId: string,
    eventType: string,
  ) {
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
        input.occurredAt,
      ))
    ) {
      return null
    }

    try {
      // Retry only when sourceId is present: the unique constraint cannot
      // dedupe NULL sourceIds, so a transient failure after commit would
      // double-insert on retry and inflate engagement scores.
      const createEvent = () =>
        this.db.radarEvent.create({
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
      const created = input.sourceId
        ? await withPrismaRetry(createEvent, {
            label: "appendEventIfNew",
            retries: 2,
          })
        : await createEvent()
      this.scheduleEngagementScoreUpdate(input.profileId, input.teamId)
      return created
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        this.scheduleEngagementScoreUpdate(input.profileId, input.teamId)
        return null
      }
      console.error("[RadarRepository][appendEventIfNew]", error)
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
      this.scheduleEngagementScoreUpdate(input.profileId, input.teamId)
      return created
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

      return tx.radarEvent.create({
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
    })

    // Fora da transação/advisory lock — não participa do dedupe.
    if (created) {
      this.scheduleEngagementScoreUpdate(input.profileId, input.teamId)
    }
    return created
  }

  /**
   * Agenda recálculo de engajamento via Vercel Queue (fora do caminho quente).
   * Idempotency key `${teamId}:${profileId}` coalesca publishes no broker.
   * Se o publish falhar, faz fallback direto para `updateEngagementScore`.
   */
  scheduleEngagementScoreUpdate(profileId: string, teamId: string): void {
    void publishRadarEngagementScoreUpdate({ profileId, teamId }).catch((error) => {
      console.error(
        `[RadarRepository][scheduleEngagementScoreUpdate] ${RADAR_ENGAGEMENT_SCORE_QUEUE_PUBLISH_FAILED_TAG}`,
        error,
      )
      void this.updateEngagementScore(profileId, teamId).catch((fallbackError) => {
        console.error("[RadarRepository][updateEngagementScore]", fallbackError)
      })
    })
  }

  /**
   * D19: recalcula `engagementScore`/`engagementBand` do perfil a partir dos
   * eventos dentro de `windowOldDays`. Pesos + config backoffice com cache 5 min.
   */
  async updateEngagementScore(profileId: string, teamId: string) {
    return this.runWithTransientPrismaRetry(async () => {
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
    }, "updateEngagementScore")
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

    const topEvents = rankTopEngagementEvents(
      events,
      weights,
      config,
      3,
      new Date(),
      formRules,
    ).map((item) => ({
      eventType: item.eventType,
      occurredAt: item.occurredAt.toISOString(),
      contribution: Math.round(item.contribution * 100) / 100,
    }))

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
    /** Só perfis que nunca foram pontuados — a dívida do backfill. */
    onlyMissingScore?: boolean
    /** Recorta pela atividade recente, para a dívida ativa vir primeiro. */
    activeSince?: Date | null
  }): Promise<Array<{ id: string; teamId: string }>> {
    return this.db.radarProfile.findMany({
      where: {
        ...(params.cursorId ? { id: { gt: params.cursorId } } : {}),
        ...(params.onlyMissingScore ? { engagementScore: null } : {}),
        ...(params.activeSince ? { lastSeenAt: { gte: params.activeSince } } : {}),
      },
      select: { id: true, teamId: true },
      orderBy: { id: "asc" },
      take: params.take,
    })
  }

  /** Quantos perfis ainda nunca receberam score — métrica de progresso do backfill. */
  async countProfilesMissingEngagementScore(): Promise<number> {
    return this.db.radarProfile.count({ where: { engagementScore: null } })
  }

  /**
   * Recalcula score/banda de um LOTE de perfis com duas queries de leitura,
   * não duas por perfil.
   *
   * O caminho anterior (`updateEngagementScore` num laço) fazia 1 `findMany` de
   * eventos + 1 `updateMany` por perfil — até 1.000 round-trips por lote de 500
   * (RADAR_AUDIT B4). Com o cron morrendo aos 300s, a cauda da base nunca era
   * alcançada.
   *
   * Aqui os eventos do lote inteiro vêm numa query só, e a escrita agrupa os
   * perfis que chegaram ao mesmo par (score, banda) — na prática poucas dezenas
   * de `updateMany` no lugar de 500.
   */
  async updateEngagementScoresBatch(
    profiles: Array<{ id: string; teamId: string }>
  ): Promise<number> {
    if (profiles.length === 0) return 0

    return this.runWithTransientPrismaRetry(async () => {
      const { weights, config, formRules } = await this.loadEngagementWeightsAndConfig()
      const since = new Date(Date.now() - config.windowOldDays * 24 * 60 * 60 * 1000)

      const teamIdByProfile = new Map(profiles.map((profile) => [profile.id, profile.teamId]))
      const events = await findManyByInChunks([...teamIdByProfile.keys()], (chunk) =>
        this.db.radarEvent.findMany({
          where: { profileId: { in: chunk }, occurredAt: { gte: since } },
          select: {
            profileId: true,
            teamId: true,
            eventType: true,
            occurredAt: true,
            metadata: true,
          },
        })
      )

      const eventsByProfile = new Map<string, typeof events>()
      for (const event of events) {
        // Mantém a trava de tenant que o caminho por perfil tinha no `where`:
        // o lote cruza times, então o filtro acontece no agrupamento.
        if (teamIdByProfile.get(event.profileId) !== event.teamId) continue

        const bucket = eventsByProfile.get(event.profileId)
        if (bucket) bucket.push(event)
        else eventsByProfile.set(event.profileId, [event])
      }

      const now = new Date()
      const groups = new Map<string, { score: number; band: string; ids: string[] }>()
      for (const profile of profiles) {
        const { score, band } = computeEngagementScore(
          eventsByProfile.get(profile.id) ?? [],
          weights,
          config,
          now,
          formRules
        )
        const key = `${score}:${band}`
        const group = groups.get(key)
        if (group) group.ids.push(profile.id)
        else groups.set(key, { score, band, ids: [profile.id] })
      }

      let updated = 0
      for (const group of groups.values()) {
        const result = await this.db.radarProfile.updateMany({
          where: { id: { in: group.ids } },
          data: { engagementScore: group.score, engagementBand: group.band },
        })
        updated += result.count
      }

      return updated
    }, "updateEngagementScoresBatch")
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

    const [weightRows, configRow, formRuleRows] = await this.runWithTransientPrismaRetry(
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
      "loadEngagementWeightsAndConfig",
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
    },
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
    },
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
    },
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
    return cappedIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
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

  /** G2: dados mínimos para promover perfil Radar a Lead (escopo de time). */
  async getProfileForPromotionWithCtx(scope: RadarTeamScope, profileId: string) {
    return this.db.radarProfile.findFirst({
      where: { id: profileId, teamId: scope.teamId },
      select: {
        id: true,
        displayName: true,
        displayPhone: true,
        normalizedPhone: true,
        primaryEmail: true,
        normalizedPrimaryEmail: true,
        identities: {
          where: { type: { in: ["lead_id", "email"] } },
          select: {
            type: true,
            value: true,
            normalizedValue: true,
          },
        },
      },
    })
  }

  /**
   * G2: reserva atômica do slot lead_id no perfil (evita dupla promoção concorrente).
   * Retorna true quando a identidade foi inserida; false se o perfil já tinha lead_id.
   */
  async tryInsertLeadIdentityIfAbsent(
    scope: RadarTeamScope,
    profileId: string,
    leadId: string,
    source = "manual_promote",
  ): Promise<boolean> {
    return this.tryClaimLeadIdentity(scope.teamId, profileId, leadId, source)
  }

  /**
   * Reserva o slot `lead_id` do perfil ANTES de o Lead existir.
   *
   * A promoção criava o Lead primeiro e só então tentava a claim; perdendo a
   * corrida (o `syncLeadToRadarInline` roubava o slot), o caminho de rollback
   * DELETAVA o Lead recém-criado — destrutivo e correndo com qualquer coisa que
   * já o referenciasse (auditoria CDP §4 R5/H3).
   *
   * Reservando antes, o rollback passa a apagar apenas esta linha provisória,
   * que ninguém referencia. O valor provisório é prefixado com `pending:` para
   * (a) satisfazer a unique `(teamId, type, normalizedValue)` e (b) nunca casar
   * com uma busca por `lead_id` real, que é sempre um uuid puro.
   */
  async claimProvisionalLeadIdentity(
    teamId: string,
    profileId: string,
    source = "manual_promote_pending",
  ): Promise<{ identityId: string } | null> {
    return this.db.$transaction(async (tx) => {
      const lockKey = `${teamId}:promote-lead:${profileId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      const existing = await tx.radarIdentity.findFirst({
        where: { profileId, teamId, type: "lead_id" },
        select: { id: true, normalizedValue: true, createdAt: true },
      })

      if (existing) {
        // Vínculo real com o CRM: o perfil já foi promovido, ponto final.
        if (!isPendingLeadIdentity(existing.normalizedValue)) return null

        // Reserva provisória. `releaseClaim` é best-effort, então um crash entre
        // reservar e liberar deixaria o perfil bloqueado para sempre — "já
        // promovido" sem Lead nenhum, que é justamente o fluxo que a promoção
        // deveria destravar. Passada a janela, a reserva é órfã e pode ser
        // tomada; dentro dela, ainda é promoção concorrente de verdade e o
        // bloqueio é o comportamento certo.
        const ageMs = Date.now() - existing.createdAt.getTime()
        if (ageMs < PENDING_LEAD_IDENTITY_STALE_MS) return null

        console.info(
          `[RadarRepository][claimProvisionalLeadIdentity] Reserva órfã retomada (profileId=${profileId}, idadeMs=${ageMs})`
        )
        await tx.radarIdentity.deleteMany({ where: { id: existing.id } })
      }

      const provisionalValue = `${PENDING_LEAD_IDENTITY_PREFIX}${randomUUID()}`
      try {
        const created = await tx.radarIdentity.create({
          data: {
            profileId,
            teamId,
            type: "lead_id",
            value: provisionalValue,
            normalizedValue: provisionalValue,
            source,
            isPrimary: false,
          },
          select: { id: true },
        })
        return { identityId: created.id }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return null
        }
        throw error
      }
    })
  }

  /**
   * Troca o valor provisório da claim pelo id real do Lead.
   *
   * `createLead` dispara o sync inline, que grava a identidade `lead_id` com
   * `upsertIdentity` — sem passar pelo advisory lock. Se ele vencer a corrida,
   * a identidade REAL já existe quando chegamos aqui, e renomear a reserva para
   * o mesmo `normalizedValue` violaria a unique `(teamId, type,
   * normalizedValue)` com P2002: a promoção reportaria falha embora o Lead
   * tivesse sido criado, e ainda deixaria a linha `pending:` bloqueando o
   * perfil. Nesse caso a reserva apenas sai de cena — o vínculo já existe.
   */
  async finalizeLeadIdentityClaim(
    teamId: string,
    identityId: string,
    leadId: string,
    source = "manual_promote",
  ): Promise<void> {
    // Sem `$transaction` de propósito. Não há invariante multi-statement a
    // proteger aqui — são operações de uma linha só — e, dentro de uma
    // transação interativa, o P2002 do `updateMany` já teria abortado a TX
    // (25P02): o `deleteMany` de limpeza falharia junto, e a promoção voltaria
    // a reportar erro com o Lead criado e a reserva `pending:` travando o
    // perfil, que é exatamente o R5/H3. Fora da transação, cada statement é
    // independente e a limpeza roda numa conexão sã.
    const dropReservation = () =>
      this.db.radarIdentity.deleteMany({
        where: { id: identityId, teamId, type: "lead_id" },
      })

    const alreadyReal = await this.db.radarIdentity.findFirst({
      where: { teamId, type: "lead_id", normalizedValue: leadId },
      select: { id: true },
    })

    if (alreadyReal && alreadyReal.id !== identityId) {
      await dropReservation()
      return
    }

    try {
      const updated = await this.db.radarIdentity.updateMany({
        where: { id: identityId, teamId, type: "lead_id" },
        data: { value: leadId, normalizedValue: leadId, source },
      })

      // Contagem zero = a reserva sumiu entre a leitura e agora (o gate do
      // formulário público a assume quando está órfã). Silenciar isso deixaria
      // a promoção reportar sucesso sem ter vinculado nada, e o sync seguinte
      // criaria um SEGUNDO `lead_id` no perfil. Falhar aqui joga o caso para o
      // caminho de recuperação do UseCase, que libera e delega ao sync.
      if (updated.count === 0) {
        throw new Error(
          `Reserva de lead_id desapareceu antes da finalização (identityId=${identityId})`
        )
      }
    } catch (error) {
      // A checagem acima não é atômica: o sync pode inserir a identidade real
      // entre o `findFirst` e este `updateMany`, e aí o rename bate na unique.
      // P2002 aqui significa exatamente "o vínculo já existe" — mesmo desfecho
      // do caminho `alreadyReal`.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await dropReservation()
        return
      }
      throw error
    }
  }

  /** Devolve o slot quando a criação do Lead não aconteceu. */
  async releaseLeadIdentityClaim(teamId: string, identityId: string): Promise<void> {
    await this.db.radarIdentity.deleteMany({
      where: { id: identityId, teamId, type: "lead_id" },
    })
  }

  async tryClaimLeadIdentity(
    teamId: string,
    profileId: string,
    leadId: string,
    source: string,
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const lockKey = `${teamId}:promote-lead:${profileId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      const existing = await tx.radarIdentity.findFirst({
        where: {
          profileId,
          teamId,
          type: "lead_id",
        },
        select: { id: true },
      })
      if (existing) return false

      try {
        await tx.radarIdentity.create({
          data: {
            profileId,
            teamId,
            type: "lead_id",
            value: leadId,
            normalizedValue: leadId,
            source,
            isPrimary: false,
          },
        })
        return true
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return false
        }
        throw error
      }
    })
  }

  /**
   * PR 3: materializa uma revisão de resposta em
   * `profileData.publicForms[formId].answers[questionId]`.
   *
   * Lock por `teamId + profileId`, reload dentro da transação e deep merge
   * apenas da pergunta alterada — respostas irmãs nunca são apagadas. Revisão
   * atrasada é descartada da projeção (o RadarEvent append-only preserva o
   * histórico) e valor canônico idêntico não gera escrita nem reexecuta o gate.
   */
  async materializePublicFormAnswer(
    input: MaterializePublicFormAnswerInput,
  ): Promise<MaterializePublicFormAnswerResult> {
    return this.db.$transaction(
      async (tx) => {
        const lockKey = `radar-public-form-materialization:${input.teamId}:${input.profileId}`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

        const profile = await tx.radarProfile.findFirst({
          where: { id: input.profileId, teamId: input.teamId },
          select: {
            profileData: true,
            primaryEmail: true,
            normalizedName: true,
            normalizedPhone: true,
            normalizedPrimaryEmail: true,
          },
        })
        if (!profile) {
          return { outcome: "profile_not_found", identityChanged: null, emailChange: null }
        }

        const decision = applyPublicFormAnswerRevision(profile.profileData, input)
        // Retry do MESMO evento causal: a projeção já foi escrita, mas o gate
        // pode ter falhado tecnicamente depois dela. Reexecutar é obrigatório,
        // senão um perfil elegível ficaria sem lead silenciosamente. Um evento
        // diferente que traga valor idêntico continua sem reexecutar o gate.
        const isSameEventRetry =
          decision.outcome === "unchanged" &&
          decision.previous?.sourceEventId === input.sourceEventId
        if (decision.outcome !== "applied" && !isSameEventRetry) {
          return { outcome: decision.outcome, identityChanged: null, emailChange: null }
        }

        const projection = projectPublicFormAnswerIdentity({
          mappingKey: input.mappingKey,
          value: input.value,
          currentPrimaryEmail: profile.primaryEmail,
        })

        if (decision.requiresWrite) {
          await tx.radarProfile.update({
            where: { id: input.profileId },
            data: {
              profileData: decision.profileData as Prisma.InputJsonValue,
              ...(projection?.patch ?? {}),
              lastSeenAt: input.answeredAt,
            },
          })
          await this.syncProjectedContactIdentity(tx, input, projection)
        }

        // A mudança de identidade vem da projeção materializada, não das
        // colunas do perfil: a resolução de identidade (`resolveProfileForPhone`
        // / `resolveProfileForEmail`) já grava telefone e e-mail na linha antes
        // desta transação, então comparar coluna daria sempre "não mudou" e o
        // gate nunca rodaria.
        return {
          outcome: decision.outcome,
          identityChanged: projection?.field ?? null,
          emailChange:
            projection?.field === "email" &&
            profile.normalizedPrimaryEmail !== projection.patch.normalizedPrimaryEmail
              ? {
                  previousNormalizedEmail: profile.normalizedPrimaryEmail,
                  nextEmail: projection.patch.primaryEmail,
                  nextNormalizedEmail: projection.patch.normalizedPrimaryEmail,
                }
              : null,
        }
      },
      { timeout: 15_000 },
    )
  }

  /**
   * Mantém `RadarIdentity` em sincronia com a projeção de contato.
   *
   * Quando o perfil é resolvido por `lead_id`, uma resposta de telefone/e-mail
   * nunca passa por `resolveProfileForPhone`/`resolveProfileForEmail`, então
   * só a linha do `RadarProfile` seria atualizada. Sem a identidade
   * correspondente, uma resolução posterior por `findProfileByIdentity` não
   * acharia este perfil e criaria um duplicado. A identidade antiga do mesmo
   * tipo deixa de ser primária, mas é preservada como fonte de atribuição.
   *
   * Se o valor já pertence a outro perfil do time, a identidade não é movida
   * aqui — quem decide o perfil canônico é `reconcileAnsweredEmail`.
   */
  private async syncProjectedContactIdentity(
    tx: Prisma.TransactionClient,
    input: MaterializePublicFormAnswerInput,
    projection: ReturnType<typeof projectPublicFormAnswerIdentity>,
  ): Promise<void> {
    if (!projection || projection.field === "name") return

    const type: RadarIdentityType = projection.field === "phone" ? "phone" : "email"
    const normalizedValue =
      projection.field === "phone"
        ? projection.patch.normalizedPhone
        : projection.patch.normalizedPrimaryEmail
    const value =
      projection.field === "phone" ? projection.patch.displayPhone : projection.patch.primaryEmail

    const existing = await tx.radarIdentity.findUnique({
      where: { teamId_type_normalizedValue: { teamId: input.teamId, type, normalizedValue } },
      select: { profileId: true },
    })
    if (existing && existing.profileId !== input.profileId) return

    await tx.radarIdentity.updateMany({
      where: {
        teamId: input.teamId,
        profileId: input.profileId,
        type,
        isPrimary: true,
        normalizedValue: { not: normalizedValue },
      },
      data: { isPrimary: false },
    })

    await tx.radarIdentity.upsert({
      where: { teamId_type_normalizedValue: { teamId: input.teamId, type, normalizedValue } },
      create: {
        profileId: input.profileId,
        teamId: input.teamId,
        type,
        value,
        normalizedValue,
        source: "public_form_answer",
        isPrimary: true,
      },
      update: { value, isPrimary: true },
    })
  }

  /**
   * PR 3: reconcilia o e-mail respondido com o perfil que já é dono do
   * endereço. Locks dos dois perfis são adquiridos em ordem crescente de ID
   * (determinística) para que consumers concorrentes nunca formem deadlock.
   * Dois `lead_id` diferentes geram conflito explícito, sem merge.
   */
  async reconcileAnsweredEmail(
    input: ReconcileAnsweredEmailInput,
  ): Promise<ReconcileAnsweredEmailResult> {
    const owner = await this.db.radarProfile.findFirst({
      where: {
        teamId: input.teamId,
        normalizedPrimaryEmail: input.normalizedEmail,
        id: { not: input.profileId },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!owner) {
      return { winningProfileId: input.profileId, merged: false, conflict: false }
    }

    const [firstLock, secondLock] = [input.profileId, owner.id].sort()
    const result = await this.db.$transaction(
      async (tx) => {
        for (const profileId of [firstLock, secondLock]) {
          const lockKey = `radar-public-form-materialization:${input.teamId}:${profileId}`
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
        }
        // O perfil dono do e-mail respondido é o canônico quando nenhum dos
        // lados tem lead; `mergeProfilesWithTx` promove o lado com `lead_id`
        // quando apenas um deles possui e sinaliza conflito quando são dois.
        return this.mergeProfilesWithTx(
          tx,
          input.teamId,
          input.profileId,
          owner.id,
          "preserve_distinct_leads",
        )
      },
      { timeout: 15_000 },
    )
    if (result.merged) await this.updateEngagementScore(result.winningProfileId, input.teamId)
    return result
  }

  async updateProfileGender(
    profileId: string,
    teamId: string,
    gender: "male" | "female",
    genderSource: "mapped" | "inferred" | "manual",
  ) {
    return this.db.radarProfile.updateMany({
      where: {
        id: profileId,
        teamId,
        ...genderSourceWriteWhere(genderSource),
      },
      data: { gender, genderSource },
    })
  }

  /** F3: edição manual de gênero escopada ao time (via TeamContext no caller). */
  async updateProfileGenderWithCtx(
    scope: RadarTeamScope,
    profileId: string,
    gender: "male" | "female" | "unknown",
  ): Promise<{ updated: boolean }> {
    const result = await this.db.radarProfile.updateMany({
      where: { id: profileId, teamId: scope.teamId },
      data: { gender, genderSource: "manual" },
    })
    return { updated: result.count > 0 }
  }

  async listProfileEventsWithCtx(
    scope: RadarTeamScope,
    profileId: string,
    skip: number,
    take: number,
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

  async listProfileFormEventMarkers(scope: RadarTeamScope, profileId: string) {
    return this.db.radarEvent.findMany({
      where: {
        profileId,
        teamId: scope.teamId,
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        eventType: { startsWith: "form." },
      },
      select: { eventType: true, occurredAt: true, metadata: true },
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
   * com a campanha (audiência virtual `campaign:{id}`) ou com uma de suas
   * sub-campanhas.
   *
   * Campanha MÃE particionada nunca dispara sozinha (o cron `dispatch-scheduled`
   * exclui quem tem sub-campanhas) — os eventos reais ficam nas FILHAS
   * (`parentCampaignId = campaignId`). Sem a expansão, o segmento da mãe fica
   * vazio por construção mesmo com milhares de entregas reais nas partes
   * (adenda 10-E4, caso KKJ/Guarulhos, 02/09). `resolveCampaignIdsIncludingSubs`
   * é o mesmo ponto único usado por analytics/logs de campanha (E-mail); uma
   * campanha sem filhas devolve `[campaignId]`, comportamento idêntico ao
   * anterior. Sub-campanhas não têm sub-campanhas (nível único), então não há
   * recursão a fazer aqui.
   */
  async findProfileIdsByEmailCampaign(teamId: string, campaignId: string): Promise<string[]> {
    const campaignIds = await resolveCampaignIdsIncludingSubs(teamId, campaignId, this.db)
    const rows = await this.db.radarEvent.findMany({
      where: {
        teamId,
        eventType: { startsWith: "email." },
        OR: campaignIds.map((id) => ({ metadata: { path: ["campaignId"], equals: id } })),
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
   * Regra 2/3 (adenda 31/08, pós-#1107): leads relacionados ao perfil, na
   * ordem dos vínculos `lead_id` — mais recente primeiro. Um perfil pode ter
   * N vínculos (histórico), então esta lista alimenta a seção "Leads no CRM"
   * do perfil unificado, não mais um único lead.
   */
  async findRelatedLeadsForProfile(scope: RadarTeamScope, profileId: string) {
    const identities = await this.db.radarIdentity.findMany({
      where: {
        teamId: scope.teamId,
        profileId,
        type: "lead_id",
        NOT: { normalizedValue: { startsWith: PENDING_LEAD_IDENTITY_PREFIX } },
      },
      orderBy: { createdAt: "desc" },
      select: { normalizedValue: true },
    })
    const orderedLeadIds = identities.map((identity) => identity.normalizedValue)
    if (orderedLeadIds.length === 0) return []

    // `deletedAt: null` — o merge de leads preserva o vínculo Radar do lead
    // de origem depois de soft-deletá-lo (`MergeLeadsUseCase`). Sem o filtro,
    // o card mergeado aparece na lista com um link quebrado:
    // `LeadRepository.findByLeadCode` exige `deletedAt: null` (achado do
    // review do PR #1114).
    const leads = await this.db.lead.findMany({
      where: { teamId: scope.teamId, id: { in: orderedLeadIds }, deletedAt: null },
      select: { id: true, leadCode: true, name: true, status: true, createdAt: true },
    })
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    return orderedLeadIds
      .map((leadId) => leadById.get(leadId))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead))
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

  /**
   * Global de propósito, sem filtro de time — mesma decisão de
   * `EmailContactListRepository.findBouncedEmails`, onde o racional está
   * documentado por extenso. Bounce permanente é propriedade do endereço, não
   * da relação com o remetente.
   */
  async findBouncedEmails(emails: string[]): Promise<Set<string>> {
    const normalized = [
      ...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ]
    const rows = await findManyByInChunks(normalized, (chunk) =>
      this.db.emailContact.findMany({
        where: { email: { in: chunk }, isBounced: true },
        select: { email: true },
        distinct: ["email"],
      }),
    )
    return new Set(rows.map((row) => row.email.trim().toLowerCase()))
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

  /**
   * Achado #6 (code review 2026-08-19): antes fazia `findFirst` numa coluna
   * não-única (`normalizedPrimaryEmail`), com risco de match ambíguo quando
   * dois perfis compartilham o mesmo e-mail. Agora resolve primeiro pela
   * chave única de `RadarIdentity` (`findProfileByIdentity`, já existente e
   * documentada como a alternativa não-ambígua) e só cai no `findFirst`
   * antigo se não houver identidade de e-mail registrada pro perfil (dado
   * legado sem `RadarIdentity` criada).
   */
  async findProfileByEmail(teamId: string, normalizedEmail: string) {
    if (!normalizedEmail) return null
    const identity = await this.findProfileByIdentity(teamId, "email", normalizedEmail)
    if (identity) return { id: identity.profileId }
    return this.db.radarProfile.findFirst({
      where: { teamId, normalizedPrimaryEmail: normalizedEmail },
      select: { id: true },
    })
  }

  /**
   * Aceita o endereço em qualquer caixa. O `escapeLikePattern` é obrigatório:
   * sem ele o `mode: "insensitive"` vira `ILIKE` com o valor cru e o `_` do
   * endereço buscado casa o lead de outra pessoa, devolvendo o telefone dela —
   * vazamento de PII entre leads do mesmo time. Ver `lib/prisma/escape-like-pattern.ts`.
   */
  async findLeadPhoneByEmail(teamId: string, email: string) {
    const address = email.trim()
    if (!address) return null

    const lead = await this.db.lead.findFirst({
      where: {
        teamId,
        email: { equals: escapeLikePattern(address), mode: "insensitive" },
      },
      select: { phone: true },
    })
    return lead?.phone ? { phone: lead.phone } : null
  }

  async findLeadStatuses(
    teamId: string,
    leadIds: string[],
  ): Promise<Map<string, LeadStatus | null>> {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map<string, LeadStatus | null>()

    const leads = await findManyByInChunks(unique, (chunk) =>
      this.db.lead.findMany({
        where: { teamId, id: { in: chunk } },
        select: { id: true, status: true },
      }),
    )

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
    pagination?: { skip: number; take: number },
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
    where: Prisma.LeadPortfolioWhereInput,
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
        .map((identity) => identity.normalizedValue),
    )
    const portfolioIds = identities
      .filter((identity) => identity.type === "portfolio_id")
      .map((identity) => identity.normalizedValue)
    const contractDocuments = identities
      .filter(
        (identity) => identity.type === "contract_holder" || identity.type === "contract_dependent",
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
    if (listIds.length === 0) return []
    const contacts = await this.db.emailContact.findMany({
      where: { listId: { in: listIds }, list: { teamId } },
      select: { id: true },
    })
    return contacts.map((contact) => contact.id)
  }

  /**
   * Subquery de perfis ligados a listas de e-mail — só faz bind dos listIds
   * (evita P2035 / bind limit 32767 sobre dezenas de milhares de contactIds).
   * Inclui fallback por e-mail para contatos ainda sem identity `email_contact_id`.
   */
  private emailContactListMatchedProfilesSql(teamId: string, listIds: string[]): Prisma.Sql {
    const listIdSql = Prisma.join(listIds.map((id) => Prisma.sql`${id}::uuid`))

    // Os contatos das listas sao materializados uma vez e reaproveitados pelos
    // tres ramos. Antes cada ramo repetia o filtro por `listId`, varrendo o
    // mesmo conjunto de contatos tres vezes — e um dos ramos caia num index
    // only scan com dezenas de milhares de heap fetches. Medido em producao no
    // maior time (176k contatos, 3 listas): 300.344 buffers antes contra 81.828
    // depois, com o resultado identico (mesmos profileIds, EXCEPT vazio nos
    // dois sentidos).
    //
    // O `UNION` ja deduplica, entao o `SELECT DISTINCT` externo que existia
    // aqui era redundante e so acrescentava um segundo HashAggregate.
    return Prisma.sql`
      WITH contatos_das_listas AS MATERIALIZED (
        SELECT c.id::text AS contato_id, lower(c.email) AS email_normalizado
        FROM "corretor_studio_email_contacts" c
        WHERE c."listId" IN (${listIdSql})
      )
      SELECT i."profileId" AS "profileId"
      FROM "corretor_studio_radar_identities" i
      INNER JOIN contatos_das_listas ct ON ct.contato_id = i."normalizedValue"
      WHERE i."teamId" = ${teamId}::uuid
        AND i.type = 'email_contact_id'

      UNION

      SELECT i."profileId" AS "profileId"
      FROM "corretor_studio_radar_identities" i
      INNER JOIN contatos_das_listas ct ON ct.email_normalizado = i."normalizedValue"
      WHERE i."teamId" = ${teamId}::uuid
        AND i.type = 'email'

      UNION

      SELECT sl."profileId" AS "profileId"
      FROM "corretor_studio_radar_source_links" sl
      INNER JOIN contatos_das_listas ct ON ct.contato_id = sl."sourceId"
      WHERE sl."teamId" = ${teamId}::uuid
        AND sl."sourceType" = 'email_contact'
    `
  }

  async findProfileIdsByEmailContactListIds(teamId: string, listIds: string[]): Promise<string[]> {
    if (listIds.length === 0) return []

    const rows = await this.db.$queryRaw<Array<{ profileId: string }>>(
      this.emailContactListMatchedProfilesSql(teamId, listIds),
    )
    return rows.map((row) => row.profileId)
  }

  async countProfilesByEmailContactListIds(teamId: string, listIds: string[]): Promise<number> {
    if (listIds.length === 0) return 0

    const rows = await this.db.$queryRaw<Array<{ total: number | bigint }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM (
        ${this.emailContactListMatchedProfilesSql(teamId, listIds)}
      ) matched_count
    `)
    return Number(rows[0]?.total ?? 0)
  }

  async listProfileIdsByEmailContactListIds(
    teamId: string,
    listIds: string[],
    pagination?: { skip: number; take: number },
  ): Promise<string[]> {
    if (listIds.length === 0) return []

    const limitSql =
      pagination != null
        ? Prisma.sql`ORDER BY "profileId" ASC LIMIT ${pagination.take} OFFSET ${pagination.skip}`
        : Prisma.sql`ORDER BY "profileId" ASC`

    const rows = await this.db.$queryRaw<Array<{ profileId: string }>>(Prisma.sql`
      SELECT "profileId"
      FROM (
        ${this.emailContactListMatchedProfilesSql(teamId, listIds)}
      ) matched_page
      ${limitSql}
    `)
    return rows.map((row) => row.profileId)
  }

  /**
   * Subquery de perfis com identity `email_contact_id` — um único bind via
   * `ANY($1::text[])` (evita P2035 ao filtrar dezenas de milhares de contactIds).
   */
  private emailContactIdMatchedProfilesSql(teamId: string, contactIds: string[]): Prisma.Sql {
    return Prisma.sql`
      SELECT DISTINCT i."profileId" AS "profileId"
      FROM "corretor_studio_radar_identities" i
      WHERE i."teamId" = ${teamId}::uuid
        AND i.type = 'email_contact_id'
        AND i."normalizedValue" = ANY(${contactIds}::text[])
    `
  }

  private combineProfileIdSourcesSql(
    sources: Prisma.Sql[],
    combine: "intersect" | "union",
  ): Prisma.Sql {
    if (sources.length === 1) return sources[0]
    const separator = combine === "intersect" ? " INTERSECT " : " UNION "
    return Prisma.join(
      sources.map((source) => Prisma.sql`(SELECT "profileId" FROM (${source}) part)`),
      separator,
    )
  }

  private async countProfilesByProfileIdSources(
    sources: Prisma.Sql[],
    combine: "intersect" | "union",
  ): Promise<number> {
    if (sources.length === 0) return 0
    const rows = await this.db.$queryRaw<Array<{ total: number | bigint }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM (
        ${this.combineProfileIdSourcesSql(sources, combine)}
      ) combined_count
    `)
    return Number(rows[0]?.total ?? 0)
  }

  private async listProfileIdsByProfileIdSources(
    sources: Prisma.Sql[],
    combine: "intersect" | "union",
    pagination?: { skip: number; take: number },
  ): Promise<string[]> {
    if (sources.length === 0) return []

    const limitSql =
      pagination != null
        ? Prisma.sql`ORDER BY "profileId" ASC LIMIT ${pagination.take} OFFSET ${pagination.skip}`
        : Prisma.sql`ORDER BY "profileId" ASC`

    const rows = await this.db.$queryRaw<Array<{ profileId: string }>>(Prisma.sql`
      SELECT "profileId"
      FROM (
        ${this.combineProfileIdSourcesSql(sources, combine)}
      ) combined_page
      ${limitSql}
    `)
    return rows.map((row) => row.profileId)
  }

  private async buildSegmentAnyFilterSources(
    teamId: string,
    where: Prisma.RadarProfileWhereInput | null,
    options: {
      combine: "intersect" | "union"
      listIdGroups?: string[][]
      emailContactIdGroups?: string[][]
    },
  ): Promise<Prisma.Sql[] | null> {
    const sources: Prisma.Sql[] = []

    if (where) {
      const otherIds = await this.listProfileIdsByWhere(where)
      if (options.combine === "intersect" && otherIds.length === 0) return null
      if (otherIds.length > 0) {
        sources.push(Prisma.sql`
          SELECT p.id AS "profileId"
          FROM "corretor_studio_radar_profiles" p
          WHERE p."teamId" = ${teamId}::uuid
            AND p.id = ANY(${otherIds}::uuid[])
        `)
      }
    }

    for (const listIds of options.listIdGroups ?? []) {
      if (listIds.length === 0) {
        if (options.combine === "intersect") return null
        continue
      }
      sources.push(this.emailContactListMatchedProfilesSql(teamId, listIds))
    }

    for (const contactIds of options.emailContactIdGroups ?? []) {
      if (contactIds.length === 0) {
        if (options.combine === "intersect") return null
        continue
      }
      sources.push(this.emailContactIdMatchedProfilesSql(teamId, contactIds))
    }

    return sources
  }

  async countProfilesByEmailContactListIntersection(
    teamId: string,
    listIdGroups: string[][],
  ): Promise<number> {
    if (listIdGroups.length === 0 || listIdGroups.some((group) => group.length === 0)) return 0
    const sources = listIdGroups.map((listIds) =>
      this.emailContactListMatchedProfilesSql(teamId, listIds),
    )
    return this.countProfilesByProfileIdSources(sources, "intersect")
  }

  async listProfileIdsByEmailContactListIntersection(
    teamId: string,
    listIdGroups: string[][],
    pagination?: { skip: number; take: number },
  ): Promise<string[]> {
    if (listIdGroups.length === 0 || listIdGroups.some((group) => group.length === 0)) return []
    const sources = listIdGroups.map((listIds) =>
      this.emailContactListMatchedProfilesSql(teamId, listIds),
    )
    return this.listProfileIdsByProfileIdSources(sources, "intersect", pagination)
  }

  /**
   * Caminho composto (listas + outras regras, ou `email_contact_field` com
   * dezenas de milhares de IDs): combina subqueries SQL com `INTERSECT`/`UNION`
   * e `ANY($n::uuid[])` / `ANY($n::text[])` — um bind por array, nunca OR de IN.
   */
  async countProfilesByWhereWithAnyFilters(
    teamId: string,
    where: Prisma.RadarProfileWhereInput | null,
    options: {
      combine: "intersect" | "union"
      listIdGroups?: string[][]
      emailContactIdGroups?: string[][]
    },
  ): Promise<number> {
    const sources = await this.buildSegmentAnyFilterSources(teamId, where, options)
    if (sources == null) return 0
    return this.countProfilesByProfileIdSources(sources, options.combine)
  }

  async listProfileIdsByWhereWithAnyFilters(
    teamId: string,
    where: Prisma.RadarProfileWhereInput | null,
    options: {
      combine: "intersect" | "union"
      listIdGroups?: string[][]
      emailContactIdGroups?: string[][]
    },
    pagination?: { skip: number; take: number },
  ): Promise<string[]> {
    const sources = await this.buildSegmentAnyFilterSources(teamId, where, options)
    if (sources == null) return []
    return this.listProfileIdsByProfileIdSources(sources, options.combine, pagination)
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
    value: unknown,
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

    return findManyByInChunks(uniqueIds, (chunk) =>
      this.db.radarProfile.findMany({
        where: { teamId, id: { in: chunk } },
        select: {
          id: true,
          displayName: true,
          normalizedPrimaryEmail: true,
          consents: { where: { channel: "email" }, select: { status: true, reason: true } },
          sourceLinks: { select: { sourceType: true, sourceMetadata: true } },
          events: {
            select: {
              eventType: true,
              occurredAt: true,
              metadata: true,
              sourceType: true,
              sourceId: true,
            },
          },
          identities: {
            where: { type: "lead_id" },
            select: { type: true, normalizedValue: true },
          },
        },
      }),
    )
  }

  async listProfileIdsForSegmentation(teamId: string): Promise<string[]> {
    const rows = await this.db.radarProfile.findMany({
      where: { teamId },
      select: { id: true },
      orderBy: { id: "asc" },
    })
    return rows.map((row) => row.id)
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
          select: {
            eventType: true,
            occurredAt: true,
            metadata: true,
            sourceType: true,
            sourceId: true,
          },
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

    const leads = await findManyByInChunks(unique, (chunk) =>
      this.db.lead.findMany({
        where: { teamId, id: { in: chunk } },
        select: {
          id: true,
          status: true,
          currentHealthPlan: true,
          soldPlan: true,
          contractDueDate: true,
          referenceHospital: true,
        },
      }),
    )

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
        profileData: true,
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

    return findManyByInChunks(unique, (chunk) =>
      this.db.radarProfile.findMany({
        where: { teamId, normalizedPrimaryEmail: { in: chunk } },
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
      }),
    )
  }

  async findProfileDataByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return new Map<string, Record<string, string>>()

    const profiles = await findManyByInChunks(unique, (chunk) =>
      this.db.radarProfile.findMany({
        where: { teamId, normalizedPrimaryEmail: { in: chunk } },
        select: { normalizedPrimaryEmail: true, profileData: true },
      }),
    )

    const map = new Map<string, Record<string, string>>()
    for (const profile of profiles) {
      if (!profile.normalizedPrimaryEmail) continue
      const data = profile.profileData
      if (data && typeof data === "object" && !Array.isArray(data)) {
        map.set(
          profile.normalizedPrimaryEmail,
          Object.fromEntries(
            Object.entries(data as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value ?? ""),
            ]),
          ),
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

  async upsertPixelConfig(
    teamId: string,
    profileId: string,
    data: { publicToken: string; allowedOrigins: string[] },
  ) {
    return this.db.teamRadarPixelConfig.upsert({
      where: { teamId },
      create: {
        teamId,
        publicToken: data.publicToken,
        allowedOrigins: data.allowedOrigins,
        updatedByProfileId: profileId,
      },
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
      select: {
        id: true,
        teamId: true,
        eventType: true,
        visitorSession: true,
        origin: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    })
  }

  async findPixelConfigByPublicToken(
    publicToken: string,
  ): Promise<{ teamId: string; allowedOrigins: string[] } | null> {
    return this.db.teamRadarPixelConfig.findUnique({
      where: { publicToken },
      select: { teamId: true, allowedOrigins: true },
    })
  }

  async touchPixelLastUsed(teamId: string) {
    await this.db.teamRadarPixelConfig.update({
      where: { teamId },
      data: { lastUsedAt: new Date() },
    })
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
        : identities.filter((identity) => identity.normalizedValue !== input.keepNormalizedDocument)
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
    profileId: string,
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
   * Calcula as 9 contagens de segmentos de sistema numa varredura só.
   *
   * Os predicados vêm de `lib/radar/fixed-segment-sql` — os MESMOS que a
   * listagem consome. Antes esta query era uma implementação independente do
   * matcher em memória que servia a lista: duas verdades que divergiam sozinhas
   * (auditoria CDP §4 R6). `COUNT(*) FILTER` preserva a passada única sobre os
   * perfis do time que a versão com CTEs tinha.
   */
  async countFixedSegmentsSQL(
    teamId: string,
    recentWindowDays: number = 30,
  ): Promise<Map<string, number>> {
    const recentThreshold = resolveRecentSegmentThreshold(recentWindowDays)

    const result = await this.db.$queryRaw<Array<Record<RadarSegmentSlug, bigint>>>(
      buildFixedSegmentCountsSql(teamId, recentThreshold)
    )

    const row = result[0]
    if (!row) {
      return new Map()
    }

    return new Map(RADAR_SEGMENT_SLUGS.map((slug) => [slug, Number(row[slug])]))
  }

  /** Contagem de um único segmento de sistema — mesmo predicado da listagem. */
  async countFixedSegmentSQL(
    teamId: string,
    slug: RadarSegmentSlug,
    recentWindowDays: number = 30,
  ): Promise<number> {
    const recentThreshold = resolveRecentSegmentThreshold(recentWindowDays)

    const result = await this.db.$queryRaw<Array<{ count: bigint }>>(
      buildFixedSegmentCountSql(slug, teamId, recentThreshold)
    )

    return Number(result[0]?.count ?? 0)
  }

  /**
   * Página de ids do segmento de sistema, filtrada e paginada NO BANCO.
   *
   * Substitui o caminho que carregava todos os perfis do time em memória só
   * para dar `slice` na página — o mesmo caminho que estourava P2035 (32.768
   * bind vars) na rota de perfis de segmento com base grande.
   */
  async listFixedSegmentProfileIdsSQL(
    teamId: string,
    slug: RadarSegmentSlug,
    pagination: { skip: number; take: number },
    recentWindowDays: number = 30,
  ): Promise<string[]> {
    const recentThreshold = resolveRecentSegmentThreshold(recentWindowDays)

    const rows = await this.db.$queryRaw<Array<{ id: string }>>(
      buildFixedSegmentProfileIdsSql(slug, teamId, recentThreshold, pagination)
    )

    return rows.map((row) => row.id)
  }
}

function resolveRecentSegmentThreshold(recentWindowDays: number): Date {
  return new Date(Date.now() - recentWindowDays * 24 * 60 * 60 * 1000)
}

function genderSourceWriteWhere(incoming: RadarGenderSource): Prisma.RadarProfileWhereInput {
  const guard = allowedCurrentSourcesForGenderWrite(incoming)
  if (!guard) return {}

  const clauses: Prisma.RadarProfileWhereInput[] = []
  if (guard.allowNull) {
    clauses.push({ genderSource: null })
  }
  if (guard.sources.length > 0) {
    clauses.push({ genderSource: { in: guard.sources } })
  }
  return { OR: clauses }
}

export const radarRepository = new RadarRepository()

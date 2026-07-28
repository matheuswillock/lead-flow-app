import type {
  RadarChannel,
  RadarConsentReason,
  RadarConsentStatus,
  RadarIdentityType,
  RadarSourceType,
  LeadStatus,
  Prisma,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"

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
  createdAt: true,
  updatedAt: true,
} as const

export class RadarRepository {
  async upsertProfile(input: UpsertProfileInput) {
    const existing = await prisma.radarProfile.findUnique({
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

    return prisma.radarProfile.upsert({
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
    return prisma.radarIdentity.findUnique({
      where: {
        teamId_type_normalizedValue: { teamId, type, normalizedValue },
      },
      select: { profileId: true },
    })
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
   */
  private async mergeProfiles(
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
    return prisma.$transaction(async (tx) => {
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
            await this.mergeProfiles(tx, input.teamId, emailOwner.profileId, existingByIdentity.profileId)
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
    return prisma.$transaction(async (tx) => {
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

  async upsertIdentity(input: UpsertIdentityInput) {
    return prisma.radarIdentity.upsert({
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
    return prisma.radarSourceLink.upsert({
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
    const duplicate = await prisma.radarEvent.findFirst({
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
    const existing = await prisma.radarEvent.findFirst({
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
      return await prisma.radarEvent.create({
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
    } catch {
      return null
    }
  }

  async upsertConsent(input: UpsertConsentInput) {
    return prisma.radarChannelConsent.upsert({
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
    }
  ) {
    const where: Prisma.RadarProfileWhereInput = {
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

    const [items, total] = await Promise.all([
      prisma.radarProfile.findMany({
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
        orderBy: { lastSeenAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      prisma.radarProfile.count({ where }),
    ])

    return { items, total }
  }

  async getProfileDetailWithCtx(scope: RadarTeamScope, profileId: string) {
    return prisma.radarProfile.findFirst({
      where: { id: profileId, teamId: scope.teamId },
      select: {
        ...profileListSelect,
        normalizedName: true,
        normalizedPhone: true,
        normalizedPrimaryDocument: true,
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
      prisma.radarEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take,
      }),
      prisma.radarEvent.count({ where }),
    ])
    return { items, total }
  }

  async countProfiles(scope: RadarTeamScope) {
    return prisma.radarProfile.count({ where: { teamId: scope.teamId } })
  }

  async findLeadsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return prisma.lead.findMany({
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
    return prisma.leadPortfolio.findMany({
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

  async findEmailContactLists(teamId: string) {
    return prisma.emailContactList.findMany({
      where: { teamId },
      select: { id: true },
    })
  }

  async findEmailContacts(listId: string) {
    return prisma.emailContact.findMany({
      where: { listId },
      select: {
        id: true,
        email: true,
        name: true,
        isUnsubscribed: true,
        isBounced: true,
        isComplained: true,
        updatedAt: true,
      },
    })
  }

  async findEmailContactById(contactId: string) {
    return prisma.emailContact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        email: true,
        name: true,
        isUnsubscribed: true,
        isBounced: true,
        isComplained: true,
        updatedAt: true,
        list: { select: { teamId: true } },
      },
    })
  }

  async findEmailLogsForRadarSync(teamId: string, filters: RadarSyncFilters = {}) {
    return prisma.emailLog.findMany({
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
    return prisma.radarProfile.findUnique({
      where: {
        teamId_normalizedPhone_normalizedName: { teamId, normalizedPhone, normalizedName },
      },
      select: { id: true },
    })
  }

  async findProfileByEmail(teamId: string, normalizedEmail: string) {
    if (!normalizedEmail) return null
    return prisma.radarProfile.findFirst({
      where: { teamId, normalizedPrimaryEmail: normalizedEmail },
    })
  }

  async findLeadPhoneByEmail(teamId: string, normalizedEmail: string) {
    const lead = await prisma.lead.findFirst({
      where: { teamId, email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { phone: true },
    })
    return lead?.phone ? { phone: lead.phone } : null
  }

  async findLeadStatuses(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map<string, LeadStatus | null>()

    const leads = await prisma.lead.findMany({
      where: { teamId, id: { in: unique } },
      select: { id: true, status: true },
    })

    return new Map(leads.map((lead) => [lead.id, lead.status]))
  }

  // C6 EXPLAIN: see doc comment on RadarSegmentQueryService — teamId-scoped filter
  // uses an existing composite index; consent/event relation filters seq-scan their
  // own tables, naturally bounded by profile count per team.
  async countProfilesByWhere(where: Prisma.RadarProfileWhereInput): Promise<number> {
    return prisma.radarProfile.count({ where })
  }

  async listProfileIdsByWhere(
    where: Prisma.RadarProfileWhereInput,
    pagination?: { skip: number; take: number }
  ): Promise<string[]> {
    const profiles = await prisma.radarProfile.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "asc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
    return profiles.map((profile) => profile.id)
  }

  async findLeadIdsByWhere(where: Prisma.LeadWhereInput): Promise<string[]> {
    const leads = await prisma.lead.findMany({ where, select: { id: true } })
    return leads.map((lead) => lead.id)
  }

  async listProfilesForSegmentationByIds(teamId: string, profileIds: string[]) {
    const uniqueIds = [...new Set(profileIds.filter(Boolean))]
    if (uniqueIds.length === 0) return []

    return prisma.radarProfile.findMany({
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
    return prisma.radarProfile.findMany({
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
    return prisma.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR" },
      select: { key: true, radarFieldKey: true, defaultValue: true },
    })
  }

  async findLeadsForRadarFieldResolution(teamId: string, leadIds: string[]) {
    const unique = [...new Set(leadIds.filter(Boolean))]
    if (unique.length === 0) return new Map()

    const leads = await prisma.lead.findMany({
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
    return prisma.radarProfile.findMany({
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
    return prisma.radarProfile.updateMany({
      where: { id: profileId, teamId },
      data: { profileData },
    })
  }

  async findProfilesForInterpolationByEmails(teamId: string, normalizedEmails: string[]) {
    const unique = [...new Set(normalizedEmails.filter(Boolean))]
    if (unique.length === 0) return []

    return prisma.radarProfile.findMany({
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

    const profiles = await prisma.radarProfile.findMany({
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
    return prisma.emailTeamVariable.findMany({
      where: { teamId, isActive: true, valueSource: "RADAR", defaultValue: { not: null } },
      select: { key: true, defaultValue: true },
    })
  }
}

export const radarRepository = new RadarRepository()

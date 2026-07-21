import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  radarService,
  type RadarService,
} from "@/app/api/services/radar/RadarService"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"

const SEGMENT_LABELS: Record<string, string> = {
  email_marketable: "Aptos para e-mail",
  email_blocked: "Bloqueados",
  opened_not_clicked: "Abriram e não clicaram",
  clicked_not_closed: "Clicaram e não fecharam",
  portfolio_renewal_due: "Carteira próxima de renovação",
  inactive_recent_campaign: "Sem campanha recente",
}

export type RadarListProfilesInput = {
  teamId: string
  ctx: TeamContext
  search?: string
  consent?: "allowed" | "blocked" | "unknown"
  sourceType?: string
  channel?: "email" | "whatsapp"
  lastSeenFrom?: string
  lastSeenTo?: string
  page: number
  pageSize: number
}

export class RadarUseCase {
  constructor(private readonly service: RadarService = radarService) {}

  private scope(teamId: string, ctx: TeamContext): RadarTeamScope {
    return { teamId, ctx }
  }

  async syncCrm(teamId: string, ctx: TeamContext, filters: RadarSyncFilters = {}) {
    const scope = this.scope(teamId, ctx)
    const result = await this.service.syncFromCrm(scope, filters)
    await this.service.syncProfileDataForTeam(scope)
    return new Output(true, ["Sincronização do CRM concluída"], [], result)
  }

  async syncPortfolio(teamId: string, ctx: TeamContext, filters: RadarSyncFilters = {}) {
    const scope = this.scope(teamId, ctx)
    const result = await this.service.syncFromPortfolio(scope, filters)
    await this.service.syncProfileDataForTeam(scope)
    return new Output(true, ["Sincronização da carteira concluída"], [], result)
  }

  async syncEmail(teamId: string, ctx: TeamContext, filters: RadarSyncFilters = {}) {
    const scope = this.scope(teamId, ctx)
    const result = await this.service.syncFromEmail(scope, filters)
    await this.service.syncProfileDataForTeam(scope)
    return new Output(true, ["Sincronização de e-mail concluída"], [], result)
  }

  async syncWhatsapp(teamId: string, ctx: TeamContext) {
    const scope = this.scope(teamId, ctx)
    const result = await this.service.syncFromWhatsapp(scope.teamId)
    await this.service.syncProfileDataForTeam(scope)
    return new Output(true, ["Sincronização do WhatsApp concluída"], [], result)
  }

  async listProfiles(input: RadarListProfilesInput) {
    const skip = (input.page - 1) * input.pageSize
    const scope = this.scope(input.teamId, input.ctx)
    const result = await radarRepository.listProfilesWithCtx(scope, {
      search: input.search,
      consent: input.consent,
      sourceType: input.sourceType as never,
      channel: input.channel,
      lastSeenFrom: input.lastSeenFrom ? new Date(input.lastSeenFrom) : undefined,
      lastSeenTo: input.lastSeenTo ? new Date(input.lastSeenTo) : undefined,
      skip,
      take: input.pageSize,
    })

    const primarySegments = await this.service.resolvePrimarySegmentsForProfiles(
      scope,
      result.items.map((item) => item.id)
    )

    const items = result.items.map((item) => {
      const primarySegment = primarySegments.get(item.id) ?? null
      return {
        ...item,
        primarySegment,
        primarySegmentName: primarySegment ? SEGMENT_LABELS[primarySegment] ?? primarySegment : null,
      }
    })

    return new Output(true, [], [], {
      items,
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
    })
  }

  async getProfile(teamId: string, ctx: TeamContext, profileId: string) {
    const profile = await radarRepository.getProfileDetailWithCtx(this.scope(teamId, ctx), profileId)
    if (!profile) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }
    return new Output(true, [], [], profile)
  }

  async listProfileEvents(
    teamId: string,
    ctx: TeamContext,
    profileId: string,
    page: number,
    pageSize: number
  ) {
    const skip = (page - 1) * pageSize
    const result = await radarRepository.listProfileEventsWithCtx(
      this.scope(teamId, ctx),
      profileId,
      skip,
      pageSize
    )
    return new Output(true, [], [], {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    })
  }

  async listSegments(teamId: string, ctx: TeamContext) {
    const segments = await this.service.countSegments(this.scope(teamId, ctx))
    const metrics = await this.service.getMetrics(this.scope(teamId, ctx))
    return new Output(true, [], [], { segments, metrics })
  }

  async listSegmentProfiles(
    teamId: string,
    ctx: TeamContext,
    segment: string,
    page: number,
    pageSize: number
  ) {
    if (!isRadarSegmentSlug(segment)) {
      return new Output(false, [], ["Segmento inválido"], null)
    }

    const ids = await this.service.listSegmentProfileIds(this.scope(teamId, ctx), segment)
    const skip = (page - 1) * pageSize
    const pageIds = ids.slice(skip, skip + pageSize)

    const items = await Promise.all(
      pageIds.map((id) => radarRepository.getProfileDetailWithCtx(this.scope(teamId, ctx), id))
    )

    return new Output(true, [], [], {
      items: items.filter(Boolean),
      total: ids.length,
      page,
      pageSize,
      segment,
    })
  }

  async previewInterpolation(
    teamId: string,
    ctx: TeamContext,
    profileId: string,
    variableKeys: string[]
  ) {
    const values = await this.service.previewInterpolation(
      this.scope(teamId, ctx),
      profileId,
      variableKeys
    )

    if (!values) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    return new Output(true, [], [], { values })
  }
}

export const customerDataPlatformUseCase = new RadarUseCase()

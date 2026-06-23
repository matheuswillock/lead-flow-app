import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { CdpTeamScope } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import {
  customerDataPlatformService,
  type CustomerDataPlatformService,
} from "@/app/api/services/cdp/CustomerDataPlatformService"
import { isCdpSegmentSlug } from "@/lib/cdp/segment-config"

export type CdpListProfilesInput = {
  teamId: string
  ctx: TeamContext
  search?: string
  consent?: "allowed" | "blocked" | "unknown"
  sourceType?: string
  page: number
  pageSize: number
}

export class CustomerDataPlatformUseCase {
  constructor(private readonly service: CustomerDataPlatformService = customerDataPlatformService) {}

  private scope(teamId: string, ctx: TeamContext): CdpTeamScope {
    return { teamId, ctx }
  }

  async syncCrm(teamId: string, ctx: TeamContext) {
    const result = await this.service.syncFromCrm(this.scope(teamId, ctx))
    return new Output(true, ["Sincronização do CRM concluída"], [], result)
  }

  async syncPortfolio(teamId: string, ctx: TeamContext) {
    const result = await this.service.syncFromPortfolio(this.scope(teamId, ctx))
    return new Output(true, ["Sincronização da carteira concluída"], [], result)
  }

  async syncEmail(teamId: string, ctx: TeamContext) {
    const result = await this.service.syncFromEmail(this.scope(teamId, ctx))
    return new Output(true, ["Sincronização de e-mail concluída"], [], result)
  }

  async listProfiles(input: CdpListProfilesInput) {
    const skip = (input.page - 1) * input.pageSize
    const result = await cdpRepository.listProfilesWithCtx(this.scope(input.teamId, input.ctx), {
      search: input.search,
      consent: input.consent,
      sourceType: input.sourceType as never,
      skip,
      take: input.pageSize,
    })

    return new Output(true, [], [], {
      items: result.items,
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
    })
  }

  async getProfile(teamId: string, ctx: TeamContext, profileId: string) {
    const profile = await cdpRepository.getProfileDetailWithCtx(this.scope(teamId, ctx), profileId)
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
    const result = await cdpRepository.listProfileEventsWithCtx(
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
    if (!isCdpSegmentSlug(segment)) {
      return new Output(false, [], ["Segmento inválido"], null)
    }

    const ids = await this.service.listSegmentProfileIds(this.scope(teamId, ctx), segment)
    const skip = (page - 1) * pageSize
    const pageIds = ids.slice(skip, skip + pageSize)

    const items = await Promise.all(
      pageIds.map((id) => cdpRepository.getProfileDetailWithCtx(this.scope(teamId, ctx), id))
    )

    return new Output(true, [], [], {
      items: items.filter(Boolean),
      total: ids.length,
      page,
      pageSize,
      segment,
    })
  }
}

export const customerDataPlatformUseCase = new CustomerDataPlatformUseCase()

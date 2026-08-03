import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  radarService,
  type RadarService,
} from "@/app/api/services/radar/RadarService"
import {
  teamRadarSegmentService,
  type TeamRadarSegmentService,
} from "@/app/api/services/radar/TeamRadarSegmentService"
import {
  radarSegmentQueryService,
  type IRadarSegmentQueryService,
} from "@/app/api/services/radar/RadarSegmentQueryService"
import type {
  TeamRadarSegmentInput,
  TeamRadarSegmentUpdateInput,
} from "@/app/api/services/radar/ITeamRadarSegmentService"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"
import { parseRadarSegmentRules } from "@/lib/radar/segment-dsl"
import { CUSTOM_RADAR_SEGMENT_PREFIX } from "@/lib/radar/segment-audience"
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
  constructor(
    private readonly service: RadarService = radarService,
    private readonly segmentService: TeamRadarSegmentService = teamRadarSegmentService,
    private readonly segmentQueryService: IRadarSegmentQueryService = radarSegmentQueryService
  ) {}

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
    const scope = this.scope(teamId, ctx)
    const fixedSegments = await this.service.countSegments(scope)
    const metrics = await this.service.getMetrics(scope)

    const customSegments = await this.segmentService.listByTeam(teamId, { onlyActive: true })
    const customSegmentCounts = await Promise.all(
      customSegments.map((segment) =>
        this.segmentQueryService.countProfiles(scope, parseRadarSegmentRules(segment.rulesJson))
      )
    )

    const segments = [
      ...fixedSegments.map((segment) => ({ ...segment, isSystem: true })),
      ...customSegments.map((segment, index) => ({
        slug: `${CUSTOM_RADAR_SEGMENT_PREFIX}${segment.id}`,
        name: segment.name,
        description: segment.description,
        count: customSegmentCounts[index] ?? 0,
        isSystem: false,
      })),
    ]

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

  async listCustomSegments(teamId: string, ctx: TeamContext) {
    try {
      const segments = await this.segmentService.listByTeam(teamId)
      const scope = this.scope(teamId, ctx)
      const items = await Promise.all(
        segments.map(async (segment) => ({
          ...segment,
          count: await this.segmentQueryService.countProfiles(scope, parseRadarSegmentRules(segment.rulesJson)),
        }))
      )
      return new Output(true, [], [], items)
    } catch (error) {
      console.error("[RadarUseCase][listCustomSegments]", error)
      return new Output(false, [], ["Erro ao listar segmentos"], null)
    }
  }

  async createCustomSegment(teamId: string, ctx: TeamContext, input: TeamRadarSegmentInput) {
    try {
      const segment = await this.segmentService.create(teamId, ctx.profileId, input)
      return new Output(true, ["Segmento criado com sucesso"], [], segment)
    } catch (error) {
      console.error("[RadarUseCase][createCustomSegment]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar segmento"
      return new Output(false, [], [message], null)
    }
  }

  async updateCustomSegment(
    teamId: string,
    ctx: TeamContext,
    segmentId: string,
    input: TeamRadarSegmentUpdateInput
  ) {
    try {
      const segment = await this.segmentService.update(teamId, segmentId, input)
      if (!segment) {
        return new Output(false, [], ["Segmento não encontrado"], null)
      }
      return new Output(true, ["Segmento atualizado com sucesso"], [], segment)
    } catch (error) {
      console.error("[RadarUseCase][updateCustomSegment]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar segmento"
      return new Output(false, [], [message], null)
    }
  }

  async deleteCustomSegment(teamId: string, ctx: TeamContext, segmentId: string) {
    try {
      const result = await this.segmentService.remove(teamId, segmentId)
      if (!result.removed) {
        return new Output(false, [], ["Segmento não encontrado"], null)
      }
      if (result.softDeleted) {
        return new Output(
          true,
          ["Segmento em uso por campanhas — desativado em vez de excluído"],
          [],
          { id: segmentId, softDeleted: true }
        )
      }
      return new Output(true, ["Segmento removido com sucesso"], [], { id: segmentId, softDeleted: false })
    } catch (error) {
      console.error("[RadarUseCase][deleteCustomSegment]", error)
      return new Output(false, [], ["Erro ao remover segmento"], null)
    }
  }

  /**
   * Conta o público de regras ainda não salvas (rascunho do builder) — as
   * demais contagens (listSegments/listCustomSegments/listCustomSegmentProfiles)
   * exigem um TeamRadarSegment já persistido.
   */
  async previewCustomSegmentCount(teamId: string, ctx: TeamContext, rulesInput: unknown) {
    try {
      const rules = parseRadarSegmentRules(rulesInput)
      const scope = this.scope(teamId, ctx)
      const count = await this.segmentQueryService.countProfiles(scope, rules)
      return new Output(true, [], [], { count })
    } catch (error) {
      console.error("[RadarUseCase][previewCustomSegmentCount]", error)
      const message = error instanceof Error ? error.message : "Regras de segmento inválidas"
      return new Output(false, [], [message], null)
    }
  }

  async listCustomSegmentProfiles(
    teamId: string,
    ctx: TeamContext,
    segmentId: string,
    page: number,
    pageSize: number
  ) {
    try {
      const scope = this.scope(teamId, ctx)
      const segment = await this.segmentService.findById(teamId, segmentId)
      if (!segment || !segment.isActive) {
        return new Output(false, [], ["Segmento não encontrado"], null)
      }
      const rules = parseRadarSegmentRules(segment.rulesJson)
      const skip = (page - 1) * pageSize
      const [total, pageIds] = await Promise.all([
        this.segmentQueryService.countProfiles(scope, rules),
        this.segmentQueryService.listProfileIds(scope, rules, { skip, take: pageSize }),
      ])
      const items = await Promise.all(
        pageIds.map((id) => radarRepository.getProfileDetailWithCtx(scope, id))
      )

      return new Output(true, [], [], {
        items: items.filter(Boolean),
        total,
        page,
        pageSize,
        segmentId,
      })
    } catch (error) {
      console.error("[RadarUseCase][listCustomSegmentProfiles]", error)
      return new Output(false, [], ["Erro ao listar perfis do segmento"], null)
    }
  }

  /**
   * D14: Retorna o contrato atual (carteira ativa) e o histórico de contratos finalizados
   * associados ao perfil Radar via identidade de documento (contract_holder / contract_dependent).
   */
  async getProfileContracts(teamId: string, _ctx: TeamContext, profileId: string): Promise<Output> {
    try {
      const profileResult = await radarRepository.getProfileNormalizedDocument(teamId, profileId)

      if (!profileResult.found) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      const doc = profileResult.doc
      if (!doc) {
        return new Output(true, [], [], { current: null, history: [] })
      }

      const holders = await radarRepository.getHoldersByNormalizedDocument(teamId, doc)

      const history = holders.map((h) => ({
        id: h.leadFinalized.id,
        finalizedDateAt: h.leadFinalized.finalizedDateAt,
        amount: h.leadFinalized.amount,
        contractType: h.leadFinalized.contractType,
        operadora: h.leadFinalized.operadora,
        productName: h.leadFinalized.productName,
        createdAt: h.leadFinalized.createdAt,
        holder: { id: h.id, name: h.name, document: h.document, birthDate: h.birthDate },
        dependents: h.leadFinalized.dependents.map((d) => ({
          id: d.id,
          name: d.name,
          document: d.document,
          birthDate: d.birthDate,
        })),
      }))

      const activePortfolio =
        holders
          .map((h) => h.leadFinalized.lead.portfolio)
          .find((p) => p && p.portfolioStatus === "active") ?? null

      return new Output(true, [], [], { current: activePortfolio, history })
    } catch (error) {
      console.error("[RadarUseCase][getProfileContracts]", error)
      return new Output(false, [], ["Erro ao buscar contratos do perfil"], null)
    }
  }
}

export const customerDataPlatformUseCase = new RadarUseCase()

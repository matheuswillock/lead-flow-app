import { Output } from "@/lib/output"
import { cacheLife, cacheTag } from "next/cache"
import { cacheTags } from "@/lib/cache/cacheTags"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ"
import { formatLocalDateValue } from "@/lib/dates/parse"
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
import { listRadarFieldCatalog } from "@/lib/radar/field-catalog"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"
import { teamRadarFieldDefinitionRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarFieldDefinitionRepository"
import { parseRadarSegmentRules, radarSegmentAdditionalRulesSchema, type RadarSegmentRules } from "@/lib/radar/segment-dsl"
import { extractCampaignEventConditions } from "@/lib/radar/campaign-segment-preset"
import {
  mergeHierarchicalSegmentRules,
  parentRulesToBaseConditions,
} from "@/lib/radar/merge-hierarchical-segment-rules"
import {
  CUSTOM_RADAR_SEGMENT_PREFIX,
  parseCampaignRadarSegmentSlug,
} from "@/lib/radar/segment-audience"
import type { RadarSyncFilters } from "@/lib/radar/sync-filters"
import {
  buildRadarExportRows,
  RADAR_EXPORT_MAX_ROWS,
  type RadarExportProfileInput,
} from "@/lib/radar/exportRadarProfiles"

const SEGMENT_LABELS: Record<string, string> = {
  email_marketable: "Aptos para e-mail",
  email_blocked: "Bloqueados",
  opened_not_clicked: "Abriram e não clicaram",
  clicked_not_closed: "Clicaram e não fecharam",
  engaged_no_lead: "Engajados sem Lead",
  portfolio_renewal_due: "Carteira próxima de renovação",
  inactive_recent_campaign: "Sem campanha recente",
  portfolio_clients: "Carteira",
  crm_clients: "CRM",
}

/**
 * Reconstrói o `TeamContext` a partir de primitivos.
 *
 * A função cacheada aceita apenas primitivos para manter a chave de cache
 * estável — objeto na assinatura fragmentaria o cache por referência.
 */
function rebuildRadarScope(
  teamId: string,
  profileId: string,
  role: string,
  functionsKey: string
): RadarTeamScope {
  const ctx: TeamContext = {
    profileId,
    teamMember: { role, functions: functionsKey ? functionsKey.split(",") : [] },
  }
  return { teamId, ctx }
}

async function listCustomRadarSegments(scope: RadarTeamScope, teamId: string) {
  const customSegments = await teamRadarSegmentService.listByTeam(teamId, { onlyActive: true })
  const customSegmentCounts = await Promise.all(
    customSegments.map((segment) =>
      radarSegmentQueryService.countProfiles(scope, parseRadarSegmentRules(segment.rulesJson))
    )
  )

  return customSegments.map((segment, index) => ({
    slug: `${CUSTOM_RADAR_SEGMENT_PREFIX}${segment.id}`,
    name: segment.name,
    description: segment.description,
    count: customSegmentCounts[index] ?? 0,
    isSystem: false,
  }))
}

/**
 * Caminho feliz de `listSegments` — o ÚNICO que pode virar entrada de cache.
 *
 * Nenhuma falha é engolida aqui de propósito (DA3). O Next só grava a entrada
 * quando a função `"use cache"` RETORNA; devolver um payload degradado
 * (`fixedSegments: []` + flag de erro, como era até R8) congelava o dashboard
 * zerado por até 60s, sem mutação nenhuma para disparar `revalidateTag`.
 * Lançando, nada é gravado e o caller decide o fallback.
 */
async function getCachedRadarSegments(
  teamId: string,
  profileId: string,
  role: string,
  functionsKey: string
) {
  "use cache"
  cacheTag(cacheTags.radarSegments(teamId))
  cacheLife({ stale: 30, revalidate: 60 })

  const scope = rebuildRadarScope(teamId, profileId, role, functionsKey)

  const fixedSegments = await radarService.countSegments(scope)
  const metrics = await radarService.getMetrics(scope, fixedSegments)
  const customSegments = await listCustomRadarSegments(scope, teamId)

  const segments = [
    ...fixedSegments.map((segment) => ({ ...segment, isSystem: true })),
    ...customSegments,
  ]

  // "use cache" requires plain objects — Output class instances are not serializable
  return { segments, metrics }
}

/**
 * Caminho degradado — NUNCA cacheado.
 *
 * Roda quando o bloco cacheado falhou. Devolve o que ainda é verdade (total de
 * perfis, segmentos customizados) e `null` no que dependia da contagem de
 * sistema, para a UI marcar como desconhecido em vez de imprimir zero.
 */
async function buildRadarSegmentsWithoutFixed(
  teamId: string,
  profileId: string,
  role: string,
  functionsKey: string
) {
  const scope = rebuildRadarScope(teamId, profileId, role, functionsKey)

  const metrics = await radarService.getMetrics(scope, null)
  const segments = await listCustomRadarSegments(scope, teamId)

  return { segments, metrics }
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
  sort?: "engagementScore" | "lastSeenAt"
  order?: "asc" | "desc"
}

export type RadarExportProfilesInput = Omit<RadarListProfilesInput, "page" | "pageSize">

function mapProfilesToExportInput(
  items: Array<{
    displayName: string
    primaryEmail: string | null
    displayPhone: string | null
    primaryDocument: string | null
    lastSeenAt: Date | null
    identities: Array<{ type: string; value: string | null; normalizedValue: string }>
    events: Array<{ eventType: string; occurredAt: Date }>
  }>
): RadarExportProfileInput[] {
  return items.map((item) => ({
    displayName: item.displayName,
    primaryEmail: item.primaryEmail,
    displayPhone: item.displayPhone,
    primaryDocument: item.primaryDocument,
    lastSeenAt: item.lastSeenAt,
    identities: item.identities,
    lastEvent: item.events[0]
      ? { eventType: item.events[0].eventType, occurredAt: item.events[0].occurredAt }
      : null,
  }))
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
      sort: input.sort,
      order: input.order,
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

  /**
   * D16: exporta perfis filtrados (até `RADAR_EXPORT_MAX_ROWS`) com colunas
   * próprias do Radar (perfil, identidades, último evento).
   */
  async exportProfiles(input: RadarExportProfilesInput) {
    const scope = this.scope(input.teamId, input.ctx)
    const result = await radarRepository.listProfilesForExportWithCtx(scope, {
      search: input.search,
      consent: input.consent,
      sourceType: input.sourceType as never,
      channel: input.channel,
      lastSeenFrom: input.lastSeenFrom ? new Date(input.lastSeenFrom) : undefined,
      lastSeenTo: input.lastSeenTo ? new Date(input.lastSeenTo) : undefined,
    })

    const rows = buildRadarExportRows(mapProfilesToExportInput(result.items))
    const truncated = result.total > RADAR_EXPORT_MAX_ROWS
    const messages = truncated
      ? [`Export limitado a ${RADAR_EXPORT_MAX_ROWS} linhas (${result.total} perfis no filtro).`]
      : []

    return new Output(true, messages, [], {
      rows,
      total: result.total,
      exported: rows.length,
      truncated,
      maxRows: RADAR_EXPORT_MAX_ROWS,
    })
  }

  /**
   * D16: exporta membros de um segmento de sistema ou audiência `campaign:{id}`.
   */
  async exportSegmentProfiles(teamId: string, ctx: TeamContext, segment: string) {
    const scope = this.scope(teamId, ctx)
    const page = await this.resolveSegmentProfileIdsPage(scope, segment, {
      skip: 0,
      take: RADAR_EXPORT_MAX_ROWS,
    })
    if (page === null) {
      return new Output(false, [], ["Segmento inválido"], null)
    }

    // Derivado do que a página REALMENTE trouxe, não do total: qualquer teto
    // aplicado abaixo desta camada (LIMIT do builder, por exemplo) precisa
    // aparecer aqui em vez de sair como export silenciosamente cortado.
    const truncated = page.ids.length < page.total
    const items = await radarRepository.listProfilesForExportByIdsWithCtx(scope, page.ids)
    const rows = buildRadarExportRows(mapProfilesToExportInput(items))
    const messages = truncated
      ? [`Export limitado a ${RADAR_EXPORT_MAX_ROWS} linhas (${page.total} membros no segmento).`]
      : []

    return new Output(true, messages, [], {
      rows,
      total: page.total,
      exported: rows.length,
      truncated,
      maxRows: RADAR_EXPORT_MAX_ROWS,
      segment,
    })
  }

  /**
   * D16: exporta membros de um segmento customizado.
   */
  async exportCustomSegmentProfiles(teamId: string, ctx: TeamContext, segmentId: string) {
    try {
      const scope = this.scope(teamId, ctx)
      const segment = await this.segmentService.findById(teamId, segmentId)
      if (!segment || !segment.isActive) {
        return new Output(false, [], ["Segmento não encontrado"], null)
      }

      const rules = parseRadarSegmentRules(segment.rulesJson)
      const total = await this.segmentQueryService.countProfiles(scope, rules)
      const ids = await this.segmentQueryService.listProfileIds(scope, rules, {
        skip: 0,
        take: RADAR_EXPORT_MAX_ROWS,
      })
      const items = await radarRepository.listProfilesForExportByIdsWithCtx(scope, ids)
      const rows = buildRadarExportRows(mapProfilesToExportInput(items))
      const truncated = total > RADAR_EXPORT_MAX_ROWS
      const messages = truncated
        ? [`Export limitado a ${RADAR_EXPORT_MAX_ROWS} linhas (${total} membros no segmento).`]
        : []

      return new Output(true, messages, [], {
        rows,
        total,
        exported: rows.length,
        truncated,
        maxRows: RADAR_EXPORT_MAX_ROWS,
        segmentId,
      })
    } catch (error) {
      console.error("[RadarUseCase][exportCustomSegmentProfiles]", error)
      return new Output(false, [], ["Erro ao exportar perfis do segmento"], null)
    }
  }

  async getProfile(teamId: string, ctx: TeamContext, profileId: string) {
    const profile = await radarRepository.getProfileDetailWithCtx(this.scope(teamId, ctx), profileId)
    if (!profile) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    // D17: responsáveis dos leads associados (nomes resolvidos, não só UUID).
    const leadIds = profile.identities
      .filter((identity) => identity.type === "lead_id")
      .map((identity) => identity.normalizedValue || identity.value || "")
      .filter(Boolean)
    const leads = await radarRepository.findLeadAssigneesByIds(teamId, leadIds)
    const assignees = leads.map((lead) => ({
      leadId: lead.id,
      leadCode: lead.leadCode,
      assignedTo: lead.assignee
        ? {
            id: lead.assignee.id,
            name: lead.assignee.fullName?.trim() || lead.assignee.email,
          }
        : lead.assignedTo
          ? { id: lead.assignedTo, name: null }
          : null,
      closer: lead.closer
        ? {
            id: lead.closer.id,
            name: lead.closer.fullName?.trim() || lead.closer.email,
          }
        : lead.closerId
          ? { id: lead.closerId, name: null }
          : null,
    }))

    return new Output(true, [], [], { ...profile, assignees })
  }

  /**
   * E4: pontos de contato = pares distintos canal × dia calendário (America/Sao_Paulo).
   * Canal = prefixo antes do primeiro ".": email → E-mail, whatsapp → WhatsApp,
   * form → Formulário, pixel → Pixel, demais → Outros.
   * Prefixos internos de CRM (`lead`/`portfolio`/`profile`) ficam fora da contagem/lista.
   * Retorna Output inválido (404) quando o perfil não existe ou pertence a outro time.
   */
  async getProfileTouchpoints(teamId: string, ctx: TeamContext, profileId: string) {
    const scope = this.scope(teamId, ctx)
    const exists = await radarRepository.profileExistsInScope(scope, profileId)
    if (!exists) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    const rows = await radarRepository.listProfileTouchpointEventMarkers(scope, profileId)

    const CHANNEL_MAP: Record<string, string> = {
      email: "E-mail",
      whatsapp: "WhatsApp",
      form: "Formulário",
      pixel: "Pixel",
    }
    const CRM_PREFIXES = new Set(["lead", "portfolio", "profile"])

    type ChannelBreakdown = {
      channel: string
      count: number
      firstEventAt: string
      lastEventAt: string
    }

    const channelMap = new Map<
      string,
      { dayKeys: Set<string>; firstEventAt: Date; lastEventAt: Date }
    >()

    for (const row of rows) {
      const prefix = row.eventType.split(".")[0] ?? row.eventType
      if (CRM_PREFIXES.has(prefix)) continue
      const channel = CHANNEL_MAP[prefix] ?? "Outros"
      const dayKey = formatLocalDateValue(row.occurredAt, DEFAULT_TZ)
      const existing = channelMap.get(channel)
      if (existing) {
        existing.dayKeys.add(dayKey)
        if (row.occurredAt < existing.firstEventAt) existing.firstEventAt = row.occurredAt
        if (row.occurredAt > existing.lastEventAt) existing.lastEventAt = row.occurredAt
      } else {
        channelMap.set(channel, {
          dayKeys: new Set([dayKey]),
          firstEventAt: row.occurredAt,
          lastEventAt: row.occurredAt,
        })
      }
    }

    const breakdown: ChannelBreakdown[] = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      count: data.dayKeys.size,
      firstEventAt: data.firstEventAt.toISOString(),
      lastEventAt: data.lastEventAt.toISOString(),
    }))

    const total = breakdown.reduce((sum, b) => sum + b.count, 0)

    return new Output(true, [], [], { total, breakdown })
  }


  /**
   * D13/D14: contratos atuais (LeadPortfolio) + histórico (LeadFinalized com
   * holder/dependentes) do perfil — via lead_id/portfolio_id e identidades
   * contract_holder/contract_dependent (documento/CNPJ + source links).
   */
  async getProfileContracts(teamId: string, ctx: TeamContext, profileId: string) {
    const scope = this.scope(teamId, ctx)
    const exists = await radarRepository.profileExistsInScope(scope, profileId)
    if (!exists) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    const raw = await radarRepository.findContractsForProfile(scope, profileId)

    const portfolios = raw.portfolios.map((item) => ({
      id: item.id,
      leadId: item.leadId,
      portfolioStatus: item.portfolioStatus,
      renewalStatus: item.renewalStatus,
      renewalAmount: item.renewalAmount != null ? Number(item.renewalAmount) : null,
      source: item.source,
      note: item.note,
      lastContactAt: item.lastContactAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))

    const finalized = raw.finalized.map((item) => ({
      id: item.id,
      leadId: item.leadId,
      finalizedDateAt: item.finalizedDateAt.toISOString(),
      startDateAt: item.startDateAt.toISOString(),
      amount: Number(item.amount),
      contractType: item.contractType,
      operadora: item.operadora,
      productName: item.productName,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
      holder: item.holder
        ? {
            id: item.holder.id,
            name: item.holder.name,
            razaoSocial: item.holder.razaoSocial,
            birthDate: item.holder.birthDate.toISOString(),
            document: item.holder.document,
            cnpj: item.holder.cnpj,
          }
        : null,
      dependents: item.dependents.map((dependent) => ({
        id: dependent.id,
        name: dependent.name,
        birthDate: dependent.birthDate.toISOString(),
        parentesco: dependent.parentesco,
        document: dependent.document,
      })),
    }))

    return new Output(true, [], [], { portfolios, finalized })
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
    const role = ctx.teamMember.role
    const functionsKey = ctx.teamMember.functions.join(",")

    try {
      const cached = await getCachedRadarSegments(teamId, ctx.profileId, role, functionsKey)
      return new Output(true, [], [], { ...cached, fixedSegmentsError: false })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)

      // O erro que sai de `"use cache"` perde o protótipo (o Next o serializa com
      // React Flight e troca por um Error genérico com digest), então não dá para
      // discriminar a causa pela classe. Recalcular sem cache resolve os dois
      // casos: se a falha era só da contagem de sistema, o degradado responde;
      // se era estrutural, ela estoura aqui de novo e a rota devolve 500 — que é
      // a resposta honesta.
      console.error(
        `[RadarUseCase][listSegments] Bloco cacheado indisponível, recalculando sem cache (teamId=${teamId})`,
        error
      )
      const degraded = await buildRadarSegmentsWithoutFixed(
        teamId,
        ctx.profileId,
        role,
        functionsKey
      )
      return new Output(true, [], [], { ...degraded, fixedSegmentsError: true })
    }
  }

  async listSegmentProfiles(
    teamId: string,
    ctx: TeamContext,
    segment: string,
    page: number,
    pageSize: number
  ) {
    const scope = this.scope(teamId, ctx)
    const skip = (page - 1) * pageSize
    const resolved = await this.resolveSegmentProfileIdsPage(scope, segment, {
      skip,
      take: pageSize,
    })
    if (resolved === null) {
      return new Output(false, [], ["Segmento inválido"], null)
    }

    const items = await Promise.all(
      resolved.ids.map((id) => radarRepository.getProfileDetailWithCtx(scope, id))
    )

    return new Output(true, [], [], {
      items: items.filter(Boolean),
      total: resolved.total,
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
      const segments = await this.segmentService.listWithHierarchy(teamId)
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

  /**
   * D14: Preview com suporte a hierarquia — aceita rules diretas, parentSegmentId ou campaignId.
   * Mescla condições e retorna contagem + primeiros 10 perfis.
   */
  async previewSegmentWithHierarchy(
    teamId: string,
    ctx: TeamContext,
    input: {
      rules?: unknown
      parentSegmentId?: string
      campaignId?: string
    }
  ) {
    try {
      const { emailCampaignRepository } = await import(
        "@/app/api/infra/data/repositories/emailCampaign/EmailCampaignRepository"
      )

      let finalRules: RadarSegmentRules

      if (input.campaignId) {
        const campaign = await emailCampaignRepository.findForSegmentGeneration(teamId, input.campaignId)
        if (!campaign) {
          return new Output(false, [], ["Campanha não encontrada"], null)
        }
        if (campaign.status !== "sent" && campaign.status !== "partially_sent") {
          return new Output(false, [], ["Apenas campanhas enviadas podem ser usadas"], null)
        }

        const campaignConditions = extractCampaignEventConditions(campaign.id, campaign.sentAt)
        const additionalRules = input.rules
          ? radarSegmentAdditionalRulesSchema.parse(input.rules)
          : { match: "all" as const, conditions: [] }

        try {
          finalRules = mergeHierarchicalSegmentRules(campaignConditions, additionalRules)
        } catch (mergeError) {
          return new Output(
            false,
            [],
            [mergeError instanceof Error ? mergeError.message : "Condições inválidas"],
            null
          )
        }
      } else if (input.parentSegmentId) {
        const parentSegment = await this.segmentService.findById(teamId, input.parentSegmentId)
        if (!parentSegment || !parentSegment.isActive) {
          return new Output(false, [], ["Segmento pai não encontrado ou inativo"], null)
        }
        const parentRules = parseRadarSegmentRules(parentSegment.rulesJson)
        const childRules = input.rules
          ? radarSegmentAdditionalRulesSchema.parse(input.rules)
          : { match: "all" as const, conditions: [] }

        try {
          finalRules = mergeHierarchicalSegmentRules(parentRulesToBaseConditions(parentRules), childRules)
        } catch (mergeError) {
          return new Output(
            false,
            [],
            [mergeError instanceof Error ? mergeError.message : "Condições inválidas"],
            null
          )
        }
      } else if (input.rules) {
        finalRules = parseRadarSegmentRules(input.rules)
      } else {
        return new Output(false, [], ["Informe rules, parentSegmentId ou campaignId"], null)
      }

      const scope = this.scope(teamId, ctx)
      const [count, profileIds] = await Promise.all([
        this.segmentQueryService.countProfiles(scope, finalRules),
        this.segmentQueryService.listProfileIds(scope, finalRules, { skip: 0, take: 10 }),
      ])

      const profiles = await Promise.all(
        profileIds.map((id) => radarRepository.getProfileDetailWithCtx(scope, id))
      )

      return new Output(true, [], [], {
        count,
        totalConditions: finalRules.conditions.length,
        previewProfiles: profiles.filter(Boolean),
      })
    } catch (error) {
      console.error("[RadarUseCase][previewSegmentWithHierarchy]", error)
      const message = error instanceof Error ? error.message : "Erro ao processar preview"
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

  async listFieldDefinitions(teamId: string) {
    const definitions = await teamRadarFieldDefinitionRepository.listActiveByTeam(teamId)
    return new Output(true, [], [], { definitions })
  }

  async listAvailableFields(teamId: string) {
    const catalogFields = listRadarFieldCatalog().map((field) => ({
      key: field.key,
      label: field.label,
      sourceType: field.sourceType,
    }))

    const dynamicFields = await teamRadarFieldDefinitionRepository.listActiveByTeam(teamId)
    const baseFields = dynamicFields.map((field) => ({
      key: `base.${field.key}`,
      label: field.label,
      sourceType: "BASE",
      valueType: field.valueType,
    }))

    return new Output(true, [], [], { fields: [...catalogFields, ...baseFields] })
  }

  /** D17: eventTypes distintos já ocorridos no time (para o Select do builder). */
  async listAvailableEventTypes(teamId: string, ctx: TeamContext) {
    try {
      const eventTypes = await radarRepository.listDistinctEventTypes(this.scope(teamId, ctx))
      return new Output(true, [], [], { eventTypes })
    } catch (error) {
      console.error("[RadarUseCase][listAvailableEventTypes]", error)
      return new Output(false, [], ["Erro ao listar tipos de evento"], null)
    }
  }

  /** Campanhas do time para filtrar condições `event` por `campaignId`. */
  async listAvailableCampaigns(teamId: string, _ctx: TeamContext) {
    try {
      const campaigns = await radarRepository.listEmailCampaignOptions(teamId)
      return new Output(true, [], [], { campaigns })
    } catch (error) {
      console.error("[RadarUseCase][listAvailableCampaigns]", error)
      return new Output(false, [], ["Erro ao listar campanhas"], null)
    }
  }

  /**
   * Resolve IDs de perfil para slug de sistema ou `campaign:{uuid}`.
   * Retorna `null` quando a audiência é inválida / não pertence ao time.
   */
  /**
   * Resolve uma página do segmento — de sistema ou audiência `campaign:{id}`.
   *
   * Segmento de sistema pagina no banco pelo mesmo predicado que alimenta o
   * card (R6/DA4). Audiência de campanha ainda resolve a lista inteira e fatia
   * aqui: é um recorte por `campaignId`, com ordem de magnitude menor que a
   * base do time, e sai do escopo desta SPEC.
   */
  private async resolveSegmentProfileIdsPage(
    scope: RadarTeamScope,
    segment: string,
    pagination: { skip: number; take: number }
  ): Promise<{ ids: string[]; total: number } | null> {
    if (isRadarSegmentSlug(segment)) {
      const [ids, total] = await Promise.all([
        this.service.listSegmentProfileIds(scope, segment, pagination),
        this.service.countSegmentProfiles(scope, segment),
      ])
      return { ids, total }
    }

    const campaignId = parseCampaignRadarSegmentSlug(segment)
    if (!campaignId) return null

    const campaignName = await radarRepository.findEmailCampaignName(scope.teamId, campaignId)
    if (!campaignName) return null

    const campaignIds = await this.service.listCampaignSegmentProfileIds(scope, campaignId)
    return {
      ids: campaignIds.slice(pagination.skip, pagination.skip + pagination.take),
      total: campaignIds.length,
    }
  }
}

export const customerDataPlatformUseCase = new RadarUseCase()

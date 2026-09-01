"use client"

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Output } from "@/lib/output"
import type { ICampanhasAnalyticsService } from "../services/ICampanhasAnalyticsService"
import {
  buildCampaignAnalyticsRequestKey,
  buildDefaultCampaignAnalyticsFilters,
  validateCampaignAnalyticsRange,
} from "../utils/campaignAnalyticsRange"
import {
  CAMPAIGN_ANALYTICS_DISPATCHES_PAGE_SIZE,
  type CampaignAnalyticsCsvDataset,
  type CampaignAnalyticsDispatchPage,
  type CampaignAnalyticsFiltersState,
  type CampaignAnalyticsFormFunnelRow,
  type CampaignAnalyticsSummary,
  type CampaignAnalyticsTeamOption,
  type CampaignAnalyticsTeamsSeries,
  type CampaignAnalyticsTemplateRow,
  type CampanhasAnalyticsContextType,
} from "./CampanhasAnalyticsTypes"

export const CampanhasAnalyticsContext = createContext<CampanhasAnalyticsContextType | undefined>(undefined)

type ProviderProps = {
  service: ICampanhasAnalyticsService
  children: ReactNode
}

const FAILED_OUTPUT = (message: string) => new Output(false, [], [message], null)

async function safeFetch(promise: Promise<Output>, genericMessage: string): Promise<Output> {
  try {
    return await promise
  } catch (error) {
    console.error("[CampanhasAnalyticsContext]", error)
    return FAILED_OUTPUT(genericMessage)
  }
}

function mergeTeamOptions(
  previous: CampaignAnalyticsTeamOption[],
  byTeam: { teamId: string; teamName: string }[]
): CampaignAnalyticsTeamOption[] {
  const byId = new Map(previous.map((option) => [option.id, option]))
  for (const row of byTeam) {
    byId.set(row.teamId, { id: row.teamId, name: row.teamName })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

export function CampanhasAnalyticsProvider({ service, children }: ProviderProps) {
  const defaultFilters = useMemo(() => buildDefaultCampaignAnalyticsFilters(), [])

  const [draftFilters, setDraftFiltersState] = useState<CampaignAnalyticsFiltersState>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<CampaignAnalyticsFiltersState>(defaultFilters)
  const [teamOptions, setTeamOptions] = useState<CampaignAnalyticsTeamOption[]>([])

  const [isUpdating, setIsUpdating] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const [summary, setSummary] = useState<CampaignAnalyticsSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [series, setSeries] = useState<CampaignAnalyticsTeamsSeries | null>(null)
  const [seriesError, setSeriesError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<CampaignAnalyticsTemplateRow[] | null>(null)
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const [formsFunnel, setFormsFunnel] = useState<CampaignAnalyticsFormFunnelRow[] | null>(null)
  const [formsFunnelError, setFormsFunnelError] = useState<string | null>(null)

  const [dispatches, setDispatches] = useState<CampaignAnalyticsDispatchPage | null>(null)
  const [dispatchesError, setDispatchesError] = useState<string | null>(null)
  const [isDispatchesLoading, setIsDispatchesLoading] = useState(true)
  const [dispatchesPage, setDispatchesPageState] = useState(1)
  const [dispatchesPageSize, setDispatchesPageSizeState] = useState(CAMPAIGN_ANALYTICS_DISPATCHES_PAGE_SIZE)

  // DA1: chave estável de request + in-flight guard + last-success guard +
  // id monotônico para descartar resposta obsoleta (mesmo padrão testado em
  // CronExecutionsContext — nunca AbortController neste repo).
  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  const rangeValidationError = useMemo(
    () => validateCampaignAnalyticsRange(draftFilters.from, draftFilters.to),
    [draftFilters.from, draftFilters.to]
  )

  const setDraftFilters = useCallback((next: CampaignAnalyticsFiltersState) => {
    setDraftFiltersState(next)
  }, [])

  const fetchDispatchesPage = useCallback(
    async (filters: CampaignAnalyticsFiltersState, page: number, pageSize: number) => {
      setIsDispatchesLoading(true)
      setDispatchesError(null)
      const output = await safeFetch(
        service.getDispatches({ ...filters, page, pageSize }),
        "Erro ao carregar os disparos"
      )
      if (output.isValid) {
        setDispatches(output.result as CampaignAnalyticsDispatchPage)
      } else {
        setDispatches(null)
        setDispatchesError(output.errorMessages[0] ?? "Erro ao carregar os disparos")
      }
      setIsDispatchesLoading(false)
    },
    [service]
  )

  const runGroupFetch = useCallback(
    async (filters: CampaignAnalyticsFiltersState, options: { force: boolean }) => {
      const key = buildCampaignAnalyticsRequestKey(filters)
      if (inFlightKeyRef.current === key) return
      if (!options.force && lastSuccessKeyRef.current === key) return

      inFlightKeyRef.current = key
      const requestId = ++requestIdRef.current
      setIsUpdating(true)

      const queryParams = { from: filters.from, to: filters.to, teamIds: filters.teamIds }

      const [summaryOutput, seriesOutput, templatesOutput, funnelOutput] = await Promise.all([
        safeFetch(service.getSummary(queryParams), "Erro ao carregar o resumo"),
        safeFetch(service.getTeamsSeries(queryParams), "Erro ao carregar a série diária"),
        safeFetch(service.getTemplates(queryParams), "Erro ao carregar os templates"),
        safeFetch(service.getFormsFunnel(queryParams), "Erro ao carregar o funil de formulários"),
      ])
      await fetchDispatchesPage(filters, 1, dispatchesPageSize)

      // Uma requisição mais nova foi disparada enquanto esta estava em voo —
      // descarta esta resposta obsoleta em vez de sobrescrever dado mais fresco.
      if (requestIdRef.current !== requestId) return

      if (summaryOutput.isValid) {
        const result = summaryOutput.result as CampaignAnalyticsSummary
        setSummary(result)
        setSummaryError(null)
        setTeamOptions((previous) => mergeTeamOptions(previous, result.byTeam))
      } else {
        setSummary(null)
        setSummaryError(summaryOutput.errorMessages[0] ?? "Erro ao carregar o resumo")
      }

      if (seriesOutput.isValid) {
        setSeries(seriesOutput.result as CampaignAnalyticsTeamsSeries)
        setSeriesError(null)
      } else {
        setSeries(null)
        setSeriesError(seriesOutput.errorMessages[0] ?? "Erro ao carregar a série diária")
      }

      if (templatesOutput.isValid) {
        setTemplates(templatesOutput.result as CampaignAnalyticsTemplateRow[])
        setTemplatesError(null)
      } else {
        setTemplates(null)
        setTemplatesError(templatesOutput.errorMessages[0] ?? "Erro ao carregar os templates")
      }

      if (funnelOutput.isValid) {
        setFormsFunnel(funnelOutput.result as CampaignAnalyticsFormFunnelRow[])
        setFormsFunnelError(null)
      } else {
        setFormsFunnel(null)
        setFormsFunnelError(funnelOutput.errorMessages[0] ?? "Erro ao carregar o funil de formulários")
      }

      setDispatchesPageState(1)
      lastSuccessKeyRef.current = key
      inFlightKeyRef.current = null
      setIsUpdating(false)
      setHasLoadedOnce(true)
    },
    [service, fetchDispatchesPage, dispatchesPageSize]
  )

  const refresh = useCallback(async () => {
    if (validateCampaignAnalyticsRange(draftFilters.from, draftFilters.to)) return
    setAppliedFilters(draftFilters)
    await runGroupFetch(draftFilters, { force: true })
  }, [draftFilters, runGroupFetch])

  const retry = useCallback(async () => {
    await runGroupFetch(appliedFilters, { force: true })
  }, [appliedFilters, runGroupFetch])

  const retryDispatches = useCallback(async () => {
    await fetchDispatchesPage(appliedFilters, dispatchesPage, dispatchesPageSize)
  }, [appliedFilters, dispatchesPage, dispatchesPageSize, fetchDispatchesPage])

  const exportCsv = useCallback(
    (dataset: CampaignAnalyticsCsvDataset) =>
      service.exportCsv({ from: appliedFilters.from, to: appliedFilters.to, teamIds: appliedFilters.teamIds, dataset }),
    [appliedFilters, service]
  )

  const setDispatchesPage = useCallback(
    (page: number) => {
      setDispatchesPageState(page)
      void fetchDispatchesPage(appliedFilters, page, dispatchesPageSize)
    },
    [appliedFilters, dispatchesPageSize, fetchDispatchesPage]
  )

  const setDispatchesPageSize = useCallback(
    (pageSize: number) => {
      setDispatchesPageSizeState(pageSize)
      setDispatchesPageState(1)
      void fetchDispatchesPage(appliedFilters, 1, pageSize)
    },
    [appliedFilters, fetchDispatchesPage]
  )

  // Fetch inicial único no mount — permitido pela DA1 ("um único fetch
  // inicial no mount é permitido"); depois disso só o botão Atualizar refaz.
  useEffect(() => {
    void runGroupFetch(defaultFilters, { force: false })
    // Intencionalmente roda uma única vez — não deve reagir a mudanças em
    // draftFilters/appliedFilters (é exatamente o que a DA1 proíbe).
  }, [])

  const value = useMemo<CampanhasAnalyticsContextType>(
    () => ({
      draftFilters,
      appliedFilters,
      setDraftFilters,
      rangeValidationError,
      teamOptions,
      isUpdating,
      hasLoadedOnce,
      refresh,
      retry,
      summary,
      summaryError,
      series,
      seriesError,
      templates,
      templatesError,
      formsFunnel,
      formsFunnelError,
      dispatches,
      dispatchesError,
      isDispatchesLoading,
      setDispatchesPage,
      setDispatchesPageSize,
      retryDispatches,
      exportCsv,
    }),
    [
      draftFilters,
      appliedFilters,
      setDraftFilters,
      rangeValidationError,
      teamOptions,
      isUpdating,
      hasLoadedOnce,
      refresh,
      retry,
      summary,
      summaryError,
      series,
      seriesError,
      templates,
      templatesError,
      formsFunnel,
      formsFunnelError,
      dispatches,
      dispatchesError,
      isDispatchesLoading,
      setDispatchesPage,
      setDispatchesPageSize,
      retryDispatches,
      exportCsv,
    ]
  )

  return <CampanhasAnalyticsContext.Provider value={value}>{children}</CampanhasAnalyticsContext.Provider>
}

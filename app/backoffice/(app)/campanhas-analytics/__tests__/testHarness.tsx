import type { ReactNode } from "react"
import { Output } from "@/lib/output"
import { CampanhasAnalyticsProvider } from "../features/context/CampanhasAnalyticsContext"
import type {
  CampaignAnalyticsDispatchesParams,
  CampaignAnalyticsExportParams,
  CampaignAnalyticsExportResult,
  ICampanhasAnalyticsService,
} from "../features/services/ICampanhasAnalyticsService"
import type {
  CampaignAnalyticsDispatchPage,
  CampaignAnalyticsDispatchRow,
  CampaignAnalyticsFormFunnelRow,
  CampaignAnalyticsQueryParams,
  CampaignAnalyticsSummary,
  CampaignAnalyticsTeamsSeries,
  CampaignAnalyticsTemplateRow,
} from "../features/context/CampanhasAnalyticsTypes"

/** Radix/cmdk dependem de APIs de layout que o happy-dom não implementa. */
export function installBrowserStubs() {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  if (!globalThis.DOMRect) {
    globalThis.DOMRect = class {
      x = 0
      y = 0
      width = 0
      height = 0
      top = 0
      right = 0
      bottom = 0
      left = 0
      toJSON() {
        return {}
      }
    } as unknown as typeof DOMRect
  }

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }

  const element = window.HTMLElement.prototype as unknown as Record<string, unknown>
  if (!element.scrollIntoView) element.scrollIntoView = () => {}
  if (!element.hasPointerCapture) element.hasPointerCapture = () => false
  if (!element.setPointerCapture) element.setPointerCapture = () => {}
  if (!element.releasePointerCapture) element.releasePointerCapture = () => {}
}

export function makeSummary(overrides: Partial<CampaignAnalyticsSummary> = {}): CampaignAnalyticsSummary {
  return {
    period: { from: "2026-08-27", to: "2026-08-31" },
    totals: {
      dispatches: 40,
      failed: 2,
      sent: 57512,
      delivered: 55389,
      opened: 7237,
      clicked: 45,
      bounced: 933,
      leadsCreated: 0,
      leadsAttached: 10,
      leadsTotal: 16,
    },
    rates: { openRate: 0.126, finalScore: 0.28 },
    byTeam: [
      { teamId: "t1", teamName: "Liber Corretora", sent: 1623, leads: 6, finalScore: 3.7, openRate: 0.283 },
    ],
    ...overrides,
  }
}

export function makeDispatchRow(overrides: Partial<CampaignAnalyticsDispatchRow> = {}): CampaignAnalyticsDispatchRow {
  return {
    id: "d1",
    teamId: "t1",
    teamName: "Liber Corretora",
    templateName: "GNDI Baixo Custo",
    dispatchedAt: "2026-08-31T13:59:12.000Z",
    status: "completed",
    totalRecipients: 2,
    totalSent: 2,
    totalDelivered: 2,
    totalOpened: 2,
    totalClicked: 2,
    totalBounced: 0,
    errorMessage: null,
    ...overrides,
  }
}

export function makeDispatchPage(
  overrides: Partial<CampaignAnalyticsDispatchPage> = {}
): CampaignAnalyticsDispatchPage {
  return { rows: [makeDispatchRow()], total: 1, page: 1, pageSize: 25, ...overrides }
}

export function makeTeamsSeries(overrides: Partial<CampaignAnalyticsTeamsSeries> = {}): CampaignAnalyticsTeamsSeries {
  return {
    granularity: "day",
    points: [],
    total: [{ day: "2026-08-28", sent: 12146, delivered: 11746, opened: 1523, clicked: 11 }],
    ...overrides,
  }
}

export function makeTemplateRow(overrides: Partial<CampaignAnalyticsTemplateRow> = {}): CampaignAnalyticsTemplateRow {
  return {
    teamId: "t1",
    teamName: "Kathrein Antunes",
    templateName: "v2 médicos",
    dispatches: 4,
    sent: 6739,
    delivered: 6691,
    opened: 2494,
    clicked: 4,
    bounced: 55,
    failed: 0,
    openRate: 0.37,
    ...overrides,
  }
}

export function makeFormFunnelRow(
  overrides: Partial<CampaignAnalyticsFormFunnelRow> = {}
): CampaignAnalyticsFormFunnelRow {
  return {
    formId: "f1",
    formName: "Formulário básico",
    teamId: "t1",
    teamName: "Liber Corretora",
    viewed: 67,
    started: 12,
    completed: 10,
    leadCreated: 0,
    leadAttached: 9,
    startRate: 0.179,
    closeRate: 0.833,
    ...overrides,
  }
}

type FakeServiceOptions = {
  summary?: CampaignAnalyticsSummary
  series?: CampaignAnalyticsTeamsSeries
  templates?: CampaignAnalyticsTemplateRow[]
  formsFunnel?: CampaignAnalyticsFormFunnelRow[]
  dispatches?: CampaignAnalyticsDispatchPage
  /** Quando definido, essas chamadas nunca resolvem — útil para travar em loading. */
  neverResolve?: boolean
  /** Força erro (Output inválido) em uma chamada específica. */
  failOn?: Partial<Record<"summary" | "series" | "templates" | "formsFunnel" | "dispatches", string>>
}

export class FakeCampanhasAnalyticsService implements ICampanhasAnalyticsService {
  readonly summaryCalls: CampaignAnalyticsQueryParams[] = []
  readonly dispatchesCalls: CampaignAnalyticsDispatchesParams[] = []
  readonly exportCalls: CampaignAnalyticsExportParams[] = []

  constructor(private readonly options: FakeServiceOptions = {}) {}

  private neverIfConfigured<T>(): Promise<T> | null {
    return this.options.neverResolve ? new Promise<T>(() => {}) : null
  }

  async getSummary(params: CampaignAnalyticsQueryParams): Promise<Output> {
    this.summaryCalls.push(params)
    const never = this.neverIfConfigured<Output>()
    if (never) return never
    if (this.options.failOn?.summary) return new Output(false, [], [this.options.failOn.summary], null)
    return new Output(true, [], [], this.options.summary ?? makeSummary())
  }

  async getDispatches(params: CampaignAnalyticsDispatchesParams): Promise<Output> {
    this.dispatchesCalls.push(params)
    const never = this.neverIfConfigured<Output>()
    if (never) return never
    if (this.options.failOn?.dispatches) return new Output(false, [], [this.options.failOn.dispatches], null)
    return new Output(true, [], [], this.options.dispatches ?? makeDispatchPage())
  }

  async getTeamsSeries(params: CampaignAnalyticsQueryParams): Promise<Output> {
    void params
    const never = this.neverIfConfigured<Output>()
    if (never) return never
    if (this.options.failOn?.series) return new Output(false, [], [this.options.failOn.series], null)
    return new Output(true, [], [], this.options.series ?? makeTeamsSeries())
  }

  async getTemplates(params: CampaignAnalyticsQueryParams): Promise<Output> {
    void params
    const never = this.neverIfConfigured<Output>()
    if (never) return never
    if (this.options.failOn?.templates) return new Output(false, [], [this.options.failOn.templates], null)
    return new Output(true, [], [], this.options.templates ?? [makeTemplateRow()])
  }

  async getFormsFunnel(params: CampaignAnalyticsQueryParams): Promise<Output> {
    void params
    const never = this.neverIfConfigured<Output>()
    if (never) return never
    if (this.options.failOn?.formsFunnel) return new Output(false, [], [this.options.failOn.formsFunnel], null)
    return new Output(true, [], [], this.options.formsFunnel ?? [makeFormFunnelRow()])
  }

  async exportCsv(params: CampaignAnalyticsExportParams): Promise<CampaignAnalyticsExportResult> {
    this.exportCalls.push(params)
    return { blob: new Blob(["csv"], { type: "text/csv" }), filename: `campanhas_${params.dataset}.csv` }
  }
}

export function renderWithProvider(service: ICampanhasAnalyticsService, children: ReactNode) {
  return <CampanhasAnalyticsProvider service={service}>{children}</CampanhasAnalyticsProvider>
}

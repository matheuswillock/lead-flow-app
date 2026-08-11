export type CronExecutionStatusKey = "running" | "success" | "failed"

/**
 * Shape returned by GET /backoffice/cron-executions after JSON serialization:
 * every Prisma `DateTime` arrives as an ISO string, not a `Date`.
 */
export interface CronExecutionItem {
  id: string
  cronKey: string
  cronPath: string
  status: CronExecutionStatusKey
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorSummary: string | null
  errorDetail: string | null
  metadata: unknown
  createdAt: string
  updatedAt: string
}

export interface CronExecutionsFiltersState {
  query: string
  cronKeyFilter: string[]
  statusFilter: CronExecutionStatusKey[]
  periodStart: string
  periodEnd: string
}

export const EMPTY_CRON_EXECUTIONS_FILTERS: CronExecutionsFiltersState = {
  query: "",
  cronKeyFilter: [],
  statusFilter: [],
  periodStart: "",
  periodEnd: "",
}

export const CRON_EXECUTION_STATUS_OPTIONS: {
  key: CronExecutionStatusKey
  title: string
}[] = [
  { key: "running", title: "Executando" },
  { key: "success", title: "Sucesso" },
  { key: "failed", title: "Falhou" },
]

export const CRON_EXECUTION_STATUS_LABELS: Record<CronExecutionStatusKey, string> = {
  running: "Executando",
  success: "Sucesso",
  failed: "Falhou",
}

export function getCronExecutionStatusBadgeClass(
  status: CronExecutionStatusKey
): string {
  const classes: Record<CronExecutionStatusKey, string> = {
    running: "border-primary/30 bg-primary/10 text-primary",
    success: "border-primary/30 bg-primary/15 text-primary",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
  }
  return classes[status]
}

export function isCronExecutionsFiltersEmpty(
  filters: CronExecutionsFiltersState
): boolean {
  return (
    !filters.query.trim() &&
    filters.cronKeyFilter.length === 0 &&
    filters.statusFilter.length === 0 &&
    !filters.periodStart &&
    !filters.periodEnd
  )
}

/**
 * Client-side narrowing over the window already fetched from the API.
 * The date range is applied server-side (the API supports startDate/endDate),
 * so only the multi-select and free-text dimensions are handled here.
 */
export function filterCronExecutions(
  executions: CronExecutionItem[],
  filters: CronExecutionsFiltersState
): CronExecutionItem[] {
  const query = filters.query.trim().toLowerCase()
  const cronKeys = new Set(filters.cronKeyFilter)
  const statuses = new Set<CronExecutionStatusKey>(filters.statusFilter)

  return executions.filter((execution) => {
    if (cronKeys.size > 0 && !cronKeys.has(execution.cronKey)) return false
    if (statuses.size > 0 && !statuses.has(execution.status)) return false
    if (!query) return true

    const haystack = [
      execution.cronKey,
      execution.cronPath,
      execution.errorSummary ?? "",
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function getCronKeyOptions(executions: CronExecutionItem[]): string[] {
  return Array.from(new Set(executions.map((execution) => execution.cronKey))).sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  )
}

export function formatCronExecutionDuration(durationMs: number | null): string {
  if (durationMs === null || durationMs === undefined) return "-"
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${(durationMs / 60000).toFixed(1)}min`
}

export function formatCronExecutionDateTime(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date)
}

export interface CronExecutionsContextType {
  executions: CronExecutionItem[]
  filteredExecutions: CronExecutionItem[]
  cronKeyOptions: string[]
  filters: CronExecutionsFiltersState
  loading: boolean
  error: string | null
  selectedExecution: CronExecutionItem | null
  setFilter: <Key extends keyof CronExecutionsFiltersState>(
    key: Key,
    value: CronExecutionsFiltersState[Key]
  ) => void
  setFilters: (filters: CronExecutionsFiltersState) => void
  clearFilters: () => void
  refresh: () => Promise<void>
  selectExecution: (execution: CronExecutionItem | null) => void
}

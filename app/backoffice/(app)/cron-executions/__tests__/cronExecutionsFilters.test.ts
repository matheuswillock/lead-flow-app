import { describe, expect, it } from "bun:test"
import {
  EMPTY_CRON_EXECUTIONS_FILTERS,
  filterCronExecutions,
  formatCronExecutionDuration,
  getCronExecutionStatusBadgeClass,
  getCronKeyOptions,
  isCronExecutionsFiltersEmpty,
  type CronExecutionItem,
} from "../features/context/CronExecutionsContextTypes"

function makeExecution(overrides: Partial<CronExecutionItem> = {}): CronExecutionItem {
  return {
    id: "exec-1",
    cronKey: "radar-import",
    cronPath: "/radar/cron/process-import-jobs",
    status: "success",
    startedAt: "2026-08-10T21:45:29.000Z",
    finishedAt: "2026-08-10T21:45:31.000Z",
    durationMs: 2000,
    errorSummary: null,
    errorDetail: null,
    metadata: null,
    createdAt: "2026-08-10T21:45:29.000Z",
    updatedAt: "2026-08-10T21:45:31.000Z",
    ...overrides,
  }
}

const executions: CronExecutionItem[] = [
  makeExecution({ id: "a", cronKey: "radar-import", status: "failed", errorSummary: "P2028" }),
  makeExecution({ id: "b", cronKey: "webhook-outbox", status: "success" }),
  makeExecution({ id: "c", cronKey: "evaluate-idle", status: "running" }),
  makeExecution({ id: "d", cronKey: "radar-import", status: "success" }),
]

describe("filterCronExecutions", () => {
  it("retorna tudo quando não há filtro", () => {
    expect(filterCronExecutions(executions, EMPTY_CRON_EXECUTIONS_FILTERS)).toHaveLength(4)
  })

  it("filtra por múltiplos crons (multi-seleção)", () => {
    const result = filterCronExecutions(executions, {
      ...EMPTY_CRON_EXECUTIONS_FILTERS,
      cronKeyFilter: ["radar-import", "evaluate-idle"],
    })
    expect(result.map((item) => item.id)).toEqual(["a", "c", "d"])
  })

  it("filtra por múltiplos status (multi-seleção)", () => {
    const result = filterCronExecutions(executions, {
      ...EMPTY_CRON_EXECUTIONS_FILTERS,
      statusFilter: ["failed", "running"],
    })
    expect(result.map((item) => item.id)).toEqual(["a", "c"])
  })

  it("combina cron e status", () => {
    const result = filterCronExecutions(executions, {
      ...EMPTY_CRON_EXECUTIONS_FILTERS,
      cronKeyFilter: ["radar-import"],
      statusFilter: ["failed"],
    })
    expect(result.map((item) => item.id)).toEqual(["a"])
  })

  it("busca por cron, rota e resumo de erro", () => {
    expect(
      filterCronExecutions(executions, {
        ...EMPTY_CRON_EXECUTIONS_FILTERS,
        query: "p2028",
      }).map((item) => item.id)
    ).toEqual(["a"])

    expect(
      filterCronExecutions(executions, {
        ...EMPTY_CRON_EXECUTIONS_FILTERS,
        query: "process-import-jobs",
      })
    ).toHaveLength(4)
  })
})

describe("isCronExecutionsFiltersEmpty", () => {
  it("é vazio no estado inicial", () => {
    expect(isCronExecutionsFiltersEmpty(EMPTY_CRON_EXECUTIONS_FILTERS)).toBe(true)
  })

  it("deixa de ser vazio para cada dimensão de filtro", () => {
    expect(
      isCronExecutionsFiltersEmpty({ ...EMPTY_CRON_EXECUTIONS_FILTERS, query: "radar" })
    ).toBe(false)
    expect(
      isCronExecutionsFiltersEmpty({
        ...EMPTY_CRON_EXECUTIONS_FILTERS,
        cronKeyFilter: ["radar-import"],
      })
    ).toBe(false)
    expect(
      isCronExecutionsFiltersEmpty({
        ...EMPTY_CRON_EXECUTIONS_FILTERS,
        statusFilter: ["failed"],
      })
    ).toBe(false)
    expect(
      isCronExecutionsFiltersEmpty({
        ...EMPTY_CRON_EXECUTIONS_FILTERS,
        periodStart: "2026-08-01",
      })
    ).toBe(false)
  })

  it("ignora query composta apenas de espaços", () => {
    expect(
      isCronExecutionsFiltersEmpty({ ...EMPTY_CRON_EXECUTIONS_FILTERS, query: "   " })
    ).toBe(true)
  })
})

describe("getCronKeyOptions", () => {
  it("deduplica e ordena as chaves de cron carregadas", () => {
    expect(getCronKeyOptions(executions)).toEqual([
      "evaluate-idle",
      "radar-import",
      "webhook-outbox",
    ])
  })
})

describe("getCronExecutionStatusBadgeClass", () => {
  it("usa apenas tokens semânticos", () => {
    const classes = [
      getCronExecutionStatusBadgeClass("running"),
      getCronExecutionStatusBadgeClass("success"),
      getCronExecutionStatusBadgeClass("failed"),
    ]

    expect(getCronExecutionStatusBadgeClass("failed")).toContain("text-destructive")
    for (const value of classes) {
      expect(value).not.toMatch(/dark:/)
      expect(value).not.toMatch(/(blue|green|red|gray|slate)-\d/)
    }
  })
})

describe("formatCronExecutionDuration", () => {
  it("formata ms, segundos e minutos", () => {
    expect(formatCronExecutionDuration(null)).toBe("-")
    expect(formatCronExecutionDuration(850)).toBe("850ms")
    expect(formatCronExecutionDuration(2000)).toBe("2.0s")
    expect(formatCronExecutionDuration(90000)).toBe("1.5min")
  })
})

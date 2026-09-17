import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  CRON_MAX_DURATION_SECONDS,
  resolveMinimumStaleThresholdMs,
  resolveStaleThresholdMs,
  STALE_THRESHOLD_MULTIPLIER,
  UNKNOWN_CRON_MAX_DURATION_SECONDS,
  VERCEL_DEFAULT_MAX_DURATION_SECONDS,
} from "./cronStaleThresholds"

const ONE_HOUR_MS = 60 * 60 * 1000

type VercelCron = { path: string; schedule: string }

function readVercelCronPaths(): string[] {
  const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8")
  const crons = (JSON.parse(raw) as { crons?: VercelCron[] }).crons ?? []
  return [...new Set(crons.map((cron) => cron.path))]
}

function readCronKeyFromRoute(cronPath: string): string | null {
  const routeFile = join(process.cwd(), "app", `${cronPath}`, "route.ts")
  const source = readFileSync(routeFile, "utf8")
  return /cronKey:\s*"([^"]+)"/.exec(source)?.[1] ?? null
}

describe("cronStaleThresholds", () => {
  it("cobre todos os cronKeys registrados no vercel.json", () => {
    const missing = readVercelCronPaths()
      .map((cronPath) => ({ cronPath, cronKey: readCronKeyFromRoute(cronPath) }))
      .filter(({ cronKey }) => !cronKey || !(cronKey in CRON_MAX_DURATION_SECONDS))

    expect(missing).toEqual([])
  })

  it("não guarda teto para cronKey que não existe mais no vercel.json", () => {
    const declaredKeys = new Set(
      readVercelCronPaths()
        .map(readCronKeyFromRoute)
        .filter((cronKey): cronKey is string => Boolean(cronKey)),
    )

    const orphanKeys = Object.keys(CRON_MAX_DURATION_SECONDS).filter(
      (cronKey) => !declaredKeys.has(cronKey),
    )

    expect(orphanKeys).toEqual([])
  })

  it("aplica o multiplicador sobre o maxDuration do cronKey", () => {
    expect(resolveStaleThresholdMs("database-backup")).toBe(300 * STALE_THRESHOLD_MULTIPLIER * 1000)
    expect(resolveStaleThresholdMs("dispatch-scheduled")).toBe(60 * STALE_THRESHOLD_MULTIPLIER * 1000)
  })

  it("usa teto conservador para cronKey desconhecido", () => {
    expect(resolveStaleThresholdMs("cron-que-nao-existe")).toBe(
      UNKNOWN_CRON_MAX_DURATION_SECONDS * STALE_THRESHOLD_MULTIPLIER * 1000,
    )
  })

  it("mantém todo teto abaixo de 1h — invariante do critério de sucesso T-Q1.3", () => {
    const acimaDeUmaHora = Object.keys(CRON_MAX_DURATION_SECONDS).filter(
      (cronKey) => resolveStaleThresholdMs(cronKey) >= ONE_HOUR_MS,
    )

    expect(acimaDeUmaHora).toEqual([])
    expect(resolveStaleThresholdMs("cron-que-nao-existe")).toBeLessThan(ONE_HOUR_MS)
    expect(VERCEL_DEFAULT_MAX_DURATION_SECONDS * STALE_THRESHOLD_MULTIPLIER * 1000).toBeLessThan(
      ONE_HOUR_MS,
    )
  })

  it("expõe o menor teto como piso da varredura de candidatos", () => {
    expect(resolveMinimumStaleThresholdMs()).toBe(60 * STALE_THRESHOLD_MULTIPLIER * 1000)
  })
})

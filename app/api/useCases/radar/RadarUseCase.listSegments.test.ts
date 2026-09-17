import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import type { SegmentCount } from "@/app/api/services/radar/RadarService"
import { registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

mock.module("server-only", () => ({}))

registerPrismaModuleMock()

// `cacheTag`/`cacheLife` lançam fora de um escopo `"use cache"`, e a diretiva é
// um no-op no bun test (não passa pelo compilador do Next).
mock.module("next/cache", () => ({
  cacheTag: mock(() => undefined),
  cacheLife: mock(() => undefined),
  revalidateTag: mock(() => undefined),
}))

let countSegmentsFails = false
let countSegmentsCalls = 0
let getMetricsArgs: unknown[] = []

const HEALTHY_SEGMENTS: SegmentCount[] = [
  { slug: "email_marketable", name: "Aptos para e-mail", description: "", count: 42 },
  { slug: "email_blocked", name: "Bloqueados", description: "", count: 7 },
  { slug: "opened_not_clicked", name: "Abriram e não clicaram", description: "", count: 5 },
]

// `spyOn` nos singletons reais, com restauração no `afterAll`, em vez de
// `mock.module`: mockar os módulos de service contamina o processo inteiro —
// `SyncFinalizedToRadarUseCase.test.ts` precisa do `radarService` REAL e
// `RadarSegmentQueryService.p2035.test.ts` do `radarSegmentQueryService` REAL.
const { radarService } = await import("@/app/api/services/radar/RadarService")
const { teamRadarSegmentService } = await import(
  "@/app/api/services/radar/TeamRadarSegmentService"
)
const { radarSegmentQueryService } = await import(
  "@/app/api/services/radar/RadarSegmentQueryService"
)

const countSegments = spyOn(radarService, "countSegments").mockImplementation(async () => {
  countSegmentsCalls += 1
  if (countSegmentsFails) {
    throw new Error("P2024: Timed out fetching a new connection from the connection pool")
  }
  return HEALTHY_SEGMENTS
})

const getMetrics = spyOn(radarService, "getMetrics").mockImplementation(
  async (_scope, precomputed) => {
    getMetricsArgs.push(precomputed)
    if (precomputed === null) {
      return { totalProfiles: 330, marketable: null, blocked: null, engaged: null }
    }
    return { totalProfiles: 330, marketable: 42, blocked: 7, engaged: 5 }
  }
)

const listByTeam = spyOn(teamRadarSegmentService, "listByTeam").mockImplementation(
  async () =>
    [
      {
        id: "seg-1",
        name: "Quentes do Sul",
        description: "custom",
        rulesJson: {
          match: "all",
          conditions: [{ kind: "profile_field", field: "primaryEmail", operator: "not_empty" }],
        },
      },
    ] as unknown as Awaited<ReturnType<typeof teamRadarSegmentService.listByTeam>>
)

const countProfiles = spyOn(radarSegmentQueryService, "countProfiles").mockImplementation(
  async () => 9
)

afterAll(() => {
  countSegments.mockRestore()
  getMetrics.mockRestore()
  listByTeam.mockRestore()
  countProfiles.mockRestore()
})

const { customerDataPlatformUseCase } = await import("./RadarUseCase")

const ctx: TeamContext = {
  profileId: "profile-1",
  teamMember: { role: "manager", functions: [] },
} as unknown as TeamContext

beforeEach(() => {
  countSegmentsFails = false
  countSegmentsCalls = 0
  getMetricsArgs = []
})

describe("T-R3.1 — resultado degradado nunca vira estado persistente", () => {
  it("sinaliza fixedSegmentsError quando a contagem de sistema falha", async () => {
    countSegmentsFails = true

    const output = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    const result = output.result as {
      fixedSegmentsError: boolean
      segments: Array<{ slug: string; isSystem: boolean }>
    }

    expect(output.isValid).toBe(true)
    expect(result.fixedSegmentsError).toBe(true)
    expect(result.segments.some((segment) => segment.isSystem)).toBe(false)
  })

  it("não fabrica zero nas métricas quando a contagem de sistema falha", async () => {
    countSegmentsFails = true

    const output = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    const result = output.result as {
      metrics: { totalProfiles: number; marketable: number | null }
    }

    // O caminho degradado passa `null` (desconhecido) para getMetrics — nunca uma
    // lista vazia, que faria a métrica sair 0 como se tivesse sido medida.
    expect(getMetricsArgs).toContain(null)
    expect(result.metrics.marketable).toBeNull()
    expect(result.metrics.totalProfiles).toBe(330)
  })

  it("a chamada seguinte com o serviço são volta o número real", async () => {
    countSegmentsFails = true
    const degraded = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    expect((degraded.result as { fixedSegmentsError: boolean }).fixedSegmentsError).toBe(true)

    countSegmentsFails = false
    const recovered = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    const result = recovered.result as {
      fixedSegmentsError: boolean
      segments: Array<{ slug: string; count: number }>
    }

    expect(result.fixedSegmentsError).toBe(false)
    expect(result.segments.find((segment) => segment.slug === "email_marketable")?.count).toBe(42)
  })

  it("mantém os segmentos customizados no caminho degradado", async () => {
    countSegmentsFails = true

    const output = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    const result = output.result as { segments: Array<{ name: string; count: number }> }

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.name).toBe("Quentes do Sul")
    expect(result.segments[0]?.count).toBe(9)
  })

  it("caminho feliz devolve os segmentos de sistema sem flag de erro", async () => {
    const output = await customerDataPlatformUseCase.listSegments("team-1", ctx)
    const result = output.result as {
      fixedSegmentsError: boolean
      segments: Array<{ slug: string; isSystem: boolean }>
    }

    expect(result.fixedSegmentsError).toBe(false)
    expect(result.segments.filter((segment) => segment.isSystem)).toHaveLength(3)
    expect(countSegmentsCalls).toBe(1)
  })
})

// T-R3.2 — a garantia de "não cachear erro" é estrutural: no bun test a diretiva
// `"use cache"` é inerte, então a única prova possível aqui é que o bloco
// cacheado não tem como produzir um payload degradado.
describe("T-R3.2 — o bloco cacheado só contém o caminho feliz", () => {
  const source = readFileSync(
    path.join(import.meta.dir, "RadarUseCase.ts"),
    "utf8"
  )

  /** Corpo da função até a chave de fechamento em coluna zero. */
  function bodyOf(functionName: string): string {
    const start = source.indexOf(`async function ${functionName}(`)
    expect(start).toBeGreaterThan(-1)
    const end = source.indexOf("\n}\n", start)
    expect(end).toBeGreaterThan(start)
    return source.slice(start, end + 3)
  }

  it("getCachedRadarSegments declara use cache, tag e vida útil", () => {
    const body = bodyOf("getCachedRadarSegments")

    expect(body).toContain('"use cache"')
    expect(body).toContain("cacheTag(cacheTags.radarSegments(teamId))")
    expect(body).toContain("cacheLife(")
  })

  it("getCachedRadarSegments não engole a falha de countSegments", () => {
    const body = bodyOf("getCachedRadarSegments")

    // Sem catch e sem flag: qualquer falha propaga, e o Next só grava entrada de
    // cache quando a função RETORNA. É isso que impede o "0 por 60s" (R8).
    expect(body).not.toContain("catch")
    expect(body).not.toContain("fixedSegmentsError")
  })

  it("o caminho degradado é uma função separada e não cacheada", () => {
    const body = bodyOf("buildRadarSegmentsWithoutFixed")

    expect(body).not.toContain('"use cache"')
    expect(body).not.toContain("cacheTag(")
    expect(body).toContain("null")
  })
})

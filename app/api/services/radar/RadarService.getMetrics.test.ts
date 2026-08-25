import { describe, expect, it, mock } from "bun:test"
import { RadarService, type SegmentCount } from "./RadarService"
import type { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

const scope = {
  teamId: "team-1",
  ctx: { profileId: "profile-1", teamMember: { role: "manager", functions: [] } },
} as unknown as RadarTeamScope

function buildRepo(overrides: Record<string, unknown> = {}): RadarRepository {
  return {
    countProfiles: mock(async () => 330),
    countFixedSegmentsSQL: mock(async () => new Map<string, number>()),
    ...overrides,
  } as unknown as RadarRepository
}

const segments: SegmentCount[] = [
  { slug: "email_marketable", name: "Aptos para e-mail", description: "", count: 42 },
  { slug: "email_blocked", name: "Bloqueados", description: "", count: 7 },
  { slug: "opened_not_clicked", name: "Abriram e não clicaram", description: "", count: 5 },
]

describe("RadarService.getMetrics", () => {
  it("deriva as métricas dos segmentos pré-calculados", async () => {
    const service = new RadarService(buildRepo())

    const metrics = await service.getMetrics(scope, segments)

    expect(metrics).toEqual({
      totalProfiles: 330,
      marketable: 42,
      blocked: 7,
      engaged: 5,
    })
  })

  // R8/DA3: quando a contagem de segmentos de sistema falha, o número derivado é
  // DESCONHECIDO — não zero. Devolver 0 aqui é a origem do "dashboard zerado":
  // a UI imprime um número que parece medido e não é.
  it("devolve null nos derivados quando a contagem de sistema está indisponível", async () => {
    const countFixedSegmentsSQL = mock(async () => new Map<string, number>())
    const service = new RadarService(buildRepo({ countFixedSegmentsSQL }))

    const metrics = await service.getMetrics(scope, null)

    expect(metrics.totalProfiles).toBe(330)
    expect(metrics.marketable).toBeNull()
    expect(metrics.blocked).toBeNull()
    expect(metrics.engaged).toBeNull()
  })

  it("não tenta recontar segmentos quando recebe null — a contagem já falhou", async () => {
    const countFixedSegmentsSQL = mock(async () => new Map<string, number>())
    const service = new RadarService(buildRepo({ countFixedSegmentsSQL }))

    await service.getMetrics(scope, null)

    expect(countFixedSegmentsSQL).not.toHaveBeenCalled()
  })

  it("conta os segmentos quando nenhum pré-calculado é passado", async () => {
    const countFixedSegmentsSQL = mock(
      async () => new Map<string, number>([["email_marketable", 11]])
    )
    const service = new RadarService(buildRepo({ countFixedSegmentsSQL }))

    const metrics = await service.getMetrics(scope)

    expect(countFixedSegmentsSQL).toHaveBeenCalled()
    expect(metrics.marketable).toBe(11)
  })
})

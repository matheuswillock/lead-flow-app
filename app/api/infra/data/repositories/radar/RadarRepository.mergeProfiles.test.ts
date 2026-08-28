import { beforeEach, describe, expect, it, mock } from "bun:test"
import { DEFAULT_ENGAGEMENT_CONFIG, computeEngagementScore } from "@/lib/radar/engagement-score"

type EventRow = {
  id: string
  sourceType: string
  sourceId: string
  eventType: string
  occurredAt: Date
  metadata?: unknown
}

const NOW = new Date("2026-08-05T12:00:00.000Z")
const recent = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)

let winningEvents: EventRow[] = []
let losingEvents: EventRow[] = []
let lastScoreUpdate: { profileId: string; teamId: string; score: number; band: string } | null =
  null

const tx = {
  radarIdentity: {
    findMany: mock(async () => []),
    updateMany: mock(async () => ({ count: 1 })),
  },
  radarSourceLink: {
    findMany: mock(async () => []),
    findFirst: mock(async () => null),
    delete: mock(async () => ({})),
    update: mock(async () => ({})),
  },
  radarEvent: {
    findMany: mock(async ({ where }: { where: { profileId: string } }) => {
      if (where.profileId === "win-profile") return winningEvents
      if (where.profileId === "lose-profile") return losingEvents
      return []
    }),
    findFirst: mock(async () => null),
    update: mock(
      async ({ where, data }: { where: { id: string }; data: { profileId: string } }) => {
        const idx = losingEvents.findIndex((event) => event.id === where.id)
        if (idx >= 0) {
          const [moved] = losingEvents.splice(idx, 1)
          winningEvents.push({ ...moved, sourceId: moved.sourceId })
          void data
        }
        return {}
      },
    ),
    delete: mock(async () => ({})),
  },
  radarChannelConsent: {
    findMany: mock(async () => []),
    findUnique: mock(async () => null),
    update: mock(async () => ({})),
    delete: mock(async () => ({})),
  },
  radarProfile: {
    findUnique: mock(async ({ where }: { where: { id: string } }) => ({
      displayName: where.id === "win-profile" ? "Maria" : "Visitante Anônimo",
      normalizedName: where.id === "win-profile" ? "maria" : "visitante anonimo",
      displayPhone: null,
      normalizedPhone: null,
      primaryEmail: null,
      normalizedPrimaryEmail: null,
    })),
    update: mock(async () => ({})),
    delete: mock(async () => ({})),
  },
}

const prismaMock = {
  $transaction: mock(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  radarEvent: {
    findMany: mock(async ({ where }: { where: { profileId: string } }) => {
      if (where.profileId === "win-profile") {
        return winningEvents.map((event) => ({
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          metadata: event.metadata ?? null,
        }))
      }
      return []
    }),
  },
  radarProfile: {
    updateMany: mock(
      async ({
        where,
        data,
      }: {
        where: { id: string; teamId: string }
        data: { engagementScore: number; engagementBand: string }
      }) => {
        lastScoreUpdate = {
          profileId: where.id,
          teamId: where.teamId,
          score: data.engagementScore,
          band: data.engagementBand,
        }
        return { count: 1 }
      },
    ),
  },
  backofficeRadarEngagementWeight: {
    findMany: mock(async () => [
      { eventType: "form.completed", weight: 25 },
      { eventType: "email.clicked", weight: 12 },
    ]),
  },
  backofficeRadarEngagementConfig: {
    findFirst: mock(async () => null),
  },
  backofficeFormEngagementScoreRule: {
    findMany: mock(async () => []),
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  withPrismaRetry: <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import("@/app/api/infra/data/repositories/radar/RadarRepository")

describe("RadarRepository.mergeProfiles (E3a)", () => {
  beforeEach(() => {
    lastScoreUpdate = null
    winningEvents = [
      {
        id: "evt-win-1",
        sourceType: "email",
        sourceId: "src-email-1",
        eventType: "email.clicked",
        occurredAt: recent,
      },
    ]
    losingEvents = [
      {
        id: "evt-lose-1",
        sourceType: "form",
        sourceId: "src-form-1",
        eventType: "form.completed",
        occurredAt: recent,
      },
    ]
    prismaMock.$transaction.mockClear()
    prismaMock.radarProfile.updateMany.mockClear()
  })

  it("recalcula score do vencedor com eventos combinados após o merge", async () => {
    const repo = new RadarRepository()
    // Congela "agora" via Date no compute esperado; updateEngagementScore usa new Date().
    // Aceitamos score >= score só do vencedor e igual ao score dos eventos pós-merge.
    await repo.mergeProfiles("team-1", "lose-profile", "win-profile")

    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(losingEvents).toHaveLength(0)
    expect(winningEvents).toHaveLength(2)
    expect(lastScoreUpdate).not.toBeNull()
    expect(lastScoreUpdate?.profileId).toBe("win-profile")
    expect(lastScoreUpdate?.teamId).toBe("team-1")

    const expected = computeEngagementScore(
      winningEvents.map((event) => ({
        eventType: event.eventType,
        occurredAt: event.occurredAt,
      })),
      { "form.completed": 25, "email.clicked": 12 },
      DEFAULT_ENGAGEMENT_CONFIG,
      new Date(),
    )

    expect(lastScoreUpdate?.score).toBe(expected.score)
    expect(lastScoreUpdate?.band).toBe(expected.band)

    const winnerOnly = computeEngagementScore(
      [{ eventType: "email.clicked", occurredAt: recent }],
      { "form.completed": 25, "email.clicked": 12 },
      DEFAULT_ENGAGEMENT_CONFIG,
      new Date(),
    )
    expect(lastScoreUpdate!.score).toBeGreaterThan(winnerOnly.score)
  })

  it("não abre transação quando losing === winning", async () => {
    const repo = new RadarRepository()
    await repo.mergeProfiles("team-1", "same-id", "same-id")
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(lastScoreUpdate).toBeNull()
  })
})

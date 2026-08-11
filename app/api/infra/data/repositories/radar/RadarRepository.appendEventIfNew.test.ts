import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { Prisma } from "@prisma/client"

type AppendInput = {
  profileId: string
  teamId: string
  eventType: string
  sourceType: string
  sourceId?: string | null
  occurredAt: Date
  metadata?: Prisma.InputJsonValue
}

const APPEND_INPUT: AppendInput = {
  profileId: "profile-1",
  teamId: "team-1",
  eventType: "email.clicked",
  sourceType: "email_log",
  sourceId: "log-1",
  occurredAt: new Date("2026-08-10T12:00:00.000Z"),
}

const APPEND_INPUT_WITHOUT_SOURCE_ID: AppendInput = {
  profileId: "profile-1",
  teamId: "team-1",
  eventType: "email.opened",
  sourceType: "email_log",
  occurredAt: new Date("2026-08-10T12:00:00.000Z"),
}

const createdEvent = {
  id: "event-1",
  profileId: APPEND_INPUT.profileId,
  teamId: APPEND_INPUT.teamId,
  eventType: APPEND_INPUT.eventType,
  sourceType: APPEND_INPUT.sourceType,
  sourceId: APPEND_INPUT.sourceId ?? null,
  occurredAt: APPEND_INPUT.occurredAt,
  metadata: null,
  createdAt: new Date("2026-08-10T12:00:01.000Z"),
}

const radarEventFindFirst = mock(async (): Promise<{ id: string } | null> => null)
const radarEventCreate = mock(async () => createdEvent)

const prismaMock = {
  $connect: mock(async () => {}),
  radarEvent: {
    findFirst: radarEventFindFirst,
    create: radarEventCreate,
    findMany: mock(async () => []),
  },
  radarProfile: {
    updateMany: mock(async () => ({ count: 1 })),
  },
  backofficeRadarEngagementWeight: {
    findMany: mock(async () => []),
  },
  backofficeRadarEngagementConfig: {
    findFirst: mock(async () => null),
  },
  backofficeFormEngagementScoreRule: {
    findMany: mock(async () => []),
  },
}

const transientPrismaErrors = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"])

/** Test-local retry bound to prismaMock — never touches the real DB client. */
async function withPrismaRetryMock<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; label?: string; delayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 1
  const delayMs = options?.delayMs ?? 0
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : (error as { code?: string } | null)?.code

      const isTransient = !!code && transientPrismaErrors.has(code)
      const hasRetriesLeft = attempt < retries

      if (!isTransient || !hasRetriesLeft) {
        throw error
      }

      const label = options?.label ? ` ${options.label}` : ""
      console.warn(
        `[prisma] Transient error${label} (${code}). Retrying (${attempt + 1}/${retries})...`
      )
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      await prismaMock.$connect()
    }
  }

  throw lastError
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  withPrismaRetry: withPrismaRetryMock,
}))

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

function transientError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("transient prisma error", {
    code,
    clientVersion: "test",
  })
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  })
}

function foreignKeyError() {
  return new Prisma.PrismaClientKnownRequestError("foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
  })
}

describe("RadarRepository.appendEventIfNew (E5.1)", () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let consoleWarnSpy: ReturnType<typeof spyOn>
  let updateEngagementScoreSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    radarEventFindFirst.mockReset()
    radarEventFindFirst.mockImplementation(async () => null)
    radarEventCreate.mockReset()
    radarEventCreate.mockImplementation(async () => createdEvent)
    prismaMock.$connect.mockClear()

    updateEngagementScoreSpy?.mockRestore()
    updateEngagementScoreSpy = spyOn(
      RadarRepository.prototype,
      "updateEngagementScore"
    ).mockImplementation(async () => ({ score: 0, band: "cold" }))

    consoleErrorSpy?.mockRestore()
    consoleWarnSpy?.mockRestore()
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {})
    consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {})
  })

  it("repete em erro transitório e retorna o registro criado sem log de erro", async () => {
    radarEventCreate.mockImplementation(async () => {
      if (radarEventCreate.mock.calls.length === 1) {
        throw transientError("P2024")
      }
      return createdEvent
    })

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT)

    expect(result).toEqual(createdEvent)
    expect(radarEventCreate).toHaveBeenCalledTimes(2)
    expect(prismaMock.$connect).toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("loga erro e retorna null quando erro transitório esgota todas as tentativas", async () => {
    radarEventCreate.mockImplementation(async () => {
      throw transientError("P2024")
    })

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT)

    expect(result).toBeNull()
    expect(radarEventCreate).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[RadarRepository][appendEventIfNew]")
  })

  it("não faz retry em erro transitório quando sourceId está ausente", async () => {
    radarEventCreate.mockImplementation(async () => {
      throw transientError("P2024")
    })

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT_WITHOUT_SOURCE_ID)

    expect(result).toBeNull()
    expect(radarEventCreate).toHaveBeenCalledTimes(1)
    expect(prismaMock.$connect).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[RadarRepository][appendEventIfNew]")
  })

  it("loga erro imediatamente e retorna null em erro não-transitório, sem retry", async () => {
    radarEventCreate.mockImplementation(async () => {
      throw foreignKeyError()
    })

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT)

    expect(result).toBeNull()
    expect(radarEventCreate).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[RadarRepository][appendEventIfNew]")
  })

  it("retorna null sem log de erro quando duplicata é detectada antes do insert", async () => {
    radarEventFindFirst.mockImplementation(async () => ({ id: "existing-event" }))

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT)

    expect(result).toBeNull()
    expect(radarEventCreate).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("retorna null sem log de erro em violação de unique constraint no insert", async () => {
    radarEventCreate.mockImplementation(async () => {
      throw uniqueConstraintError()
    })

    const repo = new RadarRepository()
    const result = await repo.appendEventIfNew(APPEND_INPUT)

    expect(result).toBeNull()
    expect(radarEventCreate).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

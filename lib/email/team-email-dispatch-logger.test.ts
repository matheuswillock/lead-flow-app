import { describe, expect, it, mock, beforeEach } from "bun:test"

// ---------- mocks (antes de qualquer import do módulo) ----------

const createQueuedLogMock = mock(async () => {})
const createManyQueuedLogsMock = mock(async () => {})
const markManySentMock = mock(async () => {})
const markSentMock = mock(async () => {})
const markFailedMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: {
    createQueuedLog: createQueuedLogMock,
    createManyQueuedLogs: createManyQueuedLogsMock,
    markManySent: markManySentMock,
    markSent: markSentMock,
    markFailed: markFailedMock,
  },
}))

const { TeamEmailDispatchLogger } = await import("./team-email-dispatch-logger")

// ---------- helpers ----------

function makeLogger() {
  return new TeamEmailDispatchLogger()
}

function makeInputs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    teamId: "team-1",
    recipientEmail: `r${i}@test.com`,
    recipientName: `R${i}`,
    subject: "Assunto",
    category: "campaign" as const,
    sourceType: "campaign",
    sourceId: "camp-1",
    campaignId: "camp-1",
    dispatchId: "disp-1",
  }))
}

// ---------- tests ----------

describe("TeamEmailDispatchLogger", () => {
  beforeEach(() => {
    createQueuedLogMock.mockClear()
    createManyQueuedLogsMock.mockClear()
    markManySentMock.mockClear()
    markSentMock.mockClear()
    markFailedMock.mockClear()
  })

  describe("createQueuedTeamEmailLogs", () => {
    it("L1 — retorna array {email, logId}[] com mapeamento correto", async () => {
      const logger = makeLogger()
      const inputs = makeInputs(3)
      const result = await logger.createQueuedTeamEmailLogs(inputs)

      expect(result).toHaveLength(3)
      expect(result[0]?.email).toBe("r0@test.com")
      expect(result[1]?.email).toBe("r1@test.com")
      expect(result[2]?.email).toBe("r2@test.com")
      expect(createManyQueuedLogsMock).toHaveBeenCalledTimes(1)
    })

    it("L2 — UUIDs gerados são únicos para cada entrada", async () => {
      const logger = makeLogger()
      const result = await logger.createQueuedTeamEmailLogs(makeInputs(3))

      const logIds = result.map((r) => r.logId)
      const unique = new Set(logIds)
      expect(unique.size).toBe(3)
      // cada logId deve ser uma string não vazia
      for (const id of logIds) {
        expect(typeof id).toBe("string")
        expect(id.length).toBeGreaterThan(0)
      }
    })

    it("L3 — array vazio retorna [] e ainda chama createManyQueuedLogs", async () => {
      const logger = makeLogger()
      const result = await logger.createQueuedTeamEmailLogs([])

      expect(result).toEqual([])
      expect(createManyQueuedLogsMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("markManyTeamEmailLogsSent", () => {
    it("L4 — delega para emailLogRepository.markManySent com sentAt como Date", async () => {
      const logger = makeLogger()
      const entries = [
        { logId: "log-1", resendEmailId: "re_1" },
        { logId: "log-2", resendEmailId: "re_2" },
      ]
      await logger.markManyTeamEmailLogsSent(entries)

      expect(markManySentMock).toHaveBeenCalledTimes(1)
      const [passedEntries, passedDate] = markManySentMock.mock.calls[0] as unknown as [typeof entries, Date]
      expect(passedEntries).toEqual(entries)
      expect(passedDate).toBeInstanceOf(Date)
    })

    it("L6 — 500 entradas → markManySent chamado exatamente 1× (sem chunking no logger)", async () => {
      const logger = makeLogger()
      const entries = Array.from({ length: 500 }, (_, i) => ({
        logId: `log-${i}`,
        resendEmailId: `re_${i}`,
      }))
      await logger.markManyTeamEmailLogsSent(entries)

      expect(markManySentMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("markTeamEmailLogFailed", () => {
    it("L5 — gera eventId UUID distinto do logId e passa errorMessage", async () => {
      const logger = makeLogger()
      const logId = "log-abc"
      const errorMsg = "Falha no envio via Resend"
      await logger.markTeamEmailLogFailed(logId, errorMsg)

      expect(markFailedMock).toHaveBeenCalledTimes(1)
      const [arg0, arg1, arg2, arg3] = markFailedMock.mock.calls[0] as unknown as [
        string,
        string,
        string,
        Date,
      ]
      expect(arg0).toBe(logId)
      expect(typeof arg1).toBe("string")
      expect(arg1.length).toBeGreaterThan(0)
      expect(arg1).not.toBe(logId)
      expect(arg2).toBe(errorMsg)
      expect(arg3).toBeInstanceOf(Date)
    })
  })
})

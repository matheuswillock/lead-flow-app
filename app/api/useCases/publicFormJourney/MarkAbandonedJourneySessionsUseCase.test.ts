import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  AbandonedJourneyCandidate,
  IPublicFormJourneyRepository,
} from "@/app/api/infra/data/repositories/publicFormJourney/IPublicFormJourneyRepository"
import { MarkAbandonedJourneySessionsUseCase } from "./MarkAbandonedJourneySessionsUseCase"

type ClaimInput = { idleBefore: Date; limit: number }
const claimAbandonedJourneySessions = mock(
  async (_input: ClaimInput): Promise<AbandonedJourneyCandidate[]> => [],
)
const recordJourneyEvent = mock(async () => {
  throw new Error("não deve ser chamado pelo cron")
})
const publishAbandonment = mock(async () => true)

const repository = {
  claimAbandonedJourneySessions,
  recordJourneyEvent,
} as unknown as IPublicFormJourneyRepository

const LAST_ACTIVITY = new Date("2026-08-21T10:00:00.000Z")

const candidate: AbandonedJourneyCandidate = {
  sessionId: "session-row-1",
  formId: "form-1",
  publicId: "public-1",
  publicationId: "publication-1",
  visitorSessionId: "session_abcdefghij",
  lastActivityAt: LAST_ACTIVITY,
  abandonmentCount: 1,
}

describe("MarkAbandonedJourneySessionsUseCase", () => {
  beforeEach(() => {
    claimAbandonedJourneySessions.mockReset()
    publishAbandonment.mockReset()
    claimAbandonedJourneySessions.mockResolvedValue([])
    publishAbandonment.mockResolvedValue(true)
  })

  it("reivindica com a janela de 30 minutos de inatividade", async () => {
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)

    await useCase.execute(50)
    const after = Date.now()

    const call = claimAbandonedJourneySessions.mock.calls[0][0]
    expect(call.limit).toBe(50)
    const idleMs = after - call.idleBefore.getTime()
    expect(idleMs).toBeGreaterThanOrEqual(30 * 60_000)
    expect(idleMs).toBeLessThan(30 * 60_000 + 5_000)
  })

  it("publica form_abandoned com chave causal sessão + lastActivityAt", async () => {
    claimAbandonedJourneySessions.mockResolvedValue([candidate])
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)

    const output = await useCase.execute()

    expect(publishAbandonment).toHaveBeenCalledWith({
      formId: "form-1",
      publicId: "public-1",
      publicationId: "publication-1",
      visitorSessionId: "session_abcdefghij",
      eventKey: "journey:session_abcdefghij:abandoned:2026-08-21T10:00:00.000Z",
      occurredAt: LAST_ACTIVITY,
    })
    expect(output.result).toEqual({ claimed: 1, published: 1, failed: 0 })
  })

  it("29 minutos não entram na janela; 30 entram", async () => {
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)
    await useCase.execute()

    const { idleBefore } = claimAbandonedJourneySessions.mock.calls[0][0]
    const twentyNineMinIdle = new Date(Date.now() - 29 * 60_000)
    const thirtyOneMinIdle = new Date(Date.now() - 31 * 60_000)

    expect(twentyNineMinIdle > idleBefore).toBe(true)
    expect(thirtyOneMinIdle <= idleBefore).toBe(true)
  })

  it("falha de publicação é contabilizada sem derrubar o lote", async () => {
    claimAbandonedJourneySessions.mockResolvedValue([
      candidate,
      { ...candidate, sessionId: "session-row-2", visitorSessionId: "session_klmnopqrst" },
    ])
    publishAbandonment.mockImplementationOnce(async () => {
      throw new Error("fila indisponível")
    })
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ claimed: 2, published: 1, failed: 1 })
  })

  it("erro técnico do claim vira Output inválido retryable", async () => {
    claimAbandonedJourneySessions.mockImplementation(async () => {
      throw new Error("Banco indisponível")
    })
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)

    const output = await useCase.execute()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Banco indisponível")
  })

  it("sem candidatos, não publica nada", async () => {
    const useCase = new MarkAbandonedJourneySessionsUseCase(repository, publishAbandonment)

    const output = await useCase.execute()

    expect(publishAbandonment).not.toHaveBeenCalled()
    expect(output.result).toEqual({ claimed: 0, published: 0, failed: 0 })
  })
})

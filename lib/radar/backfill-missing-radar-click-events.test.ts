import { describe, expect, it, mock } from "bun:test"
import {
  buildAppendEventInput,
  runBackfillMissingRadarClickEvents,
  type BackfillClickCandidate,
} from "./backfill-missing-radar-click-events"

const BASE_CANDIDATE: BackfillClickCandidate = {
  logId: "log-1",
  teamId: "team-1",
  recipientEmail: "contato@empresa.com.br",
  recipientName: "Empresa SA",
  campaignId: "campaign-1",
  occurredAt: new Date("2026-08-10T14:30:00.000Z"),
  metadata: { link: "https://forms.example.com/x" },
}

function makeCandidates(count: number): BackfillClickCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    ...BASE_CANDIDATE,
    logId: `log-${index + 1}`,
    recipientEmail: `contato${index + 1}@empresa.com.br`,
  }))
}

describe("backfill-missing-radar-click-events (E5.2)", () => {
  it("buildAppendEventInput monta evento email.clicked com sourceId=logId", () => {
    const input = buildAppendEventInput(BASE_CANDIDATE, "profile-1")

    expect(input).toEqual({
      profileId: "profile-1",
      teamId: "team-1",
      eventType: "email.clicked",
      sourceType: "email_log",
      sourceId: "log-1",
      occurredAt: BASE_CANDIDATE.occurredAt,
      metadata: {
        link: "https://forms.example.com/x",
        campaignId: "campaign-1",
      },
    })
  })

  it("dry-run reporta casos que seriam criados sem escrever no banco", async () => {
    const appendEventIfNew = mock(async () => ({ id: "event-1" }))
    const hasExistingEvent = mock(async (candidate: BackfillClickCandidate) =>
      candidate.logId === "log-existing"
    )

    const candidates = [
      ...makeCandidates(2),
      { ...BASE_CANDIDATE, logId: "log-existing" },
    ]

    const result = await runBackfillMissingRadarClickEvents({
      apply: false,
      candidates,
      hasExistingEvent,
      resolveProfileId: mock(async () => "profile-1"),
      appendEventIfNew,
    })

    expect(result.mode).toBe("dry-run")
    expect(result.total).toBe(3)
    expect(result.wouldCreate).toBe(2)
    expect(result.skippedExisting).toBe(1)
    expect(result.created).toBe(0)
    expect(appendEventIfNew).not.toHaveBeenCalled()
  })

  it("--apply cria RadarEvents faltantes via appendEventIfNew", async () => {
    const appendEventIfNew = mock(async () => ({ id: "event-created" }))
    const resolveProfileId = mock(async () => "profile-1")

    const result = await runBackfillMissingRadarClickEvents({
      apply: true,
      candidates: makeCandidates(3),
      hasExistingEvent: mock(async () => false),
      resolveProfileId,
      appendEventIfNew,
    })

    expect(result.created).toBe(3)
    expect(result.failed).toBe(0)
    expect(appendEventIfNew).toHaveBeenCalledTimes(3)
    expect(resolveProfileId).toHaveBeenCalledTimes(3)
  })

  it("segunda execução com --apply é idempotente (appendEventIfNew retorna null)", async () => {
    const appendEventIfNew = mock(async () => null)

    const result = await runBackfillMissingRadarClickEvents({
      apply: true,
      candidates: makeCandidates(2),
      hasExistingEvent: mock(async () => false),
      resolveProfileId: mock(async () => "profile-1"),
      appendEventIfNew,
    })

    expect(result.created).toBe(0)
    expect(result.skippedExisting).toBe(2)
    expect(result.failed).toBe(0)
  })

  it("erro parcial não aborta o lote — processa os demais e reporta no resumo", async () => {
    const appendEventIfNew = mock(async (input) => {
      if (input.sourceId === "log-2") {
        throw new Error("constraint violation")
      }
      return { id: "event-created" }
    })

    const result = await runBackfillMissingRadarClickEvents({
      apply: true,
      candidates: makeCandidates(3),
      hasExistingEvent: mock(async () => false),
      resolveProfileId: mock(async () => "profile-1"),
      appendEventIfNew,
    })

    expect(result.created).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors).toEqual([
      { logId: "log-2", error: "constraint violation" },
    ])
  })
})

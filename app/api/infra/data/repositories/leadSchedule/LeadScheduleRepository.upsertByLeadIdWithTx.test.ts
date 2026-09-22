import { describe, expect, mock, test } from "bun:test"
import { LeadScheduleRepository } from "./LeadScheduleRepository"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E2/A-E3 — achado da revisão
 * xhigh de fechamento (R13-16): `upsertByLeadIdWithTx` fazia
 * `inviteDispatchLastError: data.inviteDispatchLastError ?? undefined`.
 * Como `??` trata `null` e `undefined` da mesma forma, um disparo
 * bem-sucedido (que grava `null` para LIMPAR o erro anterior) virava
 * `undefined` — e o Prisma, ao ver `undefined` num campo de `update`,
 * simplesmente não toca nele. Resultado: um erro antigo (de uma tentativa
 * de convite anterior) continuava gravado no banco depois de um
 * reagendamento bem-sucedido.
 *
 * Testa o método REAL (não dublado) com um `tx` fake, exatamente para
 * pegar esse tipo de bug — o snapshot de `LeadScheduleService` dubla
 * `upsertByLeadIdWithTx` inteiro e não veria esta regressão (T-13.19,
 * achado da mesma revisão).
 */
describe("LeadScheduleRepository.upsertByLeadIdWithTx — T-13.5/R13-16", () => {
  test("inviteDispatchLastError: null (sucesso) chega como null no update, não undefined", async () => {
    const upsertMock = mock(async ({ update }: any) => ({ id: "schedule-1", ...update }))
    const fakeTx = { leadsSchedule: { upsert: upsertMock } } as any
    const repo = new LeadScheduleRepository()

    await repo.upsertByLeadIdWithTx(fakeTx, "lead-1", {
      leadId: "lead-1",
      date: new Date("2026-10-01T14:00:00Z"),
      inviteDispatchLastError: null,
    })

    const call = upsertMock.mock.calls[0]?.[0] as any
    expect(call.update.inviteDispatchLastError).toBeNull()
    expect(call.update.inviteDispatchLastError).not.toBeUndefined()
  })

  test("inviteDispatchLastError com mensagem chega intacto", async () => {
    const upsertMock = mock(async ({ update }: any) => ({ id: "schedule-1", ...update }))
    const fakeTx = { leadsSchedule: { upsert: upsertMock } } as any
    const repo = new LeadScheduleRepository()

    await repo.upsertByLeadIdWithTx(fakeTx, "lead-1", {
      leadId: "lead-1",
      date: new Date("2026-10-01T14:00:00Z"),
      inviteDispatchLastError: "Falha ao criar evento no Google Calendar",
    })

    const call = upsertMock.mock.calls[0]?.[0] as any
    expect(call.update.inviteDispatchLastError).toBe("Falha ao criar evento no Google Calendar")
  })

  test("usa o tx recebido, não o prisma global", async () => {
    const upsertMock = mock(async ({ update }: any) => ({ id: "schedule-1", ...update }))
    const fakeTx = { leadsSchedule: { upsert: upsertMock }, __marker: "fake-tx" } as any
    const repo = new LeadScheduleRepository()

    await repo.upsertByLeadIdWithTx(fakeTx, "lead-1", {
      leadId: "lead-1",
      date: new Date("2026-10-01T14:00:00Z"),
    })

    expect(upsertMock).toHaveBeenCalledTimes(1)
  })
})

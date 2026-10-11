import { describe, expect, it, mock } from "bun:test"
import { AsaasDueDateCutoverUseCase } from "./AsaasDueDateCutoverUseCase"

const row = (legacyCustomerId: string) => ({ legacyCustomerId, quoteSnapshot: { status: "aligned" } })

describe("AsaasDueDateCutoverUseCase", () => {
  it("retorna inválido quando uma linha falha, sem interromper as demais", async () => {
    const migrationUseCase = {
      execute: mock(async ({ legacyCustomerId }: { legacyCustomerId: string }) =>
        legacyCustomerId === "cus-fail"
          ? { isValid: false, errorMessages: ["falha"], result: null }
          : { isValid: true, errorMessages: [], result: { status: "done" } }),
    }
    const useCase = new AsaasDueDateCutoverUseCase({
      ledgerRepository: { listDueForCutover: mock(async () => [row("cus-ok"), row("cus-fail")]) } as any,
      migrationUseCase: migrationUseCase as any,
      requestReauthorizationUseCase: { execute: mock(async () => ({ isValid: true, errorMessages: [], result: null })) } as any,
    })

    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(migrationUseCase.execute).toHaveBeenCalledTimes(2)
    expect(result.result).toMatchObject({ processed: 2, succeeded: 1, failed: 1, skipped: 0 })
  })

  it("converte exceção de uma linha em falha isolada e continua o lote", async () => {
    const execute = mock(async ({ legacyCustomerId }: { legacyCustomerId: string }) => {
      if (legacyCustomerId === "cus-throw") throw new Error("timeout")
      return { isValid: true, errorMessages: [], result: { status: "done" } }
    })
    const useCase = new AsaasDueDateCutoverUseCase({
      ledgerRepository: { listDueForCutover: mock(async () => [row("cus-throw"), row("cus-ok")]) } as any,
      migrationUseCase: { execute } as any,
      requestReauthorizationUseCase: { execute: mock(async () => ({ isValid: true, errorMessages: [], result: null })) } as any,
    })

    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(result.result).toMatchObject({ processed: 2, succeeded: 1, failed: 1, skipped: 0 })
  })

  it("contabiliza disputa legítima de lease como skipped", async () => {
    const useCase = new AsaasDueDateCutoverUseCase({
      ledgerRepository: { listDueForCutover: mock(async () => [row("cus-busy")]) } as any,
      migrationUseCase: {
        execute: mock(async () => ({
          isValid: false,
          errorMessages: ["Migração já está sendo processada"],
          result: { reason: "already_processing" },
        })),
      } as any,
      requestReauthorizationUseCase: { execute: mock(async () => ({ isValid: true })) } as any,
    })

    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ processed: 1, succeeded: 0, failed: 0, skipped: 1 })
  })
})

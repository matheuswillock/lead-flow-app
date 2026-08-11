import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  formatTransientTransactionErrorMessage,
  isTransientTransactionError,
  withTransientTransactionRetry,
} from "./retry-transient-transaction"

function p2028(message = "Unable to start a transaction in the given time.") {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2028",
    clientVersion: "test",
  })
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  })
}

describe("isTransientTransactionError", () => {
  it("reconhece P2028 e P2024", () => {
    expect(isTransientTransactionError(p2028())).toBe(true)
    expect(
      isTransientTransactionError(
        new Prisma.PrismaClientKnownRequestError("pool", {
          code: "P2024",
          clientVersion: "test",
        })
      )
    ).toBe(true)
  })

  it("rejeita erros não-transitórios", () => {
    expect(isTransientTransactionError(p2002())).toBe(false)
    expect(isTransientTransactionError(new Error("validation"))).toBe(false)
  })
})

describe("withTransientTransactionRetry", () => {
  it("reexecuta após P2028 e retorna sucesso na 2ª tentativa", async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    const operation = mock(async () => {
      if (operation.mock.calls.length === 1) throw p2028()
      return "ok"
    })

    const result = await withTransientTransactionRetry(operation, {
      sleep,
      backoffMs: [250, 500],
    })

    expect(result).toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
    expect(delays).toEqual([250])
  })

  it("esgota tentativas em P2028 e propaga o erro", async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    const operation = mock(async () => {
      throw p2028()
    })

    await expect(
      withTransientTransactionRetry(operation, {
        maxAttempts: 3,
        sleep,
        backoffMs: [10, 20],
      })
    ).rejects.toMatchObject({ code: "P2028" })

    expect(operation).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([10, 20])
  })

  it("não faz retry em erro de negócio (P2002)", async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    const operation = mock(async () => {
      throw p2002()
    })

    await expect(
      withTransientTransactionRetry(operation, { sleep })
    ).rejects.toMatchObject({ code: "P2002" })

    expect(operation).toHaveBeenCalledTimes(1)
    expect(delays).toEqual([])
  })

  it("não chama sleep quando a operação passa de primeira", async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    const result = await withTransientTransactionRetry(async () => "ok", { sleep })
    expect(result).toBe("ok")
    expect(delays).toEqual([])
  })
})

describe("formatTransientTransactionErrorMessage", () => {
  it("inclui code e message do Prisma", () => {
    const message = formatTransientTransactionErrorMessage(p2028())
    expect(message).toContain("P2028")
    expect(message).toContain("Unable to start a transaction")
    expect(message).toContain("Erro ao processar jobs de importação")
  })
})

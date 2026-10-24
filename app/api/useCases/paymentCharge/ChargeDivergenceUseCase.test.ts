import { describe, expect, it } from "bun:test"
import { ChargeDivergenceUseCase } from "./ChargeDivergenceUseCase"

describe("ChargeDivergenceUseCase", () => {
  it("devolve o resultado do serviço com janela e limite padrão", async () => {
    const calls: unknown[] = []
    const useCase = new ChargeDivergenceUseCase({
      run: async (input) => {
        calls.push(input)
        return { checked: 3, divergences: [], truncated: false }
      },
    })

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(calls).toEqual([{ windowHours: 48, limit: 500 }])
  })

  it("falha do serviço vira Output inválido sem vazar a causa", async () => {
    const useCase = new ChargeDivergenceUseCase({ run: async () => { throw new Error("segredo interno") } })

    const output = await useCase.execute()

    expect(output.isValid).toBe(false)
    expect(JSON.stringify(output)).not.toContain("segredo interno")
  })
})

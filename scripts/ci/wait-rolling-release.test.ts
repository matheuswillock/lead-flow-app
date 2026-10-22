import { describe, expect, it } from "bun:test"
import {
  evaluateRollingRelease,
  parseRollingReleaseOutput,
  redactSecret,
  waitForRollingRelease,
  type RollingRelease,
} from "./wait-rolling-release"

const NEW = "corretor-studio-new.vercel.app"
const OLD = "corretor-studio-old.vercel.app"

const release = (overrides: Partial<RollingRelease>): RollingRelease => ({
  state: "ACTIVE",
  currentDeployment: { url: OLD },
  canaryDeployment: { url: NEW },
  currentCanaryPercentage: 10,
  ...overrides,
})

describe("parseRollingReleaseOutput", () => {
  it("extrai o JSON ignorando o prefixo da CLI", () => {
    const parsed = parseRollingReleaseOutput(`Vercel CLI 59\nRetrieving project…\n> {"state":"COMPLETE"}\n`)
    expect(parsed.state).toBe("COMPLETE")
  })

  it("rejeita saída sem JSON", () => {
    expect(() => parseRollingReleaseOutput("Error: Not authorized (403)")).toThrow()
  })
})

describe("evaluateRollingRelease", () => {
  it("canary a 10% segue pendente", () => {
    expect(evaluateRollingRelease(release({}), `https://${NEW}`).kind).toBe("pending")
  })

  it("COMPLETE no deployment novo conclui", () => {
    expect(evaluateRollingRelease(release({ state: "COMPLETE", currentCanaryPercentage: 100 }), `https://${NEW}`).kind).toBe("complete")
  })

  it("ABORTED no deployment novo reprova", () => {
    expect(evaluateRollingRelease(release({ state: "ABORTED" }), `https://${NEW}`).kind).toBe("failed")
  })

  it("COMPLETE de outro deployment não conta para o novo", () => {
    const other = release({ state: "COMPLETE", canaryDeployment: { url: "x.vercel.app" }, currentDeployment: { url: OLD } })
    expect(evaluateRollingRelease(other, `https://${NEW}`).kind).toBe("pending")
  })
})

describe("waitForRollingRelease", () => {
  const baseOptions = { deployUrl: `https://${NEW}`, timeoutMs: 1000, intervalMs: 100 }
  const makeDeps = (reads: Array<RollingRelease | Error>) => {
    let clock = 0
    let index = 0
    return {
      fetchRelease: async () => {
        const next = reads[Math.min(index++, reads.length - 1)]
        if (next instanceof Error) throw next
        return next
      },
      sleep: async (ms: number) => {
        clock += ms
      },
      now: () => clock,
      log: () => {},
    }
  }

  it("espera o canary avançar e conclui no COMPLETE", async () => {
    const deps = makeDeps([release({}), release({ state: "COMPLETE", currentCanaryPercentage: 100 })])
    expect((await waitForRollingRelease(baseOptions, deps)).kind).toBe("complete")
  })

  it("tolera falha transitória de leitura", async () => {
    const deps = makeDeps([new Error("403"), release({ state: "COMPLETE" })])
    expect((await waitForRollingRelease(baseOptions, deps)).kind).toBe("complete")
  })

  it("reprova ao estourar o prazo", async () => {
    const result = await waitForRollingRelease(baseOptions, makeDeps([release({})]))
    expect(result.kind).toBe("failed")
    expect(result.detail).toContain("tempo esgotado")
  })

  it("reprova de imediato quando o release é abortado", async () => {
    const result = await waitForRollingRelease(baseOptions, makeDeps([release({ state: "ABORTED" })]))
    expect(result.kind).toBe("failed")
  })
})

describe("redactSecret", () => {
  it("troca toda ocorrência do segredo", () => {
    expect(redactSecret("a tok b tok", "tok")).toBe("a *** b ***")
  })

  it("não altera o texto quando o segredo é vazio", () => {
    expect(redactSecret("texto", "")).toBe("texto")
  })
})

// Estados oficiais da API (GET /v1/projects/{id}/rolling-release): ACTIVE, COMPLETE, ABORTED.
describe("evaluateRollingRelease — estados reais da Vercel (PAY-CI-T002)", () => {
  it("ACTIVE é pendente, com percentual na mensagem", () => {
    const verdict = evaluateRollingRelease(release({ state: "ACTIVE", currentCanaryPercentage: 50 }), `https://${NEW}`)
    expect(verdict.kind).toBe("pending")
    expect(verdict.detail).toContain("50%")
  })

  it("estado desconhecido nunca conclui: segue pendente e nomeia o estado inesperado", () => {
    const verdict = evaluateRollingRelease(release({ state: "ROLLING_BACK" }), `https://${NEW}`)
    expect(verdict.kind).toBe("pending")
    expect(verdict.detail).toContain("desconhecido")
    expect(verdict.detail).toContain("ROLLING_BACK")
  })

  it("canary com deployment em ERROR ou CANCELED reprova sem esperar o prazo", () => {
    for (const readyState of ["ERROR", "CANCELED"]) {
      const verdict = evaluateRollingRelease(
        release({ canaryDeployment: { url: NEW, readyState } }),
        `https://${NEW}`,
      )
      expect(verdict.kind).toBe("failed")
    }
  })

  it("aceita o estado em minúsculas", () => {
    expect(evaluateRollingRelease(release({ state: "complete" }), `https://${NEW}`).kind).toBe("complete")
  })

  it("COMPLETE sem rolling release apontando para o deploy segue pendente (release anterior)", () => {
    const old = release({ state: "COMPLETE", canaryDeployment: null, currentDeployment: { url: OLD } })
    expect(evaluateRollingRelease(old, `https://${NEW}`).kind).toBe("pending")
  })
})

describe("waitForRollingRelease — prazo com estado desconhecido", () => {
  it("o erro final explica o estado desconhecido e os estados esperados", async () => {
    let clock = 0
    const result = await waitForRollingRelease(
      { deployUrl: `https://${NEW}`, timeoutMs: 300, intervalMs: 100 },
      {
        fetchRelease: async () => release({ state: "PAUSED" }),
        sleep: async (ms) => {
          clock += ms
        },
        now: () => clock,
        log: () => {},
      },
    )
    expect(result.kind).toBe("failed")
    expect(result.detail).toContain("tempo esgotado")
    expect(result.detail).toContain("PAUSED")
    expect(result.detail).toContain("ACTIVE, COMPLETE, ABORTED")
  })
})

import { describe, expect, it } from "bun:test"
import {
  buildRollingReleaseUrl,
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
  it("extrai o JSON ignorando texto antes e depois", () => {
    const parsed = parseRollingReleaseOutput(`Vercel CLI 59\nRetrieving project…\n> {"state":"COMPLETE"}\n`)
    expect(parsed.state).toBe("COMPLETE")
  })

  it("desembrulha a resposta real da API REST ({ rollingRelease: {...} })", () => {
    const parsed = parseRollingReleaseOutput(
      JSON.stringify({
        rollingRelease: {
          state: "COMPLETE",
          currentDeployment: { url: OLD },
          canaryDeployment: { url: NEW },
          currentCanaryPercentage: 100,
        },
      }),
    )

    expect(evaluateRollingRelease(parsed, `https://${NEW}`).kind).toBe("complete")
  })

  it("rollingRelease nulo (projeto sem rollout) segue pendente em vez de quebrar", () => {
    const parsed = parseRollingReleaseOutput('{"rollingRelease":null}')

    expect(evaluateRollingRelease(parsed, `https://${NEW}`).kind).toBe("pending")
  })

  it("rejeita saída sem JSON", () => {
    expect(() => parseRollingReleaseOutput("Error: Not authorized (403)")).toThrow()
  })
})

describe("buildRollingReleaseUrl", () => {
  it("monta o endpoint do projeto com o time", () => {
    expect(buildRollingReleaseUrl({ projectId: "prj_123", teamId: "team_9" })).toBe(
      "https://api.vercel.com/v1/projects/prj_123/rolling-release?teamId=team_9",
    )
  })

  it("sem time (conta pessoal) não envia teamId", () => {
    expect(buildRollingReleaseUrl({ projectId: "prj_123" })).toBe("https://api.vercel.com/v1/projects/prj_123/rolling-release")
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

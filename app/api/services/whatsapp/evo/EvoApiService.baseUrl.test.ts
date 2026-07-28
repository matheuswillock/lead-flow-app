import { describe, expect, it } from "bun:test"
import { resolveEvoApiBaseUrl } from "./EvoApiService"

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as unknown as NodeJS.ProcessEnv
}

describe("resolveEvoApiBaseUrl", () => {
  it("exige EVO_API_BASE_URL", () => {
    expect(() => resolveEvoApiBaseUrl(env({}))).toThrow(
      /EVO_API_BASE_URL is not set/
    )
  })

  it("rejeita URL inválida", () => {
    expect(() =>
      resolveEvoApiBaseUrl(env({ EVO_API_BASE_URL: "not-a-url" }))
    ).toThrow(/EVO_API_BASE_URL is invalid/)
  })

  it("aceita HTTPS e remove barra final", () => {
    expect(
      resolveEvoApiBaseUrl(env({
        EVO_API_BASE_URL: "https://evo.example.com/api/",
        NODE_ENV: "production",
      }))
    ).toBe("https://evo.example.com/api")
  })

  it("rejeita HTTP em produção", () => {
    expect(() =>
      resolveEvoApiBaseUrl(env({
        EVO_API_BASE_URL: "http://evo.example.com",
        NODE_ENV: "production",
      }))
    ).toThrow(/must use HTTPS in production/)
  })

  it("permite HTTP fora de produção (dev/local)", () => {
    expect(
      resolveEvoApiBaseUrl(env({
        EVO_API_BASE_URL: "http://localhost:8080",
        NODE_ENV: "development",
      }))
    ).toBe("http://localhost:8080")
  })
})

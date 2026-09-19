import { describe, expect, it } from "bun:test"
import type {
  IVercelDomainsGateway,
  VercelDomainConfig,
  VercelDomainsGatewayResult,
  VercelProjectDomain,
} from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { checkFormDomainVerification } from "./form-domain-verification"

function makeGateway(overrides: {
  projectDomain: VercelDomainsGatewayResult<VercelProjectDomain>
  domainConfig?: VercelDomainsGatewayResult<VercelDomainConfig>
}): IVercelDomainsGateway {
  return {
    isConfigured: () => true,
    async getProjectDomain() {
      return overrides.projectDomain
    },
    async getDomainConfig() {
      return overrides.domainConfig ?? { ok: true, data: { misconfigured: false } }
    },
    async addProjectDomain() {
      throw new Error("não usado")
    },
    async removeProjectDomain() {
      throw new Error("não usado")
    },
  }
}

describe("checkFormDomainVerification", () => {
  it("verified: propriedade confirmada e DNS ok", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({ projectDomain: { ok: true, data: { name: "x", verified: true } } }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("verified")
  })

  it("failed: domínio sumiu da infraestrutura (404) — veredito real, não transporte", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({ projectDomain: { ok: false, status: 404, errorMessage: "not found" } }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("failed")
  })

  it("pending: Vercel respondeu e disse que a propriedade ainda não foi confirmada", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({ projectDomain: { ok: true, data: { name: "x", verified: false } } }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("pending")
  })

  it("pending: Vercel respondeu e disse que o DNS está misconfigured", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({
        projectDomain: { ok: true, data: { name: "x", verified: true } },
        domainConfig: { ok: true, data: { misconfigured: true } },
      }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("pending")
  })

  /**
   * Regressão do achado P1 do codex (PR #1204): falha de TRANSPORTE
   * (429/500/timeout) consultando `getProjectDomain` não é um veredito sobre
   * o domínio — precisa ser distinguível de `pending` para que quem chama
   * NÃO rebaixe um domínio `verified` por instabilidade passageira da API.
   */
  it("inconclusive: falha transitória ao consultar getProjectDomain (ex.: 429/500/timeout)", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({ projectDomain: { ok: false, status: 500, errorMessage: "internal error" } }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("inconclusive")
  })

  it("inconclusive: falha transitória ao consultar getDomainConfig", async () => {
    const outcome = await checkFormDomainVerification(
      makeGateway({
        projectDomain: { ok: true, data: { name: "x", verified: true } },
        domainConfig: { ok: false, status: 429, errorMessage: "rate limited" },
      }),
      "forms.imobiliariax.com.br",
    )
    expect(outcome.status).toBe("inconclusive")
  })
})

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type {
  ITeamFormDomainRepository,
  TeamFormDomainRecord,
} from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import type { IPublicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { PublicFormBaseUrlResolverService } from "./PublicFormBaseUrlResolverService"

const TEAM_ID = "team-1"

function makeDomain(overrides: Partial<TeamFormDomainRecord> = {}): TeamFormDomainRecord {
  return {
    id: "domain-1",
    teamId: TEAM_ID,
    hostname: "forms.time.com.br",
    status: "verified",
    vercelDomainId: "forms.time.com.br",
    verifiedAt: new Date(),
    lastCheckedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** Repositório mutável: o teste troca o retorno entre duas resoluções. */
function makeRepository(initial: TeamFormDomainRecord | null) {
  let current = initial
  let callCount = 0
  const repository = {
    async findByTeamId() {
      callCount += 1
      return current
    },
  } as unknown as ITeamFormDomainRepository
  return {
    repository,
    setDomain(next: TeamFormDomainRecord | null) {
      current = next
    },
    callCount: () => callCount,
  }
}

const formsRepositoryStub = {
  async findPublicIdsOwnedByTeam() {
    return []
  },
} as unknown as IPublicFormsRepository

describe("PublicFormBaseUrlResolverService", () => {
  let previousFallback: string | undefined
  let previousAppUrl: string | undefined

  beforeEach(() => {
    previousFallback = process.env.PUBLIC_FORMS_FALLBACK_HOST
    previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.PUBLIC_FORMS_FALLBACK_HOST = "forms-neutro.com.br"
    process.env.NEXT_PUBLIC_APP_URL = "https://app.corretorstudio.com.br"
  })

  afterEach(() => {
    if (previousFallback === undefined) delete process.env.PUBLIC_FORMS_FALLBACK_HOST
    else process.env.PUBLIC_FORMS_FALLBACK_HOST = previousFallback
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
  })

  it("usa o domínio verificado do time", async () => {
    const { repository } = makeRepository(makeDomain())
    const service = new PublicFormBaseUrlResolverService(repository, formsRepositoryStub)

    expect(await service.resolvePublicFormBaseUrl(TEAM_ID)).toEqual({
      baseUrl: "https://forms.time.com.br",
      source: "team-domain",
    })
  })

  it("cai no fallback de env quando o domínio não está verificado", async () => {
    const { repository } = makeRepository(makeDomain({ status: "pending" }))
    const service = new PublicFormBaseUrlResolverService(repository, formsRepositoryStub)

    expect(await service.resolvePublicFormBaseUrl(TEAM_ID)).toEqual({
      baseUrl: "https://forms-neutro.com.br",
      source: "fallback-env",
    })
  })

  /**
   * Regressão do achado P2 do codex: existia um cache module-level de 30 s que
   * nenhuma mutação invalidava. Um disparo logo após `disconnect` reescrevia
   * links para um domínio que já não existia mais.
   */
  it("reflete a remoção do domínio na resolução imediatamente seguinte", async () => {
    const control = makeRepository(makeDomain())
    const service = new PublicFormBaseUrlResolverService(control.repository, formsRepositoryStub)

    const before = await service.resolvePublicFormBaseUrl(TEAM_ID)
    control.setDomain(null)
    const after = await service.resolvePublicFormBaseUrl(TEAM_ID)

    expect(before.source).toBe("team-domain")
    expect(after).toEqual({ baseUrl: "https://forms-neutro.com.br", source: "fallback-env" })
    expect(control.callCount()).toBe(2)
  })

  /** Mesmo caso no sentido oposto: verificação recém-concluída. */
  it("reflete a verificação recém-concluída na resolução imediatamente seguinte", async () => {
    const control = makeRepository(makeDomain({ status: "pending" }))
    const service = new PublicFormBaseUrlResolverService(control.repository, formsRepositoryStub)

    const before = await service.resolvePublicFormBaseUrl(TEAM_ID)
    control.setDomain(makeDomain({ status: "verified" }))
    const after = await service.resolvePublicFormBaseUrl(TEAM_ID)

    expect(before.source).toBe("fallback-env")
    expect(after).toEqual({ baseUrl: "https://forms.time.com.br", source: "team-domain" })
  })
})

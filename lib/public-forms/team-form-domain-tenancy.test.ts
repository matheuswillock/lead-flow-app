import { describe, expect, mock, test, beforeEach } from "bun:test"

/**
 * Guarda de tenancy do serving multi-tenant — a que impede o time A de ler
 * dados do time B chamando a API pública no próprio domínio de formulários.
 *
 * O `prefill` devolve PII do lead, então falha aqui é vazamento entre
 * clientes, não só phishing. A guarda vivia só na página
 * `app/forms/[publicId]/page.tsx`; estas asserções travam a versão
 * compartilhada que as rotas passaram a usar.
 */

const findUnique = mock(async (_args: unknown) => null as { teamId: string } | null)
const findUniqueDomain = mock(
  async (_args: unknown) => null as { teamId: string; hostname: string; status: string } | null,
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicForm: { findUnique },
    teamFormDomain: { findUnique: findUniqueDomain },
  },
}))

// `use cache` / cacheTag exigem runtime do Next; aqui só interessa a decisão.
mock.module("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}))

mock.module("@/lib/cache/cacheTags", () => ({
  cacheTags: { teamFormDomain: (hostname: string) => `team-form-domain:${hostname}` },
}))

// `server-only` estoura fora do runtime do Next; o módulo sob teste é server.
mock.module("server-only", () => ({}))

const { isPublicFormAllowedOnRequestHost } = await import(
  "@/lib/public-forms/team-form-domain-tenancy"
)

const TEAM_A = "team-a-uuid"
const TEAM_B = "team-b-uuid"
const CUSTOM_HOST = "forms.imobiliariax.com.br"

beforeEach(() => {
  findUnique.mockReset()
  findUniqueDomain.mockReset()
  process.env.NEXT_PUBLIC_APP_URL = "https://www.corretorstudio.com"
  delete process.env.PUBLIC_FORMS_FALLBACK_HOST
})

describe("isPublicFormAllowedOnRequestHost", () => {
  test("host da plataforma serve formulário de qualquer time", async () => {
    const allowed = await isPublicFormAllowedOnRequestHost("www.corretorstudio.com", "qualquer-id")

    expect(allowed).toBe(true)
    // Host da plataforma não paga round-trip de banco.
    expect(findUniqueDomain).not.toHaveBeenCalled()
  })

  test("host custom serve o formulário do próprio time", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "verified",
    })
    findUnique.mockResolvedValue({ teamId: TEAM_A })

    expect(await isPublicFormAllowedOnRequestHost(CUSTOM_HOST, "form-do-time-a")).toBe(true)
  })

  test("host custom NÃO serve formulário de outro time", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "verified",
    })
    findUnique.mockResolvedValue({ teamId: TEAM_B })

    expect(await isPublicFormAllowedOnRequestHost(CUSTOM_HOST, "form-do-time-b")).toBe(false)
  })

  test("domínio ainda não verificado não serve nada", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "pending",
    })
    findUnique.mockResolvedValue({ teamId: TEAM_A })

    expect(await isPublicFormAllowedOnRequestHost(CUSTOM_HOST, "form-do-time-a")).toBe(false)
  })

  test("hostname desconhecido não serve nada", async () => {
    findUniqueDomain.mockResolvedValue(null)

    expect(await isPublicFormAllowedOnRequestHost("host-que-ninguem-conectou.com", "x")).toBe(false)
  })

  test("formulário inexistente não serve nada", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "verified",
    })
    findUnique.mockResolvedValue(null)

    expect(await isPublicFormAllowedOnRequestHost(CUSTOM_HOST, "nao-existe")).toBe(false)
  })

  // Header `host` ausente não é host custom — cai no caminho da plataforma,
  // que já é o comportamento de sempre (sem restrição de tenancy).
  test("host ausente no header não é tratado como host custom", async () => {
    expect(await isPublicFormAllowedOnRequestHost(null, "x")).toBe(true)
    expect(findUniqueDomain).not.toHaveBeenCalled()
  })
})

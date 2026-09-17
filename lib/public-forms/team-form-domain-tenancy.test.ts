import { describe, expect, mock, test, beforeEach } from "bun:test"

/**
 * Decisão de tenancy do serving multi-tenant — a que impede o time A de ler
 * dados do time B chamando a API pública no próprio domínio de formulários.
 *
 * `e2e/specs/public/forms-host-routing-api.spec.ts` já mede isso ponta a ponta
 * com Host forjado; estas asserções cobrem a mesma regra na suíte unitária,
 * que roda em toda CI e não depende de banco nem de servidor de pé.
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

const { isPublicFormServableOnHost } = await import(
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

describe("isPublicFormServableOnHost", () => {
  test("host da plataforma serve formulário de qualquer time", async () => {
    const allowed = await isPublicFormServableOnHost({
      publicId: "qualquer-id",
      hostHeader: "www.corretorstudio.com",
    })

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

    expect(
      await isPublicFormServableOnHost({ publicId: "form-do-time-a", hostHeader: CUSTOM_HOST }),
    ).toBe(true)
  })

  // O caso que motivou a guarda: `prefill` devolve PII, então servir formulário
  // de outro time no domínio custom é vazamento entre clientes.
  test("host custom NÃO serve formulário de outro time", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "verified",
    })
    findUnique.mockResolvedValue({ teamId: TEAM_B })

    expect(
      await isPublicFormServableOnHost({ publicId: "form-do-time-b", hostHeader: CUSTOM_HOST }),
    ).toBe(false)
  })

  test("domínio ainda não verificado não serve nada", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "pending",
    })
    findUnique.mockResolvedValue({ teamId: TEAM_A })

    expect(
      await isPublicFormServableOnHost({ publicId: "form-do-time-a", hostHeader: CUSTOM_HOST }),
    ).toBe(false)
  })

  test("hostname desconhecido não serve nada", async () => {
    findUniqueDomain.mockResolvedValue(null)

    expect(
      await isPublicFormServableOnHost({
        publicId: "x",
        hostHeader: "host-que-ninguem-conectou.com",
      }),
    ).toBe(false)
  })

  test("formulário inexistente não serve nada", async () => {
    findUniqueDomain.mockResolvedValue({
      teamId: TEAM_A,
      hostname: CUSTOM_HOST,
      status: "verified",
    })
    findUnique.mockResolvedValue(null)

    expect(
      await isPublicFormServableOnHost({ publicId: "nao-existe", hostHeader: CUSTOM_HOST }),
    ).toBe(false)
  })

  // Header `host` ausente não é host custom — cai no caminho da plataforma,
  // que é o comportamento de sempre (sem restrição de tenancy).
  test("host ausente no header não é tratado como host custom", async () => {
    expect(await isPublicFormServableOnHost({ publicId: "x", hostHeader: null })).toBe(true)
    expect(findUniqueDomain).not.toHaveBeenCalled()
  })
})

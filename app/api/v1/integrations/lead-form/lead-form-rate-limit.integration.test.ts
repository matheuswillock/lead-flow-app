import { afterAll, describe, expect, it, mock } from "bun:test"
import { randomUUID } from "crypto"
import { Output } from "@/lib/output"

/**
 * SPEC 40 A-E1 (V3, DA1), T-40.1: 11º envio do mesmo IP para o mesmo time em
 * 10 minutos → 429. Integração contra o Postgres local (:55322), não mocks —
 * `consumePublicFormRateLimit` faz `INSERT ... ON CONFLICT` atômico
 * (`lib/public-forms/rate-limit.ts`), e só o banco real prova que o contador
 * soma corretamente entre chamadas concorrentes/sequenciais, algo que um
 * Prisma mockado não reproduz.
 *
 * Rodar:
 *   PUBLIC_LEAD_FORM_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test app/api/v1/integrations/lead-form/lead-form-rate-limit.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.PUBLIC_LEAD_FORM_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:public-lead-form:local` ou passe a URL de 127.0.0.1:55322."
    )
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let consumePublicFormRateLimit: typeof import("@/lib/public-forms/rate-limit").consumePublicFormRateLimit
let POST: typeof import("./route").POST

const createPublicLeadMock = mock(async () => new Output(true, ["Lead cadastrado com sucesso!"], [], { id: "lead-1" }))

if (RUN_INTEGRATION) {
  assertLocalDatabase()
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ consumePublicFormRateLimit } = await import("@/lib/public-forms/rate-limit"))

  // R40-4: T-40.1 original só chamava a lib direto — passaria mesmo se a
  // rota nunca checasse o limitador. Este segundo bloco chama o `POST` de
  // verdade contra o Postgres real; só o use case (criação de lead em si,
  // já coberta em `PublicLeadFormUseCase.test.ts`) é mockado, para não
  // depender de um time/perfil seedado.
  mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
    publicLeadFormUseCase: { createPublicLead: createPublicLeadMock },
    PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE: "Lead cadastrado com sucesso!",
  }))
  mock.module("@/lib/cache/invalidation", () => ({ invalidateLeadCache: mock(() => {}) }))
  ;({ POST } = await import("./route"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("Lead form — rate limit por IP+time contra Postgres real (T-40.1)", () => {
  afterAll(async () => {
    if (!RUN_INTEGRATION) return
    // R40-16: prefixo largo o suficiente para cobrir `test:lead-form:%` e
    // `test:lead-form-team:%` (a chave do teto por time não batia no LIKE
    // original e ficava órfã no banco).
    await prisma.$executeRawUnsafe(
      `delete from "corretor_studio_public_form_rate_limits" where "key" like 'test:lead-form%'`
    )
  })

  // Timeout maior: 11 chamadas sequenciais reais ao Postgres (de propósito,
  // não `Promise.all`) passam dos 5s padrão do bun:test sob carga do
  // Postgres local compartilhado por outras SPECs desta rodada.
  it("10 envios do mesmo IP para o mesmo time passam; o 11º recebe 429 (allowed:false) com Retry-After > 0", async () => {
    const teamId = randomUUID()
    const fingerprint = "203.0.113.10"
    const key = `test:lead-form:${teamId}:${fingerprint}`
    const options = { limit: 10, windowMs: 10 * 60_000 }

    const results: boolean[] = []
    for (let attempt = 0; attempt < 11; attempt += 1) {
      // Sequencial, não `Promise.all`: reproduz a ordem real de 11
      // submissões do mesmo visitante, uma após a outra.
      // eslint-disable-next-line no-await-in-loop
      const result = await consumePublicFormRateLimit(key, options)
      results.push(result.allowed)
      if (attempt === 10) {
        expect(result.allowed).toBe(false)
        expect(result.retryAfterSeconds).toBeGreaterThan(0)
      }
    }

    expect(results.slice(0, 10).every(Boolean)).toBe(true)
    expect(results[10]).toBe(false)
  }, 30_000)

  it("times diferentes não compartilham cota (chave inclui o teamId)", async () => {
    const fingerprint = "203.0.113.20"
    const teamA = randomUUID()
    const teamB = randomUUID()
    const options = { limit: 1, windowMs: 10 * 60_000 }

    const firstTeamA = await consumePublicFormRateLimit(`test:lead-form:${teamA}:${fingerprint}`, options)
    const secondTeamA = await consumePublicFormRateLimit(`test:lead-form:${teamA}:${fingerprint}`, options)
    const firstTeamB = await consumePublicFormRateLimit(`test:lead-form:${teamB}:${fingerprint}`, options)

    expect(firstTeamA.allowed).toBe(true)
    expect(secondTeamA.allowed).toBe(false)
    expect(firstTeamB.allowed).toBe(true)
  })

  it("teto por time (200/hora) soma entre fingerprints diferentes do mesmo time", async () => {
    const teamId = randomUUID()
    const options = { limit: 2, windowMs: 60 * 60_000 }
    const teamKey = `test:lead-form-team:${teamId}`

    const first = await consumePublicFormRateLimit(teamKey, options)
    const second = await consumePublicFormRateLimit(teamKey, options)
    const third = await consumePublicFormRateLimit(teamKey, options)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
  })
})

describeIntegration("Lead form route — 11º POST real recebe 429 (R40-4)", () => {
  afterAll(async () => {
    if (!RUN_INTEGRATION) return
    await prisma.$executeRawUnsafe(
      `delete from "corretor_studio_public_form_rate_limits" where "key" like 'test:lead-form-route:%'`
    )
  })

  // Mesmo motivo do timeout maior acima: 11 POSTs sequenciais reais.
  it("10 POSTs do mesmo IP para o mesmo time retornam 201; o 11º retorna 429 com Retry-After", async () => {
    createPublicLeadMock.mockClear()
    const teamId = randomUUID()
    const fingerprint = `test:lead-form-route:${randomUUID()}`
    const body = {
      teamId,
      name: "Cliente Teste",
      phone: "11999998888",
      assignedTo: randomUUID(),
    }

    const makeRequest = () =>
      new Request("http://localhost/api/v1/integrations/lead-form", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "x-forwarded-for": fingerprint },
      })

    const statuses: number[] = []
    for (let attempt = 0; attempt < 11; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await POST(makeRequest() as never)
      statuses.push(response.status)
    }

    expect(statuses.slice(0, 10).every((status) => status === 201)).toBe(true)
    expect(statuses[10]).toBe(429)
    expect(createPublicLeadMock).toHaveBeenCalledTimes(10)
  }, 30_000)
})

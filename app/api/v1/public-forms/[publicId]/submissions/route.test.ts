import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"

const acceptMock = mock(async () => new Output(true, [], [], null))
const queueForBackgroundProcessingMock = mock(async () => {})
const consumePublicFormRateLimitMock = mock(async () => ({ allowed: true, retryAfterSeconds: 0 }))

let lastAfterPromise: Promise<unknown> = Promise.resolve()

mock.module("next/server", () => {
  class NextResponse {
    status: number
    body: unknown
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init)
    }
  }
  return {
    NextResponse,
    after: (fn: () => unknown) => {
      lastAfterPromise = Promise.resolve().then(fn)
    },
  }
})

mock.module("@/app/api/useCases/publicForms/PublicFormSubmissionUseCase", () => ({
  publicFormSubmissionUseCase: {
    accept: acceptMock,
    queueForBackgroundProcessing: queueForBackgroundProcessingMock,
  },
}))

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: consumePublicFormRateLimitMock,
  publicFormRequestFingerprint: () => "fp-1",
}))

const { POST } = await import("./route")

const BACKGROUND_JOB = {
  submissionId: "sub-1",
  publicationId: "pub-1",
  snapshot: { formId: "form-1", questions: [] },
  visibleAnswers: [],
  visibleIds: [],
  score: 90,
  scoreBandLabel: "Quente",
  origin: {},
  requestKey: "req-abc",
  visitorSessionId: "session-1",
  thankYouPageId: null,
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/public-forms/pub-1/submissions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  })
}

const VALID_BODY = { requestKey: "req-abc-000001", answers: [], origin: {} }

function resetMocks() {
  acceptMock.mockReset()
  acceptMock.mockResolvedValue(
    new Output(true, ["Respostas recebidas"], [], {
      submissionId: "sub-1",
      alreadyProcessed: false,
      background: BACKGROUND_JOB,
    }),
  )
  queueForBackgroundProcessingMock.mockReset()
  queueForBackgroundProcessingMock.mockResolvedValue(undefined)
  consumePublicFormRateLimitMock.mockReset()
  consumePublicFormRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
}

/**
 * SPEC 40 — E6, todo 13 (parte não bloqueada por D7). H18: `/submissions` era a
 * única das três rotas públicas sem guard de origem — e é justamente a que cria
 * lead. `/progress` e `/events` já tinham.
 */
describe("Public form submissions route — guard de origem (T-F6.2)", () => {
  // O guard compara com `NEXT_PUBLIC_APP_URL`; sem ela ele falha aberto (por
  // desenho). Fixar aqui é o que faz o teste medir o guard, não o ambiente.
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
  })

  afterAll(() => {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
  })

  it("origem externa → 400, sem chamar o UseCase", async () => {
    resetMocks()

    const response = await POST(makeRequest(VALID_BODY, { origin: "https://site-de-terceiro.com" }), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })

    expect(response.status).toBe(400)
    expect(acceptMock).not.toHaveBeenCalled()
    expect(queueForBackgroundProcessingMock).not.toHaveBeenCalled()
  })

  it("Origin ausente passa — comportamento documentado do guard", async () => {
    resetMocks()

    const response = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })

    expect(response.status).toBe(201)
    expect(acceptMock).toHaveBeenCalledTimes(1)
  })

  it("origem da própria aplicação passa", async () => {
    resetMocks()

    const response = await POST(makeRequest(VALID_BODY, { origin: "http://localhost:3000" }), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })

    expect(response.status).toBe(201)
    expect(acceptMock).toHaveBeenCalledTimes(1)
  })
})

describe("Public form submissions route (PR2.3)", () => {
  it("fluxo feliz: after() delega ao UseCase.queueForBackgroundProcessing", async () => {
    resetMocks()

    const response = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })
    expect(response.status).toBe(201)
    await lastAfterPromise

    expect(queueForBackgroundProcessingMock).toHaveBeenCalledWith(BACKGROUND_JOB)
  })

  it("sem background job (already processed): não chama queueForBackgroundProcessing", async () => {
    resetMocks()
    acceptMock.mockResolvedValue(
      new Output(true, ["Respostas já recebidas"], [], {
        submissionId: "sub-1",
        alreadyProcessed: true,
      }),
    )

    const response = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })
    expect(response.status).toBe(201)
    await Promise.resolve()

    expect(queueForBackgroundProcessingMock).not.toHaveBeenCalled()
  })

  it("accept inválido → 400, sem enfileirar", async () => {
    resetMocks()
    acceptMock.mockResolvedValue(new Output(false, [], ["Formulário indisponível"], null))

    const response = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ publicId: "pub-1" }),
    })
    expect(response.status).toBe(400)
    expect(queueForBackgroundProcessingMock).not.toHaveBeenCalled()
  })
})

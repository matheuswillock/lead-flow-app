import { describe, expect, it, mock } from "bun:test"

/**
 * Bug 31/08 (Liber): o gate ancora no perfil Radar do destinatário do e-mail.
 * Quem responde um encaminhamento só é reconhecível pelas respostas digitadas —
 * é o que esta leitura entrega ao use case.
 */

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }))

const { RadarLeadGateUnitOfWork } = await import("./RadarLeadGateUnitOfWork")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SESSION = "sessao-radar-1"

type AnswerRow = {
  value: unknown
  mappingKey: string | null
  questionSnapshot: Record<string, unknown> | null
}

function makeUnitOfWork(
  submission: { id: string; leadId: string | null; answers: AnswerRow[] } | null,
) {
  const findFirst = mock(async () => submission)
  const transaction = {
    $executeRaw: mock(async () => 1),
    publicFormSubmission: { findFirst },
  }
  const database = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transaction),
  }
  return { unitOfWork: new RadarLeadGateUnitOfWork(database as never), findFirst }
}

function read(submission: { id: string; leadId: string | null; answers: AnswerRow[] } | null) {
  const { unitOfWork } = makeUnitOfWork(submission)
  return unitOfWork.execute({ teamId: "team-1", radarProfileId: "profile-1" }, (transaction) =>
    transaction.findSubmittedIdentity({ formId: FORM_ID, visitorSessionId: SESSION }),
  )
}

const nativeAnswer = (mappingKey: string, value: unknown): AnswerRow => ({
  value,
  mappingKey,
  questionSnapshot: { mappingTarget: "native_field", mappingKey },
})

describe("findSubmittedIdentity", () => {
  it("devolve nome, telefone e e-mail digitados e o lead da sessão", async () => {
    const identity = await read({
      id: "sub-corrente",
      leadId: "lead-da-sessao",
      answers: [
        nativeAnswer("name", "Alexandre"),
        nativeAnswer("phone", " (13) 99788-9618 "),
        nativeAnswer("email", "alexandre@libercorretora.com.br"),
      ],
    })

    expect(identity).toEqual({
      name: "Alexandre",
      phone: "(13) 99788-9618",
      email: "alexandre@libercorretora.com.br",
      submissionId: "sub-corrente",
      sessionLeadId: "lead-da-sessao",
    })
  })

  it("ignora resposta que não é native_field, mesmo com mappingKey de identidade", async () => {
    const identity = await read({
      id: "sub-corrente",
      leadId: null,
      answers: [
        {
          value: "outro@exemplo.com",
          mappingKey: "email",
          questionSnapshot: { mappingTarget: "custom_field", mappingKey: "email" },
        },
        nativeAnswer("phone", "(13) 99788-9618"),
      ],
    })

    expect(identity).toEqual({
      name: null,
      phone: "(13) 99788-9618",
      email: null,
      submissionId: "sub-corrente",
      sessionLeadId: null,
    })
  })

  it("devolve null quando a sessão ainda não tem submissão", async () => {
    expect(await read(null)).toBeNull()
  })
})

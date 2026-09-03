import { mock } from "bun:test"
import * as actualLeadSyncClaim from "@/lib/public-forms/lead-sync-claim"

/**
 * Instâncias COMPARTILHADAS de mock para os módulos que o `publicFormLeadSync`
 * real consome, mais o registro (`mock.module`) com fábricas idênticas.
 *
 * Por que existe: `mock.module` do Bun é global do processo, e o módulo real
 * `publicFormLeadSync` tem um singleton de módulo
 * (`const leadUseCase = new LeadUseCase(...)`) que liga as dependências UMA
 * vez, na primeira avaliação. Quando dois arquivos de teste mockavam os
 * mesmos módulos com instâncias PRÓPRIAS, o arquivo que rodasse primeiro
 * "ganhava" o singleton e os mocks do segundo ficavam inertes — verde ou
 * vermelho conforme a ordem do runner (flaky garantido sem `--isolate`).
 *
 * A regra: todo arquivo de teste que exercita `publicFormLeadSync` real (ou
 * um módulo que o importa) registra ESTAS fábricas, manipula ESTAS instâncias
 * no `beforeEach`, e nunca cria as suas próprias para estes módulos. Com
 * `--isolate` (CI) cada arquivo recebe uma cópia isolada do helper — o
 * comportamento é o mesmo nos dois modos.
 */

type CreateLeadOutput = {
  isValid: boolean
  errorMessages: string[]
  successMessages: string[]
  result: unknown
}

// ---- Repositório de public forms (união dos métodos usados nos testes) ----
export const findLeadCandidatesMock = mock(async (..._args: unknown[]) => [] as unknown[])
export const findDeletedLeadCandidatesMock = mock(async (..._args: unknown[]) => [] as unknown[])
export const updateLeadMock = mock(
  async (id: string, data: Record<string, unknown>) => ({ ...data, id }) as unknown,
)
export const findCustomFieldDefinitionIdMock = mock(async () => null as string | null)
export const upsertLeadCustomFieldValueMock = mock(async () => {})
export const claimSubmissionForLeadSyncMock = mock(async (_submissionId: string) => true)
export const findLatestSessionSubmissionOnFormMock = mock(
  async () =>
    null as {
      id: string
      publicationId: string
      status: string
      leadId: string | null
    } | null,
)
export const findPublicationByIdMock = mock(
  async () => null as { publicationId: string; snapshot: unknown } | null,
)
export const findPublicationContainingQuestionsMock = mock(async () => null)
export const findFormSubmissionContextMock = mock(async (): Promise<unknown> => {
  throw new Error(
    "findFormSubmissionContextMock sem valor configurado — defina no beforeEach do teste",
  )
})
export const listSubmissionAnswersMock = mock(
  async () => [] as Array<{ questionId: string; value: unknown }>,
)
export const upsertProgressSubmissionMock = mock(async () => ({ id: "sub-progress" }))
export const upsertMetricEventMock = mock(async () => {})

export const sharedPublicFormsRepositoryMock = {
  findLeadCandidates: findLeadCandidatesMock,
  findDeletedLeadCandidates: findDeletedLeadCandidatesMock,
  updateLead: updateLeadMock,
  findCustomFieldDefinitionId: findCustomFieldDefinitionIdMock,
  upsertLeadCustomFieldValue: upsertLeadCustomFieldValueMock,
  claimSubmissionForLeadSync: claimSubmissionForLeadSyncMock,
  findLatestSessionSubmissionOnForm: findLatestSessionSubmissionOnFormMock,
  findPublicationById: findPublicationByIdMock,
  findPublicationContainingQuestions: findPublicationContainingQuestionsMock,
  findFormSubmissionContext: findFormSubmissionContextMock,
  listSubmissionAnswers: listSubmissionAnswersMock,
  upsertProgressSubmission: upsertProgressSubmissionMock,
  upsertMetricEvent: upsertMetricEventMock,
}

// ---- LeadUseCase / EmailLog / lead-sync-claim ----
export const createLeadMock = mock(
  async (..._args: unknown[]): Promise<CreateLeadOutput> => ({
    isValid: true,
    errorMessages: [],
    successMessages: [],
    result: null,
  }),
)

export const findCampaignLogForAttributionMock = mock(
  async () =>
    null as {
      id: string
      campaignId: string | null
      dispatchId: string | null
      recipientEmail: string
      recipientName: string | null
      campaignName: string | null
    } | null,
)

export const waitForLeadSyncClaimRetryMock = mock(async (_ms: number) => {})

export function registerPublicFormLeadSyncModuleMocks(): void {
  mock.module("server-only", () => ({}))
  mock.module("@/lib/env/server", () => ({}))
  mock.module("@/app/api/infra/data/prisma", () => ({
    prisma: {},
    withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
  }))
  mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
    // Fábrica completa: todos os exports de valor do módulo real, para não
    // derrubar outro arquivo que importe um export omitido (a armadilha das
    // fábricas parciais — ver nota project-mock-module-partial-factories).
    SOFT_DELETED_QUESTION_POSITION_BASE: 1_000_000,
    nextSoftDeletedQuestionPosition: (maxExistingDeletedPosition: number | null) =>
      Math.max(1_000_000, (maxExistingDeletedPosition ?? 1_000_000 - 1) + 1),
    PublicFormsRepository: class {},
    publicFormsRepository: sharedPublicFormsRepositoryMock,
  }))
  mock.module("@/app/api/useCases/leads/LeadUseCase", () => ({
    LeadUseCase: class {
      createLead = createLeadMock
    },
  }))
  mock.module("@/app/api/infra/data/repositories/lead/LeadRepository", () => ({
    LeadRepository: class {},
    leadRepository: {},
  }))
  mock.module("@/app/api/useCases/profiles/ProfileUseCase", () => ({
    RegisterNewUserProfile: class {},
    RegisterExistingUserProfile: class {},
  }))
  mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
    EmailLogRepository: class {},
    emailLogRepository: { findCampaignLogForAttribution: findCampaignLogForAttributionMock },
  }))
  // Espalha o módulo real: as constantes de produção (3×700ms) continuam
  // sendo as testadas; só a espera vira no-op controlável.
  mock.module("@/lib/public-forms/lead-sync-claim", () => ({
    ...actualLeadSyncClaim,
    waitForLeadSyncClaimRetry: waitForLeadSyncClaimRetryMock,
  }))
}

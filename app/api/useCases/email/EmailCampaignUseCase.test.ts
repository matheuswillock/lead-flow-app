import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

// =============================================================================
// MOCKS — declarar ANTES de qualquer await import()
// =============================================================================

// --- EmailCampaignDispatchService ---
const dispatchBatchMock = mock(async (_params: unknown) => ({
  sent: 0,
  failed: 0,
  dispatched: [] as Array<{ email: string; resendId: string }>,
  providerErrors: [] as Array<{ message: string; emails: string[]; statusCode?: number }>,
}))
mock.module("@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService", () => ({
  EmailCampaignDispatchService: class {
    dispatchBatch = dispatchBatchMock
  },
}))

// --- EmailCampaignRecipientService ---
const buildCampaignDispatchInputMock = mock(async () => makeDefaultDispatchInput([]))
const findUnresolvedTokensMock = mock(() => [] as string[])
mock.module("@/app/api/services/EmailCampaignDispatch/EmailCampaignRecipientService", () => ({
  EmailCampaignRecipientService: class {
    buildCampaignDispatchInput = buildCampaignDispatchInputMock
    findUnresolvedTokensForRecipients = findUnresolvedTokensMock
    listActiveRecipients = mock(async () => [])
  },
}))

// --- EmailCreditService ---
const reserveCreditsMock = mock(async () => ({ ok: true as const } as { ok: true } | { ok: false; reason: string; available: number }))
const releaseCreditsMock = mock(async () => {})
const formatInsufficientMock = mock((_n: number, _a: number) => "Saldo insuficiente de e-mails")
mock.module("@/app/api/services/EmailCredit/EmailCreditService", () => ({
  EmailCreditService: class {
    reserveCredits = reserveCreditsMock
    releaseCredits = releaseCreditsMock
    formatInsufficientCreditsMessage = formatInsufficientMock
  },
}))

// --- TeamEmailDispatchLogger ---
const createQueuedLogsMock = mock(async (inputs: Array<{ recipientEmail: string }>) =>
  inputs.map((i) => ({ email: i.recipientEmail, logId: `log-${i.recipientEmail}` }))
)
const markManyTeamEmailLogsSentMock = mock(async () => {})
const markTeamEmailLogFailedMock = mock(async () => {})
mock.module("@/lib/email/team-email-dispatch-logger", () => ({
  teamEmailDispatchLogger: {
    createQueuedTeamEmailLogs: createQueuedLogsMock,
    markManyTeamEmailLogsSent: markManyTeamEmailLogsSentMock,
    markTeamEmailLogFailed: markTeamEmailLogFailedMock,
  },
}))

// --- Prisma ---
const emailCampaignFindFirstMock = mock(async () => makeCampaign())
const emailCampaignFindUniqueMock = mock(async () => ({
  name: "Campanha Teste",
  parentCampaignId: null as string | null,
}))
const emailCampaignDispatchFindUniqueMock = mock(async () => ({
  triggeredBy: "profile-1",
  status: "sending" as const,
}))
const emailCampaignFindManyMock = mock(async () => [])
const emailCampaignCountMock = mock(async () => 0)
const emailCampaignUpdateManyMock = mock(async () => ({ count: 1 }))
const emailCampaignUpdateMock = mock(async () => ({ parentCampaignId: null as string | null }))
const emailTemplateFindFirstMock = mock(async () => null as unknown)
const emailCampaignDispatchAggregateMock = mock(async () => ({ _max: { dispatchNumber: 0 } }))
const emailCampaignDispatchCreateMock = mock(async () => ({ id: "dispatch-1" }))
const emailCampaignDispatchFindFirstMock = mock(async () => ({ id: "dispatch-1" }))
const emailCampaignDispatchFindManyMock = mock(async () => [])
const emailCampaignDispatchUpdateMock = mock(async () => ({}))
const emailCampaignDispatchUpdateManyMock = mock(async () => ({ count: 0 }))
const emailTeamSenderFindFirstMock = mock(async () => null as { name: string; email: string } | null)
const emailLogFindManyMock = mock(async () => [] as Array<{ recipientEmail: string; status: string }>)
const transactionMock = mock(async (ops: Promise<unknown>[]) => Promise.all(ops))
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailCampaign: {
      findFirst: emailCampaignFindFirstMock,
      findUnique: emailCampaignFindUniqueMock,
      findMany: emailCampaignFindManyMock,
      count: emailCampaignCountMock,
      updateMany: emailCampaignUpdateManyMock,
      update: emailCampaignUpdateMock,
    },
    emailTeamSettings: { findUnique: mock(async () => null) },
    emailTemplate: { findFirst: emailTemplateFindFirstMock },
    emailContactList: {
      findMany: mock(async () => [
        { id: "00000000-0000-4000-8000-000000000001", name: "Lista 1" },
      ]),
    },
    emailContact: {
      findMany: mock(async () => []),
    },
    emailCampaignDispatch: {
      aggregate: emailCampaignDispatchAggregateMock,
      create: emailCampaignDispatchCreateMock,
      findFirst: emailCampaignDispatchFindFirstMock,
      findUnique: emailCampaignDispatchFindUniqueMock,
      findMany: emailCampaignDispatchFindManyMock,
      update: emailCampaignDispatchUpdateMock,
      updateMany: emailCampaignDispatchUpdateManyMock,
    },
    emailTeamSender: {
      findFirst: emailTeamSenderFindFirstMock,
    },
    emailLog: {
      findMany: emailLogFindManyMock,
      count: mock(async () => 0),
    },
    backofficeTeamEmailLimitGrant: {
      findUnique: mock(async () => null),
    },
    teamEmailCampaignLimitGrant: {
      findUnique: mock(async () => null),
    },
    $transaction: transactionMock,
  },
}))

// --- FeatureAccessService ---
const resolveEmailBetaAccessMock = mock(async () => false)
mock.module("@/app/api/services/featureAccess/FeatureAccessService", () => ({
  featureAccessService: { resolveEmailBetaAccess: resolveEmailBetaAccessMock },
}))

// --- EmailOrphanEventService ---
const processPendingBatchMock = mock(async () => ({ processed: 0, failed: 0, skipped: 0 }))
mock.module("@/app/api/services/resend/EmailOrphanEventService", () => ({
  emailOrphanEventService: { processPendingBatch: processPendingBatchMock },
}))

// --- EmailCampaignLeadActivityService (fire-and-forget) ---
mock.module("@/app/api/services/email/EmailCampaignLeadActivityService", () => ({
  emailCampaignLeadActivityService: { recordDispatchForRecipient: mock(async () => {}) },
}))

// --- Pure helpers ---
mock.module("@/lib/email/inline-email-html", () => ({
  inlineEmailHtml: (html: string) => html,
}))
mock.module("@/lib/email/email-rbac", () => ({
  canDispatchEmail: () => true,
}))
mock.module("@/lib/radar/list-segment-recipients", () => ({
  listRadarSegmentEmailRecipients: mock(async () => []),
}))

mock.module("@/lib/email/notify-campaign-dispatch-failure", () => ({
  notifyCampaignDispatchFailure: mock(async () => {}),
}))

// =============================================================================
// Importação dinâmica — APÓS todos os mocks
// =============================================================================
const { EmailCampaignUseCase, EMAIL_CAMPAIGN_FAILURE_MESSAGES } = await import(
  "./EmailCampaignUseCase"
)

// =============================================================================
// Helpers de fixture
// =============================================================================

function makeRecipients(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    email: `r${i}@test.com`,
    name: `R${i}`,
    contactId: `c${i}`,
    customFields: null as Record<string, unknown> | null,
  }))
}

function makeDefaultDispatchInput(
  recipients: ReturnType<typeof makeRecipients> = []
) {
  return {
    recipients,
    globalDefaults: {} as Record<string, string | null | undefined>,
    templateVariables: [] as unknown[],
    subject: "Campanha Teste",
    html: "<p>Olá {{nome}}</p>",
    from: "Test <test@sender.com>",
    replyTo: null as string | null,
  }
}

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    status: "draft",
    templateId: "tpl-ref-1",
    contactListId: "list-1",
    radarSegmentSlug: null,
    parentCampaignId: null,
    audienceContactIds: [] as string[],
    contactList: { id: "list-1", name: "Lista Test", totalContacts: 10 },
    team: { master: { id: "master-1", timezone: "America/Sao_Paulo" } },
    ...overrides,
  }
}

const teamCtx: TeamAccess = {
  supabaseId: "supa-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "test@test.com",
  profileName: "Test User",
  isMaster: false,
  managerId: "manager-1",
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
}

// Configura o mock de template (2 chamadas: ref → template completo)
function setupTemplateMock() {
  let call = 0
  emailTemplateFindFirstMock.mockImplementation(async () => {
    call++
    if (call === 1) return { versionGroupId: "vg-1" }
    return {
      id: "tpl-1",
      name: "Template Test",
      subject: "Assunto {{nome}}",
      html: "<p>Olá {{nome}}</p>",
      variables: [],
      versionNumber: 1,
    }
  })
}

// Todos os mocks que precisam ser resetados entre testes
const allMocks = [
  emailCampaignFindFirstMock,
  emailCampaignFindManyMock,
  emailCampaignUpdateManyMock,
  emailCampaignUpdateMock,
  emailTemplateFindFirstMock,
  emailCampaignDispatchAggregateMock,
  emailCampaignDispatchCreateMock,
  emailCampaignDispatchFindFirstMock,
  emailCampaignDispatchUpdateMock,
  emailCampaignDispatchUpdateManyMock,
  emailTeamSenderFindFirstMock,
  emailLogFindManyMock,
  transactionMock,
  reserveCreditsMock,
  releaseCreditsMock,
  formatInsufficientMock,
  createQueuedLogsMock,
  markManyTeamEmailLogsSentMock,
  markTeamEmailLogFailedMock,
  resolveEmailBetaAccessMock,
  processPendingBatchMock,
  buildCampaignDispatchInputMock,
  findUnresolvedTokensMock,
  dispatchBatchMock,
]

// =============================================================================
// EmailCampaignUseCase.send
// =============================================================================

describe("EmailCampaignUseCase.send", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()

    // Restaurar implementações padrão após clear
    emailCampaignFindFirstMock.mockImplementation(async () => makeCampaign())
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
    emailCampaignUpdateMock.mockImplementation(async () => ({ parentCampaignId: null }))
    emailCampaignDispatchAggregateMock.mockImplementation(async () => ({
      _max: { dispatchNumber: 0 },
    }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchUpdateMock.mockImplementation(async () => ({}))
    emailTeamSenderFindFirstMock.mockImplementation(async () => null)
    emailLogFindManyMock.mockImplementation(async () => [])
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    reserveCreditsMock.mockImplementation(async () => ({ ok: true as const }))
    releaseCreditsMock.mockImplementation(async () => {})
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))
    buildCampaignDispatchInputMock.mockImplementation(async () => makeDefaultDispatchInput([]))
    findUnresolvedTokensMock.mockImplementation(() => [])
    createQueuedLogsMock.mockImplementation(
      async (inputs: Array<{ recipientEmail: string }>) =>
        inputs.map((i) => ({ email: i.recipientEmail, logId: `log-${i.recipientEmail}` }))
    )
    markManyTeamEmailLogsSentMock.mockImplementation(async () => {})
    markTeamEmailLogFailedMock.mockImplementation(async () => {})
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 0,
      dispatched: [],
      providerErrors: [],
    }))
    setupTemplateMock()
  })

  // ---------------------------------------------------------------------------
  // C9 — campanha não encontrada
  // ---------------------------------------------------------------------------
  it("C9 — campanha não encontrada → isValid: false antes do lock", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () => null as never)

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-inexistente", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("não encontrada")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C3 — zero destinatários
  // ---------------------------------------------------------------------------
  it("C3 — zero destinatários → NO_RECIPIENTS_LIST; lock e créditos NÃO chamados", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput([])
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("contato")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C8 — tokens não resolvidos
  // ---------------------------------------------------------------------------
  it("C8 — tokens não resolvidos → bloqueia disparo; erros contêm os tokens", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(5))
    )
    findUnresolvedTokensMock.mockImplementation(() => ["preco", "plano"])

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("{{preco}}")
    expect(output.errorMessages[0]).toContain("{{plano}}")
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C10 — lock concorrente (updateMany count=0)
  // ---------------------------------------------------------------------------
  it("C10 — lock concorrente: updateMany count=0 → isValid: false; créditos NÃO reservados", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 0 }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("já está sendo enviada")
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C4 — crédito: sem assinatura
  // ---------------------------------------------------------------------------
  it("C4 — reserveCredits no_subscription → isValid: false; restaura status da campanha", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    reserveCreditsMock.mockImplementation(async () => ({
      ok: false as const,
      reason: "no_subscription" as const,
      available: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS)
    expect(emailCampaignUpdateMock).toHaveBeenCalledTimes(1)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C5 — crédito: saldo insuficiente
  // ---------------------------------------------------------------------------
  it("C5 — reserveCredits insufficient_balance → mensagem de formatInsufficientCreditsMessage", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    reserveCreditsMock.mockImplementation(async () => ({
      ok: false as const,
      reason: "insufficient_balance" as const,
      available: 3,
    }))
    formatInsufficientMock.mockImplementation(() => "Você precisa de 10, tem 3")

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Você precisa de 10, tem 3")
  })

  // ---------------------------------------------------------------------------
  // C7 — beta access bypassa créditos
  // ---------------------------------------------------------------------------
  it("C7 — beta access: reserveCredits e releaseCredits NÃO chamados", async () => {
    resolveEmailBetaAccessMock.mockImplementation(async () => true)
    const recipients = makeRecipients(5)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 5,
      failed: 0,
      dispatched: recipients.map((r) => ({ email: r.email, resendId: `re_${r.email}` })),
      providerErrors: [],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(releaseCreditsMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C6 — todos os e-mails falham (sent=0)
  // ---------------------------------------------------------------------------
  it("C6 — sent=0: isValid: false; créditos todos liberados no finally", async () => {
    const recipients = makeRecipients(10)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 10,
      dispatched: [],
      providerErrors: [
        {
          message: "Invalid `to` field",
          statusCode: 422,
          emails: recipients.map((r) => r.email),
        },
      ],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    // Mensagem ao usuário é sanitizada (sem e-mails nem detalhe técnico do provedor).
    expect(output.errorMessages[0]).toBe("Falha no envio. 10 destinatário(s) não foram enviados.")
    expect(markTeamEmailLogFailedMock).toHaveBeenCalled()
    const failedReasons = markTeamEmailLogFailedMock.mock.calls.map(
      (call) => (call as unknown as [string, string])[1]
    )
    expect(failedReasons.every((reason) => reason.includes("422") || reason.includes("Invalid `to`"))).toBe(
      true
    )
    // unused = max(0, 10 - 0) = 10 → releaseCredits("team-1", 10)
    expect(releaseCreditsMock).toHaveBeenCalledTimes(1)
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(10)
  })

  // ---------------------------------------------------------------------------
  // C12 — e-mails pipe (casos reais) filtrados antes do Resend
  // ---------------------------------------------------------------------------
  it("C12 — destinatários com pipe: não chama dispatchBatch; marca failed com motivo local; campanha failed", async () => {
    const recipients = [
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "Carol/Hugo",
        contactId: "c-pipe-1",
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "financeiro@newcorban.com.br|financeiro@grupodigital.com.br",
        name: "Financeiro",
        contactId: "c-pipe-2",
        customFields: null as Record<string, unknown> | null,
      },
    ]
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(2)
    // Mensagem ao usuário é sanitizada (sem e-mails nem motivo técnico).
    expect(output.errorMessages[0]).toBe("Falha no envio. 2 destinatário(s) não foram enviados.")

    const failedReasons = markTeamEmailLogFailedMock.mock.calls.map(
      (call) => (call as unknown as [string, string])[1]
    )
    expect(
      failedReasons.every((reason) => reason.includes("E-mail inválido para o Resend"))
    ).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // C13 — mix: válidos enviados + pipe filtrado localmente
  // ---------------------------------------------------------------------------
  it("C13 — mix válido + pipe: dispatchBatch só recebe válidos; pipe falha localmente", async () => {
    const recipients = [
      {
        email: "ok@example.com",
        name: "Ok",
        contactId: "c-ok",
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "Pipe",
        contactId: "c-pipe",
        customFields: null as Record<string, unknown> | null,
      },
    ]
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as { recipients: Array<{ email: string }> }
      expect(typed.recipients).toHaveLength(1)
      expect(typed.recipients[0]?.email).toBe("ok@example.com")
      return {
        sent: 1,
        failed: 0,
        dispatched: [{ email: "ok@example.com", resendId: "re_ok" }],
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(1)
    expect(output.result.failed).toBe(1)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(1)
    expect((markTeamEmailLogFailedMock.mock.calls[0] as unknown as [string, string])[1]).toContain(
      "carol.ocipriani@gmail.com|hugopoli@gmail.com"
    )
  })

  // ---------------------------------------------------------------------------
  // C1 — CENÁRIO PRINCIPAL: 2000 e-mails, 20 chunks, onChunkDispatched 20×
  // ---------------------------------------------------------------------------
  it("C1 — 2000 e-mails: onChunkDispatched invocado 20×; markManyTeamEmailLogsSent 20× c/ 100 entradas cada", async () => {
    const recipients2000 = makeRecipients(2000)

    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients2000)
    )

    // dispatchBatch chama onChunkDispatched para cada um dos 20 chunks
    dispatchBatchMock.mockImplementation(async (_p: unknown) => {
      const params = _p as { onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void> }
      for (let i = 0; i < 20; i++) {
        const chunk = Array.from({ length: 100 }, (_, j) => ({
          email: `r${i * 100 + j}@test.com`,
          resendId: `re_${i * 100 + j}`,
        }))
        await params.onChunkDispatched?.(chunk)
      }
      return {
        sent: 2000,
        failed: 0,
        dispatched: recipients2000.map((r, k) => ({ email: r.email, resendId: `re_${k}` })),
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(2000)
    expect(output.result.failed).toBe(0)

    // reservou exatamente 2000 créditos
    expect(reserveCreditsMock).toHaveBeenCalledTimes(1)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(2000)

    // markManyTeamEmailLogsSent chamado 20× (uma vez por chunk via onChunkDispatched)
    expect(markManyTeamEmailLogsSentMock).toHaveBeenCalledTimes(20)

    // cada chamada recebeu exatamente 100 entradas
    for (const callArgs of markManyTeamEmailLogsSentMock.mock.calls) {
      const entries = (callArgs as unknown as [Array<{ logId: string; resendEmailId: string }>])[0]
      expect(entries).toHaveLength(100)
    }

    // markTeamEmailLogFailed NÃO chamado (nenhuma falha)
    expect(markTeamEmailLogFailedMock).not.toHaveBeenCalled()

    // unused = max(0, 2000-2000) = 0 → releaseCredits NÃO chamado
    expect(releaseCreditsMock).not.toHaveBeenCalled()

    // dispatchBatch chamado 1× (chunking é interno ao service)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // C2 — 2000 e-mails: chunk 4 falha → 1900 sent, 100 failed
  // ---------------------------------------------------------------------------
  it("C2 — 2000 e-mails / chunk 4 falha: markManyTeamEmailLogsSent 19×; markTeamEmailLogFailed 100×; releaseCredits 100", async () => {
    const recipients2000 = makeRecipients(2000)

    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients2000)
    )

    // Chunk 4 (índice 4) falha — onChunkDispatched não é invocado para ele
    dispatchBatchMock.mockImplementation(async (_p: unknown) => {
      const params = _p as { onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void> }
      const dispatchedEntries: Array<{ email: string; resendId: string }> = []
      for (let i = 0; i < 20; i++) {
        if (i === 4) continue // chunk 4 com erro no Resend
        const chunk = Array.from({ length: 100 }, (_, j) => ({
          email: `r${i * 100 + j}@test.com`,
          resendId: `re_${i * 100 + j}`,
        }))
        await params.onChunkDispatched?.(chunk)
        dispatchedEntries.push(...chunk)
      }
      return {
        sent: 1900,
        failed: 100,
        dispatched: dispatchedEntries,
        providerErrors: [
          {
            message: "Too many requests",
            statusCode: 429,
            emails: Array.from({ length: 100 }, (_, j) => `r${4 * 100 + j}@test.com`),
          },
        ],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(1900)
    expect(output.result.failed).toBe(100)

    // onChunkDispatched foi chamado 19× → markManyTeamEmailLogsSent 19×
    expect(markManyTeamEmailLogsSentMock).toHaveBeenCalledTimes(19)

    // 100 destinatários do chunk 4 marcados como failed
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(100)

    // unused = max(0, 2000-1900) = 100 → releaseCredits("team-1", 100)
    expect(releaseCreditsMock).toHaveBeenCalledTimes(1)
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[0]).toBe("team-1")
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(100)
  })

  // ---------------------------------------------------------------------------
  // C14 — retryFailedOnly: só destinatários com falha (sem sucesso no provedor)
  // ---------------------------------------------------------------------------
  it("C14 — retryFailedOnly filtra só falhos; reserva créditos só pelos falhos", async () => {
    const allRecipients = makeRecipients(5)
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(allRecipients)
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "sent" },
      { recipientEmail: "r1@test.com", status: "delivered" },
      { recipientEmail: "r2@test.com", status: "failed" },
      { recipientEmail: "r3@test.com", status: "failed" },
      { recipientEmail: "r3@test.com", status: "opened" },
      { recipientEmail: "r4@test.com", status: "failed" },
    ])
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as { recipients: Array<{ email: string }> }
      return {
        sent: typed.recipients.length,
        failed: 0,
        dispatched: typed.recipients.map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        })),
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    const dispatchArgs = dispatchBatchMock.mock.calls[0] as unknown as [
      { recipients: Array<{ email: string }> },
    ]
    expect(dispatchArgs[0].recipients.map((recipient) => recipient.email).sort()).toEqual([
      "r2@test.com",
      "r4@test.com",
    ])
    expect(reserveCreditsMock).toHaveBeenCalledTimes(1)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(2)
    expect(createQueuedLogsMock.mock.calls[0]?.[0]).toHaveLength(2)
  })

  it("C14b — failed sem elegíveis → NO_FAILED_RECIPIENTS; sem lock/créditos", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(3))
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "sent" },
      { recipientEmail: "r1@test.com", status: "failed" },
      { recipientEmail: "r1@test.com", status: "delivered" },
      { recipientEmail: "r2@test.com", status: "bounced" },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_FAILED_RECIPIENTS)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })
})

// =============================================================================
// EmailCampaignUseCase.dispatchScheduledCampaigns
// =============================================================================

describe("EmailCampaignUseCase.dispatchScheduledCampaigns", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailCampaignFindManyMock.mockImplementation(async () => [])
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailCampaignDispatchUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))
  })

  it("C11 — processPendingBatch chamado 1× após o loop de campanhas", async () => {
    // Sem campanhas agendadas; apenas verifica que o orphan sweep ocorre
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 3,
      failed: 0,
      skipped: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 5 })

    expect(processPendingBatchMock).toHaveBeenCalledTimes(1)
    expect(output.isValid).toBe(true)
    expect(output.result.dispatched).toBe(0)
  })
})

// =============================================================================
// Contratos de constantes (mantidos dos testes originais)
// =============================================================================

describe("EMAIL_CAMPAIGN_FAILURE_MESSAGES (contratos)", () => {
  it("NO_CREDITS contém 'créditos'", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS).toContain("créditos")
  })

  it("NO_RECIPIENTS_LIST contém 'contato'", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST).toContain("contato")
  })
})

describe("EmailCampaignUseCase.previewPlan", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
  })

  it("retorna erro quando nome está vazio", async () => {
    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      { name: "", templateId: "00000000-0000-4000-8000-000000000001" },
      teamCtx
    )
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Nome")
  })

  it("exige estratégia quando há múltiplas listas", async () => {
    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      {
        name: "Multi",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002",
        ],
      },
      teamCtx
    )
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("estratégia")
  })

  it("aceita preview com lista e segmento juntos (não rejeita por XOR)", async () => {
    const uc = new EmailCampaignUseCase()
    const both = await uc.previewPlan(
      {
        name: "Combo",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListId: "00000000-0000-4000-8000-000000000001",
        radarSegmentSlug: "email_marketable",
      },
      teamCtx
    )
    expect(both.errorMessages.join(" ")).not.toContain("não ambos")
  })
})

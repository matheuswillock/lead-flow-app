import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E2 — T-13.4.
 *
 * `createSchedule` (`LeadScheduleService.ts`) não tinha NENHUM teste antes
 * desta sessão (confirmado no mapa estrutural da sessão anterior). Este
 * arquivo é a rede de segurança da refatoração de A-E2 a A-E5: captura o
 * comportamento ATUAL (antes de qualquer extração) em três cenários —
 * online com Google, online sem Google com link manual, e telefone — e
 * precisa continuar produzindo o MESMO resultado depois de cada estágio da
 * refatoração (A-E2, A-E3, A-E4), sem editar as asserções abaixo.
 *
 * Todas as dependências do método (prisma, `leadScheduleRepository`,
 * `upsertCalendarEvent`/`cancelCalendarEvent`, `emailService`,
 * `notificationService`, `teamAutomationDispatcherService`,
 * `outboundEventPublisher`, o import dinâmico de
 * `logGoogleCalendarDispatchesForRecipients`) são dubladas com `mock.module`,
 * seguindo o padrão já usado em `EmailService.invite-idempotency.test.ts`.
 * Nenhuma chamada real a Google, Resend ou banco acontece aqui.
 */

const FIXED_MEETING_DATE = "2026-10-01T14:00:00.000Z"
const LEAD_ID = "11111111-1111-4111-8111-111111111111"
const CLOSER_ID = "22222222-2222-4222-8222-222222222222"
const TEAM_ID = "33333333-3333-4333-8333-333333333333"
const CREATED_BY_ID = "44444444-4444-4444-8444-444444444444"

// --- prisma ---
const profileFindUniqueMock = mock(async ({ where }: { where: { id: string } }) => {
  if (where.id === CLOSER_ID) {
    return closerProfileFixture()
  }
  if (where.id === CREATED_BY_ID) {
    return { fullName: "Ana Scheduler", email: "ana.scheduler@example.com" }
  }
  return null
})

const leadFindUniqueMock = mock(async () => ({ phone: "+5511999990000" }))
const leadAttachmentFindManyMock = mock(async () => [])
const teamMemberFindManyMock = mock(async () => [])
const leadActivityCreateMock = mock(async () => ({}))

const txLeadsScheduleUpsertMock = mock(async ({ create, update }: any) => ({
  id: "schedule-fixed-id",
  leadId: LEAD_ID,
  ...(create ? create : update),
}))
const txLeadUpdateMock = mock(async ({ data }: any) => ({
  id: LEAD_ID,
  status: data.status ?? "new_opportunity",
  ...data,
}))

const transactionMock = mock(async (callback: (tx: unknown) => unknown) => {
  const tx = {
    leadsSchedule: { upsert: txLeadsScheduleUpsertMock },
    lead: { update: txLeadUpdateMock },
    leadActivity: { create: leadActivityCreateMock },
  }
  return callback(tx)
})

let googleConnectionActive: { refreshToken: string | null; revokedAt: Date | null } | null = null

function closerProfileFixture() {
  return {
    id: CLOSER_ID,
    email: "closer@example.com",
    fullName: "Carlos Closer",
    phone: "+5511988880000",
    timezone: "America/Sao_Paulo",
    googleConnection: googleConnectionActive,
  }
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUniqueMock },
    lead: { findUnique: leadFindUniqueMock },
    leadAttachment: { findMany: leadAttachmentFindManyMock },
    teamMember: { findMany: teamMemberFindManyMock },
    leadActivity: { create: leadActivityCreateMock },
    $transaction: transactionMock,
  },
}))

// --- leadScheduleRepository ---
// `MeetingRepository` (A-E2) usa o mesmo singleton para `upsertByLeadIdWithTx`
// — dublado aqui repassando para o `tx.leadsSchedule.upsert` já mockado
// acima, igual a implementação real faz.
const findLatestByLeadIdMock = mock(async () => null as null | Record<string, unknown>)
const upsertByLeadIdWithTxMock = mock(async (tx: any, leadId: string, data: any) =>
  tx.leadsSchedule.upsert({
    where: { leadId },
    create: { id: data.id, leadId, ...data },
    update: data,
  })
)
mock.module("@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository", () => ({
  leadScheduleRepository: {
    findLatestByLeadId: findLatestByLeadIdMock,
    upsertByLeadIdWithTx: upsertByLeadIdWithTxMock,
  },
}))

// --- Google Calendar ---
const upsertCalendarEventMock = mock(async () => ({
  eventId: "google-event-1",
  calendarId: "primary",
  htmlLink: "https://calendar.google.com/event?eid=abc",
  meetLink: "https://meet.google.com/abc-defg-hij",
}))
const cancelCalendarEventMock = mock(async () => undefined)
mock.module("@/app/api/services/googleCalendar/GoogleCalendarService", () => ({
  upsertCalendarEvent: upsertCalendarEventMock,
  cancelCalendarEvent: cancelCalendarEventMock,
}))

// --- EmailService ---
const sendMeetingContactNotificationEmailMock = mock(async () => ({ success: true }))
const sendMeetingInviteEmailMock = mock(async () => ({ success: true, data: { id: "resend-invite-1" } }))
const sendCloserScheduleNotificationEmailMock = mock(async () => ({ success: true }))
mock.module("@/lib/services/EmailService", () => ({
  emailService: {
    sendMeetingContactNotificationEmail: sendMeetingContactNotificationEmailMock,
    sendMeetingInviteEmail: sendMeetingInviteEmailMock,
    sendCloserScheduleNotificationEmail: sendCloserScheduleNotificationEmailMock,
  },
}))

// --- NotificationService ---
const createScheduleNotificationMock = mock(async () => undefined)
mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: { createScheduleNotification: createScheduleNotificationMock },
}))

// --- TeamAutomationDispatcherService ---
const automationDispatchMock = mock(async () => undefined)
mock.module("@/app/api/services/teamAutomation/TeamAutomationDispatcherService", () => ({
  teamAutomationDispatcherService: { dispatch: automationDispatchMock },
}))

// --- OutboundEventPublisher ---
const outboundPublishMock = mock(async () => undefined)
mock.module("@/app/api/services/teamWebhook/OutboundEventPublisher", () => ({
  outboundEventPublisher: { publish: outboundPublishMock },
}))

// --- import dinâmico dentro do método ---
const logGoogleCalendarDispatchesForRecipientsMock = mock(async () => undefined)
mock.module("@/lib/email/log-profile-email-dispatches", () => ({
  logGoogleCalendarDispatchesForRecipients: logGoogleCalendarDispatchesForRecipientsMock,
  logResendDispatchesForRecipients: mock(async () => undefined),
}))

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    leadId: LEAD_ID,
    leadName: "Lead de Teste",
    leadEmail: "lead@example.com",
    leadStatus: "new_opportunity",
    leadManagerId: CREATED_BY_ID,
    leadAssignedTo: null,
    leadAssigneeEmail: null,
    leadCurrentCloserId: CLOSER_ID,
    leadMeetingLink: null,
    leadCode: "LEAD-0001",
    closerId: CLOSER_ID,
    teamId: TEAM_ID,
    meetingDate: FIXED_MEETING_DATE,
    meetingTitle: "Reunião de teste",
    meetingNotes: undefined,
    meetingLink: undefined,
    meetingType: "online" as const,
    durationMinutes: undefined,
    extraGuests: undefined,
    createdByProfileId: CREATED_BY_ID,
    transitionStatusToScheduled: true,
    confirmNoShowSchedule: undefined,
    authorAsStudio: false,
    ...overrides,
  }
}

describe("LeadScheduleService.createSchedule — T-13.4 (snapshot pré-refatoração A-E2/A-E3/A-E4)", () => {
  beforeEach(() => {
    googleConnectionActive = null
    profileFindUniqueMock.mockClear()
    leadFindUniqueMock.mockClear()
    leadAttachmentFindManyMock.mockClear()
    teamMemberFindManyMock.mockClear()
    leadActivityCreateMock.mockClear()
    txLeadsScheduleUpsertMock.mockClear()
    txLeadUpdateMock.mockClear()
    transactionMock.mockClear()
    findLatestByLeadIdMock.mockClear()
    upsertByLeadIdWithTxMock.mockClear()
    upsertCalendarEventMock.mockClear()
    cancelCalendarEventMock.mockClear()
    sendMeetingContactNotificationEmailMock.mockClear()
    sendMeetingInviteEmailMock.mockClear()
    sendCloserScheduleNotificationEmailMock.mockClear()
    createScheduleNotificationMock.mockClear()
    automationDispatchMock.mockClear()
    outboundPublishMock.mockClear()
    logGoogleCalendarDispatchesForRecipientsMock.mockClear()
  })

  afterEach(() => {
    // dá um tick para o bloco fire-and-forget terminar antes do próximo teste
    return new Promise((resolve) => setTimeout(resolve, 0))
  })

  it("online com Google conectado: cria evento no Calendar, usa o Meet, status sent_google", async () => {
    googleConnectionActive = { refreshToken: "refresh-token", revokedAt: null }
    const { LeadScheduleService } = await import("./LeadScheduleService")
    const service = new LeadScheduleService()

    const output = await service.createSchedule(baseParams() as any)

    expect(output.isValid).toBe(true)
    expect(output.result.status).toBe("scheduled")
    expect(output.result.inviteDispatch).toEqual({
      status: "sent_google",
      provider: "google",
      fallbackUsed: false,
      attemptedAt: expect.any(String),
      error: null,
    })
    expect(output.result.meetingLink).toBe("https://meet.google.com/abc-defg-hij")
    expect(output.result.googleEventId).toBe("google-event-1")
    expect(upsertCalendarEventMock).toHaveBeenCalledTimes(1)
    expect(sendMeetingInviteEmailMock).not.toHaveBeenCalled()
    expect(sendMeetingContactNotificationEmailMock).not.toHaveBeenCalled()
    expect(sendCloserScheduleNotificationEmailMock).toHaveBeenCalledTimes(1)
    expect(cancelCalendarEventMock).not.toHaveBeenCalled()
  })

  it("online sem Google conectado, com link manual: envia convite por Resend, status sent_resend", async () => {
    googleConnectionActive = null
    const { LeadScheduleService } = await import("./LeadScheduleService")
    const service = new LeadScheduleService()

    const output = await service.createSchedule(
      baseParams({ meetingLink: "https://meet.google.com/link-manual-abc" }) as any
    )

    expect(output.isValid).toBe(true)
    expect(output.result.status).toBe("scheduled")
    expect(output.result.inviteDispatch.status).toBe("sent_resend")
    expect(output.result.inviteDispatch.provider).toBe("resend")
    expect(output.result.meetingLink).toBe("https://meet.google.com/link-manual-abc")
    expect(upsertCalendarEventMock).not.toHaveBeenCalled()
    expect(sendMeetingInviteEmailMock).toHaveBeenCalledTimes(1)
    expect(sendMeetingContactNotificationEmailMock).not.toHaveBeenCalled()
    expect(sendCloserScheduleNotificationEmailMock).toHaveBeenCalledTimes(1)
  })

  it("telefone (call): envia aviso ao lead, sem link, status sent_resend", async () => {
    googleConnectionActive = null
    const { LeadScheduleService } = await import("./LeadScheduleService")
    const service = new LeadScheduleService()

    const output = await service.createSchedule(baseParams({ meetingType: "call" }) as any)

    expect(output.isValid).toBe(true)
    expect(output.result.status).toBe("scheduled")
    expect(output.result.inviteDispatch.status).toBe("sent_resend")
    expect(output.result.inviteDispatch.provider).toBe("resend")
    expect(output.result.meetingLink).toBeNull()
    expect(sendMeetingContactNotificationEmailMock).toHaveBeenCalledTimes(1)
    expect(sendMeetingInviteEmailMock).not.toHaveBeenCalled()
    expect(upsertCalendarEventMock).not.toHaveBeenCalled()
    expect(sendCloserScheduleNotificationEmailMock).toHaveBeenCalledTimes(1)
  })
})

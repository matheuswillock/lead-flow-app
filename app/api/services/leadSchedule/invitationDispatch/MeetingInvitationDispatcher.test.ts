import { describe, expect, mock, test } from "bun:test"
import { MeetingInvitationDispatcher } from "./MeetingInvitationDispatcher"
import type { IGoogleCalendarInviteStrategy } from "./IGoogleCalendarInviteStrategy"
import type { IResendIcsInviteStrategy } from "./IResendIcsInviteStrategy"
import type { DispatchMeetingInvitationInput } from "./IMeetingInvitationDispatcher"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3.
 *
 * T-13.6 — closer com Google conectado usa a estratégia Google; sem Google,
 * usa a estratégia de e-mail — com as mesmas chamadas de hoje.
 * T-13.7 — o despachante é testável com dublês das portas, sem `prisma` nem
 * Resend de verdade: nenhum `mock.module` neste arquivo, só as duas
 * interfaces injetadas pelo construtor.
 */

function buildInput(overrides: Partial<DispatchMeetingInvitationInput> = {}): DispatchMeetingInvitationInput {
  return {
    isOnlineMeeting: true,
    canUseGoogleCalendar: true,
    leadId: "lead-1",
    leadEmail: "lead@example.com",
    leadName: "Lead de Teste",
    resolvedMeetingType: "online",
    resolvedMeetingTitle: "Reunião de teste",
    scheduleId: "schedule-1",
    teamId: "team-1",
    attendeeEmails: ["lead@example.com", "closer@example.com"],
    googleRecipients: ["lead@example.com", "closer@example.com"],
    resendRecipients: [],
    participantDispatchMetadata: {},
    normalizedMeetingLink: undefined,
    existingSchedule: null,
    closerEmail: "closer@example.com",
    closerName: "Carlos Closer",
    closerPhone: null,
    timezone: "America/Sao_Paulo",
    googleCalendarEventInput: {
      organizer: { id: "closer-1" } as any,
      lead: { id: "lead-1", name: "Lead de Teste", email: "lead@example.com" } as any,
      sdrEmail: null,
      meetingDate: new Date("2026-10-01T14:00:00Z"),
      meetingNotes: undefined,
      meetingLink: undefined,
      extraGuests: undefined,
      existingEventId: undefined,
      durationMinutes: undefined,
      transfer: undefined,
    },
    ...overrides,
  }
}

function buildStrategies() {
  const googleStrategy: IGoogleCalendarInviteStrategy = {
    dispatch: mock(async () => ({
      eventId: "google-event-1",
      calendarId: "primary",
      htmlLink: "https://calendar.google.com/x",
      meetLink: "https://meet.google.com/abc-defg-hij",
    })),
  }
  const resendStrategy: IResendIcsInviteStrategy = {
    sendParticipantInvite: mock(async () => ({ success: true, data: { id: "resend-1" } }) as any),
    sendContactNotification: mock(async () => ({ success: true }) as any),
  }
  return { googleStrategy, resendStrategy }
}

describe("MeetingInvitationDispatcher — T-13.6/T-13.7", () => {
  test("closer com Google conectado (online): usa a estratégia Google, não chama a de e-mail", async () => {
    const { googleStrategy, resendStrategy } = buildStrategies()
    const dispatcher = new MeetingInvitationDispatcher(googleStrategy, resendStrategy)

    const result = await dispatcher.dispatch(buildInput())

    expect(result.ok).toBe(true)
    expect(googleStrategy.dispatch).toHaveBeenCalledTimes(1)
    expect(resendStrategy.sendParticipantInvite).not.toHaveBeenCalled()
    expect(resendStrategy.sendContactNotification).not.toHaveBeenCalled()
    if (result.ok) {
      expect(result.inviteDispatchStatus).toBe("sent_google")
      expect(result.inviteDispatchProvider).toBe("google")
      expect(result.resolvedMeetingLink).toBe("https://meet.google.com/abc-defg-hij")
    }
  })

  test("closer sem Google (online, com link manual): usa a estratégia de e-mail, não chama a do Google", async () => {
    const { googleStrategy, resendStrategy } = buildStrategies()
    const dispatcher = new MeetingInvitationDispatcher(googleStrategy, resendStrategy)

    const result = await dispatcher.dispatch(
      buildInput({
        canUseGoogleCalendar: false,
        googleRecipients: [],
        resendRecipients: ["lead@example.com", "closer@example.com"],
        googleCalendarEventInput: {
          ...buildInput().googleCalendarEventInput,
          meetingLink: "https://meet.google.com/link-manual",
        },
        normalizedMeetingLink: "https://meet.google.com/link-manual",
      })
    )

    expect(result.ok).toBe(true)
    expect(googleStrategy.dispatch).not.toHaveBeenCalled()
    expect(resendStrategy.sendParticipantInvite).toHaveBeenCalledTimes(1)
    if (result.ok) {
      expect(result.inviteDispatchStatus).toBe("sent_resend")
      expect(result.inviteDispatchProvider).toBe("resend")
    }
  })

  test("telefone/WhatsApp: usa sendContactNotification, nunca sendParticipantInvite", async () => {
    const { googleStrategy, resendStrategy } = buildStrategies()
    const dispatcher = new MeetingInvitationDispatcher(googleStrategy, resendStrategy)

    const result = await dispatcher.dispatch(
      buildInput({
        isOnlineMeeting: false,
        canUseGoogleCalendar: false,
        resolvedMeetingType: "call",
        googleRecipients: [],
        resendRecipients: [],
      })
    )

    expect(result.ok).toBe(true)
    expect(resendStrategy.sendContactNotification).toHaveBeenCalledTimes(1)
    expect(resendStrategy.sendParticipantInvite).not.toHaveBeenCalled()
    expect(googleStrategy.dispatch).not.toHaveBeenCalled()
  })

  test("falha da estratégia Google → ok:false, com evento de atividade de falha", async () => {
    const { resendStrategy } = buildStrategies()
    const googleStrategy: IGoogleCalendarInviteStrategy = {
      dispatch: mock(async () => {
        throw new Error("Google indisponível")
      }),
    }
    const dispatcher = new MeetingInvitationDispatcher(googleStrategy, resendStrategy)

    const result = await dispatcher.dispatch(buildInput())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorMessage).toContain("Google indisponível")
      expect(result.activityEvents).toHaveLength(1)
      expect(result.activityEvents[0]?.status).toBe("failed")
    }
  })
})

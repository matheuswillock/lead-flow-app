import type { BackofficeUser } from "@prisma/client"

export type BackofficeCalendarOrganizer = Pick<
  BackofficeUser,
  | "id"
  | "email"
  | "googleAccessToken"
  | "googleRefreshToken"
  | "googleTokenExpiresAt"
  | "googleCalendarConnected"
  | "timezone"
>

export interface BackofficeCalendarEventInput {
  organizer: BackofficeCalendarOrganizer
  leadId: string
  leadName: string
  leadEmail?: string | null
  closerEmail?: string | null
  meetingDate: Date
  meetingTitle: string
  meetingNotes?: string | null
  meetingLink?: string | null
  extraGuests?: string[]
  existingEventId?: string | null
}

export interface BackofficeCalendarEventResult {
  eventId: string
  calendarId: string
  htmlLink: string | null
  meetLink: string | null
}

export type BackofficeCalendarAttendeeResponseStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction"

export interface BackofficeCalendarAttendee {
  email: string
  displayName: string | null
  responseStatus: BackofficeCalendarAttendeeResponseStatus
  organizer?: boolean
  self?: boolean
}

export interface IBackofficeGoogleCalendarService {
  getBusyIntervals(input: {
    organizer: BackofficeCalendarOrganizer
    timeMin: string
    timeMax: string
    calendarId?: string
  }): Promise<Array<{ start: string; end: string }>>
  upsertEvent(input: BackofficeCalendarEventInput): Promise<BackofficeCalendarEventResult>
  cancelEvent(input: {
    organizer: BackofficeCalendarOrganizer
    eventId: string
    calendarId?: string
  }): Promise<void>
  getEventAttendees(input: {
    organizer: BackofficeCalendarOrganizer
    eventId: string
    calendarId?: string
  }): Promise<BackofficeCalendarAttendee[]>
}

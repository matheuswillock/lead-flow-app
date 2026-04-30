import { prisma } from "@/app/api/infra/data/prisma"
import { DEFAULT_TZ, resolveTimezone } from "@/lib/dates"
import type {
  BackofficeCalendarAttendee,
  BackofficeCalendarEventInput,
  BackofficeCalendarEventResult,
  BackofficeCalendarOrganizer,
  IBackofficeGoogleCalendarService,
} from "./IBackofficeGoogleCalendarService"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const CALENDAR_DURATION_MINUTES = 30
const LOG_PREFIX = "[BackofficeGoogleCalendarService]"

type GoogleTokenResult = {
  access_token: string
  expires_in: number
  refresh_token?: string
}

type ParsedGoogleError = {
  message: string | null
  code: number | null
  status: string | null
}

function parseGoogleError(rawBody: string): ParsedGoogleError {
  if (!rawBody) return { message: null, code: null, status: null }
  try {
    const payload = JSON.parse(rawBody) as {
      error?: { message?: string; code?: number; status?: string } | string
      error_description?: string
      message?: string
    }
    const errorObject = payload.error
    const message =
      (typeof errorObject === "object" && typeof errorObject?.message === "string"
        ? errorObject.message
        : null) ||
      (typeof payload.error_description === "string" ? payload.error_description : null) ||
      (typeof errorObject === "string" ? errorObject : null) ||
      (typeof payload.message === "string" ? payload.message : null)
    const code =
      typeof errorObject === "object" && typeof errorObject?.code === "number"
        ? errorObject.code
        : null
    const status =
      typeof errorObject === "object" && typeof errorObject?.status === "string"
        ? errorObject.status
        : null

    return { message, code, status }
  } catch {
    return { message: null, code: null, status: null }
  }
}

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google OAuth não configuradas")
  }

  return { clientId, clientSecret }
}

function getEventEnd(start: Date) {
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + CALENDAR_DURATION_MINUTES)
  return end
}

function normalizeEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const emails: string[] = []

  values.forEach((value) => {
    const email = value?.trim().toLowerCase()
    if (!email || seen.has(email)) return
    seen.add(email)
    emails.push(email)
  })

  return emails
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResult> {
  const { clientId, clientSecret } = getOAuthCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  })

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "")
    const googleError = parseGoogleError(rawBody)
    console.error(`${LOG_PREFIX} Token refresh failed`, {
      status: response.status,
      googleError,
      responseBody: rawBody,
    })
    throw new Error(googleError.message || "Falha ao renovar token Google")
  }

  return response.json() as Promise<GoogleTokenResult>
}

async function getValidAccessToken(organizer: BackofficeCalendarOrganizer) {
  const now = Date.now()
  const expiresAt = organizer.googleTokenExpiresAt?.getTime() ?? 0

  if (organizer.googleAccessToken && expiresAt > now + 60_000) {
    return organizer.googleAccessToken
  }

  if (!organizer.googleRefreshToken) {
    throw new Error("Conta Google do backoffice não conectada")
  }

  const refreshed = await refreshAccessToken(organizer.googleRefreshToken)
  const expiresAtDate = new Date(Date.now() + refreshed.expires_in * 1000)

  await prisma.backofficeUser.update({
    where: { id: organizer.id },
    data: {
      googleAccessToken: refreshed.access_token,
      googleRefreshToken: refreshed.refresh_token ?? organizer.googleRefreshToken,
      googleTokenExpiresAt: expiresAtDate,
      googleCalendarConnected: true,
    },
  })

  return refreshed.access_token
}

async function googleCalendarFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "")
    const googleError = parseGoogleError(rawBody)
    console.error(`${LOG_PREFIX} Request failed`, {
      url,
      method: options.method || "GET",
      status: response.status,
      googleError,
      responseBody: rawBody,
    })
    throw new Error(googleError.message || `Erro na API Google Calendar: ${response.status}`)
  }

  if (response.status === 204) return null as T
  const rawBody = await response.text().catch(() => "")
  if (!rawBody) return null as T
  return JSON.parse(rawBody) as T
}

export class BackofficeGoogleCalendarService
  implements IBackofficeGoogleCalendarService
{
  async getBusyIntervals({
    organizer,
    timeMin,
    timeMax,
    calendarId = "primary",
  }: {
    organizer: BackofficeCalendarOrganizer
    timeMin: string
    timeMax: string
    calendarId?: string
  }) {
    const accessToken = await getValidAccessToken(organizer)
    const timezone = resolveTimezone(organizer.timezone ?? DEFAULT_TZ)
    const response = await googleCalendarFetch<{
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
    }>(`${GOOGLE_CALENDAR_API}/freeBusy`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: calendarId }],
      }),
    })

    return response?.calendars?.[calendarId]?.busy ?? []
  }

  async upsertEvent(input: BackofficeCalendarEventInput): Promise<BackofficeCalendarEventResult> {
    const accessToken = await getValidAccessToken(input.organizer)
    const calendarId = "primary"
    const timezone = resolveTimezone(input.organizer.timezone ?? DEFAULT_TZ)
    const endTime = getEventEnd(input.meetingDate)
    const attendeeEmails = normalizeEmails([
      input.leadEmail,
      input.closerEmail,
      ...(input.extraGuests ?? []),
    ])
    const body: Record<string, unknown> = {
      summary: input.meetingTitle,
      description: [
        "Demonstração agendada pelo Backoffice Corretor Studio.",
        `Lead: ${input.leadName}`,
        input.meetingNotes ? `Notas: ${input.meetingNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: input.meetingDate.toISOString(), timeZone: timezone },
      end: { dateTime: endTime.toISOString(), timeZone: timezone },
      attendees: attendeeEmails.map((email) => ({ email })),
    }

    if (input.meetingLink?.trim()) {
      body.location = input.meetingLink.trim()
    } else {
      body.conferenceData = {
        createRequest: {
          requestId: `backoffice${input.leadId.replace(/-/g, "")}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      }
    }

    const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    const params = "?sendUpdates=all&conferenceDataVersion=1"

    const event = input.existingEventId
      ? await googleCalendarFetch<{
          id: string
          htmlLink?: string
          hangoutLink?: string
        }>(`${baseUrl}/${encodeURIComponent(input.existingEventId)}${params}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      : await googleCalendarFetch<{
          id: string
          htmlLink?: string
          hangoutLink?: string
        }>(`${baseUrl}${params}`, accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        })

    return {
      eventId: event.id,
      calendarId,
      htmlLink: event.htmlLink ?? null,
      meetLink: event.hangoutLink ?? null,
    }
  }

  async cancelEvent({
    organizer,
    eventId,
    calendarId = "primary",
  }: {
    organizer: BackofficeCalendarOrganizer
    eventId: string
    calendarId?: string
  }) {
    const accessToken = await getValidAccessToken(organizer)
    const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    await googleCalendarFetch<void>(
      `${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      accessToken,
      { method: "DELETE" }
    )
  }

  async getEventAttendees({
    organizer,
    eventId,
    calendarId = "primary",
  }: {
    organizer: BackofficeCalendarOrganizer
    eventId: string
    calendarId?: string
  }): Promise<BackofficeCalendarAttendee[]> {
    const accessToken = await getValidAccessToken(organizer)
    const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    const event = await googleCalendarFetch<{
      attendees?: Array<{
        email?: string
        displayName?: string
        responseStatus?: BackofficeCalendarAttendee["responseStatus"]
        organizer?: boolean
        self?: boolean
      }>
    }>(`${baseUrl}/${encodeURIComponent(eventId)}?fields=attendees`, accessToken, {
      method: "GET",
    })

    return (event.attendees ?? [])
      .filter((attendee) => attendee.email)
      .map((attendee) => ({
        email: attendee.email ?? "",
        displayName: attendee.displayName ?? null,
        responseStatus: attendee.responseStatus ?? "needsAction",
        organizer: attendee.organizer ?? false,
        self: attendee.self ?? false,
      }))
  }
}

export const backofficeGoogleCalendarService =
  new BackofficeGoogleCalendarService()

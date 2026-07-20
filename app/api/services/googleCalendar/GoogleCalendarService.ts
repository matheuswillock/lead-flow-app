import type { Lead, GoogleOAuthConnection } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleOAuthConnectionRepository } from "@/app/api/infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository";
import { DEFAULT_TZ, resolveTimezone } from "@/lib/dates";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_LOG_PREFIX = "[GoogleAPI]";
const GOOGLE_REQUEST_TIMEOUT_MS = 5_000;

type GoogleTokenResult = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type CalendarEventResult = {
  eventId: string;
  calendarId: string;
  htmlLink?: string | null;
  meetLink?: string | null;
};

type GoogleErrorDetail = {
  message?: string;
  reason?: string;
  domain?: string;
  location?: string;
  locationType?: string;
};

type ParsedGoogleError = {
  message: string | null;
  code: number | null;
  status: string | null;
  errors?: GoogleErrorDetail[];
};

const parseGoogleError = (rawBody: string): ParsedGoogleError => {
  if (!rawBody) {
    return { message: null, code: null, status: null };
  }

  try {
    const payload = JSON.parse(rawBody) as any;
    const errorObject = payload?.error;
    const message =
      (typeof errorObject?.message === "string" && errorObject.message) ||
      (typeof payload?.error_description === "string" && payload.error_description) ||
      (typeof errorObject === "string" && errorObject) ||
      (typeof payload?.message === "string" && payload.message) ||
      null;
    const code = typeof errorObject?.code === "number" ? errorObject.code : null;
    const status = typeof errorObject?.status === "string" ? errorObject.status : null;
    const errors = Array.isArray(errorObject?.errors) ? (errorObject.errors as GoogleErrorDetail[]) : undefined;

    return { message, code, status, errors };
  } catch {
    return { message: null, code: null, status: null };
  }
};

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google OAuth nao configuradas");
  }

  return { clientId, clientSecret };
}

function getEventEnd(start: Date, durationMinutes = 30) {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMinutes);
  return end;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResult> {
  const { clientId, clientSecret } = getOAuthCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    const googleError = parseGoogleError(rawBody);

    console.error(`${GOOGLE_LOG_PREFIX} Token refresh failed`, {
      status: response.status,
      statusText: response.statusText,
      googleError,
      responseBody: rawBody,
    });

    const message =
      googleError.message ||
      "Falha ao renovar token Google";
    throw new Error(message);
  }

  return response.json() as Promise<GoogleTokenResult>;
}

export type CorretorStudioOrganizer = {
  profileId: string;
  supabaseId: string | null;
  timezone: string;
  connection: GoogleOAuthConnection;
};

type LegacyOrganizerInput = {
  id: string;
  supabaseId: string | null;
  timezone?: string | null;
  googleConnectionId?: string | null;
  googleEmail?: string | null;
};

async function resolveOrganizerConnection(
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput
): Promise<CorretorStudioOrganizer> {
  if ("connection" in organizer) {
    return organizer;
  }

  const connection =
    (organizer.googleConnectionId
      ? await googleOAuthConnectionRepository.findById(organizer.googleConnectionId)
      : null) ||
    (organizer.googleEmail
      ? await googleOAuthConnectionRepository.findByGoogleEmail(organizer.googleEmail)
      : null)

  if (!connection) {
    throw new Error("Conta Google nao conectada ou conexao invalida")
  }

  return {
    profileId: organizer.id,
    supabaseId: organizer.supabaseId,
    timezone: organizer.timezone ?? DEFAULT_TZ,
    connection,
  }
}

async function getValidAccessToken(
  organizerInput: CorretorStudioOrganizer | LegacyOrganizerInput
): Promise<string> {
  const organizer = await resolveOrganizerConnection(organizerInput)
  const { connection } = organizer;
  const now = Date.now();
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;

  if (connection.accessToken && expiresAt > now + 60_000) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error("Conta Google nao conectada ou refresh token ausente");
  }

  if (!organizer.supabaseId) {
    throw new Error("Supabase ID nao encontrado para renovar token Google");
  }

  const refreshed = await refreshAccessToken(connection.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await googleOAuthConnectionRepository.updateTokens(connection.id, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? connection.refreshToken,
    tokenExpiresAt: newExpiresAt,
    lastRefreshedAt: new Date(),
    lastRefreshError: null,
  })
  await profileRepository.updateGoogleCalendarAuth(organizer.supabaseId, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? connection.refreshToken,
    expiresAt: newExpiresAt,
    connected: true,
  })

  return refreshed.access_token;
}

async function googleCalendarFetch<T>(url: string, accessToken: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    const googleError = parseGoogleError(rawBody);
    const requestHeaders = new Headers({
      "Content-Type": "application/json",
      ...(options.headers || {}),
    });
    requestHeaders.delete("Authorization");
    const requestBody =
      typeof options.body === "string" ? options.body : JSON.stringify(options.body ?? null);

    console.error("[GoogleCalendar] Request failed", {
      url,
      method: options.method || "GET",
      requestHeaders: Object.fromEntries(requestHeaders.entries()),
      requestBody,
      status: response.status,
      statusText: response.statusText,
      googleError,
      responseBody: rawBody,
    });
    const message =
      googleError.message ||
      `Erro na API Google Calendar: ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  const rawBody = await response.text().catch(() => "");
  if (!rawBody) {
    return null as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null as T;
  }
}

export async function getCalendarBusyIntervals({
  organizer,
  timeMin,
  timeMax,
  calendarId = "primary",
}: {
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput;
  timeMin: string;
  timeMax: string;
  calendarId?: string;
}): Promise<Array<{ start: string; end: string }>> {
  const accessToken = await getValidAccessToken(organizer);
  const url = `${GOOGLE_CALENDAR_API}/freeBusy`;
  const resolvedOrganizer = await resolveOrganizerConnection(organizer)
  const organizerTimezone = resolveTimezone(resolvedOrganizer.timezone || DEFAULT_TZ);
  const body = {
    timeMin,
    timeMax,
    timeZone: organizerTimezone,
    items: [{ id: calendarId }],
  };

  const response = await googleCalendarFetch<any>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });

  const busy = response?.calendars?.[calendarId]?.busy;
  if (!Array.isArray(busy)) {
    return [];
  }

  return busy
    .filter((item: any) => item?.start && item?.end)
    .map((item: any) => ({ start: item.start, end: item.end }));
}

export type AttendeeResponseStatus = "accepted" | "declined" | "tentative" | "needsAction";

export type CalendarAttendee = {
  email: string;
  displayName?: string | null;
  responseStatus: AttendeeResponseStatus;
  organizer?: boolean;
  self?: boolean;
};

export async function getCalendarEventAttendees({
  organizer,
  eventId,
  calendarId = "primary",
}: {
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput;
  eventId: string;
  calendarId?: string;
}): Promise<CalendarAttendee[]> {
  const accessToken = await getValidAccessToken(organizer);
  const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const event = await googleCalendarFetch<any>(
    `${baseUrl}/${encodeURIComponent(eventId)}?fields=attendees`,
    accessToken,
    { method: "GET" }
  );
  if (!Array.isArray(event?.attendees)) return [];
  return (event.attendees as any[]).map((a) => ({
    email: a.email ?? "",
    displayName: a.displayName ?? null,
    responseStatus: (a.responseStatus ?? "needsAction") as AttendeeResponseStatus,
    organizer: a.organizer ?? false,
    self: a.self ?? false,
  }));
}

export async function resendCalendarInvite({
  organizer,
  eventId,
  calendarId = "primary",
  attendeeEmails,
}: {
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput;
  eventId: string;
  calendarId?: string;
  attendeeEmails?: string[];
}): Promise<void> {
  const accessToken = await getValidAccessToken(organizer);
  const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;

  const event = await googleCalendarFetch<any>(
    `${baseUrl}/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "GET" }
  );

  const body: Record<string, unknown> = {
    summary: event.summary,
    description: "Reunião agendada pelo Corretor Studio.",
    start: event.start,
    end: event.end,
    attendees: attendeeEmails
      ? attendeeEmails.map((email) => ({ email }))
      : event.attendees,
  };

  if (event.location) {
    body.location = event.location;
  }

  await googleCalendarFetch<any>(
    `${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=all`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export async function cancelCalendarEvent({
  organizer,
  eventId,
  calendarId = "primary",
}: {
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput;
  eventId: string;
  calendarId?: string;
}): Promise<void> {
  const accessToken = await getValidAccessToken(organizer);
  const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  await googleCalendarFetch<any>(
    `${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=all`,
    accessToken,
    { method: "DELETE" }
  );
}

export async function upsertCalendarEvent({
  organizer,
  lead,
  closerEmail,
  sdrEmail,
  meetingDate,
  meetingTitle,
  notes: _notes,
  meetingLink,
  extraGuests,
  attendeeEmails,
  existingEventId,
  durationMinutes,
}: {
  organizer: CorretorStudioOrganizer | LegacyOrganizerInput;
  lead: Lead;
  closerEmail?: string | null;
  sdrEmail?: string | null;
  meetingDate: Date;
  meetingTitle?: string | null;
  notes?: string | null;
  meetingLink?: string | null;
  extraGuests?: string[];
  attendeeEmails?: string[];
  existingEventId?: string | null;
  durationMinutes?: number;
}): Promise<CalendarEventResult> {
  const accessToken = await getValidAccessToken(organizer);
  const resolvedOrganizer = await resolveOrganizerConnection(organizer)
  const organizerTimezone = resolveTimezone(resolvedOrganizer.timezone || DEFAULT_TZ);

  const calendarId = "primary";
  const requestId = `lead${lead.id.replace(/-/g, "")}`;
  const resolvedDuration =
    Number.isFinite(durationMinutes) && (durationMinutes as number) >= 5 && (durationMinutes as number) <= 480
      ? Math.floor(durationMinutes as number)
      : 30;
  const endTime = getEventEnd(meetingDate, resolvedDuration);
  const normalizedAttendeeEmails = (attendeeEmails && attendeeEmails.length > 0
    ? attendeeEmails
    : [
        lead.email,
        closerEmail,
        sdrEmail,
        ...(extraGuests ?? []),
      ])
    .filter(Boolean)
    .map((email) => (email as string).trim().toLowerCase())
    .filter((email, index, list) => list.indexOf(email) === index);
  const attendees = normalizedAttendeeEmails.map((email) => ({ email }));

  const summary = meetingTitle || `Estudo Plano de Saúde: ${lead.name}`;
  const description = "Reunião agendada pelo Corretor Studio.";
  const body: Record<string, unknown> = {
    summary,
    description,
    start: { dateTime: meetingDate.toISOString(), timeZone: organizerTimezone },
    end: { dateTime: endTime.toISOString(), timeZone: organizerTimezone },
    attendees,
  };

  if (meetingLink) {
    body.location = meetingLink;
  } else {
    body.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const baseUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const params = "?sendUpdates=all&conferenceDataVersion=1";

  if (existingEventId) {
    body.id = existingEventId;
    const updated = await googleCalendarFetch<any>(
      `${baseUrl}/${encodeURIComponent(existingEventId)}${params}`,
      accessToken,
      { method: "PUT", body: JSON.stringify(body) }
    );

    return {
      eventId: updated.id,
      calendarId,
      htmlLink: updated.htmlLink ?? null,
      meetLink: updated.hangoutLink ?? null,
    };
  }

  const created = await googleCalendarFetch<any>(`${baseUrl}${params}`, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    eventId: created.id,
    calendarId,
    htmlLink: created.htmlLink ?? null,
    meetLink: created.hangoutLink ?? null,
  };
}

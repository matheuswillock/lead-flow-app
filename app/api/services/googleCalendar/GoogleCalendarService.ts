import type { Profile, Lead } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

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

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google OAuth nao configuradas");
  }

  return { clientId, clientSecret };
}

function getEventEnd(start: Date) {
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
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
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error_description || payload.error || "Falha ao renovar token Google";
    throw new Error(message);
  }

  return response.json() as Promise<GoogleTokenResult>;
}

async function getValidAccessToken(profile: Profile): Promise<string> {
  const now = Date.now();
  const expiresAt = profile.googleTokenExpiresAt?.getTime() ?? 0;

  if (profile.googleAccessToken && expiresAt > now + 60_000) {
    return profile.googleAccessToken;
  }

  if (!profile.googleRefreshToken) {
    throw new Error("Conta Google nao conectada ou refresh token ausente");
  }

  if (!profile.supabaseId) {
    throw new Error("Supabase ID nao encontrado para renovar token Google");
  }

  const refreshed = await refreshAccessToken(profile.googleRefreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await profileRepository.updateGoogleCalendarAuth(profile.supabaseId, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? profile.googleRefreshToken,
    expiresAt: newExpiresAt,
    connected: true,
  });

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
    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = {};
    }
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
      responseBody: rawBody,
    });
    const message =
      payload.error?.message ||
      payload.error_description ||
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

export async function resendCalendarInvite({
  organizer,
  eventId,
  calendarId = "primary",
}: {
  organizer: Profile;
  eventId: string;
  calendarId?: string;
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
    description: event.description,
    start: event.start,
    end: event.end,
    attendees: event.attendees,
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
  organizer: Profile;
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
  meetingDate,
  meetingTitle,
  notes,
  meetingLink,
  extraGuests,
  existingEventId,
}: {
  organizer: Profile;
  lead: Lead;
  closerEmail?: string | null;
  meetingDate: Date;
  meetingTitle?: string | null;
  notes?: string | null;
  meetingLink?: string | null;
  extraGuests?: string[];
  existingEventId?: string | null;
}): Promise<CalendarEventResult> {
  const accessToken = await getValidAccessToken(organizer);

  const calendarId = "primary";
  const requestId = `lead${lead.id.replace(/-/g, "")}`;
  const endTime = getEventEnd(meetingDate);
  const attendeeEmails = [
    lead.email,
    closerEmail,
    organizer.email,
    ...(extraGuests ?? []),
  ]
    .filter(Boolean)
    .map((email) => (email as string).trim().toLowerCase())
    .filter((email, index, list) => list.indexOf(email) === index);
  const attendees = attendeeEmails.map((email) => ({ email }));

  const summary = meetingTitle || `Reuniao com ${lead.name}`;
  const body: Record<string, unknown> = {
    summary,
    description: notes || `Lead ${lead.name} agendado pelo Lead Flow`,
    start: { dateTime: meetingDate.toISOString(), timeZone: DEFAULT_TIMEZONE },
    end: { dateTime: endTime.toISOString(), timeZone: DEFAULT_TIMEZONE },
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

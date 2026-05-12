import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import { DEFAULT_TZ, resolveTimezone } from "@/lib/dates";
import type {
  ITaskGoogleCalendarService,
  TaskGoogleSyncResult,
  CreateTaskCalendarEventInput,
  CancelTaskCalendarEventInput,
} from "./ITaskGoogleCalendarService";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
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
    const text = await response.text().catch(() => "");
    throw new Error(`Token refresh failed: ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return data.access_token;
}

async function getValidAccessToken(
  profile: { googleAccessToken: string | null; googleRefreshToken: string | null; googleTokenExpiresAt: Date | null },
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = Date.now();
  const expiresAt = profile.googleTokenExpiresAt?.getTime() ?? 0;

  if (profile.googleAccessToken && expiresAt > now + 60_000) {
    return profile.googleAccessToken;
  }

  if (!profile.googleRefreshToken) {
    throw new Error("Google não conectado ou refresh token ausente");
  }

  return refreshAccessToken(profile.googleRefreshToken, clientId, clientSecret);
}

async function createGoogleEvent({
  accessToken,
  timezone,
  summary,
  description,
  startAt,
  endAt,
}: {
  accessToken: string;
  timezone: string;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
}): Promise<string> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=none`;
  const body = {
    summary,
    description,
    start: { dateTime: startAt.toISOString(), timeZone: timezone },
    end: { dateTime: endAt.toISOString(), timeZone: timezone },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Calendar create failed: ${text}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Calendar delete failed: ${text}`);
  }
}

class TaskGoogleCalendarService implements ITaskGoogleCalendarService {
  async createEventsForAssignees(input: CreateTaskCalendarEventInput): Promise<TaskGoogleSyncResult[]> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return input.assigneeProfileIds.map((profileId) => ({
        profileId,
        googleSynced: false,
        googleEventId: null,
        reason: "Google OAuth não configurado",
      }));
    }

    const profiles = await taskRepository.findProfilesWithGoogleForTask(input.assigneeProfileIds);
    const connectedById = new Map(profiles.map((p) => [p.id, p]));
    const results: TaskGoogleSyncResult[] = [];

    const now = new Date();
    const defaultStart = input.startAt ?? now;
    const defaultEnd = input.endAt ?? new Date(defaultStart.getTime() + 60 * 60 * 1000);

    for (const profileId of input.assigneeProfileIds) {
      const profile = connectedById.get(profileId);
      if (!profile) {
        results.push({ profileId, googleSynced: false, googleEventId: null, reason: "Google Calendar não conectado" });
        continue;
      }

      try {
        const accessToken = await getValidAccessToken(profile, clientId, clientSecret);
        const tz = resolveTimezone(profile.timezone ?? DEFAULT_TZ);
        const urgentLabel = input.isUrgent ? "[URGENTE] " : "";
        const summary = `${urgentLabel}Tarefa: ${input.leadName}`;

        const eventId = await createGoogleEvent({
          accessToken,
          timezone: tz,
          summary,
          description: input.body,
          startAt: defaultStart,
          endAt: defaultEnd,
        });

        await taskRepository.updateAssigneeGoogleSync(input.taskId, profileId, {
          googleEventId: eventId,
          googleCalendarId: "primary",
          googleSynced: true,
        });

        results.push({ profileId, googleSynced: true, googleEventId: eventId });
      } catch (err) {
        console.error("[TaskGoogleCalendarService] Falha ao criar evento", { profileId, err });
        results.push({
          profileId,
          googleSynced: false,
          googleEventId: null,
          reason: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    return results;
  }

  async cancelEventForAssignee(input: CancelTaskCalendarEventInput): Promise<void> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return;

    const profiles = await taskRepository.findProfilesWithGoogleForTask([input.assigneeProfileId]);
    const profile = profiles[0];
    if (!profile?.googleRefreshToken) return;

    try {
      const accessToken = await getValidAccessToken(profile, clientId, clientSecret);
      await deleteGoogleEvent(accessToken, input.googleEventId);
    } catch (err) {
      console.error("[TaskGoogleCalendarService] Falha ao cancelar evento", { profileId: input.assigneeProfileId, err });
    }
  }
}

export const taskGoogleCalendarService = new TaskGoogleCalendarService();

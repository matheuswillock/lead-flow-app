import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import { getFullUrl } from "@/lib/utils/app-url";
import type {
  ITaskGoogleCalendarService,
  TaskGoogleSyncResult,
  CreateTaskCalendarEventInput,
  CancelTaskCalendarEventInput,
} from "./ITaskGoogleCalendarService";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

function parseGoogleErrorMessage(rawBody: string): string {
  if (!rawBody) return "Erro desconhecido na integração Google";

  try {
    const payload = JSON.parse(rawBody) as {
      error?:
        | string
        | {
            message?: string;
          };
      error_description?: string;
      message?: string;
    };

    if (typeof payload.error === "string" && payload.error) return payload.error;
    const googleError = typeof payload.error === "object" && payload.error !== null ? payload.error : null;
    if (typeof googleError?.message === "string" && googleError.message) return googleError.message;
    if (typeof payload.error_description === "string" && payload.error_description) return payload.error_description;
    if (typeof payload.message === "string" && payload.message) return payload.message;
  } catch {
    // no-op
  }

  return rawBody;
}

function toUserFacingGoogleTaskError(rawError: string): string {
  const normalized = rawError.toLowerCase();

  if (normalized.includes("insufficient authentication scopes")) {
    return "a conta Google está conectada sem as permissões necessárias para criar tarefas. Reconecte o Google na tela de Conta e tente novamente.";
  }

  return rawError;
}

function buildLeadCardUrl(supabaseId: string | null, leadCode: string): string | null {
  if (!supabaseId) return null;
  return getFullUrl(`/${supabaseId}/crm?leadCode=${encodeURIComponent(leadCode)}`);
}

function buildTaskNotes(body: string, leadCardUrl: string | null): string {
  const trimmedBody = body.trim();
  if (!leadCardUrl) return trimmedBody;
  if (!trimmedBody) return `Lead no Corretor Studio:\n${leadCardUrl}`;
  return `${trimmedBody}\n\nLead no Corretor Studio:\n${leadCardUrl}`;
}

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
    throw new Error(parseGoogleErrorMessage(text));
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

async function createGoogleTask({
  accessToken,
  title,
  notes,
  dueAt,
}: {
  accessToken: string;
  title: string;
  notes: string;
  dueAt: Date | null;
}): Promise<string> {
  const url = `${GOOGLE_TASKS_API}/lists/@default/tasks`;
  const body = {
    title,
    notes,
    ...(dueAt ? { due: dueAt.toISOString() } : {}),
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
    throw new Error(parseGoogleErrorMessage(text));
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function deleteGoogleTask(accessToken: string, taskId: string): Promise<void> {
  const url = `${GOOGLE_TASKS_API}/lists/@default/tasks/${encodeURIComponent(taskId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const text = await response.text().catch(() => "");
    throw new Error(parseGoogleErrorMessage(text));
  }
}

async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const text = await response.text().catch(() => "");
    throw new Error(parseGoogleErrorMessage(text));
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
    const taskDueAt = input.endAt ?? input.startAt ?? null;

    for (const profileId of input.assigneeProfileIds) {
      const profile = connectedById.get(profileId);
      if (!profile) {
        results.push({ profileId, googleSynced: false, googleEventId: null, reason: "Google não conectado" });
        continue;
      }

      try {
        const accessToken = await getValidAccessToken(profile, clientId, clientSecret);
        const urgentLabel = input.isUrgent ? "[URGENTE] " : "";
        const title = `${urgentLabel}${input.taskTitle} • Lead: ${input.leadName}`;
        const leadCardUrl = buildLeadCardUrl(profile.supabaseId, input.leadCode);
        const notes = buildTaskNotes(input.body, leadCardUrl);

        const remoteTaskId = await createGoogleTask({
          accessToken,
          title,
          notes,
          dueAt: taskDueAt,
        });

        await taskRepository.updateAssigneeGoogleSync(input.taskId, profileId, {
          googleEventId: remoteTaskId,
          googleCalendarId: "@default",
          googleSynced: true,
        });

        results.push({ profileId, googleSynced: true, googleEventId: remoteTaskId });
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : "Erro desconhecido";
        const reason = toUserFacingGoogleTaskError(rawMessage);
        console.error("[TaskGoogleCalendarService] Falha ao criar task no Google", { profileId, err });
        results.push({
          profileId,
          googleSynced: false,
          googleEventId: null,
          reason,
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
      const isLegacyCalendarEvent = input.googleCalendarId === "primary";

      if (isLegacyCalendarEvent) {
        await deleteGoogleEvent(accessToken, input.googleEventId);
        return;
      }

      try {
        await deleteGoogleTask(accessToken, input.googleEventId);
      } catch (taskError) {
        console.warn("[TaskGoogleCalendarService] Falha ao remover Google Task, tentando fallback para evento legado", {
          profileId: input.assigneeProfileId,
          googleEventId: input.googleEventId,
          googleCalendarId: input.googleCalendarId,
          taskError: taskError instanceof Error ? taskError.message : String(taskError),
        });
        await deleteGoogleEvent(accessToken, input.googleEventId);
      }
    } catch (err) {
      console.error("[TaskGoogleCalendarService] Falha ao cancelar item no Google", {
        profileId: input.assigneeProfileId,
        googleEventId: input.googleEventId,
        googleCalendarId: input.googleCalendarId,
        err,
      });
    }
  }
}

export const taskGoogleCalendarService = new TaskGoogleCalendarService();

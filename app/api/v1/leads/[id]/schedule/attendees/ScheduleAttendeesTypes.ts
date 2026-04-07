export type AttendeeRole = "closer" | "sdr" | "lead" | "extra";

export type AttendeeResponseStatus = "accepted" | "declined" | "tentative" | "needsAction";

export type ScheduleAttendee = {
  email: string;
  displayName: string | null;
  role: AttendeeRole;
  responseStatus: AttendeeResponseStatus;
};

export type GetScheduleAttendeesInput = {
  leadId: string;
  teamId: string;
  /** Hints de email enviados pelo frontend a partir do contexto já carregado — evitam re-busca do lead */
  hints?: {
    closerEmail?: string | null;
    sdrEmail?: string | null;
    leadEmail?: string | null;
  };
};

export type GetScheduleAttendeesResult = {
  attendees: ScheduleAttendee[];
  hasGoogleData: boolean;
  scheduleId: string;
};

/** Dados mínimos do closer necessários para autenticar com o Google Calendar */
export type LeadCloserForCalendar = {
  id: string;
  supabaseId: string;
  fullName: string | null;
  email: string;
  googleCalendarConnected: boolean;
  googleRefreshToken: string | null;
  googleAccessToken: string | null;
  googleTokenExpiresAt: Date | null;
};

/** Dados do lead necessários para montar o roleMap sem hints */
export type LeadForAttendeesRoleMap = {
  teamId: string | null;
  email: string | null;
  closer: LeadCloserForCalendar | null;
  assignee: { email: string } | null;
};

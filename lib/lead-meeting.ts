export type LeadMeetingHeald = "yes" | "no" | null | undefined;

export const MEETING_FOLLOW_UP_DAYS = 3;
export const MEETING_FOLLOW_UP_EMAIL_MAX_PER_DAY = 2;
export const MEETING_FOLLOW_UP_EMAIL_MIN_INTERVAL_HOURS = 6;
export const MEETING_PRESENCE_CONFIRM_WINDOW_MS = 60 * 60 * 1000;

export type ScheduleMeetingStatus = "scheduled" | "realized" | "overdue" | "canceled";

export const scheduleMeetingStatusLabels: Record<ScheduleMeetingStatus, string> = {
  scheduled: "Agendado",
  realized: "Reunião realizada",
  overdue: "Vencido",
  canceled: "Cancelado",
};

export const getScheduleMeetingStatusLabel = (status: ScheduleMeetingStatus) =>
  scheduleMeetingStatusLabels[status];

export const getScheduleMeetingStatus = (params: {
  date: Date | string;
  meetingHeald: LeadMeetingHeald;
  isCanceled?: boolean;
  now?: Date;
}): ScheduleMeetingStatus => {
  if (params.isCanceled === true) return "canceled";

  const meetingDate = params.date instanceof Date ? params.date : new Date(params.date);
  const now = params.now ?? new Date();

  if (meetingDate.getTime() > now.getTime()) return "scheduled";
  if (params.meetingHeald === "yes") return "realized";
  return "overdue";
};

export const getScheduleMeetingStatusBadgeClass = (status: ScheduleMeetingStatus) => {
  const classes: Record<ScheduleMeetingStatus, string> = {
    canceled: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    scheduled: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    realized: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
    overdue: "border-border bg-muted text-muted-foreground",
  };

  return classes[status];
};

export const isMeetingOverdue = (meetingDateIso: string | null | undefined) => {
  if (!meetingDateIso) return false;
  const date = new Date(meetingDateIso);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
};

export const isMeetingHealdResolved = (meetingHeald: LeadMeetingHeald) => meetingHeald === "yes";

export function isMeetingFollowUpOverdue(params: {
  status: string | null | undefined;
  meetingDate: string | Date | null | undefined;
  meetingHeald: LeadMeetingHeald;
  now?: Date;
}): boolean {
  if (params.status !== "scheduled") return false;
  if (params.meetingHeald === "yes") return false;
  if (!params.meetingDate) return false;

  const meetingDate =
    params.meetingDate instanceof Date ? params.meetingDate : new Date(params.meetingDate);
  if (Number.isNaN(meetingDate.getTime())) return false;

  const now = params.now ?? new Date();
  const cutoffMs = now.getTime() - MEETING_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
  return meetingDate.getTime() < cutoffMs;
}

export const requiresMeetingHealdGate = (fromStatus: string | null | undefined, toStatus: string) =>
  fromStatus === "scheduled" &&
  toStatus !== "scheduled" &&
  toStatus !== "no_show" &&
  toStatus !== "new_opportunity" &&
  toStatus !== "opportunityLost";

export const canConfirmMeetingHeald = (params: {
  isTeamMaster: boolean;
  currentProfileId: string | null | undefined;
  leadCloserId: string | null | undefined;
}) => {
  if (!params.currentProfileId) return false;
  return params.isTeamMaster || params.currentProfileId === params.leadCloserId;
};

function parseMeetingDate(meetingDate: string | Date | null | undefined): Date | null {
  if (!meetingDate) return null;
  const date = meetingDate instanceof Date ? meetingDate : new Date(meetingDate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isRealScheduledMeeting(params: {
  status: string | null | undefined;
  meetingDate: string | Date | null | undefined;
  isTransfer?: boolean;
}): boolean {
  if (params.status !== "scheduled") return false;
  if (params.isTransfer === true) return false;
  return parseMeetingDate(params.meetingDate) !== null;
}

export function canConfirmMeetingPresence(params: {
  status: string | null | undefined;
  meetingDate: string | Date | null | undefined;
  isTransfer?: boolean;
  now?: Date;
}): boolean {
  if (!isRealScheduledMeeting(params)) return false;
  const meetingDate = parseMeetingDate(params.meetingDate);
  if (!meetingDate) return false;
  const now = params.now ?? new Date();
  return meetingDate.getTime() > now.getTime();
}

export function isMeetingPresenceConfirmationDue(params: {
  status: string | null | undefined;
  meetingDate: string | Date | null | undefined;
  meetingPresenceConfirmed: boolean | null | undefined;
  isTransfer?: boolean;
  now?: Date;
}): boolean {
  if (params.meetingPresenceConfirmed === true) return false;
  if (!isRealScheduledMeeting(params)) return false;

  const meetingDate = parseMeetingDate(params.meetingDate);
  if (!meetingDate) return false;

  const now = params.now ?? new Date();
  const msUntilMeeting = meetingDate.getTime() - now.getTime();
  return msUntilMeeting > 0 && msUntilMeeting <= MEETING_PRESENCE_CONFIRM_WINDOW_MS;
}

export type MeetingPresenceBadgeVariant = "confirmed" | "pending" | "missed";

export function getMeetingPresenceBadgeVariant(params: {
  meetingPresenceConfirmed: boolean | null | undefined;
  meetingDate: string | Date | null | undefined;
  now?: Date;
}): MeetingPresenceBadgeVariant {
  if (params.meetingPresenceConfirmed === true) return "confirmed";
  const meetingDate = parseMeetingDate(params.meetingDate);
  if (!meetingDate) return "pending";
  const now = params.now ?? new Date();
  if (meetingDate.getTime() <= now.getTime()) return "missed";
  return "pending";
}

export function getMeetingPresenceBadgeClass(variant: MeetingPresenceBadgeVariant): string {
  const classes: Record<MeetingPresenceBadgeVariant, string> = {
    confirmed: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
    pending: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    missed: "border-border bg-muted text-muted-foreground",
  };
  return classes[variant];
}

export function getMeetingPresenceBadgeLabel(variant: MeetingPresenceBadgeVariant): string {
  const labels: Record<MeetingPresenceBadgeVariant, string> = {
    confirmed: "Agenda confirmada",
    pending: "Pendente",
    missed: "Não confirmada",
  };
  return labels[variant];
}

export function getMeetingPresenceAlertLabel(): string {
  return "Confirme a presença do lead";
}

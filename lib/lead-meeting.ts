export type LeadMeetingHeald = "yes" | "no" | null | undefined;

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

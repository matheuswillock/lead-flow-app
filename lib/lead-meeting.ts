export type LeadMeetingHeald = "yes" | "no" | null | undefined;

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

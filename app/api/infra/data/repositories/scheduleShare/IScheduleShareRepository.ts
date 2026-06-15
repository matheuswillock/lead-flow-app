export type LeadForScheduleShare = {
  id: string;
  teamId: string | null;
  name: string;
  meetingDate: Date | null;
  meetingTitle: string | null;
  meetingLink: string | null;
  meetingType: string | null;
  closerTimezone: string | null;
};

export type ScheduleForScheduleShare = {
  id: string;
  date: Date;
  meetingTitle: string | null;
  meetingLink: string | null;
  meetingType: string | null;
  publicShareTokenHash: string | null;
  publicShareExpiresAt: Date | null;
};

export type PublicScheduleShareRecord = {
  id: string;
  date: Date;
  meetingTitle: string | null;
  meetingLink: string | null;
  meetingType: string | null;
  publicShareTokenHash: string | null;
  publicShareExpiresAt: Date | null;
  leadName: string;
  leadMeetingDate: Date | null;
  leadMeetingTitle: string | null;
  leadMeetingLink: string | null;
  leadMeetingType: string | null;
  closerTimezone: string | null;
};

export interface IScheduleShareRepository {
  findLeadForShare(leadId: string): Promise<LeadForScheduleShare | null>;
  findScheduleByLeadId(leadId: string): Promise<ScheduleForScheduleShare | null>;
  updateScheduleShare(id: string, data: {
    publicShareTokenHash: string;
    publicShareExpiresAt: Date;
  }): Promise<void>;
  findPublicScheduleById(scheduleId: string): Promise<PublicScheduleShareRecord | null>;
}

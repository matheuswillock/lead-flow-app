export type ScheduleShareSummary = {
  leadId: string;
  leadName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: string;
  expiresAt: string;
  timezone: string;
  isPreSchedule: boolean;
};

export type PublicScheduleShareResult = {
  leadName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: string;
  expiresAt: string;
  availableAt: string;
  timezone: string;
  joinAllowed: boolean;
  meetingLink: string | null;
  isPreSchedule: boolean;
};

export interface IScheduleShareService {
  createPublicShare(input: {
    leadId: string;
    teamId: string;
  }): Promise<{
    publicUrl: string;
    expiresAt: string;
    summary: ScheduleShareSummary;
  }>;
  getPublicShare(token: string): Promise<PublicScheduleShareResult>;
}

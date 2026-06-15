export type PublicScheduleShareData = {
  leadName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: string;
  expiresAt: string;
  availableAt: string;
  timezone: string;
  joinAllowed: boolean;
  meetingLink: string | null;
};

export interface IPublicScheduleShareService {
  getSchedule(token: string): Promise<PublicScheduleShareData>;
}

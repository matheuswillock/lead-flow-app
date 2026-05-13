export type TaskGoogleSyncResult = {
  profileId: string;
  googleSynced: boolean;
  googleEventId: string | null;
  reason?: string;
};

export type CreateTaskCalendarEventInput = {
  taskId: string;
  body: string;
  isUrgent: boolean;
  startAt: Date | null;
  endAt: Date | null;
  leadName: string;
  assigneeProfileIds: string[];
};

export type UpdateTaskCalendarEventInput = {
  taskId: string;
  body: string;
  isUrgent: boolean;
  startAt: Date | null;
  endAt: Date | null;
  leadName: string;
  assigneeProfileId: string;
  googleEventId: string;
};

export type CancelTaskCalendarEventInput = {
  assigneeProfileId: string;
  googleEventId: string;
};

export interface ITaskGoogleCalendarService {
  createEventsForAssignees(input: CreateTaskCalendarEventInput): Promise<TaskGoogleSyncResult[]>;
  cancelEventForAssignee(input: CancelTaskCalendarEventInput): Promise<void>;
}

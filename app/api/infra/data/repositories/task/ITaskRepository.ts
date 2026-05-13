import type { Task, TaskAssignee, TaskAssigneeStatus } from "@prisma/client";

export type TaskWithRelations = Task & {
  lead: { id: string; name: string; leadCode: string };
  creator: { id: string; fullName: string | null; email: string; profileIconUrl: string | null };
  assignees: Array<
    TaskAssignee & {
      profile: { id: string; fullName: string | null; email: string; profileIconUrl: string | null };
    }
  >;
};

export type CreateTaskDTO = {
  leadId: string;
  title: string;
  taskType: string;
  body: string;
  isUrgent: boolean;
  startAt: Date | null;
  endAt: Date | null;
  createdBy: string;
  assigneeProfileIds: string[];
};

export type CreateActivityDTO = {
  leadId: string;
  body: string;
  title: string;
  taskType: string;
  createdBy: string;
  isUrgent: boolean;
  assigneeProfileIds: string[];
};

export type TaskByDateFilter = {
  teamId: string;
  dateFrom?: Date;
  dateTo?: Date;
  leadId?: string;
};

export type AssigneeWithGoogleSync = TaskAssignee & {
  profile: { id: string; fullName: string | null; email: string; profileIconUrl: string | null };
};

export interface ITaskRepository {
  createActivityAndTask(dto: CreateTaskDTO & { activityDto: CreateActivityDTO }): Promise<TaskWithRelations>;
  findByTeamAndDateRange(filter: TaskByDateFilter): Promise<TaskWithRelations[]>;
  findById(taskId: string): Promise<(Task & { lead: { teamId: string | null } }) | null>;
  updateTaskDetails(input: {
    taskId: string;
    title: string;
    taskType: "call" | "documentation" | "email" | "proposal" | "other";
    body: string;
    isUrgent: boolean;
    startAt: Date | null;
    endAt: Date | null;
    assigneeProfileIds: string[];
  }): Promise<TaskWithRelations>;
  findByIdWithAssignees(taskId: string): Promise<(Task & { lead: { teamId: string | null }; assignees: TaskAssignee[] }) | null>;
  findAssignee(taskId: string, profileId: string): Promise<AssigneeWithGoogleSync | null>;
  updateAssigneeStatus(taskId: string, profileId: string, status: TaskAssigneeStatus): Promise<AssigneeWithGoogleSync>;
  createTaskStatusActivity(input: {
    leadId: string;
    actorProfileId: string;
    taskId: string;
    taskTitle: string;
    status: TaskAssigneeStatus;
  }): Promise<void>;
  updateAssigneeGoogleSync(taskId: string, profileId: string, data: { googleEventId: string; googleCalendarId: string; googleSynced: boolean }): Promise<void>;
  cancelAllAssignees(taskId: string): Promise<void>;
  findConnectedAssigneesForTask(taskId: string): Promise<Array<{ profileId: string; googleEventId: string | null; googleSynced: boolean }>>;
  validateTeamMembers(teamId: string, profileIds: string[]): Promise<string[]>;
  findLeadInTeam(leadId: string, teamId: string): Promise<{ id: string; teamId: string | null; leadCode: string; name: string } | null>;
  findCreatorProfile(profileId: string): Promise<{ id: string; fullName: string | null; email: string } | null>;
  findProfilesWithGoogleForTask(profileIds: string[]): Promise<Array<{ id: string; googleAccessToken: string | null; googleRefreshToken: string | null; googleTokenExpiresAt: Date | null; timezone: string; supabaseId: string | null }>>;
}

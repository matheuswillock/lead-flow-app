import type { TaskAssigneeStatus, TaskType } from "@prisma/client";
import { prisma } from "../../prisma";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import type {
  ITaskRepository,
  TaskWithRelations,
  CreateTaskDTO,
  CreateActivityDTO,
  TaskByDateFilter,
  AssigneeWithGoogleSync,
} from "./ITaskRepository";

const ASSIGNEE_PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  profileIconUrl: true,
} as const;

const TASK_INCLUDE = {
  lead: { select: { id: true, name: true, leadCode: true } },
  creator: { select: ASSIGNEE_PROFILE_SELECT },
  assignees: {
    include: { profile: { select: ASSIGNEE_PROFILE_SELECT } },
  },
} as const;

class TaskRepository implements ITaskRepository {
  async createActivityAndTask(
    dto: CreateTaskDTO & { activityDto: CreateActivityDTO }
  ): Promise<TaskWithRelations> {
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: dto.activityDto.leadId,
        type: "task",
        body: dto.activityDto.body.trim(),
        createdBy: dto.activityDto.createdBy,
        payload: {
          kind: "task",
          title: dto.activityDto.title.trim(),
          taskType: dto.activityDto.taskType,
          isUrgent: dto.activityDto.isUrgent,
          assigneeProfileIds: dto.activityDto.assigneeProfileIds,
        },
      },
    });

    const task = await prisma.task.create({
      data: {
        leadId: dto.leadId,
        activityId: activity.id,
        title: dto.title.trim(),
        taskType: dto.taskType as TaskType,
        body: dto.body.trim(),
        isUrgent: dto.isUrgent,
        startAt: dto.startAt,
        endAt: dto.endAt,
        createdBy: dto.createdBy,
        assignees: {
          create: dto.assigneeProfileIds.map((profileId) => ({ profileId })),
        },
      },
      include: TASK_INCLUDE,
    });

    await prisma.leadActivity.update({
      where: { id: activity.id },
      data: {
        payload: {
          kind: "task",
          title: task.title,
          taskType: task.taskType,
          isUrgent: task.isUrgent,
          assigneeProfileIds: dto.activityDto.assigneeProfileIds,
          assigneeMentions: task.assignees.map((assignee) => ({
            profileId: assignee.profile.id,
            label: `@${assignee.profile.fullName || assignee.profile.email}`,
          })),
        },
      },
    });

    return task as TaskWithRelations;
  }

  async findByTeamAndDateRange(filter: TaskByDateFilter): Promise<TaskWithRelations[]> {
    const where: Record<string, unknown> = {
      lead: { teamId: filter.teamId },
    };

    if (filter.leadId) {
      where.leadId = filter.leadId;
    }

    if (filter.dateFrom || filter.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.dateFrom) dateFilter.gte = filter.dateFrom;
      if (filter.dateTo) dateFilter.lte = filter.dateTo;
      where.OR = [
        { startAt: dateFilter },
        { endAt: dateFilter },
        { startAt: null, createdAt: dateFilter },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    });

    return tasks as TaskWithRelations[];
  }

  async findById(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: { lead: { select: { teamId: true } } },
    });
  }

  async updateTaskDetails(input: {
    taskId: string;
    title: string;
    taskType: "call" | "documentation" | "email" | "proposal" | "whatsapp" | "meeting" | "other";
    body: string;
    isUrgent: boolean;
    startAt: Date | null;
    endAt: Date | null;
    assigneeProfileIds: string[];
  }): Promise<TaskWithRelations> {
    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        title: input.title.trim(),
        taskType: input.taskType as TaskType,
        body: input.body.trim(),
        isUrgent: input.isUrgent,
        startAt: input.startAt,
        endAt: input.endAt,
        assignees: {
          deleteMany: {},
          create: input.assigneeProfileIds.map((profileId) => ({ profileId })),
        },
      },
      include: TASK_INCLUDE,
    });
    const taskWithRelations = updatedTask as TaskWithRelations;

    await prisma.leadActivity.updateMany({
      where: { id: taskWithRelations.activityId ?? "" },
      data: {
        body: input.body.trim(),
        payload: {
          kind: "task",
          title: taskWithRelations.title,
          taskType: taskWithRelations.taskType,
          isUrgent: taskWithRelations.isUrgent,
          assigneeProfileIds: input.assigneeProfileIds,
          assigneeMentions: taskWithRelations.assignees.map((assignee) => ({
            profileId: assignee.profile.id,
            label: `@${assignee.profile.fullName || assignee.profile.email}`,
          })),
        },
      },
    });

    return taskWithRelations;
  }

  async findByIdWithAssignees(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        lead: { select: { teamId: true } },
        assignees: true,
      },
    });
  }

  async findAssignee(taskId: string, profileId: string): Promise<AssigneeWithGoogleSync | null> {
    return prisma.taskAssignee.findUnique({
      where: { taskId_profileId: { taskId, profileId } },
      include: { profile: { select: ASSIGNEE_PROFILE_SELECT } },
    }) as Promise<AssigneeWithGoogleSync | null>;
  }

  async updateAssigneeStatus(
    taskId: string,
    profileId: string,
    status: TaskAssigneeStatus
  ): Promise<AssigneeWithGoogleSync> {
    return prisma.taskAssignee.update({
      where: { taskId_profileId: { taskId, profileId } },
      data: { status },
      include: { profile: { select: ASSIGNEE_PROFILE_SELECT } },
    }) as Promise<AssigneeWithGoogleSync>;
  }

  async createTaskStatusActivity(input: {
    leadId: string;
    actorProfileId: string;
    taskId: string;
    taskTitle: string;
    status: TaskAssigneeStatus;
  }): Promise<void> {
    await prisma.leadActivity.create({
      data: {
        leadId: input.leadId,
        type: "task",
        body: `Task "${input.taskTitle}" marcada como ${input.status === "DONE" ? "concluída" : "pendente"}.`,
        createdBy: input.actorProfileId,
        payload: {
          kind: "task_status_update",
          taskId: input.taskId,
          title: input.taskTitle,
          status: input.status,
        },
      },
    });
  }

  async updateAssigneeGoogleSync(
    taskId: string,
    profileId: string,
    data: { googleEventId: string; googleCalendarId: string; googleSynced: boolean }
  ): Promise<void> {
    await prisma.taskAssignee.updateMany({
      where: { taskId, profileId },
      data,
    });
  }

  async cancelAllAssignees(taskId: string): Promise<void> {
    await prisma.taskAssignee.updateMany({
      where: { taskId },
      data: { status: "CANCELED" },
    });
  }

  async findConnectedAssigneesForTask(taskId: string) {
    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
      select: { profileId: true, googleEventId: true, googleCalendarId: true, googleSynced: true },
    });
    return assignees;
  }

  async validateTeamMembers(teamId: string, profileIds: string[]): Promise<string[]> {
    const members = await prisma.teamMember.findMany({
      where: { teamId, profileId: { in: profileIds } },
      select: { profileId: true },
    });
    return members.map((m) => m.profileId);
  }

  async findLeadInTeam(leadId: string, teamId: string) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true, leadCode: true, name: true },
    }).then((lead) => (lead?.teamId === teamId ? lead : null));
  }

  async findCreatorProfile(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, fullName: true, email: true },
    });
  }

  async findProfilesWithGoogleForTask(profileIds: string[]) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        googleConnection: {
          select: {
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
            revokedAt: true,
          },
        },
        timezone: true,
        supabaseId: true,
      },
    });

    return profiles
      .filter((profile) => isGoogleConnectionActive(profile.googleConnection))
      .map((profile) => ({
        id: profile.id,
        googleAccessToken: profile.googleConnection?.accessToken ?? null,
        googleRefreshToken: profile.googleConnection?.refreshToken ?? null,
        googleTokenExpiresAt: profile.googleConnection?.tokenExpiresAt ?? null,
        timezone: profile.timezone,
        supabaseId: profile.supabaseId,
      }));
  }
}

export const taskRepository = new TaskRepository();


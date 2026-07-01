import { prisma } from "@/app/api/infra/data/prisma";

export type OverdueTaskAssigneeRow = {
  profileId: string;
  task: {
    id: string;
    title: string;
    lead: {
      id: string;
      name: string;
    } | null;
  };
};

export class TaskOverdueReminderRepository {
  async findOverdueAssignees(now: Date, limit = 100): Promise<OverdueTaskAssigneeRow[]> {
    return prisma.taskAssignee.findMany({
      where: {
        status: "PENDING",
        task: {
          OR: [{ endAt: { lt: now } }, { endAt: null, startAt: { lt: now } }],
        },
      },
      select: {
        profileId: true,
        task: {
          select: {
            id: true,
            title: true,
            lead: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: limit,
    });
  }
}

export const taskOverdueReminderRepository = new TaskOverdueReminderRepository();

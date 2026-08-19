import { prisma } from "@/app/api/infra/data/prisma";

export type LeadStatusChangedBatchCursor = {
  id: string;
  statusEnteredAt: Date;
};

export type LeadStatusChangedBatchPageOptions = {
  take?: number;
  cursor?: LeadStatusChangedBatchCursor;
};

export class LeadStatusChangedBatchRepository {
  async findLeadsWithStatusChangedBetween(
    batchStart: Date,
    batchEnd: Date,
    options: LeadStatusChangedBatchPageOptions = {}
  ) {
    const take = options.take ?? 200;
    const cursor = options.cursor;

    return prisma.lead.findMany({
      where: {
        status: { not: null },
        statusEnteredAt: {
          gte: batchStart,
          lt: batchEnd,
        },
        ...(cursor
          ? {
              OR: [
                { statusEnteredAt: { gt: cursor.statusEnteredAt } },
                {
                  AND: [
                    { statusEnteredAt: cursor.statusEnteredAt },
                    { id: { gt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        leadCode: true,
        name: true,
        status: true,
        teamId: true,
        assignedTo: true,
        closerId: true,
        managerId: true,
        statusEnteredAt: true,
      },
      orderBy: [{ statusEnteredAt: "asc" }, { id: "asc" }],
      take,
    });
  }

  async findTeamMemberProfileIds(teamId: string, profileIds: string[]) {
    if (profileIds.length === 0) return [];

    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
        profileId: { in: profileIds },
      },
      select: { profileId: true },
    });

    return members.map((member) => member.profileId);
  }
}

export const leadStatusChangedBatchRepository = new LeadStatusChangedBatchRepository();

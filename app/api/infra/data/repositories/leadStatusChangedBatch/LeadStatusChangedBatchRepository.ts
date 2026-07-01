import { prisma } from "@/app/api/infra/data/prisma";

export class LeadStatusChangedBatchRepository {
  async findLeadsWithStatusChangedBetween(batchStart: Date, batchEnd: Date, limit = 200) {
    return prisma.lead.findMany({
      where: {
        status: { not: null },
        statusEnteredAt: {
          gte: batchStart,
          lt: batchEnd,
        },
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
      },
      take: limit,
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

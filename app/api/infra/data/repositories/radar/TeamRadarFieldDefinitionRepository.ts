import { prisma } from "@/app/api/infra/data/prisma"

export class TeamRadarFieldDefinitionRepository {
  async listActiveByTeam(teamId: string) {
    return prisma.teamRadarFieldDefinition.findMany({
      where: { teamId, isActive: true },
      orderBy: [{ label: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        valueType: true,
        importJobId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async upsertDefinition(input: {
    id: string
    teamId: string
    key: string
    label: string
    valueType: string
    createdBy: string
    importJobId: string
  }) {
    return prisma.teamRadarFieldDefinition.upsert({
      where: { teamId_key: { teamId: input.teamId, key: input.key } },
      create: {
        id: input.id,
        teamId: input.teamId,
        key: input.key,
        label: input.label,
        valueType: input.valueType,
        createdBy: input.createdBy,
        importJobId: input.importJobId,
        isActive: true,
      },
      update: {
        label: input.label,
        isActive: true,
      },
    })
  }
}

export const teamRadarFieldDefinitionRepository = new TeamRadarFieldDefinitionRepository()

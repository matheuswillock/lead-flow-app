import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ITeamFilterPresetService,
  TeamFilterPresetCreateInput,
  TeamFilterPresetUpdateInput,
} from "./ITeamFilterPresetService";

export class TeamFilterPresetService implements ITeamFilterPresetService {
  async listByTeamAndCreator(teamId: string, createdBy: string) {
    return prisma.teamFilterPreset.findMany({
      where: {
        teamId,
        createdBy,
      },
      orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(teamId: string, createdBy: string, input: TeamFilterPresetCreateInput) {
    return prisma.teamFilterPreset.create({
      data: {
        teamId,
        createdBy,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        queryJson: input.queryJson,
      },
    });
  }

  async update(teamId: string, createdBy: string, presetId: string, input: TeamFilterPresetUpdateInput) {
    const existing = await prisma.teamFilterPreset.findFirst({
      where: {
        id: presetId,
        teamId,
        createdBy,
      },
      select: { id: true },
    });

    if (!existing) return null;

    return prisma.teamFilterPreset.update({
      where: { id: presetId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.queryJson !== undefined ? { queryJson: input.queryJson } : {}),
      },
    });
  }

  async delete(teamId: string, createdBy: string, presetId: string) {
    const result = await prisma.teamFilterPreset.deleteMany({
      where: {
        id: presetId,
        teamId,
        createdBy,
      },
    });
    return result.count > 0;
  }

  async markAsUsed(teamId: string, createdBy: string, presetId: string) {
    const existing = await prisma.teamFilterPreset.findFirst({
      where: {
        id: presetId,
        teamId,
        createdBy,
      },
      select: { id: true },
    });

    if (!existing) return null;

    return prisma.teamFilterPreset.update({
      where: { id: presetId },
      data: {
        lastUsedAt: new Date(),
      },
    });
  }
}

export const teamFilterPresetService: ITeamFilterPresetService = new TeamFilterPresetService();


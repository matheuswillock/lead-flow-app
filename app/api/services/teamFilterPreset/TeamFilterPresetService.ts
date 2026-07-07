import type { TeamFilterPreset } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ITeamFilterPresetService,
  TeamFilterPresetCreateInput,
  TeamFilterPresetUpdateInput,
} from "./ITeamFilterPresetService";

function canMutatePreset(preset: TeamFilterPreset, profileId: string, isManager: boolean): boolean {
  if (preset.createdBy === profileId) return true;
  if (preset.visibility === "team" && isManager) return true;
  return false;
}

export class TeamFilterPresetService implements ITeamFilterPresetService {
  async listByTeamScopeAndProfile(teamId: string, profileId: string, scope: TeamFilterPreset["scope"]) {
    return prisma.teamFilterPreset.findMany({
      where: {
        teamId,
        scope,
        OR: [{ createdBy: profileId }, { visibility: "team" }],
      },
      orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async findById(teamId: string, presetId: string) {
    return prisma.teamFilterPreset.findFirst({
      where: { id: presetId, teamId },
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
        scope: input.scope,
        visibility: input.visibility ?? "private",
      },
    });
  }

  async update(
    teamId: string,
    profileId: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput,
    isManager: boolean
  ) {
    const existing = await this.findById(teamId, presetId);
    if (!existing) return { preset: null };
    if (!canMutatePreset(existing, profileId, isManager)) {
      return { preset: null, forbidden: true };
    }

    const preset = await prisma.teamFilterPreset.update({
      where: { id: presetId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.queryJson !== undefined ? { queryJson: input.queryJson } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      },
    });
    return { preset };
  }

  async delete(teamId: string, profileId: string, presetId: string, isManager: boolean) {
    const existing = await this.findById(teamId, presetId);
    if (!existing) return { removed: false };
    if (!canMutatePreset(existing, profileId, isManager)) {
      return { removed: false, forbidden: true };
    }

    await prisma.teamFilterPreset.delete({ where: { id: presetId } });
    return { removed: true };
  }

  async markAsUsed(teamId: string, profileId: string, presetId: string, _isManager: boolean) {
    const existing = await this.findById(teamId, presetId);
    if (!existing) return { preset: null };

    const canUse = existing.createdBy === profileId || existing.visibility === "team";
    if (!canUse) {
      return { preset: null, forbidden: true };
    }

    const preset = await prisma.teamFilterPreset.update({
      where: { id: presetId },
      data: { lastUsedAt: new Date() },
    });
    return { preset };
  }
}

export const teamFilterPresetService: ITeamFilterPresetService = new TeamFilterPresetService();

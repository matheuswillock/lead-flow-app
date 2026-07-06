import { FilterPresetScope, Prisma, TeamFilterPreset } from "@prisma/client";
import type { FilterPresetVisibility } from "@prisma/client";

export type TeamFilterPresetCreateInput = {
  name: string;
  description?: string | null;
  queryJson: Prisma.InputJsonValue;
  scope: FilterPresetScope;
  visibility?: FilterPresetVisibility;
};

export type TeamFilterPresetUpdateInput = {
  name?: string;
  description?: string | null;
  queryJson?: Prisma.InputJsonValue;
  visibility?: FilterPresetVisibility;
};

export interface ITeamFilterPresetService {
  listByTeamScopeAndProfile(
    teamId: string,
    profileId: string,
    scope: FilterPresetScope
  ): Promise<TeamFilterPreset[]>;
  findById(teamId: string, presetId: string): Promise<TeamFilterPreset | null>;
  create(teamId: string, createdBy: string, input: TeamFilterPresetCreateInput): Promise<TeamFilterPreset>;
  update(
    teamId: string,
    profileId: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput,
    isManager: boolean
  ): Promise<{ preset: TeamFilterPreset | null; forbidden?: boolean }>;
  delete(
    teamId: string,
    profileId: string,
    presetId: string,
    isManager: boolean
  ): Promise<{ removed: boolean; forbidden?: boolean }>;
  markAsUsed(
    teamId: string,
    profileId: string,
    presetId: string,
    isManager: boolean
  ): Promise<{ preset: TeamFilterPreset | null; forbidden?: boolean }>;
}

import { FilterPresetScope, Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import type { FilterPresetVisibility } from "@prisma/client";

export type TeamFilterPresetInput = {
  name: string;
  description?: string | null;
  queryJson: Prisma.InputJsonValue;
  visibility?: FilterPresetVisibility;
};

export type TeamFilterPresetUpdateInput = {
  name?: string;
  description?: string | null;
  queryJson?: Prisma.InputJsonValue;
  visibility?: FilterPresetVisibility;
};

export interface ITeamFilterPresetsUseCase {
  list(teamId: string, profileId: string, scope: FilterPresetScope): Promise<Output>;
  create(
    teamId: string,
    profileId: string,
    scope: FilterPresetScope,
    input: TeamFilterPresetInput
  ): Promise<Output>;
  update(
    teamId: string,
    profileId: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput,
    isManager: boolean
  ): Promise<Output>;
  remove(teamId: string, profileId: string, presetId: string, isManager: boolean): Promise<Output>;
  markAsUsed(
    teamId: string,
    profileId: string,
    presetId: string,
    isManager: boolean
  ): Promise<Output>;
}

import { Prisma, TeamFilterPreset } from "@prisma/client";

export type TeamFilterPresetCreateInput = {
  name: string;
  description?: string | null;
  queryJson: Prisma.InputJsonValue;
};

export type TeamFilterPresetUpdateInput = {
  name?: string;
  description?: string | null;
  queryJson?: Prisma.InputJsonValue;
};

export interface ITeamFilterPresetService {
  listByTeamAndCreator(teamId: string, createdBy: string): Promise<TeamFilterPreset[]>;
  create(teamId: string, createdBy: string, input: TeamFilterPresetCreateInput): Promise<TeamFilterPreset>;
  update(
    teamId: string,
    createdBy: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput
  ): Promise<TeamFilterPreset | null>;
  delete(teamId: string, createdBy: string, presetId: string): Promise<boolean>;
  markAsUsed(teamId: string, createdBy: string, presetId: string): Promise<TeamFilterPreset | null>;
}


import { Prisma } from "@prisma/client";
import { Output } from "@/lib/output";

export type TeamFilterPresetInput = {
  name: string;
  description?: string | null;
  queryJson: Prisma.InputJsonValue;
};

export type TeamFilterPresetUpdateInput = {
  name?: string;
  description?: string | null;
  queryJson?: Prisma.InputJsonValue;
};

export interface ITeamFilterPresetsUseCase {
  list(teamId: string, createdBy: string): Promise<Output>;
  create(teamId: string, createdBy: string, input: TeamFilterPresetInput): Promise<Output>;
  update(
    teamId: string,
    createdBy: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput
  ): Promise<Output>;
  remove(teamId: string, createdBy: string, presetId: string): Promise<Output>;
  markAsUsed(teamId: string, createdBy: string, presetId: string): Promise<Output>;
}


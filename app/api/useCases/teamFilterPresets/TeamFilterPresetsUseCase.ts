import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { Output } from "@/lib/output";
import type { ITeamFilterPresetService } from "@/app/api/services/teamFilterPreset/ITeamFilterPresetService";
import { teamFilterPresetService } from "@/app/api/services/teamFilterPreset/TeamFilterPresetService";
import type {
  ITeamFilterPresetsUseCase,
  TeamFilterPresetInput,
  TeamFilterPresetUpdateInput,
} from "./ITeamFilterPresetsUseCase";

async function getCachedFilterPresets(teamId: string, profileId: string) {
  "use cache";
  cacheTag(cacheTags.teamFilterPresets(teamId, profileId));
  cacheLife({ stale: 60, revalidate: 300 });
  return teamFilterPresetService.listByTeamAndCreator(teamId, profileId);
}

export class TeamFilterPresetsUseCase implements ITeamFilterPresetsUseCase {
  constructor(private readonly service: ITeamFilterPresetService = teamFilterPresetService) {}

  async list(teamId: string, createdBy: string): Promise<Output> {
    try {
      const presets = await getCachedFilterPresets(teamId, createdBy);
      return new Output(true, [], [], presets);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][list] Erro ao listar presets:", error);
      return new Output(false, [], ["Erro ao listar filtros pré-definidos"], null);
    }
  }

  async create(teamId: string, createdBy: string, input: TeamFilterPresetInput): Promise<Output> {
    try {
      const name = input.name?.trim();
      if (!name) {
        return new Output(false, [], ["Nome do preset é obrigatório"], null);
      }
      const preset = await this.service.create(teamId, createdBy, {
        name,
        description: input.description,
        queryJson: input.queryJson,
      });
      return new Output(true, ["Filtro pré-definido criado com sucesso"], [], preset);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][create] Erro ao criar preset:", error);
      return new Output(false, [], ["Erro ao criar filtro pré-definido"], null);
    }
  }

  async update(
    teamId: string,
    createdBy: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput
  ): Promise<Output> {
    try {
      const preset = await this.service.update(teamId, createdBy, presetId, input);
      if (!preset) {
        return new Output(false, [], ["Filtro pré-definido não encontrado"], null);
      }
      return new Output(true, ["Filtro pré-definido atualizado com sucesso"], [], preset);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][update] Erro ao atualizar preset:", error);
      return new Output(false, [], ["Erro ao atualizar filtro pré-definido"], null);
    }
  }

  async remove(teamId: string, createdBy: string, presetId: string): Promise<Output> {
    try {
      const removed = await this.service.delete(teamId, createdBy, presetId);
      if (!removed) {
        return new Output(false, [], ["Filtro pré-definido não encontrado"], null);
      }
      return new Output(true, ["Filtro pré-definido removido com sucesso"], [], { id: presetId });
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][remove] Erro ao remover preset:", error);
      return new Output(false, [], ["Erro ao remover filtro pré-definido"], null);
    }
  }

  async markAsUsed(teamId: string, createdBy: string, presetId: string): Promise<Output> {
    try {
      const preset = await this.service.markAsUsed(teamId, createdBy, presetId);
      if (!preset) {
        return new Output(false, [], ["Filtro pré-definido não encontrado"], null);
      }
      return new Output(true, ["Filtro pré-definido marcado como utilizado"], [], preset);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][markAsUsed] Erro ao atualizar preset:", error);
      return new Output(false, [], ["Erro ao marcar filtro pré-definido"], null);
    }
  }
}

export const teamFilterPresetsUseCase: ITeamFilterPresetsUseCase = new TeamFilterPresetsUseCase();


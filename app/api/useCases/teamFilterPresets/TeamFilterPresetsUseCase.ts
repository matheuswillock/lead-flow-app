import { FilterPresetScope } from "@prisma/client";
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

async function getCachedFilterPresets(teamId: string, profileId: string, scope: FilterPresetScope) {
  "use cache";
  cacheTag(cacheTags.teamFilterPresets(teamId, profileId, scope));
  cacheLife({ stale: 60, revalidate: 300 });
  return teamFilterPresetService.listByTeamScopeAndProfile(teamId, profileId, scope);
}

export class TeamFilterPresetsUseCase implements ITeamFilterPresetsUseCase {
  constructor(private readonly service: ITeamFilterPresetService = teamFilterPresetService) {}

  async list(teamId: string, profileId: string, scope: FilterPresetScope): Promise<Output> {
    try {
      const presets = await getCachedFilterPresets(teamId, profileId, scope);
      return new Output(true, [], [], presets);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][list] Erro ao listar presets:", error);
      return new Output(false, [], ["Erro ao listar filtros pré-definidos"], null);
    }
  }

  async create(
    teamId: string,
    profileId: string,
    scope: FilterPresetScope,
    input: TeamFilterPresetInput
  ): Promise<Output> {
    try {
      const name = input.name?.trim();
      if (!name) {
        return new Output(false, [], ["Nome do preset é obrigatório"], null);
      }
      const preset = await this.service.create(teamId, profileId, {
        name,
        description: input.description,
        queryJson: input.queryJson,
        scope,
        visibility: input.visibility,
      });
      return new Output(true, ["Filtro pré-definido criado com sucesso"], [], preset);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][create] Erro ao criar preset:", error);
      return new Output(false, [], ["Erro ao criar filtro pré-definido"], null);
    }
  }

  async update(
    teamId: string,
    profileId: string,
    presetId: string,
    input: TeamFilterPresetUpdateInput,
    isManager: boolean
  ): Promise<Output> {
    try {
      const { preset, forbidden } = await this.service.update(
        teamId,
        profileId,
        presetId,
        input,
        isManager
      );
      if (forbidden) {
        return new Output(false, [], ["Sem permissão para editar este filtro pré-definido"], null);
      }
      if (!preset) {
        return new Output(false, [], ["Filtro pré-definido não encontrado"], null);
      }
      return new Output(true, ["Filtro pré-definido atualizado com sucesso"], [], preset);
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][update] Erro ao atualizar preset:", error);
      return new Output(false, [], ["Erro ao atualizar filtro pré-definido"], null);
    }
  }

  async remove(
    teamId: string,
    profileId: string,
    presetId: string,
    isManager: boolean
  ): Promise<Output> {
    try {
      const { removed, forbidden } = await this.service.delete(
        teamId,
        profileId,
        presetId,
        isManager
      );
      if (forbidden) {
        return new Output(false, [], ["Sem permissão para excluir este filtro pré-definido"], null);
      }
      if (!removed) {
        return new Output(false, [], ["Filtro pré-definido não encontrado"], null);
      }
      return new Output(true, ["Filtro pré-definido removido com sucesso"], [], { id: presetId });
    } catch (error) {
      console.error("[TeamFilterPresetsUseCase][remove] Erro ao remover preset:", error);
      return new Output(false, [], ["Erro ao remover filtro pré-definido"], null);
    }
  }

  async markAsUsed(
    teamId: string,
    profileId: string,
    presetId: string,
    isManager: boolean
  ): Promise<Output> {
    try {
      const { preset, forbidden } = await this.service.markAsUsed(
        teamId,
        profileId,
        presetId,
        isManager
      );
      if (forbidden) {
        return new Output(false, [], ["Sem permissão para usar este filtro pré-definido"], null);
      }
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

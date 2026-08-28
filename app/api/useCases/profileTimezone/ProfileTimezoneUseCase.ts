import { Output } from "@/lib/output";
import { isValidTimezone } from "@/lib/dates";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamRepository } from "@/app/api/infra/data/repositories/team/TeamRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import type { ITeamRepository } from "@/app/api/infra/data/repositories/team/ITeamRepository";
import type { IProfileTimezoneUseCase } from "./IProfileTimezoneUseCase";

const PROFILE_NOT_FOUND = "Perfil não encontrado";

export class ProfileTimezoneUseCase implements IProfileTimezoneUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly teams: ITeamRepository
  ) {}

  async getTimezone(supabaseId: string): Promise<Output> {
    try {
      const profile = await this.profiles.findTimezoneBySupabaseId(supabaseId);
      if (!profile) {
        return new Output(false, [], [PROFILE_NOT_FOUND], null);
      }

      return new Output(true, [], [], { timezone: profile.timezone });
    } catch (error) {
      console.error("[ProfileTimezoneUseCase][getTimezone] Erro:", error);
      return new Output(false, [], ["Erro interno"], null);
    }
  }

  async updateTimezone(supabaseId: string, timezone: string): Promise<Output> {
    try {
      if (!timezone || !isValidTimezone(timezone)) {
        return new Output(false, [], ["Timezone inválido"], null);
      }

      const profile = await this.profiles.findTimezoneBySupabaseId(supabaseId);
      if (!profile) {
        return new Output(false, [], [PROFILE_NOT_FOUND], null);
      }

      await this.profiles.updateTimezoneBySupabaseId(supabaseId, timezone);

      // O bootstrap do formulário público exibe o fuso do master do time, então
      // trocar o fuso invalida o bootstrap de toda a conta.
      const affectedTeamIds = await this.teams.findTeamIdsByMaster(profile.id);

      return new Output(true, ["Fuso horário atualizado"], [], { timezone, affectedTeamIds });
    } catch (error) {
      console.error("[ProfileTimezoneUseCase][updateTimezone] Erro:", error);
      return new Output(false, [], ["Erro interno"], null);
    }
  }
}

export const profileTimezoneUseCase = new ProfileTimezoneUseCase(profileRepository, teamRepository);

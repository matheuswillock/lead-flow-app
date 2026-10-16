import { Output } from "@/lib/output";
import type { ITeamScheduleSettingsUseCase } from "./ITeamScheduleSettingsUseCase";
import {
  isMeetingDurationMinutes,
  type MeetingDurationMinutes,
} from "@/app/api/domain/teamScheduleSettings/meetingDuration";
import type { ITeamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/ITeamScheduleSettingsRepository";
import { teamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/TeamScheduleSettingsRepository";

export class TeamScheduleSettingsUseCase implements ITeamScheduleSettingsUseCase {
  constructor(private readonly repository: ITeamScheduleSettingsRepository = teamScheduleSettingsRepository) {}

  async get(teamId: string): Promise<Output> {
    try {
      const durationMinutes = await this.repository.findMeetingDuration(teamId);
      if (durationMinutes === null) {
        return new Output(false, [], ["Time não encontrado."], null);
      }

      return new Output(true, [], [], { durationMinutes });
    } catch (error) {
      console.error("[TeamScheduleSettingsUseCase][get] Erro ao carregar configuração:", error);
      return new Output(false, [], ["Erro ao carregar configuração de agendamento."], null);
    }
  }

  async update(input: { teamId: string; durationMinutes: MeetingDurationMinutes }): Promise<Output> {
    try {
      if (!isMeetingDurationMinutes(input.durationMinutes)) {
        return new Output(false, [], ["A duração deve ser de 5 a 60 minutos, em intervalos de 5."], null);
      }

      const durationMinutes = await this.repository.updateMeetingDuration(input);
      if (durationMinutes === null) {
        return new Output(false, [], ["Time não encontrado."], null);
      }

      return new Output(true, ["Duração de reunião atualizada."], [], { durationMinutes });
    } catch (error) {
      console.error("[TeamScheduleSettingsUseCase][update] Erro ao atualizar configuração:", error);
      return new Output(false, [], ["Erro ao atualizar configuração de agendamento."], null);
    }
  }
}

export const teamScheduleSettingsUseCase: ITeamScheduleSettingsUseCase = new TeamScheduleSettingsUseCase();

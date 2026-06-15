import { scheduleShareService } from "@/app/api/services/scheduleShare/ScheduleShareService";
import { Output } from "@/lib/output";
import type { IScheduleShareUseCase } from "./IScheduleShareUseCase";

export class ScheduleShareUseCase implements IScheduleShareUseCase {
  async createPublicShare(input: { leadId: string; teamId: string }): Promise<Output> {
    try {
      const result = await scheduleShareService.createPublicShare(input);
      return new Output(true, ["Link público gerado com sucesso."], [], result);
    } catch (error) {
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao gerar link público do agendamento."],
        null
      );
    }
  }

  async getPublicShare(token: string): Promise<Output> {
    try {
      const result = await scheduleShareService.getPublicShare(token);
      return new Output(true, [], [], result);
    } catch (error) {
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao consultar agendamento público."],
        null
      );
    }
  }
}

export const scheduleShareUseCase = new ScheduleShareUseCase();

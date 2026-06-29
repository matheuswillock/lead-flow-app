import { Output } from "@/lib/output"
import { getPreScheduleSlotsPayload } from "@/app/api/services/preSchedule/PreScheduleSlotService"
import type { GetPreScheduleSlotsInput, IPreScheduleSlotUseCase } from "./IPreScheduleSlotUseCase"

export class PreScheduleSlotUseCase implements IPreScheduleSlotUseCase {
  async getSlots(input: GetPreScheduleSlotsInput): Promise<Output> {
    try {
      const payload = await getPreScheduleSlotsPayload(
        input.teamId,
        input.dateParam,
        undefined,
        input.excludeLeadId
      )

      return new Output(true, [], [], payload)
    } catch (error) {
      console.error("[PreScheduleSlotUseCase][getSlots] Erro:", error)
      return new Output(false, [], ["Erro interno do servidor."], null)
    }
  }
}

export const preScheduleSlotUseCase = new PreScheduleSlotUseCase()

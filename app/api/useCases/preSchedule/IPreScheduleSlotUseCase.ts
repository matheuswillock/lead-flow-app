import type { Output } from "@/lib/output"

export interface GetPreScheduleSlotsInput {
  teamId: string
  dateParam: string
  excludeLeadId?: string
}

export interface IPreScheduleSlotUseCase {
  getSlots(input: GetPreScheduleSlotsInput): Promise<Output>
}

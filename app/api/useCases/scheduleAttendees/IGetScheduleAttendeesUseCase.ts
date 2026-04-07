import { Output } from "@/lib/output";
import type { GetScheduleAttendeesInput } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

export interface IGetScheduleAttendeesUseCase {
  execute(input: GetScheduleAttendeesInput): Promise<Output>;
}

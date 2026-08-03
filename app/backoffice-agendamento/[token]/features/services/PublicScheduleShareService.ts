import type {
  IPublicScheduleShareService,
  PublicScheduleShareData,
} from "./IPublicScheduleShareService";
import { API_CLIENT_BASE } from "@/lib/route-map";

export class PublicScheduleShareService implements IPublicScheduleShareService {
  async getSchedule(token: string): Promise<PublicScheduleShareData> {
      const response = await fetch(`${API_CLIENT_BASE}/backoffice/public-schedules/${token}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || !result?.isValid || !result?.result) {
      const message =
        Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Não foi possível carregar o agendamento.";
      throw new Error(message);
    }

    return result.result as PublicScheduleShareData;
  }
}

export const publicScheduleShareService = new PublicScheduleShareService();

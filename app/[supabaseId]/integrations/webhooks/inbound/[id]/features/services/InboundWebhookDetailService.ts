import { teamWebhooksService } from "../../../../features/services/TeamWebhooksService";
import type { IInboundWebhookDetailService } from "./IInboundWebhookDetailService";

export class InboundWebhookDetailService implements IInboundWebhookDetailService {
  getById(supabaseId: string, teamId: string, id: string) {
    return teamWebhooksService.getById(supabaseId, teamId, id);
  }

  update(supabaseId: string, teamId: string, id: string, payload: Parameters<IInboundWebhookDetailService["update"]>[3]) {
    return teamWebhooksService.update(supabaseId, teamId, id, payload);
  }

  changeStatus(
    supabaseId: string,
    teamId: string,
    id: string,
    body: Parameters<IInboundWebhookDetailService["changeStatus"]>[3]
  ) {
    return teamWebhooksService.changeStatus(supabaseId, teamId, id, body);
  }

  listLogs(
    supabaseId: string,
    teamId: string,
    id: string,
    params: Parameters<IInboundWebhookDetailService["listLogs"]>[3]
  ) {
    return teamWebhooksService.listLogs(supabaseId, teamId, id, params);
  }

  testDelivery(supabaseId: string, teamId: string, id: string) {
    return teamWebhooksService.testDelivery(supabaseId, teamId, id);
  }
}

export const inboundWebhookDetailService = new InboundWebhookDetailService();

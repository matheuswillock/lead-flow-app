import { teamWebhooksService } from "../../../../features/services/TeamWebhooksService";
import type { IInboundWebhookCreateService } from "./IInboundWebhookCreateService";
import type { CreateInboundWebhookPayload } from "../../../../features/services/ITeamWebhooksService";

export class InboundWebhookCreateService implements IInboundWebhookCreateService {
  create(supabaseId: string, teamId: string, payload: CreateInboundWebhookPayload) {
    return teamWebhooksService.create(supabaseId, teamId, payload);
  }
}

export const inboundWebhookCreateService = new InboundWebhookCreateService();

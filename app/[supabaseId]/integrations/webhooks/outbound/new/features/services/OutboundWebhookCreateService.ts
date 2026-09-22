import { teamWebhooksService } from "../../../../features/services/TeamWebhooksService";
import type { IOutboundWebhookCreateService } from "./IOutboundWebhookCreateService";
import type { CreateOutboundWebhookPayload } from "../../../../features/services/ITeamWebhooksService";

export class OutboundWebhookCreateService implements IOutboundWebhookCreateService {
  create(supabaseId: string, teamId: string, payload: CreateOutboundWebhookPayload) {
    return teamWebhooksService.create(supabaseId, teamId, payload);
  }
}

export const outboundWebhookCreateService = new OutboundWebhookCreateService();

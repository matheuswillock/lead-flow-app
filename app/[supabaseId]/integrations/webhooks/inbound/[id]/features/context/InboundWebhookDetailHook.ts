import { useMemo } from "react";
import { inboundWebhookDetailService } from "../services/InboundWebhookDetailService";
import type { InboundWebhookDetailContextValue } from "./InboundWebhookDetailTypes";

export function useInboundWebhookDetailHook(
  supabaseId: string,
  webhookId: string
): InboundWebhookDetailContextValue {
  return useMemo(
    () => ({
      supabaseId,
      webhookId,
      listPath: `/${supabaseId}/integrations/webhooks/inbound`,
      service: inboundWebhookDetailService,
    }),
    [supabaseId, webhookId]
  );
}

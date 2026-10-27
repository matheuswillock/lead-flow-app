import { useMemo } from "react";
import { outboundWebhookDetailService } from "../services/OutboundWebhookDetailService";
import type { OutboundWebhookDetailContextValue } from "./OutboundWebhookDetailTypes";

export function useOutboundWebhookDetailHook(
  supabaseId: string,
  webhookId: string
): OutboundWebhookDetailContextValue {
  return useMemo(
    () => ({
      supabaseId,
      webhookId,
      listPath: `/${supabaseId}/integrations/webhooks/outbound`,
      service: outboundWebhookDetailService,
    }),
    [supabaseId, webhookId]
  );
}

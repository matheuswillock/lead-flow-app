"use client";

import { WebhookDetailContainer } from "../../../../features/components/WebhookDetailContainer";

export function OutboundWebhookDetailPageContainer({
  supabaseId,
  webhookId,
}: {
  supabaseId: string;
  webhookId: string;
}) {
  return (
    <WebhookDetailContainer supabaseId={supabaseId} webhookId={webhookId} direction="outbound" />
  );
}

"use client";

import { WebhookDetailContainer } from "../../../../features/components/WebhookDetailContainer";

export function InboundWebhookDetailPageContainer({
  supabaseId,
  webhookId,
}: {
  supabaseId: string;
  webhookId: string;
}) {
  return (
    <WebhookDetailContainer supabaseId={supabaseId} webhookId={webhookId} direction="inbound" />
  );
}

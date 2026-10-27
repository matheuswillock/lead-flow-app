"use client";

import { WebhookDetailContainer } from "../../../../features/components/WebhookDetailContainer";
import {
  OutboundWebhookDetailProvider,
  useOutboundWebhookDetailContext,
} from "../context/OutboundWebhookDetailContext";

function OutboundWebhookDetailPageContent() {
  const { supabaseId, webhookId, listPath, service } = useOutboundWebhookDetailContext();
  return (
    <WebhookDetailContainer
      supabaseId={supabaseId}
      webhookId={webhookId}
      direction="outbound"
      listPath={listPath}
      service={service}
    />
  );
}

export function OutboundWebhookDetailPageContainer({
  supabaseId,
  webhookId,
}: {
  supabaseId: string;
  webhookId: string;
}) {
  return (
    <OutboundWebhookDetailProvider supabaseId={supabaseId} webhookId={webhookId}>
      <OutboundWebhookDetailPageContent />
    </OutboundWebhookDetailProvider>
  );
}

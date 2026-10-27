"use client";

import { WebhookDetailContainer } from "../../../../features/components/WebhookDetailContainer";
import {
  InboundWebhookDetailProvider,
  useInboundWebhookDetailContext,
} from "../context/InboundWebhookDetailContext";

function InboundWebhookDetailPageContent() {
  const { supabaseId, webhookId, listPath, service } = useInboundWebhookDetailContext();
  return (
    <WebhookDetailContainer
      supabaseId={supabaseId}
      webhookId={webhookId}
      direction="inbound"
      listPath={listPath}
      service={service}
    />
  );
}

export function InboundWebhookDetailPageContainer({
  supabaseId,
  webhookId,
}: {
  supabaseId: string;
  webhookId: string;
}) {
  return (
    <InboundWebhookDetailProvider supabaseId={supabaseId} webhookId={webhookId}>
      <InboundWebhookDetailPageContent />
    </InboundWebhookDetailProvider>
  );
}

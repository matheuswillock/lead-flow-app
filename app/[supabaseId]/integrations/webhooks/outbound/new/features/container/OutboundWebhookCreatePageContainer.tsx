"use client";

import { OutboundWebhookCreateContainer } from "../../../../features/components/OutboundWebhookCreateContainer";
import {
  OutboundWebhookCreateProvider,
  useOutboundWebhookCreateContext,
} from "../context/OutboundWebhookCreateContext";

function OutboundWebhookCreatePageContent() {
  const { supabaseId, listPath, buildDetailPath, service } = useOutboundWebhookCreateContext();
  return (
    <OutboundWebhookCreateContainer
      supabaseId={supabaseId}
      listPath={listPath}
      buildDetailPath={buildDetailPath}
      service={service}
    />
  );
}

export function OutboundWebhookCreatePageContainer({ supabaseId }: { supabaseId: string }) {
  return (
    <OutboundWebhookCreateProvider supabaseId={supabaseId}>
      <OutboundWebhookCreatePageContent />
    </OutboundWebhookCreateProvider>
  );
}

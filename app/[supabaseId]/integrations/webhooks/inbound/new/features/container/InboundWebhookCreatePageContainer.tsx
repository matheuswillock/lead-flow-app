"use client";

import { InboundWebhookCreateContainer } from "../../../../features/components/InboundWebhookCreateContainer";
import {
  InboundWebhookCreateProvider,
  useInboundWebhookCreateContext,
} from "../context/InboundWebhookCreateContext";

function InboundWebhookCreatePageContent() {
  const { supabaseId, listPath, buildDetailPath, service } = useInboundWebhookCreateContext();
  return (
    <InboundWebhookCreateContainer
      supabaseId={supabaseId}
      listPath={listPath}
      buildDetailPath={buildDetailPath}
      service={service}
    />
  );
}

export function InboundWebhookCreatePageContainer({ supabaseId }: { supabaseId: string }) {
  return (
    <InboundWebhookCreateProvider supabaseId={supabaseId}>
      <InboundWebhookCreatePageContent />
    </InboundWebhookCreateProvider>
  );
}

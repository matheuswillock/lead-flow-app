"use client";

import { InboundWebhookCreateContainer } from "../../../../features/components/InboundWebhookCreateContainer";
import {
  InboundWebhookCreateProvider,
  useInboundWebhookCreateContext,
} from "../context/InboundWebhookCreateContext";

function InboundWebhookCreatePageContent({ initialName }: { initialName?: string }) {
  const { supabaseId, listPath, buildDetailPath, service } = useInboundWebhookCreateContext();
  return (
    <InboundWebhookCreateContainer
      supabaseId={supabaseId}
      listPath={listPath}
      buildDetailPath={buildDetailPath}
      service={service}
      initialName={initialName}
    />
  );
}

export function InboundWebhookCreatePageContainer({
  supabaseId,
  initialName,
}: {
  supabaseId: string;
  initialName?: string;
}) {
  return (
    <InboundWebhookCreateProvider supabaseId={supabaseId}>
      <InboundWebhookCreatePageContent initialName={initialName} />
    </InboundWebhookCreateProvider>
  );
}

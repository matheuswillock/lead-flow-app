"use client";

import { WebhooksListContainer } from "../../../features/components/WebhooksListContainer";

export function InboundWebhooksListContainer({ supabaseId }: { supabaseId: string }) {
  return <WebhooksListContainer supabaseId={supabaseId} direction="inbound" />;
}

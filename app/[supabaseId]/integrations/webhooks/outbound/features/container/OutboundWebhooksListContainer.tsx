"use client";

import { WebhooksListContainer } from "../../../features/components/WebhooksListContainer";

export function OutboundWebhooksListContainer({ supabaseId }: { supabaseId: string }) {
  return <WebhooksListContainer supabaseId={supabaseId} direction="outbound" />;
}

"use client";

import { OutboundWebhookCreateContainer } from "../../../../features/components/OutboundWebhookCreateContainer";

export function OutboundWebhookCreatePageContainer({ supabaseId }: { supabaseId: string }) {
  return <OutboundWebhookCreateContainer supabaseId={supabaseId} />;
}

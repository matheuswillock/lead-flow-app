"use client";

import { InboundWebhookCreateContainer } from "../../../../features/components/InboundWebhookCreateContainer";

export function InboundWebhookCreatePageContainer({ supabaseId }: { supabaseId: string }) {
  return <InboundWebhookCreateContainer supabaseId={supabaseId} />;
}

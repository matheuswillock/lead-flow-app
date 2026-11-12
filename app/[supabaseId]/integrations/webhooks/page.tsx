import { IntegrationsProvider } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";
import { WebhooksEntryProvider } from "./features/context/WebhooksEntryContext";
import { WebhooksEntryContainer } from "./features/container/WebhooksEntryContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function WebhooksEntryPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <IntegrationsProvider supabaseId={supabaseId}>
      <WebhooksEntryProvider supabaseId={supabaseId}>
        <WebhooksEntryContainer />
      </WebhooksEntryProvider>
    </IntegrationsProvider>
  );
}

import { InboundWebhookDetailProvider } from "./features/context/InboundWebhookDetailContext";
import { InboundWebhookDetailPageContainer } from "./features/container/InboundWebhookDetailPageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string; id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId, id } = await params;
  return (
    <InboundWebhookDetailProvider supabaseId={supabaseId} webhookId={id}>
      <InboundWebhookDetailPageContainer supabaseId={supabaseId} webhookId={id} />
    </InboundWebhookDetailProvider>
  );
}

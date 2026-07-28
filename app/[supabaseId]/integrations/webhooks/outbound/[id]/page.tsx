import { OutboundWebhookDetailProvider } from "./features/context/OutboundWebhookDetailContext";
import { OutboundWebhookDetailPageContainer } from "./features/container/OutboundWebhookDetailPageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string; id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId, id } = await params;
  return (
    <OutboundWebhookDetailProvider supabaseId={supabaseId} webhookId={id}>
      <OutboundWebhookDetailPageContainer supabaseId={supabaseId} webhookId={id} />
    </OutboundWebhookDetailProvider>
  );
}

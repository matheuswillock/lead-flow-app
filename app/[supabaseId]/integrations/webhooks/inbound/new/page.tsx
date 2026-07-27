import { InboundWebhookCreateProvider } from "./features/context/InboundWebhookCreateContext";
import { InboundWebhookCreatePageContainer } from "./features/container/InboundWebhookCreatePageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return (
    <InboundWebhookCreateProvider supabaseId={supabaseId}>
      <InboundWebhookCreatePageContainer supabaseId={supabaseId} />
    </InboundWebhookCreateProvider>
  );
}

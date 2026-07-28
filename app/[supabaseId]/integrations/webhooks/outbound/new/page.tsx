import { OutboundWebhookCreateProvider } from "./features/context/OutboundWebhookCreateContext";
import { OutboundWebhookCreatePageContainer } from "./features/container/OutboundWebhookCreatePageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return (
    <OutboundWebhookCreateProvider supabaseId={supabaseId}>
      <OutboundWebhookCreatePageContainer supabaseId={supabaseId} />
    </OutboundWebhookCreateProvider>
  );
}

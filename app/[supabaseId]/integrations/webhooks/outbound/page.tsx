import { OutboundWebhooksListProvider } from "./features/context/OutboundWebhooksListContext";
import { OutboundWebhooksListContainer } from "./features/container/OutboundWebhooksListContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return (
    <OutboundWebhooksListProvider supabaseId={supabaseId}>
      <OutboundWebhooksListContainer supabaseId={supabaseId} />
    </OutboundWebhooksListProvider>
  );
}

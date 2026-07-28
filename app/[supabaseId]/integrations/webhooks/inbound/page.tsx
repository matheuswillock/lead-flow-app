import { InboundWebhooksListProvider } from "./features/context/InboundWebhooksListContext";
import { InboundWebhooksListContainer } from "./features/container/InboundWebhooksListContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return (
    <InboundWebhooksListProvider supabaseId={supabaseId}>
      <InboundWebhooksListContainer supabaseId={supabaseId} />
    </InboundWebhooksListProvider>
  );
}

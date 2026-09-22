import { OutboundWebhookCreatePageContainer } from "./features/container/OutboundWebhookCreatePageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

// SPEC 10, R10-5 (decisão do owner): features/context mínima e real —
// o Provider deriva `listPath`/`buildDetailPath` e os repassa ao
// componente compartilhado, que não os hardcoda mais.
export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return <OutboundWebhookCreatePageContainer supabaseId={supabaseId} />;
}

import { InboundWebhookCreatePageContainer } from "./features/container/InboundWebhookCreatePageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

// SPEC 10, R10-5 (decisão do owner): features/context mínima e real —
// o Provider deriva `listPath`/`buildDetailPath` e os repassa ao
// componente compartilhado, que não os hardcoda mais.
export default async function Page({ params }: PageProps) {
  const { supabaseId } = await params;
  return <InboundWebhookCreatePageContainer supabaseId={supabaseId} />;
}

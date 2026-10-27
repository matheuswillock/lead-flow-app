import { OutboundWebhookDetailPageContainer } from "./features/container/OutboundWebhookDetailPageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string; id: string }>;
}

// SPEC 10, R10-5 (decisão do owner): features/context mínima e real —
// o Provider deriva `listPath` e o repassa ao componente compartilhado
// (WebhookDetailContainer), que não o hardcoda mais a partir de
// supabaseId+direction.
export default async function Page({ params }: PageProps) {
  const { supabaseId, id } = await params;
  return <OutboundWebhookDetailPageContainer supabaseId={supabaseId} webhookId={id} />;
}

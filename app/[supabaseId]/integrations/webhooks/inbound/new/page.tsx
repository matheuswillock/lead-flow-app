import { InboundWebhookCreatePageContainer } from "./features/container/InboundWebhookCreatePageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
  searchParams: Promise<{ from_name?: string | string[] }>;
}

// SPEC 10, R10-5 (decisão do owner): features/context mínima e real —
// o Provider deriva `listPath`/`buildDetailPath` e os repassa ao
// componente compartilhado, que não os hardcoda mais.
export default async function Page({ params, searchParams }: PageProps) {
  const { supabaseId } = await params;
  const { from_name: fromName } = await searchParams;
  const initialName = typeof fromName === "string" ? fromName.slice(0, 120) : undefined;
  return <InboundWebhookCreatePageContainer supabaseId={supabaseId} initialName={initialName} />;
}

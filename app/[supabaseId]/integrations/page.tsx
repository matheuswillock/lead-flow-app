import { IntegrationsProvider } from "./features/context/IntegrationsContext";
import { IntegrationsContainer } from "./features/container/IntegrationsContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function IntegrationsPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <IntegrationsProvider supabaseId={supabaseId}>
      <IntegrationsContainer />
    </IntegrationsProvider>
  );
}

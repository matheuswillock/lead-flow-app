import { GenericWebhookPageProvider } from "./features/context/GenericWebhookPageContext";
import { GenericWebhookContainer } from "./features/container/GenericWebhookContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function GenericWebhookPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <GenericWebhookPageProvider supabaseId={supabaseId}>
      <GenericWebhookContainer />
    </GenericWebhookPageProvider>
  );
}

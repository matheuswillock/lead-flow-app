import { LeadFormPageProvider } from "./features/context/LeadFormPageContext";
import { LeadFormPageContainer } from "./features/container/LeadFormPageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function LeadFormPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <LeadFormPageProvider supabaseId={supabaseId}>
      <LeadFormPageContainer />
    </LeadFormPageProvider>
  );
}

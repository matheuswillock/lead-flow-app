import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PublicLeadFormProvider } from "./features/context/PublicLeadFormContext";
import { PublicLeadFormContainer } from "./features/container/PublicLeadFormContainer";
import Loading from "./loading";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function PublicLeadFormByTeamPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Loading />}>
        <PublicLeadFormProvider teamId={supabaseId}>
          <PublicLeadFormContainer />
        </PublicLeadFormProvider>
      </Suspense>
    </>
  );
}

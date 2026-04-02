import { Suspense } from "react";
import { PublicLeadFormProvider } from "./features/context/PublicLeadFormContext";
import { PublicLeadFormContainer } from "./features/container/PublicLeadFormContainer";
import { Toaster } from "@/components/ui/sonner";
import Loading from "./loading";

interface PageProps {
  params: Promise<{ supabaseId: string; teamId: string }>;
}

export default async function PublicLeadFormPage({ params }: PageProps) {
  const { supabaseId, teamId } = await params;

  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Loading />}>
        <PublicLeadFormProvider supabaseId={supabaseId} teamId={teamId}>
          <PublicLeadFormContainer />
        </PublicLeadFormProvider>
      </Suspense>
    </>
  );
}

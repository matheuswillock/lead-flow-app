import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DocumentRequestProvider } from "./features/context/DocumentRequestContext";
import { DocumentRequestContainer } from "./features/container/DocumentRequestContainer";
import Loading from "./loading";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function DocumentRequestPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Loading />}>
        <DocumentRequestProvider token={token}>
          <DocumentRequestContainer />
        </DocumentRequestProvider>
      </Suspense>
    </>
  );
}

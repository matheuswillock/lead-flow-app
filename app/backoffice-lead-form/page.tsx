import { Suspense } from "react"
import { Toaster } from "@/components/ui/sonner"
import { BackofficePublicLeadFormProvider } from "./features/context/BackofficePublicLeadFormContext"
import { BackofficePublicLeadFormContainer } from "./features/container/BackofficePublicLeadFormContainer"
import Loading from "./loading"

export default function BackofficeLeadFormPage() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Loading />}>
        <BackofficePublicLeadFormProvider>
          <BackofficePublicLeadFormContainer />
        </BackofficePublicLeadFormProvider>
      </Suspense>
    </>
  )
}

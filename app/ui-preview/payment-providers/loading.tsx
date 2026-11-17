import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentProviderPreviewLoading() {
  return (
    <main
      aria-label="Carregando prévia dos providers"
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 lg:px-8"
    >
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </main>
  )
}

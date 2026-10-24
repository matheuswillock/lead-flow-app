import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficePaymentProvidersLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

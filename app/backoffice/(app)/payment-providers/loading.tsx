import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentProvidersLoading() {
  return <main className="flex flex-col gap-6 p-4 md:p-8"><Skeleton className="h-9 w-72" /><Skeleton className="h-32 w-full" /></main>
}

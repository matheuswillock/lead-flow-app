import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeDeliverabilityLoading() {
  return <div className="flex flex-col gap-6 p-6"><Skeleton className="h-16 w-full max-w-xl" /><Skeleton className="h-80 w-full" /></div>
}

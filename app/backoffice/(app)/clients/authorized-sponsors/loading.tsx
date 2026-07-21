import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeAuthorizedSponsorsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeBackupsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

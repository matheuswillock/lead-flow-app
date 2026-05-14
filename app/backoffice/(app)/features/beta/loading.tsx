import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeBetaLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

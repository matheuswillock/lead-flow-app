import { Skeleton } from "@/components/ui/skeleton"

export default function CampanhasAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`campanhas-analytics-loading-kpi-${index}`} className="h-24 w-full" />
        ))}
      </div>

      <Skeleton className="h-72 w-full" />
    </div>
  )
}

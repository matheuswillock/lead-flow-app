import { Skeleton } from "@/components/ui/skeleton"

export default function CronExecutionsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`cron-executions-loading-row-${index}`} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

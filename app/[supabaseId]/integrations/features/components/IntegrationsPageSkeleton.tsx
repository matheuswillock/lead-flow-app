import { Skeleton } from "@/components/ui/skeleton";

export function IntegrationsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-72 max-w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[88%] max-w-full" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-10 min-w-0 flex-1" />
            <Skeleton className="size-10" />
            <Skeleton className="size-10" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-56 max-w-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[86%] max-w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 min-w-0 flex-1" />
              <Skeleton className="size-10" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>

          <Skeleton className="h-10 w-52" />

          <div className="flex flex-col gap-3 border-t pt-4">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-[260px] w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

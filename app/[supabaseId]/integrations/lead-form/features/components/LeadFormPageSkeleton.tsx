import { Skeleton } from "@/components/ui/skeleton";

export function LeadFormPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="mt-4 h-9 w-full" />
      </div>
    </div>
  );
}

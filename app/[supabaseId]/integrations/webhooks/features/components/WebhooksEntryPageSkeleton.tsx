import { Skeleton } from "@/components/ui/skeleton";

function WebhookDirectionCardSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}

export function WebhooksEntryPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WebhookDirectionCardSkeleton />
        <WebhookDirectionCardSkeleton />
      </div>
    </div>
  );
}

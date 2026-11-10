import { Skeleton } from "@/components/ui/skeleton";

export function GenericWebhookPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

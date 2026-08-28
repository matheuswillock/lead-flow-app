import { Skeleton } from "@/components/ui/skeleton";

export function LeadDocumentRequestsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-1">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

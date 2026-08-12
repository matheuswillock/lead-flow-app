import { Skeleton } from "@/components/ui/skeleton";

export default function BackofficeRadarOutboxLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-48 w-full max-w-xl" />
    </div>
  );
}

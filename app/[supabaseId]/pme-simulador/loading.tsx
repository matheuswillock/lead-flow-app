import { Skeleton } from "@/components/ui/skeleton";

export default function PmeSimulatorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-72 rounded-md" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-40 w-full max-w-xl" />
    </div>
  );
}

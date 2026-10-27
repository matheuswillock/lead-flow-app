import { Skeleton } from "@/components/ui/skeleton";

export default function ApiCatalogLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

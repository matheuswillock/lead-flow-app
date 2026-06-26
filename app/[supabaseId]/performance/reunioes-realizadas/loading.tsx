import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-80 w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

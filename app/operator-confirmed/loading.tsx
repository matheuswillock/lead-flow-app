import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border p-6">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
    </main>
  );
}

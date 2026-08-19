import { Skeleton } from "@/components/ui/skeleton";

export default function AdquirirCreditosLoading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-[520px]" />
        <Skeleton className="h-16 w-[480px]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </div>
    </main>
  );
}
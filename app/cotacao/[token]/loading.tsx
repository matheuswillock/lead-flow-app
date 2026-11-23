import { Skeleton } from "@/components/ui/skeleton";

export default function ClientQuoteLoading() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Skeleton className="h-8 w-72 rounded-md" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </main>
  );
}

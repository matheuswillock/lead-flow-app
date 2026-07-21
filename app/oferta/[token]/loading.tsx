import { Skeleton } from "@/components/ui/skeleton"

export default function PublicOfferLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  )
}

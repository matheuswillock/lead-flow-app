import { Skeleton } from "@/components/ui/skeleton"

export default function EmailUnsubscribeLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Skeleton className="mx-auto h-10 w-44" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </main>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

export default function LandingPagesLoading() {
  return (
    <main className="container mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-full max-w-xl" /></div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-10 w-full max-w-2xl" />
      <div className="flex flex-col gap-3"><Skeleton className="h-24 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" /></div>
    </main>
  )
}

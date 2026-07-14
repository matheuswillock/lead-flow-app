import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-[32rem] w-full" /></main>
}


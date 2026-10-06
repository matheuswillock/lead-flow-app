import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return <main className="container mx-auto grid gap-4 p-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></main>
}

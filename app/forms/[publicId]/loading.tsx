import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Skeleton className="h-[520px] w-full max-w-2xl" />
    </main>
  )
}

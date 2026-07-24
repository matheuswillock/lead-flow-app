import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

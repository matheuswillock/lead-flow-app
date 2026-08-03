import { Skeleton } from "@/components/ui/skeleton"

export default function ExtracaoLeadsLoading() {
  return (
    <div className="flex h-full gap-4 overflow-hidden p-5">
      <Skeleton className="w-[340px] shrink-0 rounded-xl" />
      <Skeleton className="flex-1 rounded-xl" />
    </div>
  )
}

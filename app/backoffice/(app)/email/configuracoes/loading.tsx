import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeEmailConfiguracoesLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

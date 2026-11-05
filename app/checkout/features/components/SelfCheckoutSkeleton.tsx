import { Skeleton } from "@/components/ui/skeleton"

/** Estado de carregamento: mesma estrutura da página pronta, sem texto. */
export function SelfCheckoutSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando planos"
      className="mx-auto flex w-full max-w-[720px] flex-col gap-6"
    >
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-36" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-28" />
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

/** Estado de carregamento: mesma estrutura da página pronta, sem texto. */
export function SelfCheckoutSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando planos"
      className="mx-auto flex w-full max-w-[720px] flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  )
}

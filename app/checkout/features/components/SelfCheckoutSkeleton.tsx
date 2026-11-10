import { Skeleton } from "@/components/ui/skeleton"

/** Estado de carregamento: mesma estrutura da página pronta (formulário e resumo), sem texto. */
export function SelfCheckoutSkeleton() {
  return (
    <div role="status" aria-label="Carregando planos" className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-[124px] w-full" />
              <Skeleton className="h-[124px] w-full" />
              <Skeleton className="h-[124px] w-full" />
              <Skeleton className="h-[124px] w-full" />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <Skeleton className="h-8 w-36" />
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
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    </div>
  )
}

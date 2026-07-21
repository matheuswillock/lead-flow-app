import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton com a silhueta do formulário público de lead — substitui os
 * spinners genéricos para reduzir a percepção de espera (route-level
 * loading.tsx e estado de bootstrap do formulário).
 */
export function LeadFormSkeleton() {
  return (
    <div className="flex min-h-screen justify-center bg-background p-4">
      <div className="flex w-full max-w-2xl flex-col gap-6 py-8">
        {/* Cabeçalho: avatar do time + título */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Campos do formulário */}
        <div className="flex flex-col gap-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Observações */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        {/* Botão de envio */}
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

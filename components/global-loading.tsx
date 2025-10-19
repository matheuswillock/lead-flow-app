import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

/**
 * Loading global exibido enquanto UserContext carrega
 * Mostra um skeleton do layout com sidebar e conteúdo
 */
export function GlobalLoading() {
  return (
    <div className="flex h-screen w-full">
      {/* Skeleton da Sidebar */}
      <div className="hidden md:flex w-64 border-r bg-background p-4 flex-col gap-4">
        <div className="flex items-center gap-2 px-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        <div className="flex-1 space-y-2 mt-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 px-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background p-4 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Área de Conteúdo */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Carregando...</h3>
                <p className="text-sm text-muted-foreground">
                  Preparando sua área de trabalho
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading simplificado para páginas individuais
 * Usado quando apenas uma parte da página está carregando
 */
export function PageLoading() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Carregando...</h3>
          <p className="text-sm text-muted-foreground">
            Aguarde um momento
          </p>
        </div>
      </div>
    </div>
  );
}

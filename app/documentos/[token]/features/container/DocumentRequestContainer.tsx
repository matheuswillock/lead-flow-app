"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentItemCard } from "../components/DocumentItemCard";
import { useDocumentRequestContext } from "../context/DocumentRequestHook";

export function DocumentRequestContainer() {
  const { request, isLoading, error, token, uploadItem } = useDocumentRequestContext();

  const uploadedCount = useMemo(
    () => request?.items.filter((item) => Boolean(item.uploadedAt)).length ?? 0,
    [request]
  );
  const total = request?.items.length ?? 0;
  const progress = total === 0 ? 0 : Math.round((uploadedCount / total) * 100);
  const allDone = total > 0 && uploadedCount === total;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            {error ??
              "Esta solicitação de documentos não foi encontrada. Peça um novo link ao seu corretor."}
          </p>
        </div>
      </main>
    );
  }

  const closerName = request.createdBy.fullName || "Seu corretor";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Corretor Studio
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Solicitação de documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Enviado por {closerName} para {request.lead.name}
          </p>
        </header>

        {request.message ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
            {request.message}
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">
              {uploadedCount} de {total} documentos enviados
            </span>
          </div>
          <Progress value={progress} />
        </section>

        {allDone ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-8 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <h2 className="text-lg font-semibold">Todos os documentos foram enviados</h2>
            <p className="text-sm text-muted-foreground">
              Obrigado! Seu corretor foi notificado e já pode seguir com a análise.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {request.items.map((item) => (
              <DocumentItemCard
                key={item.id}
                item={item}
                token={token}
                onUpload={uploadItem}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

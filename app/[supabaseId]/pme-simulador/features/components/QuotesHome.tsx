"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { formatBrl, formatVidas } from "./format";

export function QuotesHome() {
  const ctx = usePlanSimulatorContext();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight">
            <strong className="font-semibold">Cotações</strong>
          </h1>
          <p className="text-sm text-muted-foreground">
            {ctx.quotes.length === 0 ? "Nenhuma cotação ainda" : `${ctx.quotes.length} ${ctx.quotes.length === 1 ? "cotação" : "cotações"}`}
          </p>
        </div>
        <Button type="button" onClick={ctx.openNew}>
          <Plus className="size-4" />
          Nova cotação
        </Button>
      </header>

      {ctx.quotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Crie uma cotação para comparar planos por faixa etária, operadora e rede.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {ctx.quotes.map((q) => (
            <li key={q.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void ctx.openQuote(q.id)}>
                    <span className="block truncate font-medium">{q.nome}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatVidas(q.vidas)}
                      {q.uf ? ` · ${q.uf}` : ""}
                      {q.selecionados ? ` · ${q.selecionados} ${q.selecionados === 1 ? "plano" : "planos"} na proposta` : ""}
                    </span>
                  </button>
                  <div className="text-right text-sm">
                    {q.resumo && q.resumo.min != null ? (
                      <>
                        <span className="text-muted-foreground">a partir de </span>
                        <span className="font-semibold tabular-nums">{formatBrl(q.resumo.min)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sem preços ainda</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void ctx.duplicate(q.id)}>
                      <Copy className="size-4" />
                      Duplicar
                    </Button>
                    {confirmId === q.id ? (
                      <Button type="button" variant="destructive" size="sm" onClick={() => void ctx.remove(q.id)}>
                        Confirmar exclusão
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" aria-label={`Excluir ${q.nome}`} onClick={() => setConfirmId(q.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

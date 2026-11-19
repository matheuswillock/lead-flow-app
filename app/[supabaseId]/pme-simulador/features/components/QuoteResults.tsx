"use client";

import { ArrowLeft, Check, ChevronDown, Info, Plus, Send, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { QUOTE_MAX_SELECTED, type SimulationRow } from "../context/PlanSimulatorTypes";
import { FiltersEditor } from "./FiltersEditor";
import { LivesEditor } from "./LivesEditor";
import { formatBrl, formatVidas } from "./format";

type OperatorGroup = { operadora: string; logoPath: string; rows: SimulationRow[]; min: number };

function groupByOperator(rows: SimulationRow[]): OperatorGroup[] {
  const map = new Map<string, OperatorGroup>();
  for (const row of rows) {
    const group = map.get(row.operadora) ?? { operadora: row.operadora, logoPath: row.logoPath, rows: [], min: Infinity };
    group.rows.push(row);
    group.min = Math.min(group.min, row.total);
    map.set(row.operadora, group);
  }
  return [...map.values()].sort((a, b) => a.min - b.min);
}

/** Tela de resultados: operadoras, planos, proposta e envio ao cliente. */
export function QuoteResults() {
  const ctx = usePlanSimulatorContext();
  const [adjusting, setAdjusting] = useState(false);
  const [operator, setOperator] = useState<string | null>(null);

  const groups = useMemo(() => groupByOperator(ctx.sim?.rows ?? []), [ctx.sim]);
  const activeGroup = groups.find((g) => g.operadora === operator) ?? null;
  const proposal = ctx.draft.sel.map((chave) => ctx.seenRows[chave] ?? { chave, plano: "Plano fora dos filtros atuais", operadora: "", total: null });
  const included = new Set(ctx.draft.sel);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={ctx.goHome}>
            <ArrowLeft className="size-4" />
            Cotações
          </Button>
          <span className="text-xs text-muted-foreground">{ctx.saving ? "Salvando…" : "Alterações salvas"}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Input aria-label="Nome da cotação" value={ctx.nome} maxLength={80} className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0" onChange={(e) => ctx.renameQuote(e.target.value)} />
            <p className="text-sm text-muted-foreground">
              {formatVidas(ctx.totalVidas)} · {ctx.draft.uf}
            </p>
          </div>
          <Button type="button" onClick={() => ctx.setSendOpen(true)} disabled={ctx.draft.sel.length === 0}>
            <Send className="size-4" />
            Enviar ao cliente ({ctx.draft.sel.length})
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-0">
          <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left font-medium" aria-expanded={adjusting} onClick={() => setAdjusting((v) => !v)}>
            Vidas e filtros
            <ChevronDown className={`size-4 transition-transform ${adjusting ? "rotate-180" : ""}`} />
          </button>
          {adjusting ? (
            <div className="flex flex-col gap-6 border-t p-4">
              <LivesEditor lives={ctx.draft.lives} onChange={ctx.setLives} />
              <FiltersEditor uf={ctx.draft.uf} filters={ctx.draft.filters} onUf={ctx.setUf} onPatch={ctx.patchFilters} onSearchHospitals={ctx.searchHospitals} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {ctx.sim && (ctx.sim.ocultosPorVidas > 0 || ctx.sim.ocultosPorValor > 0) ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          {ctx.sim.ocultosPorVidas > 0 ? `${ctx.sim.ocultosPorVidas} planos não aceitam ${formatVidas(ctx.totalVidas)} e estão ocultos. ` : ""}
          {ctx.sim.ocultosPorValor > 0 ? `${ctx.sim.ocultosPorValor} fora da faixa de valor. ` : ""}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-medium">Operadoras</h2>
            {ctx.simLoading && !ctx.sim ? <p className="text-sm text-muted-foreground">Calculando…</p> : null}
            {ctx.sim && groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano atende a esses critérios. Ajuste os filtros.</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <button
                  key={group.operadora}
                  type="button"
                  aria-pressed={operator === group.operadora}
                  onClick={() => setOperator(group.operadora)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left ${operator === group.operadora ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                >
                  <span className="relative h-8 w-20 shrink-0">
                    <Image src={group.logoPath} alt={group.operadora} fill sizes="80px" className="object-contain" unoptimized />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{group.operadora}</span>
                    <span className="block text-xs text-muted-foreground">
                      {group.rows.length} {group.rows.length === 1 ? "plano" : "planos"} · a partir de {formatBrl(group.min)}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {activeGroup ? (
              <ul className="flex flex-col divide-y rounded-lg border">
                {activeGroup.rows.map((row) => {
                  const on = included.has(row.chave);
                  return (
                    <li key={row.chave} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.plano}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.tabela} · {row.acomodacao} · {row.contratacao} · {row.coparticipacao}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatBrl(row.total)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void ctx.openDetail(row.chave)}>
                          Detalhes
                        </Button>
                        <Button type="button" variant={on ? "secondary" : "outline"} size="sm" aria-pressed={on} onClick={() => ctx.toggleSel(row.chave)}>
                          {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                          {on ? "Incluído" : "Incluir"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Proposta para o cliente</h2>
              <span className="text-xs text-muted-foreground">{ctx.draft.sel.length}/{QUOTE_MAX_SELECTED}</span>
            </div>
            {proposal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inclua planos para montar a proposta. Só os planos incluídos aparecem para o cliente.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {proposal.map((row) => (
                  <li key={row.chave} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.plano}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.operadora}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {"total" in row && typeof row.total === "number" ? <span className="font-semibold tabular-nums">{formatBrl(row.total)}</span> : null}
                      <button type="button" aria-label={`Tirar ${row.plano} da proposta`} onClick={() => ctx.toggleSel(row.chave)}>
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

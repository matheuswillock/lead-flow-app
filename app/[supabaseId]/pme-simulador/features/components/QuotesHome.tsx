"use client";

import { useState } from "react";
import { brl } from "@/components/plan-simulator/format";
import { IconPlus, IconSearch } from "@/components/plan-simulator/Icons";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { UF_OPTIONS } from "../context/PlanSimulatorTypes";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Painel de cotações salvas (markup do protótipo: .hh, .hsearch, .qlist, .qrow). */
export function QuotesHome() {
  const ctx = usePlanSimulatorContext();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = ctx.quotes
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((q) => !search.trim() || norm(q.nome).includes(norm(search.trim())));
  const count = ctx.quotes.length;

  return (
    <section className="wrap">
      <div className="hh">
        <div>
          <h1>Cotações</h1>
          <p>{count ? `${count} ${count === 1 ? "cotação salva" : "cotações salvas"}` : "Nenhuma cotação salva ainda"}</p>
        </div>
        <button type="button" className="btn pri big" onClick={ctx.openNew}>
          <IconPlus />
          Nova cotação
        </button>
      </div>

      <div className="search hsearch">
        <IconSearch />
        <input type="search" placeholder="Buscar cotação pelo nome" aria-label="Buscar cotação pelo nome" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="qlist">
        {count === 0 ? (
          <div className="empty">
            <h3>Comece sua primeira cotação</h3>
            <p>Informe as idades, o perfil do cliente e compare as operadoras.</p>
            <div className="acts">
              <button type="button" className="btn pri" onClick={ctx.openNew}>Nova cotação</button>
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            <h3>Nenhuma cotação com esse nome</h3>
            <p>Tente outra busca.</p>
          </div>
        ) : (
          list.map((q) => {
            const uf = UF_OPTIONS.find((u) => u.uf === q.uf)?.nome ?? "Estado não escolhido";
            return (
              <div key={q.id} className="qrow">
                <button type="button" className="qopen" onClick={() => void ctx.openQuote(q.id)}>
                  <span className="qn">{q.nome || "Sem nome"}</span>
                  <span className="qm">
                    {q.vidas} {q.vidas === 1 ? "vida" : "vidas"} · {uf}
                    {q.selecionados ? <> · <b style={{ color: "var(--accent-ink)", fontWeight: 500 }}>{q.selecionados} {q.selecionados === 1 ? "plano" : "planos"} na proposta</b></> : null}
                    {" · atualizada em "}{fmtDate(q.updatedAt)}
                  </span>
                </button>
                <div className="qpr">
                  {q.resumo && q.resumo.min != null ? (
                    <>a partir de<b className="tn">{brl(q.resumo.min)}</b>{q.resumo.nops} {q.resumo.nops === 1 ? "operadora" : "operadoras"}</>
                  ) : (
                    "Sem preços ainda"
                  )}
                </div>
                <div className="qact">
                  <button type="button" onClick={() => void ctx.duplicate(q.id)}>Duplicar</button>
                  {confirmId === q.id ? (
                    <button type="button" className="danger" onClick={() => void ctx.remove(q.id)}>Confirmar exclusão</button>
                  ) : (
                    <button type="button" className="danger" onClick={() => setConfirmId(q.id)}>Excluir</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="foot">As cotações ficam salvas na sua conta. Só você vê as suas.</p>
    </section>
  );
}

"use client";

import { useState } from "react";
import { IconArrow } from "@/components/plan-simulator/Icons";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { FiltersBlock } from "./FiltersBlock";
import { LivesBlock } from "./LivesBlock";

/** Assistente em 2 passos (markup do protótipo: .steps, .card, .wnav). */
export function QuoteWizard() {
  const ctx = usePlanSimulatorContext();
  const [step, setStep] = useState<1 | 2>(1);
  const ok = step === 1 ? ctx.totalVidas > 0 : ctx.draft.uf !== "";
  const hint = ok ? "" : step === 1 ? "Adicione pelo menos uma vida para continuar" : "Escolha o estado para continuar";

  return (
    <section className="wrap narrow">
      <ol className="steps" aria-label="Passos">
        <li className={step === 1 ? "on" : "done"}>
          <button type="button" onClick={() => setStep(1)}><span className="n">1</span><span className="t">Beneficiários</span></button>
        </li>
        <li className={step === 2 ? "on" : ""}>
          <button type="button" disabled={ctx.totalVidas === 0} onClick={() => ctx.totalVidas > 0 && setStep(2)}><span className="n">2</span><span className="t">Perfil do cliente</span></button>
        </li>
        <li>
          <button type="button" disabled aria-disabled><span className="n">3</span><span className="t">Operadoras</span></button>
        </li>
      </ol>

      {step === 1 ? (
        <section className="card" aria-labelledby="h-w1">
          <div className="head">
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="grow">
              <h2 id="h-w1">Escolha as idades dos beneficiários</h2>
              <p>Dê um nome à cotação e informe quantas vidas há em cada faixa etária.</p>
            </div>
            <div className="pill" aria-live="polite"><b>{ctx.totalVidas}</b><span>{ctx.totalVidas === 1 ? "vida" : "vidas"}</span></div>
          </div>
          <label className="field">
            <span className="lbl">Nome da cotação</span>
            <input value={ctx.nome} maxLength={80} placeholder="Ex.: Padaria Bom Pão" autoComplete="off" onChange={(e) => ctx.renameQuote(e.target.value)} />
          </label>
          <LivesBlock lives={ctx.draft.lives} onChange={ctx.setLives} />
        </section>
      ) : (
        <section className="card" aria-labelledby="h-w2">
          <div className="head">
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </div>
            <div className="grow">
              <h2 id="h-w2">Escolha o perfil do cliente</h2>
              <p>O estado é obrigatório. Os outros filtros são opcionais e podem mudar depois.</p>
            </div>
          </div>
          <FiltersBlock
            uf={ctx.draft.uf}
            filters={ctx.draft.filters}
            facets={ctx.sim?.facets ?? null}
            hospNames={ctx.hospNames}
            onUf={ctx.setUf}
            onPatch={ctx.patchFilters}
            onSearchHospitals={ctx.searchHospitals}
            onClear={ctx.clearFilters}
            anyActive={ctx.hasActiveFilters}
          />
        </section>
      )}

      <div className="wnav">
        <button type="button" className="btn" onClick={step === 1 ? ctx.goHome : () => setStep(1)}>{step === 1 ? "Cancelar" : "Voltar"}</button>
        <span className="whint">{hint}</span>
        {step === 1 ? (
          <button type="button" className="btn pri" disabled={!ok} onClick={() => setStep(2)}>Continuar <IconArrow /></button>
        ) : (
          <button type="button" className="btn pri" disabled={!ok} onClick={() => void ctx.finishWizard()}>Ver operadoras <IconArrow /></button>
        )}
      </div>
    </section>
  );
}

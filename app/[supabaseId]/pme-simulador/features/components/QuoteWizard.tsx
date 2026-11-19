"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { FiltersEditor } from "./FiltersEditor";
import { LivesEditor } from "./LivesEditor";

/** Assistente em dois passos: vidas e perfil. Ao concluir, a cotação é criada e abre nos resultados. */
export function QuoteWizard() {
  const ctx = usePlanSimulatorContext();
  const [step, setStep] = useState<1 | 2>(1);
  const canContinue = ctx.totalVidas > 0;
  const canFinish = ctx.totalVidas > 0 && ctx.draft.uf !== "";

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <ol className="flex gap-2 text-sm" aria-label="Passos">
        {[
          { n: 1, label: "Vidas" },
          { n: 2, label: "Perfil do cliente" },
        ].map((s) => (
          <li key={s.n}>
            <button type="button" className={`rounded-full border px-3 py-1 ${step === s.n ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`} onClick={() => (s.n === 1 || canContinue) && setStep(s.n as 1 | 2)}>
              {s.n}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Escolha as idades dos beneficiários</CardTitle>
            <CardDescription>Dê um nome à cotação e informe quantas vidas há em cada faixa etária.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Nome da cotação</span>
              <Input value={ctx.nome} maxLength={80} placeholder="Ex.: Padaria Bom Pão" autoComplete="off" onChange={(e) => void ctx.renameQuote(e.target.value)} />
            </label>
            <LivesEditor lives={ctx.draft.lives} onChange={ctx.setLives} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Escolha o perfil do cliente</CardTitle>
            <CardDescription>O estado é obrigatório. Os outros filtros são opcionais e podem mudar depois.</CardDescription>
          </CardHeader>
          <CardContent>
            <FiltersEditor uf={ctx.draft.uf} filters={ctx.draft.filters} onUf={ctx.setUf} onPatch={ctx.patchFilters} onSearchHospitals={ctx.searchHospitals} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={step === 1 ? ctx.goHome : () => setStep(1)}>
          <ArrowLeft className="size-4" />
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        {step === 1 ? (
          <Button type="button" disabled={!canContinue} onClick={() => setStep(2)}>
            Continuar
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" disabled={!canFinish} onClick={() => void ctx.finishWizard()}>
            Ver planos
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </section>
  );
}

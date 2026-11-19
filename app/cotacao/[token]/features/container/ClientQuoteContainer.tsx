"use client";

import Image from "next/image";
import { useClientQuote } from "../context/ClientQuoteContext";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Visão do cliente. Somente leitura: o cliente vê os planos incluídos e os detalhes. */
export function ClientQuoteContainer() {
  const { snapshot, message, vidas, geradoEmLabel } = useClientQuote();
  if (!snapshot) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
        <p className="text-center text-muted-foreground">{message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Cotação de planos de saúde</p>
        <h1 className="text-3xl font-semibold tracking-tight">{snapshot.nome}</h1>
        <p className="text-sm text-muted-foreground">
          {vidas} {vidas === 1 ? "vida" : "vidas"} · {snapshot.uf} · gerada em {geradoEmLabel}
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {snapshot.plans.map((plan) => (
          <li key={plan.chave} className="flex flex-col gap-4 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="relative h-8 w-20 shrink-0">
                  <Image src={plan.logoPath} alt={plan.operadora} fill sizes="80px" className="object-contain" unoptimized />
                </span>
                <div>
                  <p className="font-semibold">{plan.plano}</p>
                  <p className="text-sm text-muted-foreground">{plan.operadora} · {plan.tabela}</p>
                </div>
              </div>
              <p className="text-right">
                <span className="block text-2xl font-semibold tabular-nums">{brl.format(plan.total)}</span>
                <span className="text-xs text-muted-foreground">por mês</span>
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              {plan.acomodacao} · {plan.contratacao} · {plan.coparticipacao}
            </p>

            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Regras do plano</summary>
              <ul className="mt-3 flex flex-col gap-3">
                {plan.regras.map((regra) => (
                  <li key={regra.tipo}>
                    <p className="font-medium">{regra.tipo}</p>
                    <p className="whitespace-pre-line text-muted-foreground">{regra.texto}</p>
                  </li>
                ))}
              </ul>
            </details>

            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Rede credenciada ({plan.rede.hospitais.length} hospitais)</summary>
              <ul className="mt-3 flex flex-col gap-2">
                {plan.rede.hospitais.map((h) => (
                  <li key={`${h.nome}-${h.cidade}`} className="flex justify-between gap-3">
                    <span>{h.nome} <span className="text-muted-foreground">{[h.cidade, h.uf].filter(Boolean).join(" - ")}</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">{h.siglas.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </main>
  );
}

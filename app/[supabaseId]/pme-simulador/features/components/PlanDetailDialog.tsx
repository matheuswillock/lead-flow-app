"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";

/** Detalhe do plano: regras e rede credenciada. Abre a partir de "Detalhes" na lista de planos. */
export function PlanDetailDialog() {
  const ctx = usePlanSimulatorContext();
  const detail = ctx.detail;
  const included = detail ? ctx.draft.sel.includes(detail.chave) : false;

  return (
    <Dialog open={detail !== null} onOpenChange={(open) => !open && ctx.setDetail(null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {detail ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="relative h-8 w-20 shrink-0">
                  <Image src={detail.logoPath} alt={detail.operadora} fill sizes="80px" className="object-contain" unoptimized />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{detail.plano}</DialogTitle>
                  <DialogDescription className="truncate">{detail.tabela}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <dl className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Acomodação</dt><dd>{detail.acomodacao}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Contratação</dt><dd>{detail.contratacao}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Coparticipação</dt><dd>{detail.coparticipacao}</dd></div>
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Regras</h3>
              <ul className="flex flex-col gap-2">
                {detail.regras.map((regra) => (
                  <li key={regra.tipo} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{regra.tipo}</p>
                    <p className="whitespace-pre-line text-muted-foreground">{regra.texto}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Rede de hospitais ({detail.rede.hospitais.length})</h3>
              <ul className="flex flex-col divide-y rounded-lg border text-sm">
                {detail.rede.hospitais.length === 0 ? <li className="p-3 text-muted-foreground">Sem hospitais cadastrados.</li> : null}
                {detail.rede.hospitais.map((h) => (
                  <li key={`${h.nome}-${h.cidade}`} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0"><span className="block truncate font-medium">{h.nome}</span><span className="block text-xs text-muted-foreground">{[h.cidade, h.uf].filter(Boolean).join(" - ")}</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">{h.siglas.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex justify-end">
              <Button type="button" variant={included ? "secondary" : "default"} onClick={() => ctx.toggleSel(detail.chave)}>
                {included ? "Tirar da proposta" : "Incluir na proposta"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

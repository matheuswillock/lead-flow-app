"use client";

import { useState } from "react";
import { BAND_KEYS, FAIXAS, brl } from "@/components/plan-simulator/format";
import { IconPlus } from "@/components/plan-simulator/Icons";
import { PlanSheet } from "@/components/plan-simulator/PlanSheet";
import { PlanSimulatorShell } from "@/components/plan-simulator/PlanSimulatorShell";
import { ProposalPanel, type ProposalItem } from "@/components/plan-simulator/ProposalPanel";
import { useClientQuote } from "../context/ClientQuoteContext";
import type { ClientQuotePlan } from "../context/ClientQuoteTypes";

const UF_NOME: Record<string, string> = { SP: "São Paulo", RJ: "Rio de Janeiro", BA: "Bahia", MG: "Minas Gerais", DF: "Distrito Federal" };

/** Visão do cliente: a mesma tela de resultados em modo somente leitura (markup do protótipo). */
export function ClientQuoteContainer() {
  const { snapshot, message, vidas, geradoEmLabel } = useClientQuote();
  const [open, setOpen] = useState<ClientQuotePlan | null>(null);

  if (!snapshot) {
    return (
      <PlanSimulatorShell client>
        <main className="wrap narrow" style={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
          <div className="empty" style={{ width: "100%" }}>
            <h3>Cotação indisponível</h3>
            <p>{message}</p>
          </div>
        </main>
      </PlanSimulatorShell>
    );
  }

  const lives = snapshot.lives;
  const ufNome = UF_NOME[snapshot.uf] ?? snapshot.uf;
  const f = snapshot.filters;
  const meta = [
    `${vidas} ${vidas === 1 ? "vida" : "vidas"}`,
    ufNome,
    ...(f.acomodacoes.length ? [f.acomodacoes.join(" ou ")] : []),
    ...(f.contratacoes.length ? [f.contratacoes.join(" ou ")] : []),
    ...(f.hospitalIds.length ? [`${f.hospitalIds.length} ${f.hospitalIds.length === 1 ? "hospital de referência" : "hospitais de referência"}`] : []),
    ...(f.mei ? ["aceita MEI"] : []),
  ].join(" · ");

  const items: ProposalItem[] = snapshot.plans.map((p) => ({
    chave: p.chave,
    operadora: p.operadora,
    logoPath: p.logoPath,
    plano: p.plano,
    tabela: p.tabela,
    acomodacao: p.acomodacao,
    contratacao: p.contratacao,
    coparticipacao: p.coparticipacao,
    coparticipacaoTabela: p.coparticipacaoTabela,
    aceitaMei: p.aceitaMei,
    vidasMin: p.vidasMin,
    vidasMax: p.vidasMax,
    precos: p.precos,
    regras: p.regras,
    total: p.total,
  }));

  const openPlan = (chave: string) => {
    const plan = snapshot.plans.find((p) => p.chave === chave);
    if (plan) setOpen(plan);
  };

  return (
    <PlanSimulatorShell client>
      <header className="topbar">
        <div className="brand" style={{ cursor: "default" }}>
          <span className="mark"><IconPlus /></span>
          <span className="bt"><b>Simulador</b> de Planos de Saúde</span>
        </div>
      </header>

      <div className="cinfo" style={{ margin: "12px 16px 0" }}>
        Cotação para <b>{snapshot.nome}</b>
        <br />
        Enviada em {geradoEmLabel} · tabelas de {geradoEmLabel}
      </div>

      <div className="rlay" style={{ marginTop: 16 }}>
        <aside className="side" aria-label="Resumo da cotação">
          <div className="sideh"><span>Resumo da cotação</span></div>
          <div>
            <div className="sblk">
              <div className="sbt"><span>Beneficiários</span><span className="pill sm"><b>{vidas}</b><span>{vidas === 1 ? "vida" : "vidas"}</span></span></div>
              <div className="box">
                <table className="kv">
                  <tbody>
                    {BAND_KEYS.map((band, i) =>
                      lives[i] > 0 ? (
                        <tr key={band}><th>{FAIXAS[i]} anos</th><td>{lives[i]} {lives[i] === 1 ? "vida" : "vidas"}</td></tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="sblk">
              <div className="sbt"><span>Perfil do cliente</span></div>
              <div className="box">
                <table className="kv">
                  <tbody>
                    <tr><th>Estado</th><td>{ufNome}</td></tr>
                    <tr><th>Acomodação</th><td>{f.acomodacoes.join(", ") || "Todas"}</td></tr>
                    <tr><th>Coparticipação</th><td>{f.coparticipacoes.join(", ") || "Todas"}</td></tr>
                    <tr><th>Contratação</th><td>{f.contratacoes.join(", ") || "Todas"}</td></tr>
                    {f.valorMin != null || f.valorMax != null ? (
                      <tr><th>Valor mensal</th><td>{[f.valorMin != null ? `de ${brl(f.valorMin)}` : "", f.valorMax != null ? `até ${brl(f.valorMax)}` : ""].filter(Boolean).join(" ")}</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </aside>

        <div className="rmain">
          <div className="rhd">
            <div className="grow">
              <h1 className="qtitle" style={{ border: 0, padding: 0 }}>{snapshot.nome}</h1>
              <div className="rmeta">{meta}</div>
            </div>
          </div>

          <ProposalPanel client items={items} lives={lives} onOpen={openPlan} />

          <p className="foot">Valores mensais de planos conforme tabelas de {geradoEmLabel}. Confirme valores, rede e regras com a operadora antes de contratar.</p>
        </div>
      </div>

      {open ? (
        <PlanSheet
          plan={open}
          uf={snapshot.uf}
          ufNome={ufNome}
          lives={lives}
          total={open.total}
          client
          included
          refIds={f.hospitalIds}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </PlanSimulatorShell>
  );
}

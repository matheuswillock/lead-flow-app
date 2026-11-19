"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { priceFor, type LivesByBand } from "@/lib/planSimulator/planSimulator";
import { ACOM_INFO, BAND_KEYS, brl, copInfo, faixaLabel } from "@/components/plan-simulator/format";
import { IconLeft } from "@/components/plan-simulator/Icons";
import { PlanSheet, type SheetPlan } from "@/components/plan-simulator/PlanSheet";
import { ProposalPanel, type ProposalItem } from "@/components/plan-simulator/ProposalPanel";
import { UF_OPTIONS, type SimulationRow } from "../context/PlanSimulatorTypes";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { FiltersBlock } from "./FiltersBlock";
import { LivesBlock } from "./LivesBlock";
import { OperatorExplorer } from "./OperatorExplorer";
import { SendDialog } from "./SendDialog";

const totalVidas = (lives: number[]) => lives.reduce((a, b) => a + b, 0);

type Group = { operadora: string; logoPath: string; rows: SimulationRow[]; min: number; tabelas: number; planos: number };

function groupByOperator(rows: SimulationRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const g = map.get(r.operadora) ?? { operadora: r.operadora, logoPath: r.logoPath, rows: [], min: Infinity, tabelas: 0, planos: 0 };
    g.rows.push(r);
    g.min = Math.min(g.min, r.total);
    map.set(r.operadora, g);
  }
  for (const g of map.values()) {
    g.tabelas = new Set(g.rows.map((r) => `${r.produto}|${r.tabela}`)).size;
    g.planos = new Set(g.rows.map((r) => r.plano)).size;
  }
  return [...map.values()].sort((a, b) => a.min - b.min);
}

/** Resultados: vidas e filtros (lateral), operadoras, proposta e detalhe do plano (markup do protótipo: .rlay, .rhd, .prop, #opsCard). */
export function QuoteResults() {
  const ctx = usePlanSimulatorContext();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [operator, setOperator] = useState<string | null>(null);

  const lives = ctx.draft.lives as LivesByBand;
  const n = totalVidas(lives);
  const rows = useMemo(() => ctx.sim?.rows ?? [], [ctx.sim]);
  const groups = useMemo(() => groupByOperator(rows), [rows]);
  const activeOp = groups.find((g) => g.operadora === operator) ?? null;
  const included = new Set(ctx.draft.sel);
  const ufNome = UF_OPTIONS.find((u) => u.uf === ctx.draft.uf)?.nome ?? "";

  const proposal: ProposalItem[] = ctx.draft.sel.map((chave) => {
    const row = rows.find((r) => r.chave === chave) ?? ctx.seenRows[chave];
    if (!row) {
      return {
        chave, operadora: "", logoPath: "", plano: "Plano fora dos filtros atuais", tabela: "", acomodacao: "", contratacao: "",
        coparticipacao: "", coparticipacaoTabela: "", aceitaMei: false, vidasMin: 0, vidasMax: 0, precos: {}, total: null, foraDosFiltros: true,
      };
    }
    return {
      chave, operadora: row.operadora, logoPath: row.logoPath, plano: row.plano, tabela: row.tabela, acomodacao: row.acomodacao,
      contratacao: row.contratacao, coparticipacao: row.coparticipacao, coparticipacaoTabela: row.coparticipacaoTabela,
      aceitaMei: row.aceitaMei, vidasMin: row.vidasMin, vidasMax: row.vidasMax, precos: row.precos,
      total: priceFor({ precos: row.precos }, lives), foraDosFiltros: !rows.some((r) => r.chave === chave),
    };
  });

  const sheetPlan: SheetPlan | null = ctx.detail;
  const sheetTotal = sheetPlan ? priceFor({ precos: sheetPlan.precos }, lives) : null;

  const meta = [
    `${n} ${n === 1 ? "vida" : "vidas"}`,
    ufNome,
    ...(ctx.draft.filters.acomodacoes.length ? [ctx.draft.filters.acomodacoes.join(" ou ")] : []),
    ...(ctx.draft.filters.contratacoes.length ? [ctx.draft.filters.contratacoes.join(" ou ")] : []),
    ...(ctx.draft.filters.hospitalIds.length ? [`${ctx.draft.filters.hospitalIds.length} ${ctx.draft.filters.hospitalIds.length === 1 ? "hospital de referência" : "hospitais de referência"}`] : []),
    ...(ctx.draft.filters.mei ? ["aceita MEI"] : []),
  ].filter(Boolean);

  function copySummary(plan: SheetPlan) {
    const total = sheetTotal;
    const ai = ACOM_INFO[plan.acomodacao]?.[0] ?? plan.acomodacao;
    const ci = copInfo(plan.coparticipacao, plan.coparticipacaoTabela)[0];
    const txt = [
      `*${plan.plano}* · ${plan.operadora}`, plan.produto, `${ai} · ${ci} · Contratação ${plan.contratacao.toLowerCase()}`, "",
      ...BAND_KEYS.map((b, i) => (lives[i] ? `${faixaLabel(b)}: ${lives[i]} × ${brl(plan.precos[b])}` : null)).filter(Boolean) as string[],
      "", `*Total: ${brl(total)}/mês* (${n} ${n === 1 ? "vida" : "vidas"})`,
    ].join("\n");
    void navigator.clipboard?.writeText(txt);
  }

  return (
    <section className="rlay-wrap">
      <div className={`rlay${collapsed ? " collapsed" : ""}${drawer ? " mopen" : ""}`}>
        <aside className="side" aria-label="Vidas e filtros">
          <div className="sideh">
            <span>Vidas e filtros</span>
            <button type="button" className="ibtn" aria-label="Ocultar barra lateral" title="Ocultar barra lateral" onClick={() => { setCollapsed(true); setDrawer(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16M15.5 10 13.5 12l2 2" /></svg>
            </button>
          </div>
          <div>
            <div className="sblk">
              <div className="sbt"><span>Beneficiários</span><span className="pill sm"><b>{n}</b><span>{n === 1 ? "vida" : "vidas"}</span></span></div>
              <LivesBlock lives={lives} onChange={ctx.setLives} />
            </div>
            <div className="sblk">
              <div className="sbt"><span>Perfil do cliente</span></div>
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
            </div>
          </div>
        </aside>
        <div className="side-scrim" hidden={!drawer} onClick={() => setDrawer(false)} />

        <div className="rmain">
          <div className="rhd">
            <button type="button" className="ibtn wide" aria-label="Mostrar vidas e filtros" onClick={() => { setCollapsed(false); setDrawer(true); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16M13.5 10l2 2-2 2" /></svg>
              <span>Vidas e filtros</span>
            </button>
            <div className="grow">
              <button type="button" className="lnk" onClick={ctx.goHome}><IconLeft />Cotações</button>
              <input className="qtitle" aria-label="Nome da cotação" value={ctx.nome} maxLength={80} onChange={(e) => ctx.renameQuote(e.target.value)} />
              <div className="rmeta">{meta.join(" · ")}{ctx.saving ? " · salvando…" : ""}</div>
            </div>
            <button type="button" className="btn pri big" disabled={ctx.draft.sel.length === 0} onClick={() => ctx.setSendOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
              Enviar ao cliente
            </button>
          </div>

          <ProposalPanel
            client={false}
            items={proposal}
            lives={lives}
            onOpen={(chave) => void ctx.openDetail(chave)}
            onRemove={ctx.toggleSel}
            onClear={() => ctx.draft.sel.forEach((c) => ctx.toggleSel(c))}
          />

          <section className="card" id="opsCard" aria-labelledby="h-r">
            <div className="head">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              </div>
              <div className="grow">
                <h2 id="h-r">Operadoras</h2>
                <p>{ctx.draft.uf === "" ? "Escolha o estado para ver as operadoras disponíveis" : n === 0 ? "Preencha as vidas para calcular os preços" : "Escolha uma operadora para ver as tabelas e os planos"}</p>
              </div>
            </div>

            {ctx.sim && ctx.draft.uf && n > 0 ? (
              <div className="rsum">
                <span><b>{groups.length}</b> {groups.length === 1 ? "operadora" : "operadoras"} com planos em {ufNome} para <b>{n} {n === 1 ? "vida" : "vidas"}</b></span>
                {ctx.sim.ocultosPorVidas > 0 && ctx.draft.filters.respeitarMinimoVidas ? (
                  <span>{ctx.sim.ocultosPorVidas} opções ocultas pelo mínimo de vidas · <button type="button" className="linkbtn" onClick={() => ctx.patchFilters({ respeitarMinimoVidas: false })}>mostrar</button></span>
                ) : null}
                {rows.length === 0 ? (
                  <div className="empty">
                    <h3>Nenhum plano com esses filtros</h3>
                    <p>Não há planos em {ufNome} que atendam a todos os filtros. Tire algum filtro para ver mais opções.</p>
                    <div className="acts"><button type="button" className="btn pri" onClick={ctx.clearFilters}>Limpar filtros</button></div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="logos">
              {groups.map((g) => (
                <button key={g.operadora} type="button" className="lcard" aria-pressed={operator === g.operadora} onClick={() => setOperator(operator === g.operadora ? null : g.operadora)}>
                  <span className="lg"><Image src={g.logoPath} alt={g.operadora} width={120} height={44} unoptimized /></span>
                  <span className="lf">
                    <span className="nm">{g.operadora}</span>
                    <span className="pr">a partir de <b className="tn">{brl(g.min)}</b></span>
                    <span className="pr">{g.tabelas} {g.tabelas === 1 ? "tabela" : "tabelas"} · {g.planos} {g.planos === 1 ? "plano" : "planos"}</span>
                  </span>
                  {ctx.draft.sel.filter((c) => g.rows.some((r) => r.chave === c)).length ? (
                    <span className="selb">{ctx.draft.sel.filter((c) => g.rows.some((r) => r.chave === c)).length} na proposta</span>
                  ) : null}
                </button>
              ))}
            </div>

            {activeOp ? (
              <OperatorExplorer
                op={activeOp.operadora}
                logoPath={activeOp.logoPath}
                rows={activeOp.rows}
                lives={lives}
                uf={ctx.draft.uf}
                ufNome={ufNome}
                included={included}
                onOpenPlan={ctx.openDetail}
                onToggle={ctx.toggleSel}
                onClose={() => setOperator(null)}
              />
            ) : null}
          </section>
          <p className="foot">Valores mensais conforme as tabelas da base importada. Confirme valores, rede e regras com a operadora antes de enviar a proposta.</p>
        </div>
      </div>

      {sheetPlan ? (
        <PlanSheet
          plan={sheetPlan}
          uf={ctx.draft.uf}
          ufNome={ufNome}
          lives={lives}
          total={sheetTotal}
          client={false}
          included={included.has(sheetPlan.chave)}
          refIds={ctx.draft.filters.hospitalIds}
          onToggle={() => ctx.toggleSel(sheetPlan.chave)}
          onCopy={() => copySummary(sheetPlan)}
          onClose={() => ctx.setDetail(null)}
        />
      ) : null}

      <SendDialog />
    </section>
  );
}

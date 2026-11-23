"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { BAND_KEYS, brl, copShort, FAIXAS } from "@/components/plan-simulator/format";
import { IconArrow, IconCheck, IconLeft, IconPlus, IconRight, IconX } from "@/components/plan-simulator/Icons";
import type { LivesByBand } from "@/lib/planSimulator/planSimulator";
import type { SimulationRow } from "../context/PlanSimulatorTypes";

type Props = {
  op: string;
  logoPath: string;
  rows: SimulationRow[];
  lives: LivesByBand;
  uf: string;
  ufNome: string;
  included: Set<string>;
  onOpenPlan: (chave: string) => Promise<void> | void;
  onToggle: (chave: string) => void;
  onClose: () => void;
};

type TableGroup = { gk: string; prod: string; tab: string; rows: SimulationRow[]; min: number; planos: number; vmin: number; vmax: number };

const variantKey = (r: SimulationRow) => `${r.contratacao}|${r.coparticipacao}|${r.aceitaMei ? "mei" : "std"}`;

/** Explorador: operadora → tabela → condição → planos (markup do protótipo: .xp, .trow, .ptab). */
export function OperatorExplorer({ op, logoPath, rows, lives, ufNome, included, onOpenPlan, onToggle, onClose }: Props) {
  const [gk, setGk] = useState<string | null>(null);
  const [vk, setVk] = useState<string | null>(null);

  const groups = useMemo<TableGroup[]>(() => {
    const map = new Map<string, SimulationRow[]>();
    for (const r of rows) {
      const k = `${r.produto}|${r.tabela}`;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()]
      .map(([k, list]) => ({
        gk: k,
        prod: list[0].produto,
        tab: list[0].tabela,
        rows: list,
        min: Math.min(...list.map((r) => r.total)),
        planos: new Set(list.map((r) => r.plano)).size,
        vmin: list[0].vidasMin,
        vmax: list[0].vidasMax,
      }))
      .sort((a, b) => a.min - b.min);
  }, [rows]);

  const usedBands = BAND_KEYS.map((_, i) => i).filter((i) => (lives[i] ?? 0) > 0);
  const head = (crumb: React.ReactNode, back: boolean) => (
    <div className="xh">
      {back ? <button type="button" className="back" aria-label="Voltar às tabelas" onClick={() => { setGk(null); setVk(null); }}><IconLeft /></button> : null}
      <span className="minilogo"><Image src={logoPath} alt={op} width={60} height={24} unoptimized /></span>
      <div className="crumb">{crumb}</div>
      <button type="button" className="x" aria-label="Fechar operadora" onClick={onClose}><IconX /></button>
    </div>
  );

  if (gk == null) {
    return (
      <div className="xp">
        {head(<><b>{op}</b><span className="sep">›</span>{groups.length} {groups.length === 1 ? "tabela" : "tabelas"} em {ufNome}, da mais barata para a mais cara</>, false)}
        {groups.map((g) => {
          const acoms = [...new Set(g.rows.map((r) => r.acomodacao))];
          const cons = [...new Set(g.rows.map((r) => r.contratacao))];
          const cops = [...new Set(g.rows.map((r) => copShort(r.coparticipacao)))];
          return (
            <button key={g.gk} type="button" className="trow" onClick={() => { setGk(g.gk); setVk(null); }}>
              <div>
                <div className="t1">{g.tab}</div>
                <div className="t2">{g.prod} · {g.planos} {g.planos === 1 ? "plano" : "planos"}</div>
                <div className="tags">
                  {acoms.map((a) => (<span key={a} className="tag">{a}</span>))}
                  {cons.map((c) => (<span key={c} className="tag alt">{c}</span>))}
                  {cops.map((c) => (<span key={c} className={`tag ${/^Sem/.test(c) ? "ok" : "warn"}`}>{c}</span>))}
                  <span className="tag">{g.vmin} a {g.vmax} vidas</span>
                </div>
              </div>
              <div className="pr">a partir de<b className="tn">{brl(g.min)}</b></div>
              <IconRight />
            </button>
          );
        })}
      </div>
    );
  }

  const group = groups.find((g) => g.gk === gk);
  if (!group) return null;
  const variants = [...new Map(group.rows.map((r) => [variantKey(r), r] as const)).keys()].map((k) => {
    const list = group.rows.filter((r) => variantKey(r) === k);
    const sample = list[0];
    return { vk: k, sample, min: Math.min(...list.map((r) => r.total)) };
  }).sort((a, b) => a.min - b.min);
  const activeVk = variants.some((v) => v.vk === vk) ? vk! : variants[0].vk;
  const rowsOfVariant = group.rows
    .filter((r) => variantKey(r) === activeVk)
    .sort((a, b) => a.total - b.total || a.plano.localeCompare(b.plano, "pt"));

  return (
    <div className="xp">
      {head(<><b>{op}</b><span className="sep">›</span><b>{group.tab}</b><br /><span>{group.prod}</span></>, true)}
      <div className="vbar">
        <div className="lbl">Condição da tabela</div>
        {variants.length > 1
          ? variants.map((v) => (
              <button key={v.vk} type="button" className="vopt" aria-pressed={v.vk === activeVk} onClick={() => setVk(v.vk)}>
                <span>{v.sample.contratacao} · {copShort(v.sample.coparticipacao)}{v.sample.aceitaMei ? " · tabela MEI" : ""}</span>
                <small>a partir de {brl(v.min)}</small>
              </button>
            ))
          : (
            <>
              <span className="tag alt">{variants[0].sample.contratacao}</span>
              <span className={`tag ${/^sem/i.test(variants[0].sample.coparticipacao) ? "ok" : "warn"}`}>{copShort(variants[0].sample.coparticipacao)}</span>
              {variants[0].sample.aceitaMei ? <span className="tag">Tabela MEI</span> : null}
            </>
          )}
        <span className="tag">{group.vmin} a {group.vmax} vidas</span>
      </div>

      <div className="scrollx">
        <table className="ptab">
          <thead>
            <tr>
              <th>Plano</th>
              <th>Acomodação</th>
              {usedBands.map((i) => (
                <th key={i}>{FAIXAS[i]}{lives[i] > 1 ? <span style={{ textTransform: "none", letterSpacing: 0 }}> (×{lives[i]})</span> : null}</th>
              ))}
              <th>Total mensal</th>
              <th />
              <th className="incth">Proposta</th>
            </tr>
          </thead>
          <tbody>
            {rowsOfVariant.map((r, k) => {
              const on = included.has(r.chave);
              return (
                <tr key={r.chave} className={k === 0 ? "best" : ""}>
                  <td className="pn">{r.plano}{k === 0 ? <> <span className="tag acc">Menor preço</span></> : null}</td>
                  <td>{r.acomodacao}</td>
                  {usedBands.map((i) => (<td key={i}>{brl(r.precos[BAND_KEYS[i]])}</td>))}
                  <td className="tot">{brl(r.total)}</td>
                  <td><button type="button" className="det" onClick={() => void onOpenPlan(r.chave)}>Detalhes <IconArrow /></button></td>
                  <td>
                    <button type="button" className={`inc${on ? " on" : ""}`} aria-pressed={on} aria-label={`${on ? "Tirar da proposta" : "Incluir na proposta"}: ${r.plano}`} onClick={() => onToggle(r.chave)}>
                      {on ? <><IconCheck />Incluído</> : <><IconPlus />Incluir</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

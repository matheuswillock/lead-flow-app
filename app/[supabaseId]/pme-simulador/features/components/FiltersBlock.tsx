"use client";

import { useState } from "react";
import { IconSearch, IconX } from "@/components/plan-simulator/Icons";
import type { SimulationFilters } from "@/lib/planSimulator/planSimulator";
import { UF_OPTIONS, type FacetCounts, type ProviderHit } from "../context/PlanSimulatorTypes";

const ACOM = ["Apartamento", "Enfermaria", "Ambulatorial"];
const COP = ["Sem coparticipação", "Coparticipação parcial", "Coparticipação total"];
const CON = ["Compulsória", "Livre"];
const COP_LABEL: Record<string, string> = { "Sem coparticipação": "Sem", "Coparticipação parcial": "Parcial", "Coparticipação total": "Total" };

type Props = {
  uf: string;
  filters: SimulationFilters;
  facets: FacetCounts | null;
  hospNames: Record<number, string>;
  onUf: (uf: string) => void;
  onPatch: (patch: Partial<SimulationFilters>) => void;
  onSearchHospitals: (q: string) => Promise<ProviderHit[]>;
  onClear: () => void;
  /** Mostra o botão "Limpar filtros" (quando há algum filtro ativo). */
  anyActive: boolean;
};

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Chip({ label, count, on, disabled, onClick }: { label: string; count: number | null; on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} disabled={disabled} onClick={onClick}>
      {label}
      {count != null ? <span className="n">{count}</span> : null}
    </button>
  );
}

/** Perfil do cliente: estado, acomodação, coparticipação, contratação, valor, rede e opções (markup do protótipo: .fgrid). */
export function FiltersBlock({ uf, filters, facets, hospNames, onUf, onPatch, onSearchHospitals, onClear, anyActive }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProviderHit[]>([]);

  const countOf = (group: keyof FacetCounts, value: string) => (facets ? facets[group][value] ?? 0 : null);

  function chipOptions(group: keyof FacetCounts, values: string[], selected: string[], patchKey: keyof SimulationFilters) {
    return values
      .filter((v) => selected.includes(v) || (facets == null ? v !== "Ambulatorial" : (facets[group][v] ?? 0) > 0))
      .map((v) => {
        const count = countOf(group, v);
        const on = selected.includes(v);
        return (
          <Chip
            key={v}
            label={patchKey === "coparticipacoes" ? COP_LABEL[v] ?? v : v}
            count={count}
            on={on}
            disabled={uf !== "" && !on && count === 0}
            onClick={() => onPatch({ [patchKey]: toggle(selected, v) } as Partial<SimulationFilters>)}
          />
        );
      });
  }

  async function search(value: string) {
    setQuery(value);
    setHits(value.trim().length < 2 ? [] : await onSearchHospitals(value));
  }

  const money = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 7);
    return d ? Number(d) : null;
  };

  return (
    <div>
      <div className="lbl">Estado</div>
      <div className="ufrow" role="group" aria-label="Estado">
        {UF_OPTIONS.map((o) => (
          <button key={o.uf} type="button" className="uf" aria-pressed={uf === o.uf} onClick={() => onUf(o.uf)}>
            <b>{o.uf}</b>
            <span>{o.capital}</span>
          </button>
        ))}
      </div>
      <div className="divider" />
      <div className="fgrid">
        <div>
          <div className="lbl">Acomodação</div>
          <div className="chips">{chipOptions("acomodacoes", ACOM, filters.acomodacoes, "acomodacoes")}</div>
        </div>
        <div>
          <div className="lbl">Coparticipação</div>
          <div className="chips">{chipOptions("coparticipacoes", COP, filters.coparticipacoes, "coparticipacoes")}</div>
        </div>
        <div>
          <div className="lbl">Contratação</div>
          <div className="chips">{chipOptions("contratacoes", CON, filters.contratacoes, "contratacoes")}</div>
        </div>
        <div>
          <div className="lbl">Valor mensal total</div>
          <div className="range">
            <label className="money">
              <span>R$</span>
              <input inputMode="numeric" placeholder="mín." aria-label="Valor mensal mínimo em reais" value={filters.valorMin == null ? "" : filters.valorMin.toLocaleString("pt-BR")} onChange={(e) => onPatch({ valorMin: money(e.target.value) })} />
            </label>
            <i>a</i>
            <label className="money">
              <span>R$</span>
              <input inputMode="numeric" placeholder="máx." aria-label="Valor mensal máximo em reais" value={filters.valorMax == null ? "" : filters.valorMax.toLocaleString("pt-BR")} onChange={(e) => onPatch({ valorMax: money(e.target.value) })} />
            </label>
          </div>
        </div>
        <div className="span2">
          <div className="lbl">Rede de referência</div>
          <div className="search">
            <IconSearch />
            <input
              type="search"
              autoComplete="off"
              disabled={!uf}
              placeholder={uf ? "Busque um hospital pelo nome, bairro ou cidade" : "Escolha o estado para buscar hospitais"}
              value={query}
              onChange={(e) => void search(e.target.value)}
            />
          </div>
          {hits.length > 0 ? (
            <div className="sugg" role="listbox">
              {hits.filter((h) => !filters.hospitalIds.includes(h.id)).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onPatch({ hospitalIds: [...filters.hospitalIds, h.id] });
                    setQuery("");
                    setHits([]);
                  }}
                >
                  <span className="s1">{h.nome}</span>
                  <br />
                  <span className="s2">{[h.cidade, h.uf].filter(Boolean).join(" - ")}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="picked">
            {filters.hospitalIds.map((id) => (
              <span key={id}>
                {hospNames[id] ?? `Hospital ${id}`}
                <button type="button" aria-label={`Tirar ${hospNames[id] ?? "hospital"}`} onClick={() => onPatch({ hospitalIds: filters.hospitalIds.filter((x) => x !== id) })}>
                  <IconX />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="span2 toggles">
          <label className="switch">
            <input type="checkbox" checked={filters.mei} onChange={(e) => onPatch({ mei: e.target.checked })} />
            Só tabelas que aceitam MEI
          </label>
          <label className="switch">
            <input type="checkbox" checked={filters.respeitarMinimoVidas} onChange={(e) => onPatch({ respeitarMinimoVidas: e.target.checked })} />
            Respeitar o mínimo de vidas
          </label>
        </div>
      </div>
      {anyActive ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="linkbtn" onClick={onClear}>Limpar filtros</button>
        </div>
      ) : null}
    </div>
  );
}

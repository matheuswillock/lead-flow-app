"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SimulationFilters } from "@/lib/planSimulator/planSimulator";
import { UF_OPTIONS, type ProviderHit } from "../context/PlanSimulatorTypes";

const ACOMODACOES = ["Apartamento", "Enfermaria", "Ambulatorial"];
const COPARTICIPACOES = ["Sem coparticipação", "Coparticipação parcial", "Coparticipação total"];
const CONTRATACOES = ["Livre", "Compulsória"];

type Props = {
  uf: string;
  filters: SimulationFilters;
  onUf: (uf: string) => void;
  onPatch: (patch: Partial<SimulationFilters>) => void;
  onSearchHospitals: (q: string) => Promise<ProviderHit[]>;
  /** No assistente o estado é obrigatório; nos resultados a troca de UF limpa a proposta. */
  showUf?: boolean;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chips({ options, selected, onToggle, label }: { options: string[]; selected: string[]; onToggle: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Button key={option} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => onToggle(option)}>
            {option}
          </Button>
        );
      })}
    </div>
  );
}

/** Estado, perfil e filtros da cotação. Usado no assistente e na tela de resultados. */
export function FiltersEditor({ uf, filters, onUf, onPatch, onSearchHospitals, showUf = true }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProviderHit[]>([]);
  const [hospitalNames, setHospitalNames] = useState<Record<number, string>>({});

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setHits(await onSearchHospitals(value));
  }

  function pick(hit: ProviderHit) {
    if (filters.hospitalIds.includes(hit.id)) return;
    setHospitalNames((prev) => ({ ...prev, [hit.id]: hit.nome }));
    onPatch({ hospitalIds: [...filters.hospitalIds, hit.id] });
    setQuery("");
    setHits([]);
  }

  return (
    <div className="flex flex-col gap-5">
      {showUf ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Estado</span>
          <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
            {UF_OPTIONS.map((option) => (
              <Button key={option.uf} type="button" size="sm" variant={uf === option.uf ? "default" : "outline"} aria-pressed={uf === option.uf} onClick={() => onUf(option.uf)}>
                {option.nome}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Acomodação</span>
          <Chips label="Acomodação" options={ACOMODACOES} selected={filters.acomodacoes} onToggle={(v) => onPatch({ acomodacoes: toggle(filters.acomodacoes, v) })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Coparticipação</span>
          <Chips label="Coparticipação" options={COPARTICIPACOES} selected={filters.coparticipacoes} onToggle={(v) => onPatch({ coparticipacoes: toggle(filters.coparticipacoes, v) })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Contratação</span>
          <Chips label="Contratação" options={CONTRATACOES} selected={filters.contratacoes} onToggle={(v) => onPatch({ contratacoes: toggle(filters.contratacoes, v) })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Valor mensal total</span>
          <div className="flex items-center gap-2">
            <Input inputMode="numeric" placeholder="mín." aria-label="Valor mensal mínimo em reais" value={filters.valorMin ?? ""} onChange={(e) => onPatch({ valorMin: e.target.value.replace(/\D/g, "") === "" ? null : Number(e.target.value.replace(/\D/g, "")) })} />
            <span className="text-muted-foreground">a</span>
            <Input inputMode="numeric" placeholder="máx." aria-label="Valor mensal máximo em reais" value={filters.valorMax ?? ""} onChange={(e) => onPatch({ valorMax: e.target.value.replace(/\D/g, "") === "" ? null : Number(e.target.value.replace(/\D/g, "")) })} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Rede de referência (hospitais)</span>
        <div className="relative">
          <Input
            type="search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-autocomplete="list"
            placeholder={uf ? "Digite o nome do hospital" : "Escolha o estado para buscar hospitais"}
            disabled={!uf}
            value={query}
            onChange={(e) => void search(e.target.value)}
          />
          {hits.length > 0 ? (
            <ul role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" role="option" aria-selected={false} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => pick(hit)}>
                    <span className="block font-medium">{hit.nome}</span>
                    <span className="block text-xs text-muted-foreground">{[hit.cidade, hit.uf].filter(Boolean).join(" - ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {filters.hospitalIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filters.hospitalIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1">
                {hospitalNames[id] ?? `Hospital ${id}`}
                <button type="button" aria-label={`Tirar ${hospitalNames[id] ?? "hospital"}`} onClick={() => onPatch({ hospitalIds: filters.hospitalIds.filter((h) => h !== id) })}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          Só tabelas que aceitam MEI
          <Switch checked={filters.mei} onCheckedChange={(checked) => onPatch({ mei: checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          Respeitar o mínimo de vidas
          <Switch checked={filters.respeitarMinimoVidas} onCheckedChange={(checked) => onPatch({ respeitarMinimoVidas: checked })} />
        </label>
      </div>
    </div>
  );
}

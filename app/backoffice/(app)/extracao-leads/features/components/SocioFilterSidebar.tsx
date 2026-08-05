"use client"

import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { MultiCheckboxSelect } from "./MultiCheckboxSelect"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"

const PERSON_TYPE_OPTIONS = [
  { value: "NATURAL", label: "Pessoa física" },
  { value: "LEGAL", label: "Pessoa jurídica" },
  { value: "FOREIGN", label: "Estrangeira" },
]

const AGE_RANGE_OPTIONS = [
  { value: "0-12", label: "0 – 12 anos" },
  { value: "13-20", label: "13 – 20 anos" },
  { value: "21-30", label: "21 – 30 anos" },
  { value: "31-40", label: "31 – 40 anos" },
  { value: "41-50", label: "41 – 50 anos" },
  { value: "51-60", label: "51 – 60 anos" },
  { value: "61-70", label: "61 – 70 anos" },
  { value: "71-80", label: "71 – 80 anos" },
  { value: "81+", label: "81+ anos" },
]

export function SocioFilterSidebar() {
  const {
    socioFilters,
    setSocioFilters,
    isSocioSearching,
    handleSocioSearch,
    clearSocioFilters,
  } = useBackofficeLeadExtraction()

  function update<K extends keyof typeof socioFilters>(key: K, value: (typeof socioFilters)[K]) {
    setSocioFilters((prev) => ({ ...prev, [key]: value }))
  }

  const hasNaturalType =
    socioFilters.types.length === 0 || socioFilters.types.includes("NATURAL")

  const isSubmitDisabled = isSocioSearching || socioFilters.names.trim().length === 0

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {/* Nome */}
        <div className="mb-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Nome(s) do sócio</Label>
          <Input
            placeholder="Ex: João Silva, Maria Souza"
            value={socioFilters.names}
            onChange={(e) => update("names", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSubmitDisabled) void handleSocioSearch()
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">Separe múltiplos nomes por vírgula</p>
        </div>

        <Separator className="mb-4" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Filtros opcionais</span>
          <button
            onClick={clearSocioFilters}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        </div>

        {/* Tipo de pessoa */}
        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Tipo de pessoa</Label>
          <MultiCheckboxSelect
            options={PERSON_TYPE_OPTIONS}
            values={socioFilters.types}
            onChange={(v) => update("types", v)}
            placeholder="Qualquer tipo"
          />
        </div>

        {/* Faixa etária — só quando Pessoa Física está no escopo */}
        {hasNaturalType && (
          <div className="mb-3">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Faixa etária</Label>
            <MultiCheckboxSelect
              options={AGE_RANGE_OPTIONS}
              values={socioFilters.ageRanges}
              onChange={(v) => update("ageRanges", v)}
              placeholder="Qualquer faixa etária"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-3">
        <Button
          className="w-full"
          onClick={handleSocioSearch}
          disabled={isSubmitDisabled}
        >
          {isSocioSearching ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Search data-icon="inline-start" />
          )}
          {isSocioSearching ? "Pesquisando…" : "Pesquisar sócios"}
        </Button>
      </div>
    </aside>
  )
}

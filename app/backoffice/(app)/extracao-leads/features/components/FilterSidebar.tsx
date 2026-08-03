"use client"

import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"

const CNAE_OPTIONS = [
  { value: "6622300", label: "6622-3/00 — Corretores de seguros" },
  { value: "6621500", label: "6621-5/00 — Sociedades de capitalização" },
  { value: "6630400", label: "6630-4/00 — Gestão de fundos" },
  { value: "6512000", label: "6512-0/00 — Bancos múltiplos" },
  { value: "6550200", label: "6550-2/00 — Planos de saúde" },
]

const STATE_OPTIONS = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MG", label: "Minas Gerais" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MT", label: "Mato Grosso" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "PR", label: "Paraná" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SE", label: "Sergipe" },
  { value: "SP", label: "São Paulo" },
  { value: "TO", label: "Tocantins" },
]

export function FilterSidebar() {
  const {
    filters,
    setFilters,
    isSearching,
    removeContadores,
    setRemoveContadores,
    handleSearch,
    clearFilters,
  } = useBackofficeLeadExtraction()

  function update(key: keyof typeof filters, value: unknown) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-1 flex-col gap-0 overflow-y-auto p-4">

        {/* CNAE */}
        <div className="mb-3">
          <Select value={filters.mainCnae} onValueChange={(v) => update("mainCnae", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Ramo de atividade (CNAE)" />
            </SelectTrigger>
            <SelectContent>
              {CNAE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id="sideCnae"
            checked={filters.sideCnae}
            onCheckedChange={(v) => update("sideCnae", v === true)}
          />
          <Label htmlFor="sideCnae" className="cursor-pointer text-sm font-normal text-muted-foreground">
            Buscar CNAE secundário
          </Label>
        </div>

        {/* Localização */}
        <div className="mb-4">
          <Select value={filters.state} onValueChange={(v) => update("state", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Localização (UF)" />
            </SelectTrigger>
            <SelectContent>
              {STATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} — {opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Características */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Características</span>
          <button
            onClick={clearFilters}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtro
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Select value={filters.statusId} onValueChange={(v) => update("statusId", v)}>
            <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Ativa</SelectItem>
              <SelectItem value="3">Suspensa</SelectItem>
              <SelectItem value="4">Inapta</SelectItem>
              <SelectItem value="8">Baixada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.natureId} onValueChange={(v) => update("natureId", v)}>
            <SelectTrigger><SelectValue placeholder="Natureza jurídica" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2135">EI</SelectItem>
              <SelectItem value="2062">EIRELI</SelectItem>
              <SelectItem value="2054">LTDA</SelectItem>
              <SelectItem value="2135">MEI</SelectItem>
              <SelectItem value="2057">SA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Select value={filters.sizeId} onValueChange={(v) => update("sizeId", v)}>
            <SelectTrigger><SelectValue placeholder="Porte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Micro empresa</SelectItem>
              <SelectItem value="3">Pequeno porte</SelectItem>
              <SelectItem value="5">Demais</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.simplesOptant} onValueChange={(v) => update("simplesOptant", v)}>
            <SelectTrigger><SelectValue placeholder="Simples Nacional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Optante</SelectItem>
              <SelectItem value="false">Não optante</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4">
          <Select value={filters.simeiOptant} onValueChange={(v) => update("simeiOptant", v)}>
            <SelectTrigger><SelectValue placeholder="Opção pelo MEI" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Optante MEI</SelectItem>
              <SelectItem value="false">Não optante MEI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator className="mb-4" />

        {/* Filtrar */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Filtrar</span>
          <button
            onClick={() => setFilters((prev) => ({
              ...prev, foundedGte: "", foundedLte: "", hasPhone: false, hasEmail: false
            }))}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtro
          </button>
        </div>

        <Label className="mb-2 text-xs text-muted-foreground">Data de abertura</Label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Input
            placeholder="De (YYYY-MM-DD)"
            value={filters.foundedGte}
            onChange={(e) => update("foundedGte", e.target.value)}
          />
          <Input
            placeholder="Até (YYYY-MM-DD)"
            value={filters.foundedLte}
            onChange={(e) => update("foundedLte", e.target.value)}
          />
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id="hasPhone"
            checked={filters.hasPhone}
            onCheckedChange={(v) => update("hasPhone", v === true)}
          />
          <Label htmlFor="hasPhone" className="cursor-pointer text-sm font-normal">
            Apenas com telefone
          </Label>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id="hasEmail"
            checked={filters.hasEmail}
            onCheckedChange={(v) => update("hasEmail", v === true)}
          />
          <Label htmlFor="hasEmail" className="cursor-pointer text-sm font-normal">
            Apenas com e-mail
          </Label>
        </div>

        {/* Toggle — remover contadores */}
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            <span className="text-base">⚡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Remover contato de contadores</p>
              <p className="text-xs text-muted-foreground">Remove até 80% dos contatos de contadores das listas</p>
            </div>
            <Switch
              checked={removeContadores}
              onCheckedChange={setRemoveContadores}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3">
        <Button
          className="w-full"
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Search data-icon="inline-start" />
          )}
          {isSearching ? "Pesquisando…" : "Pesquisar"}
        </Button>
      </div>
    </aside>
  )
}

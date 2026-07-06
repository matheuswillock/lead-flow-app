"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMultiskillTransfersContext } from "../context/MultiskillTransfersContext";

type MultiskillTransfersFiltersBarProps = {
  onRefresh: () => void;
};

export function MultiskillTransfersFiltersBar({ onRefresh }: MultiskillTransfersFiltersBarProps) {
  const { filters, setFilters, isLoading } = useMultiskillTransfersContext();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2 sm:max-w-md sm:flex-1">
        <Label htmlFor="multiskill-search">Buscar destino</Label>
        <Input
          id="multiskill-search"
          placeholder="Master, e-mail, time padrão ou closer..."
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
      </div>
      <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
        Atualizar
      </Button>
    </div>
  );
}

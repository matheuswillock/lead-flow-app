"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPresetsTriggerButton } from "@/app/[supabaseId]/components/leads-filters/FilterPresetsTriggerButton";
import type { FilterPresetScope } from "@/lib/team-filter-presets/types";
import { API_CLIENT_BASE } from "@/lib/route-map";

export type StoredFilterPreset<T> = {
  id: string;
  name: string;
  description: string | null;
  queryJson: T;
  visibility: "private" | "team";
  createdBy: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeadsFilterPresetsSheetProps<T> = {
  scope: FilterPresetScope;
  supabaseId?: string;
  profileId?: string;
  teamId?: string | null;
  isManager: boolean;
  currentFilters: T;
  isPresetActive: boolean;
  lastPresetStorageKey: string | null;
  normalizePresetFilters: (raw: unknown) => T;
  areFiltersEqual: (left: T, right: T) => boolean;
  presetDescriptionLabel: (filters: T) => string;
  onApplyFilters: (filters: T) => void;
  getCreatorName?: (profileId: string) => string | undefined;
  /** One-shot import from localStorage before API load (Carteira migration) */
  importFromLocalStorageKey?: string | null;
  onPresetsChange?: (presets: StoredFilterPreset<T>[]) => void;
};

export function LeadsFilterPresetsSheet<T>({
  scope,
  supabaseId,
  profileId,
  teamId,
  isManager,
  currentFilters,
  isPresetActive,
  lastPresetStorageKey,
  normalizePresetFilters,
  areFiltersEqual,
  presetDescriptionLabel,
  onApplyFilters,
  getCreatorName,
  importFromLocalStorageKey,
  onPresetsChange,
}: LeadsFilterPresetsSheetProps<T>) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presets, setPresets] = useState<StoredFilterPreset<T>[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [presetVisibility, setPresetVisibility] = useState<"private" | "team">("private");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);
  const importDoneRef = useRef(false);
  const inFlightKeyRef = useRef<string | null>(null);
  const lastSettledKeyRef = useRef<string | null>(null);
  const normalizePresetFiltersRef = useRef(normalizePresetFilters);
  const onPresetsChangeRef = useRef(onPresetsChange);

  normalizePresetFiltersRef.current = normalizePresetFilters;
  onPresetsChangeRef.current = onPresetsChange;

  const apiBase = teamId ? `${API_CLIENT_BASE}/teams/${teamId}/${scope}/filter-presets` : null;

  useEffect(() => {
    if (!lastPresetStorageKey || typeof window === "undefined") {
      setLastUsedPresetId(null);
      return;
    }
    setLastUsedPresetId(window.localStorage.getItem(lastPresetStorageKey));
  }, [lastPresetStorageKey]);

  useEffect(() => {
    importDoneRef.current = false;
    lastSettledKeyRef.current = null;
    inFlightKeyRef.current = null;
  }, [apiBase]);

  const requestHeaders = useMemo(() => {
    if (!supabaseId || !teamId) return null;
    return {
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    };
  }, [supabaseId, teamId]);

  const importLocalPresets = useCallback(async () => {
    if (!importFromLocalStorageKey || !apiBase || !requestHeaders || importDoneRef.current) return;
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(importFromLocalStorageKey);
    if (!stored) {
      importDoneRef.current = true;
      return;
    }

    try {
      const listResponse = await fetch(apiBase, { headers: requestHeaders });
      const listResult = await listResponse.json().catch(() => null);
      const existing = Array.isArray(listResult?.result) ? listResult.result : [];
      if (existing.length > 0) {
        window.localStorage.removeItem(importFromLocalStorageKey);
        importDoneRef.current = true;
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(importFromLocalStorageKey);
        importDoneRef.current = true;
        return;
      }

      for (const item of parsed) {
        if (!item?.name) continue;
        await fetch(apiBase, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify({
            name: String(item.name),
            description: item.description ?? null,
            queryJson: item.queryJson ?? {},
            visibility: "private",
          }),
        });
      }
      window.localStorage.removeItem(importFromLocalStorageKey);
    } catch (error) {
      console.error("[LeadsFilterPresetsSheet] Falha ao importar presets do localStorage:", error);
    } finally {
      importDoneRef.current = true;
    }
  }, [apiBase, importFromLocalStorageKey, requestHeaders]);

  const loadPresets = useCallback(async (options?: { force?: boolean }) => {
    if (!apiBase || !requestHeaders) {
      setPresets([]);
      return;
    }

    const requestKey = apiBase;
    if (
      !options?.force &&
      (inFlightKeyRef.current === requestKey || lastSettledKeyRef.current === requestKey)
    ) {
      return;
    }

    inFlightKeyRef.current = requestKey;

    if (importFromLocalStorageKey && !importDoneRef.current) {
      await importLocalPresets();
    }

    setPresetsLoading(true);
    try {
      const response = await fetch(apiBase, { headers: requestHeaders });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao carregar presets.");
      }
      const nextPresets = Array.isArray(result.result)
        ? result.result.map((preset: StoredFilterPreset<T> & { queryJson: unknown }) => ({
            ...preset,
            visibility: preset.visibility === "team" ? "team" : "private",
            queryJson: normalizePresetFiltersRef.current(preset.queryJson),
          }))
        : [];
      setPresets(nextPresets);
      onPresetsChangeRef.current?.(nextPresets);
      lastSettledKeyRef.current = requestKey;
    } catch (error) {
      // Assenta mesmo em erro para não martelar o endpoint em loop de 5xx.
      lastSettledKeyRef.current = requestKey;
      toast.error(error instanceof Error ? error.message : "Erro ao carregar filtros salvos.");
      setPresets([]);
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null;
      }
      setPresetsLoading(false);
    }
  }, [apiBase, importFromLocalStorageKey, importLocalPresets, requestHeaders]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const { myPresets, teamPresets } = useMemo(() => {
    const mine: StoredFilterPreset<T>[] = [];
    const shared: StoredFilterPreset<T>[] = [];
    for (const preset of presets) {
      if (preset.visibility === "team") {
        shared.push(preset);
      } else {
        mine.push(preset);
      }
    }
    return { myPresets: mine, teamPresets: shared };
  }, [presets]);

  const canMutatePreset = (preset: StoredFilterPreset<T>) =>
    preset.createdBy === profileId || (preset.visibility === "team" && isManager);

  const handleSavePreset = async () => {
    if (!apiBase || !requestHeaders) return;
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      toast.error("Informe um nome para o preset.");
      return;
    }

    setIsSavingPreset(true);
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          name: normalizedName,
          description: presetDescription.trim() || null,
          queryJson: currentFilters,
          visibility: presetVisibility,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Não foi possível salvar o preset.");
      }
      toast.success("Filtro pré-definido salvo.");
      setPresetName("");
      setPresetDescription("");
      setPresetVisibility("private");
      await loadPresets({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar preset.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleUsePreset = async (preset: StoredFilterPreset<T>) => {
    if (!apiBase || !requestHeaders) return;

    onApplyFilters(normalizePresetFilters(preset.queryJson));
    setLastUsedPresetId(preset.id);
    if (lastPresetStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(lastPresetStorageKey, preset.id);
    }

    try {
      await fetch(`${apiBase}/${preset.id}/use`, {
        method: "POST",
        headers: requestHeaders,
      });
    } catch (error) {
      console.error("[LeadsFilterPresetsSheet] Falha ao marcar preset como usado:", error);
    }

    toast.success(`Preset "${preset.name}" aplicado.`);
    setPresetsOpen(false);
    await loadPresets({ force: true });
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!apiBase || !requestHeaders) return;
    try {
      const response = await fetch(`${apiBase}/${presetId}`, {
        method: "DELETE",
        headers: requestHeaders,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Não foi possível remover o preset.");
      }
      if (lastPresetStorageKey && typeof window !== "undefined" && lastUsedPresetId === presetId) {
        window.localStorage.removeItem(lastPresetStorageKey);
        setLastUsedPresetId(null);
      }
      toast.success("Preset removido.");
      await loadPresets({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover preset.");
    }
  };

  const renderPresetCard = (preset: StoredFilterPreset<T>) => {
    const isLastUsed = preset.id === lastUsedPresetId;
    const isActive = areFiltersEqual(normalizePresetFilters(preset.queryJson), currentFilters);
    const creatorName = getCreatorName?.(preset.createdBy);

    return (
      <div key={preset.id} className="rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{preset.name}</p>
            {preset.visibility === "team" ? (
              <Badge variant="secondary" title={creatorName ? `Criado por ${creatorName}` : undefined}>
                Time
              </Badge>
            ) : null}
            {isLastUsed ? <Badge variant="outline">Último usado</Badge> : null}
            {isActive ? <Badge variant="default">Ativo</Badge> : null}
          </div>
          {canMutatePreset(preset) ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void handleDeletePreset(preset.id)}
              aria-label={`Remover preset ${preset.name}`}
            >
              <Trash2 data-icon="inline-start" />
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {preset.description?.trim() ||
            presetDescriptionLabel(normalizePresetFilters(preset.queryJson))}
        </p>
        {preset.visibility === "team" && creatorName ? (
          <p className="mt-1 text-xs text-muted-foreground">Por {creatorName}</p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void handleUsePreset(preset)}>
            Usar
          </Button>
        </div>
      </div>
    );
  };

  const renderPresetSection = (title: string, items: StoredFilterPreset<T>[]) => {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {items.map(renderPresetCard)}
      </div>
    );
  };

  return (
    <Sheet
      open={presetsOpen}
      onOpenChange={(open) => {
        setPresetsOpen(open);
        if (open) void loadPresets({ force: true });
      }}
    >
      <SheetTrigger asChild>
        <FilterPresetsTriggerButton isActive={isPresetActive} />
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Filtros pré-definidos</SheetTitle>
          <SheetDescription>
            Salve e reutilize combinações de filtros. Compartilhe com o time quando necessário.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid gap-3 rounded-lg border border-border/60 p-3">
          <Input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Nome do preset"
          />
          <Input
            value={presetDescription}
            onChange={(event) => setPresetDescription(event.target.value)}
            placeholder="Descrição da query"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-muted-foreground">Visibilidade</Label>
            <RadioGroup
              value={presetVisibility}
              onValueChange={(value) => setPresetVisibility(value as "private" | "team")}
              className="grid gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="private" id={`${scope}-visibility-private`} />
                <Label htmlFor={`${scope}-visibility-private`}>Somente eu</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team" id={`${scope}-visibility-team`} />
                <Label htmlFor={`${scope}-visibility-team`}>Todo o time</Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={() => void handleSavePreset()} disabled={isSavingPreset}>
            {isSavingPreset ? "Salvando..." : "Salvar filtro atual"}
          </Button>
        </div>

        <div className="mt-4 flex max-h-[calc(100vh-22rem)] flex-col gap-4 overflow-y-auto">
          {presetsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum preset salvo ainda.</p>
          ) : (
            <>
              {renderPresetSection("Meus filtros", myPresets)}
              {myPresets.length > 0 && teamPresets.length > 0 ? <Separator /> : null}
              {renderPresetSection("Filtros do time", teamPresets)}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import type { ColumnKey } from "../context/BoardTypes";
import {
  leadOriginFilterLabel,
  resolveLeadOriginFilter,
  type LeadOriginFilterValue,
} from "@/lib/leads/origin-filter";
import {
  sortCustomFieldFiltersForComparison,
  type CustomFieldFilterState,
  type CustomFieldSortState,
} from "@/app/[supabaseId]/components/leads-filters/customFieldFilterTypes";

export type BoardFiltersState = {
  query: string;
  assignedUsers: string[];
  statusFilter: ColumnKey[];
  closerFilter: string[];
  onlyMeetingsHeld: boolean;
  onlyTransfer: boolean;
  originFilter: LeadOriginFilterValue | "";
  periodStart: string;
  periodEnd: string;
  customFieldFilters: CustomFieldFilterState[];
  customFieldSort: CustomFieldSortState | null;
};

export const DEFAULT_BOARD_FILTERS: BoardFiltersState = {
  query: "",
  assignedUsers: [],
  statusFilter: [],
  closerFilter: [],
  onlyMeetingsHeld: false,
  onlyTransfer: false,
  originFilter: "",
  periodStart: "",
  periodEnd: "",
  customFieldFilters: [],
  customFieldSort: null,
};

export function normalizeBoardPresetFilters(raw: unknown): BoardFiltersState {
  if (!raw || typeof raw !== "object") return DEFAULT_BOARD_FILTERS;
  const data = raw as Partial<BoardFiltersState>;
  return {
    ...DEFAULT_BOARD_FILTERS,
    ...data,
    query: typeof data.query === "string" ? data.query : "",
    assignedUsers: Array.isArray(data.assignedUsers) ? data.assignedUsers : [],
    statusFilter: Array.isArray(data.statusFilter) ? (data.statusFilter as ColumnKey[]) : [],
    closerFilter: Array.isArray(data.closerFilter) ? data.closerFilter : [],
    onlyMeetingsHeld: data.onlyMeetingsHeld === true,
    onlyTransfer: resolveLeadOriginFilter(data.originFilter, data.onlyTransfer === true) === "transfer",
    originFilter: resolveLeadOriginFilter(data.originFilter, data.onlyTransfer === true),
    periodStart: typeof data.periodStart === "string" ? data.periodStart : "",
    periodEnd: typeof data.periodEnd === "string" ? data.periodEnd : "",
    customFieldFilters: Array.isArray(data.customFieldFilters) ? data.customFieldFilters : [],
    customFieldSort:
      data.customFieldSort && typeof data.customFieldSort === "object" ? data.customFieldSort : null,
  };
}

function normalizeForComparison(filters: BoardFiltersState): BoardFiltersState {
  return {
    ...filters,
    query: filters.query.trim(),
    assignedUsers: [...filters.assignedUsers].sort(),
    statusFilter: [...filters.statusFilter].sort(),
    closerFilter: [...filters.closerFilter].sort(),
    periodStart: filters.periodStart || "",
    periodEnd: filters.periodEnd || "",
    onlyMeetingsHeld: filters.onlyMeetingsHeld === true,
    onlyTransfer: filters.onlyTransfer === true,
    originFilter: resolveLeadOriginFilter(filters.originFilter, filters.onlyTransfer),
    customFieldFilters: sortCustomFieldFiltersForComparison(
      filters.customFieldFilters
    ) as CustomFieldFilterState[],
    customFieldSort: filters.customFieldSort ?? null,
  };
}

export function areBoardFiltersEqual(left: BoardFiltersState, right: BoardFiltersState) {
  return (
    JSON.stringify(normalizeForComparison(left)) === JSON.stringify(normalizeForComparison(right))
  );
}

export function boardPresetDescriptionLabel(filters: BoardFiltersState) {
  const parts: string[] = [];
  if (filters.query.trim()) parts.push(`Busca: "${filters.query.trim()}"`);
  if (filters.statusFilter.length) parts.push(`Status: ${filters.statusFilter.length}`);
  if (filters.assignedUsers.length) parts.push(`Responsáveis: ${filters.assignedUsers.length}`);
  if (filters.closerFilter.length) parts.push(`Closers: ${filters.closerFilter.length}`);
  if (filters.periodStart) {
    parts.push(
      `Período: ${filters.periodStart}${filters.periodEnd ? ` até ${filters.periodEnd}` : ""}`
    );
  }
  if (filters.onlyMeetingsHeld) parts.push("Reuniões realizadas");
  const originLabel = leadOriginFilterLabel(filters.originFilter);
  if (originLabel) parts.push(`Origem: ${originLabel}`);
  else if (filters.onlyTransfer) parts.push("Transferência");
  if (filters.customFieldFilters.length) parts.push(`Campos personalizados: ${filters.customFieldFilters.length}`);
  if (filters.customFieldSort) parts.push(`Ordenado por campo personalizado (${filters.customFieldSort.direction})`);
  if (parts.length === 0) return "Sem filtros aplicados";
  return parts.join(" • ");
}

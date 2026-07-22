import type { CustomFieldFilterOperator } from "@/lib/leadCustomFields/customFieldQuery";

export type { CustomFieldFilterOperator };

export type CustomFieldFilterState = {
  id: string;
  definitionId: string;
  operator: CustomFieldFilterOperator;
  value?: unknown;
};

export type CustomFieldSortState = {
  definitionId: string;
  direction: "asc" | "desc";
};

export const OPERATOR_LABELS: Record<CustomFieldFilterOperator, string> = {
  eq: "é igual a",
  neq: "é diferente de",
  contains: "contém",
  is_empty: "está vazio",
  not_empty: "não está vazio",
};

export function customFieldFiltersDescriptionLabel(filters: CustomFieldFilterState[]): string | null {
  if (filters.length === 0) return null;
  return `Campos personalizados: ${filters.length}`;
}

/**
 * Chave de conteúdo para comparação/ordenação — ignora `id` (gerado no
 * client a cada adição, não é estável entre reconstruções do mesmo filtro).
 */
export function customFieldFilterContentKey(filter: CustomFieldFilterState): string {
  return `${filter.definitionId}:${filter.operator}:${JSON.stringify(filter.value ?? null)}`;
}

export function sortCustomFieldFiltersForComparison(
  filters: CustomFieldFilterState[]
): Array<Omit<CustomFieldFilterState, "id">> {
  return [...filters]
    .map(({ id: _id, ...rest }) => rest)
    .sort((a, b) =>
      customFieldFilterContentKey({ ...a, id: "" }).localeCompare(
        customFieldFilterContentKey({ ...b, id: "" })
      )
    );
}

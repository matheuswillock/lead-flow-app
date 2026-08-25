import { z } from "zod";
import { LeadStatus } from "@prisma/client";
import {
  MAX_CUSTOM_FIELD_FILTERS,
  type CustomFieldFilterInput,
  type CustomFieldSortInput,
} from "@/lib/leadCustomFields/customFieldQuery";

const customFieldFilterOperatorSchema = z.enum(["eq", "neq", "contains", "is_empty", "not_empty"]);
const OPERATORS_REQUIRING_VALUE = new Set(["eq", "neq", "contains"]);

export const CustomFieldFilterQuerySchema = z
  .object({
    definitionId: z.string().uuid("definitionId deve ser um UUID válido"),
    operator: customFieldFilterOperatorSchema,
    value: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (OPERATORS_REQUIRING_VALUE.has(data.operator) && data.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `O operador "${data.operator}" exige um valor`,
        path: ["value"],
      });
    }
  });

export const CustomFieldFiltersQuerySchema = z
  .array(CustomFieldFilterQuerySchema)
  .max(MAX_CUSTOM_FIELD_FILTERS, `Máximo de ${MAX_CUSTOM_FIELD_FILTERS} filtros de campos personalizados por consulta`);

export const CustomFieldSortQuerySchema = z.object({
  definitionId: z.string().uuid("definitionId deve ser um UUID válido"),
  direction: z.enum(["asc", "desc"]),
});

/**
 * `customFieldFilters`/`customFieldSort` chegam como JSON serializado em query
 * params (GET não carrega body). Retorna `undefined` quando ausente e lança
 * `ZodError` quando presente mas inválido — o caller decide como responder.
 */
export function parseCustomFieldFiltersQueryParam(raw: string | null) {
  if (!raw) return undefined;
  const json: unknown = JSON.parse(raw);
  return CustomFieldFiltersQuerySchema.parse(json);
}

export function parseCustomFieldSortQueryParam(raw: string | null) {
  if (!raw) return undefined;
  const json: unknown = JSON.parse(raw);
  return CustomFieldSortQuerySchema.parse(json);
}

export const LeadStatusQuerySchema = z.nativeEnum(LeadStatus);

/**
 * Valida o `status` da query contra o enum real do banco. Antes era um cast
 * (`as LeadStatus`), que deixava `?status=qualquer-coisa` chegar ate a consulta
 * Prisma como enum invalido. Retorna `undefined` quando ausente e lanca
 * `ZodError` quando presente mas invalido — o caller decide como responder.
 */
export function parseLeadStatusQueryParam(raw: string | null) {
  if (!raw) return undefined;
  return LeadStatusQuerySchema.parse(raw);
}

/**
 * Serializa filtros/ordenacao de campos personalizados de forma canonica, para
 * uso como argumento de cache.
 *
 * Sem isso, `[{a},{b}]` e `[{b},{a}]` — semanticamente a mesma consulta —
 * gerariam duas entradas de cache distintas. Ordena o array por
 * `definitionId`/`operator` e as chaves de cada objeto, e devolve `""` quando
 * ausente (sentinela de "sem filtro" aceita como argumento primitivo).
 */
export function canonicalizeCustomFieldFilters(
  filters: CustomFieldFilterInput[] | undefined
): string {
  if (!filters?.length) return "";

  const normalized = filters
    .map((filter) => ({
      definitionId: filter.definitionId,
      operator: filter.operator,
      ...(filter.value !== undefined && { value: filter.value }),
    }))
    .sort((a, b) =>
      a.definitionId === b.definitionId
        ? a.operator.localeCompare(b.operator)
        : a.definitionId.localeCompare(b.definitionId)
    );

  return JSON.stringify(normalized);
}

export function canonicalizeCustomFieldSort(sort: CustomFieldSortInput | undefined): string {
  if (!sort) return "";
  return JSON.stringify({ definitionId: sort.definitionId, direction: sort.direction });
}

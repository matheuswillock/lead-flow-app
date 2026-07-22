import { z } from "zod";
import { MAX_CUSTOM_FIELD_FILTERS } from "@/lib/leadCustomFields/customFieldQuery";

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

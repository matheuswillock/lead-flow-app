import { z } from "zod";
import { LeadStatus } from "@prisma/client";
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

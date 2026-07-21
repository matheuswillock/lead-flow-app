import type { Prisma } from "@prisma/client"

export type CustomFieldFilterOperator = "eq" | "neq" | "contains" | "is_empty" | "not_empty"

export type CustomFieldFilterInput = {
  definitionId: string
  operator: CustomFieldFilterOperator
  value?: unknown
}

export type CustomFieldSortDirection = "asc" | "desc"

export type CustomFieldSortInput = {
  definitionId: string
  direction: CustomFieldSortDirection
}

export const MAX_CUSTOM_FIELD_FILTERS = 3

/**
 * `LeadDialog`/`persistLeadCustomFieldValues` sempre fazem upsert, nunca deletam
 * a linha quando o campo é limpo — um texto/multi-select opcional esvaziado
 * persiste como `""`/`[]`. `is_empty`/`not_empty` precisam tratar isso como
 * ausência de valor, não apenas checar se a linha existe.
 */
const BLANK_VALUE_CONDITIONS: Prisma.JsonFilter[] = [{ equals: "" }, { equals: [] }]

/**
 * Traduz um filtro de custom field para um fragmento de `Prisma.LeadWhereInput`.
 * `neq` inclui leads sem valor para a definição (ausência != valor), espelhando
 * a semântica de "diferente de X" também para o campo vazio.
 */
export function buildCustomFieldWhereFilter(filter: CustomFieldFilterInput): Prisma.LeadWhereInput {
  const { definitionId, operator, value } = filter

  if (operator === "is_empty") {
    return {
      customFieldValues: {
        none: {
          definitionId,
          NOT: { OR: BLANK_VALUE_CONDITIONS.map((condition) => ({ value: condition })) },
        },
      },
    }
  }

  if (operator === "not_empty") {
    return {
      customFieldValues: {
        some: {
          definitionId,
          NOT: { OR: BLANK_VALUE_CONDITIONS.map((condition) => ({ value: condition })) },
        },
      },
    }
  }

  if (operator === "contains") {
    // multi_select persiste um array JSON — a UI codifica o valor selecionado
    // como array para sinalizar teste de pertencimento (array_contains) em vez
    // de substring (string_contains, usado para texto).
    if (Array.isArray(value)) {
      return {
        customFieldValues: {
          some: {
            definitionId,
            value: { array_contains: value as Prisma.InputJsonValue },
          },
        },
      }
    }
    return {
      customFieldValues: {
        some: {
          definitionId,
          value: { string_contains: String(value ?? ""), mode: "insensitive" },
        },
      },
    }
  }

  if (operator === "neq") {
    return {
      NOT: {
        customFieldValues: {
          some: {
            definitionId,
            value: { equals: value as Prisma.InputJsonValue },
          },
        },
      },
    }
  }

  // eq
  return {
    customFieldValues: {
      some: {
        definitionId,
        value: { equals: value as Prisma.InputJsonValue },
      },
    },
  }
}

function toComparablePrimitive(value: unknown): number | string {
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.join(",")
  return String(value)
}

/**
 * Comparador para ordenação por valor de custom field, com valores vazios
 * sempre por último independente da direção (asc/desc).
 */
export function compareCustomFieldSortValues(
  a: unknown,
  b: unknown,
  direction: CustomFieldSortDirection
): number {
  const aEmpty = a === null || a === undefined
  const bEmpty = b === null || b === undefined

  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  const left = toComparablePrimitive(a)
  const right = toComparablePrimitive(b)

  let cmp: number
  if (typeof left === "number" && typeof right === "number") {
    cmp = left - right
  } else {
    cmp = String(left).localeCompare(String(right), "pt-BR")
  }

  return direction === "asc" ? cmp : -cmp
}

/**
 * Deriva os atributos de Autofill do browser (`autoComplete`/`name`/`inputMode`)
 * pra uma pergunta de formulário público. Autofill é o perfil salvo pelo
 * PRÓPRIO usuário no browser/gerenciador de senhas — não lê cookie de
 * terceiro nem dado de outro site (ver nota "Formulários de campanha —
 * Autocomplete e cookies").
 *
 * Deriva prioritariamente de `mappingKey` (fonte de verdade de intenção —
 * "isso é um e-mail"), com `type` só como fallback quando não há mapeamento
 * nativo. Necessário porque produção tem perguntas com `type` divergente do
 * `mappingKey` (ex.: e-mail tipado como texto livre) — ver migration
 * `corrigir-type-mapping-key-divergente`.
 */

export type PublicFormAutocompleteAttrs = {
  autoComplete: string
  name: string
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "url" | "none"
}

/** mappingKey nativo → token de autocomplete. Cobre identidade + endereço (novo, sem dado em produção ainda). */
const AUTOCOMPLETE_TOKEN_BY_MAPPING_KEY: Record<string, string> = {
  name: "name",
  email: "email",
  phone: "tel",
  cnpj: "off",
  age: "off",
  currentHealthPlan: "off",
  currentValue: "off",
  referenceHospital: "off",
  currentTreatment: "off",
  // Endereço — nenhum formulário em produção usa esses mappingKey ainda,
  // reservados pra quando a pergunta de endereço existir.
  address: "street-address",
  addressLine1: "address-line1",
  addressLine2: "address-line2",
  city: "address-level2",
  state: "address-level1",
  postalCode: "postal-code",
  country: "country",
}

const INPUT_MODE_BY_MAPPING_KEY: Record<string, PublicFormAutocompleteAttrs["inputMode"]> = {
  email: "email",
  phone: "tel",
  postalCode: "numeric",
}

/** Types que nunca devem ser autofilled — escolha, consentimento, cálculo, agendamento. */
const AUTOCOMPLETE_OFF_TYPES = new Set([
  "currency",
  "single_choice",
  "multiple_choice",
  "boolean",
  "consent",
  "calculation",
  "health_plan",
  "scheduling",
  "crm_field",
  "custom_field",
])

function fallbackAutoCompleteByType(type: string): string {
  if (AUTOCOMPLETE_OFF_TYPES.has(type)) return "off"
  if (type === "email") return "email"
  if (type === "phone") return "tel"
  if (type === "url") return "url"
  // Texto livre: não força "off" — deixa o browser decidir (regra da nota-fonte).
  return "on"
}

function fallbackInputModeByType(type: string): PublicFormAutocompleteAttrs["inputMode"] {
  if (type === "email") return "email"
  if (type === "phone") return "tel"
  if (type === "number" || type === "currency") return "decimal"
  if (type === "url") return "url"
  return undefined
}

export function resolvePublicFormAutocompleteAttrs(question: {
  id: string
  type: string
  mappingTarget?: string | null
  mappingKey?: string | null
}): PublicFormAutocompleteAttrs {
  const isNativeMapping = question.mappingTarget === "native_field" && Boolean(question.mappingKey)
  const key = isNativeMapping ? question.mappingKey! : null

  const autoComplete = key
    ? (AUTOCOMPLETE_TOKEN_BY_MAPPING_KEY[key] ?? fallbackAutoCompleteByType(question.type))
    : fallbackAutoCompleteByType(question.type)

  const inputMode = key
    ? (INPUT_MODE_BY_MAPPING_KEY[key] ?? fallbackInputModeByType(question.type))
    : fallbackInputModeByType(question.type)

  return {
    autoComplete,
    name: key ?? question.id,
    inputMode,
  }
}

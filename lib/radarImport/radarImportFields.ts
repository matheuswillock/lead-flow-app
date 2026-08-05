import { RADAR_FIELD_CATALOG } from "@/lib/radar/field-catalog"
import type { ImportFieldDef } from "@/components/import/types"

export type RadarImportNativeFieldKey =
  | "name"
  | "phone"
  | "email"
  | "document"

export type RadarImportCatalogFieldKey = (typeof RADAR_FIELD_CATALOG)[number]["key"]

export type RadarImportFieldKey = RadarImportNativeFieldKey | RadarImportCatalogFieldKey | `new:${string}`

export const RADAR_IMPORT_MAX_ROWS = 2000

const CATALOG_IMPORT_FIELDS: ImportFieldDef[] = RADAR_FIELD_CATALOG.filter(
  (entry) => !entry.key.startsWith("profile.")
).map((entry) => ({
  key: entry.key,
  label: entry.label,
  description: entry.description ?? `Campo do catálogo Radar (${entry.sourceType}).`,
  required: false,
  aliases: [entry.label.toLowerCase(), entry.key.split(".").pop() ?? entry.key],
}))

export const RADAR_IMPORT_NATIVE_FIELDS: ImportFieldDef[] = [
  {
    key: "name",
    label: "Nome",
    description:
      "Nome da pessoa ou empresa. Pelo menos um entre nome, e-mail ou telefone válido é necessário para importar a linha.",
    required: false,
    aliases: ["nome", "name", "cliente", "razao social", "empresa"],
  },
  {
    key: "phone",
    label: "Telefone",
    description: "Telefone ou WhatsApp com DDD. Com nome, forma identidade primária do perfil.",
    required: false,
    formatHint: "Aceita com ou sem máscara",
    aliases: ["telefone", "phone", "celular", "whatsapp", "fone"],
  },
  {
    key: "email",
    label: "E-mail",
    description: "E-mail de contato. Pode ser usado sozinho quando válido (perfil email-only).",
    required: false,
    aliases: ["email", "e-mail", "mail"],
  },
  {
    key: "document",
    label: "Documento",
    description: "CPF ou CNPJ para reconciliação de identidade.",
    required: false,
    aliases: ["cpf", "cnpj", "documento", "doc"],
  },
]

export const RADAR_IMPORT_FIELDS: ImportFieldDef[] = [
  ...RADAR_IMPORT_NATIVE_FIELDS,
  ...CATALOG_IMPORT_FIELDS,
]

export function slugifyRadarFieldKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
}

export function isRadarNewFieldKey(key: string): key is `new:${string}` {
  return key.startsWith("new:")
}

export function inferRadarFieldValueType(samples: string[]): "text" | "number" | "date" | "boolean" {
  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return "text"

  if (nonEmpty.every((value) => /^(true|false|sim|não|nao|yes|no)$/i.test(value))) {
    return "boolean"
  }

  if (nonEmpty.every((value) => /^-?\d+([.,]\d+)?$/.test(value.replace(/\./g, "").replace(",", ".")))) {
    return "number"
  }

  if (nonEmpty.every((value) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value) || /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return "date"
  }

  return "text"
}

export function profileDataKeyForImportField(fieldKey: string): string {
  if (isRadarNewFieldKey(fieldKey)) {
    return `base.${fieldKey.slice(4)}`
  }
  if (fieldKey.startsWith("profile.")) {
    return fieldKey
  }
  return fieldKey
}

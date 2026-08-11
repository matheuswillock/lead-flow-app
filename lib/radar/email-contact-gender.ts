import type { Prisma } from "@prisma/client"
import {
  inferGenderFromSocios,
  type InferredGender,
} from "@/lib/radar/gender-inference"
import {
  resolveGender,
  type GenderCandidate,
  type GenderState,
  type RadarGender,
} from "@/lib/radar/gender"

const MAPPED_GENDER_FIELD_KEYS = ["gender", "genero", "gênero", "sexo"] as const
const SOCIOS_FIELD_KEYS = ["socios", "sócios", "socio", "sócio"] as const

function asCustomFieldsRecord(
  customFields: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return null
  }
  return customFields as Record<string, unknown>
}

function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function extractCustomFieldValue(
  customFields: Record<string, unknown> | null,
  keys: readonly string[]
): string | null {
  if (!customFields) return null

  const normalizedKeys = new Set(keys.map(normalizeFieldKey))
  for (const [key, rawValue] of Object.entries(customFields)) {
    if (!normalizedKeys.has(normalizeFieldKey(key))) continue
    if (typeof rawValue !== "string") continue
    const trimmed = rawValue.trim()
    if (trimmed) return trimmed
  }

  return null
}

export function parseMappedGender(value: string): RadarGender | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")

  if (!normalized) return null

  if (["male", "m", "masculino", "homem", "h"].includes(normalized)) {
    return "male"
  }

  if (["female", "f", "feminino", "mulher"].includes(normalized)) {
    return "female"
  }

  if (["unknown", "indefinido", "nao informado", "nao se aplica", "n/a"].includes(normalized)) {
    return "unknown"
  }

  return null
}

export function buildGenderCandidateFromEmailContactCustomFields(
  customFields: Prisma.JsonValue | null | undefined
): GenderCandidate | null {
  const record = asCustomFieldsRecord(customFields)
  const mappedRaw = extractCustomFieldValue(record, MAPPED_GENDER_FIELD_KEYS)

  if (mappedRaw) {
    const mappedGender = parseMappedGender(mappedRaw)
    if (mappedGender === "male" || mappedGender === "female") {
      return { gender: mappedGender, source: "mapped" }
    }
    return null
  }

  const sociosRaw = extractCustomFieldValue(record, SOCIOS_FIELD_KEYS)
  if (!sociosRaw) return null

  const inferred = inferGenderFromSocios(sociosRaw)
  return toInferredCandidate(inferred)
}

function toInferredCandidate(inferred: InferredGender): GenderCandidate | null {
  if (inferred === "male" || inferred === "female") {
    return { gender: inferred, source: "inferred" }
  }
  return null
}

export function resolveGenderUpdateFromEmailContact(
  current: GenderState,
  customFields: Prisma.JsonValue | null | undefined
): GenderState | null {
  const candidate = buildGenderCandidateFromEmailContactCustomFields(customFields)
  if (!candidate) return null
  return resolveGender(current, candidate)
}

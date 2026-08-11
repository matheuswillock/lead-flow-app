import { BR_FIRST_NAME_GENDER } from "./br-first-name-gender-catalog"

export type InferredGender = "male" | "female" | "unknown"

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

function normalizeFirstNameToken(token: string): string {
  return stripAccents(token.trim().toLowerCase()).replace(/\./g, "")
}

function isInitialOnlyName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  return tokens.every((token) => {
    const normalized = normalizeFirstNameToken(token)
    return normalized.length <= 1
  })
}

function extractFirstName(partner: string): string | null {
  const trimmed = partner.trim()
  if (!trimmed || isInitialOnlyName(trimmed)) return null

  const firstToken = trimmed.split(/\s+/)[0] ?? ""
  const normalized = normalizeFirstNameToken(firstToken)
  if (!normalized || normalized.length <= 1) return null

  return normalized
}

function parseSocios(socios: string[] | string | null | undefined): string[] {
  if (socios == null) return []
  if (Array.isArray(socios)) {
    return socios.map((entry) => entry.trim()).filter(Boolean)
  }

  return socios
    .split(/[;,|/\n]+|\s+e\s+/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function lookupGender(firstName: string): "male" | "female" | null {
  return BR_FIRST_NAME_GENDER[firstName] ?? null
}

export function inferGenderFromSocios(
  socios: string[] | string | null | undefined
): InferredGender {
  const partners = parseSocios(socios)
  if (partners.length === 0) return "unknown"

  const genders = new Set<"male" | "female">()

  for (const partner of partners) {
    const firstName = extractFirstName(partner)
    if (!firstName) continue

    const gender = lookupGender(firstName)
    if (gender) genders.add(gender)
  }

  if (genders.size === 1) {
    return Array.from(genders)[0]!
  }

  return "unknown"
}

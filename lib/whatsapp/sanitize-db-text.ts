/**
 * Sanitizes text before Postgres/Prisma persistence.
 * Strips lone backslashes and incomplete \\u hex escapes that break JSON serialization.
 */
export function sanitizeDbText(value: string | null | undefined): string | null {
  if (value == null || value === "") return null

  let result = ""
  let i = 0
  while (i < value.length) {
    const char = value[i]
    if (char !== "\\") {
      result += char
      i += 1
      continue
    }

    const next = value[i + 1]
    if (next === undefined) {
      i += 1
      continue
    }

    if (next === "u") {
      const hex = value.slice(i + 2, i + 6)
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        result += value.slice(i, i + 6)
        i += 6
      } else {
        i += 1
      }
      continue
    }

    if ('"\\/bfnrt'.includes(next)) {
      result += char + next
      i += 2
      continue
    }

    i += 1
  }

  return result
}

/**
 * Strips HTML tags from untrusted text (link previews, pushName, etc.)
 * to prevent stored XSS. Does NOT decode HTML entities.
 */
export function stripHtmlTags(value: string | null | undefined): string | null {
  if (!value) return null
  const stripped = value.replace(/<[^>]*>/g, "").trim()
  return stripped || null
}

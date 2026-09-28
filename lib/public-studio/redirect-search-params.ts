export type PublicRedirectSearchParams = Record<string, string | string[] | undefined>

export function serializePublicRedirectSearchParams(searchParams: PublicRedirectSearchParams): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
      continue
    }

    if (value !== undefined) query.set(key, value)
  }

  const serialized = query.toString()
  return serialized ? `?${serialized}` : ""
}

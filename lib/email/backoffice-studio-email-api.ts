export function studioEmailBasePath(masterId: string, teamId: string): string {
  return `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}/email`
}

type StudioEmailApiOutput<T> = {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

export async function parseStudioEmailOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as StudioEmailApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

export async function studioEmailFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  return parseStudioEmailOutput<T>(response)
}

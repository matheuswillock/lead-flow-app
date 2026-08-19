/** Postgres bind limit is 32_767; keep IN lists well under (other WHERE binds also count). */
export const PRISMA_IN_CHUNK_SIZE = 5_000

export async function findManyByInChunks<T>(
  values: readonly string[],
  query: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (values.length === 0) return []

  const results: T[] = []
  for (let index = 0; index < values.length; index += PRISMA_IN_CHUNK_SIZE) {
    const chunk = values.slice(index, index + PRISMA_IN_CHUNK_SIZE)
    const batch = await query(chunk)
    results.push(...batch)
  }
  return results
}

export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const results: R[] = new Array(items.length)
  const workerCount = Math.max(1, Math.min(limit, items.length))
  let cursor = 0

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker))

  return results
}

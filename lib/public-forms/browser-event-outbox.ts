export type PublicFormBrowserOutboxKind = "submission" | "answer" | "behavior"

export type PublicFormBrowserOutboxRecord = {
  eventId: string
  kind: PublicFormBrowserOutboxKind
  endpoint: string
  body: Record<string, unknown>
  attempts: number
  nextAttemptAt: number
  expiresAt: number
  createdAt: number
}

const DATABASE_NAME = "corretor-studio-public-form-outbox"
const STORE_NAME = "events"
const MAX_RECORDS = 1_000
const TTL_MS = 7 * 24 * 60 * 60 * 1_000

function getPriority(kind: PublicFormBrowserOutboxKind): number {
  return kind === "submission" ? 0 : kind === "answer" ? 1 : 2
}

/**
 * Registros a remover: expirados + excedente do limite. Acima do limite,
 * evict primeiro os comportamentais mais antigos; submissões/respostas ficam.
 */
export function selectEvictablePublicFormOutboxRecords(
  records: PublicFormBrowserOutboxRecord[],
  now: number,
  maxRecords: number = MAX_RECORDS,
): PublicFormBrowserOutboxRecord[] {
  return records
    .filter((record) => record.expiresAt <= now)
    .concat(
      records
        .filter((record) => record.expiresAt > now)
        .sort(
          (left, right) =>
            getPriority(left.kind) - getPriority(right.kind) || right.createdAt - left.createdAt,
        )
        .slice(maxRecords),
    )
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "eventId" })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  } finally {
    database.close()
  }
}

export async function enqueuePublicFormBrowserOutboxEvent(input: {
  eventId: string
  kind: PublicFormBrowserOutboxKind
  endpoint: string
  body: Record<string, unknown>
}): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const now = Date.now()
  await withStore("readwrite", async (store) => {
    await requestResult(
      store.put({
        ...input,
        attempts: 0,
        nextAttemptAt: now,
        expiresAt: now + TTL_MS,
        createdAt: now,
      } satisfies PublicFormBrowserOutboxRecord),
    )
    const records = (await requestResult(store.getAll())) as PublicFormBrowserOutboxRecord[]
    const removable = selectEvictablePublicFormOutboxRecords(records, now)
    await Promise.all(removable.map((record) => requestResult(store.delete(record.eventId))))
  })
}

export async function removePublicFormBrowserOutboxEvent(eventId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return
  await withStore("readwrite", (store) => requestResult(store.delete(eventId)))
}

export async function drainPublicFormBrowserOutbox(
  deliver: (record: PublicFormBrowserOutboxRecord) => Promise<Response>,
): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const now = Date.now()
  const records = await withStore("readonly", (store) =>
    requestResult(store.getAll()) as Promise<PublicFormBrowserOutboxRecord[]>,
  )
  await Promise.all(
    records.filter((record) => record.expiresAt <= now).map((record) => removePublicFormBrowserOutboxEvent(record.eventId)),
  )

  const due = records
    .filter((record) => record.expiresAt > now && record.nextAttemptAt <= now)
    .sort(
      (left, right) =>
        getPriority(left.kind) - getPriority(right.kind) || left.createdAt - right.createdAt,
    )
  for (const record of due) {
    try {
      const response = await deliver(record)
      if ([200, 201, 202].includes(response.status)) {
        await removePublicFormBrowserOutboxEvent(record.eventId)
      } else if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0")
        await reschedule(record, retryAfter > 0 ? retryAfter * 1_000 : undefined)
      } else {
        await removePublicFormBrowserOutboxEvent(record.eventId)
      }
    } catch {
      await reschedule(record)
    }
  }
}

async function reschedule(record: PublicFormBrowserOutboxRecord, delayMs?: number): Promise<void> {
  const attempts = record.attempts + 1
  const retryDelay = delayMs ?? Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6))
  await withStore("readwrite", (store) =>
    requestResult(store.put({ ...record, attempts, nextAttemptAt: Date.now() + retryDelay })),
  )
}

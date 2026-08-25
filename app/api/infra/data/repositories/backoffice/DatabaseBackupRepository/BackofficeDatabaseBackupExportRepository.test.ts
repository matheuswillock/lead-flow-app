import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { BackupModelChunk } from "./IBackofficeDatabaseBackupExportRepository"

type Row = Record<string, unknown>

const tables = new Map<string, Row[]>()
const transactionOptions: Array<Record<string, unknown>> = []

function createDelegate(delegateName: string) {
  return {
    findMany: async ({ take, skip }: { take: number; skip: number }) => {
      const rows = tables.get(delegateName) ?? []
      return rows.slice(skip, skip + take)
    },
  }
}

const fakeTransactionClient = new Proxy(
  {},
  {
    get: (_target, property: string) => createDelegate(property),
  }
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (
      callback: (tx: unknown) => Promise<unknown>,
      options: Record<string, unknown>
    ) => {
      transactionOptions.push(options)
      return callback(fakeTransactionClient)
    },
  },
}))

const { BackofficeDatabaseBackupExportRepository } = await import(
  "./BackofficeDatabaseBackupExportRepository"
)

function delegateNameOf(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

function parseNdjson(chunks: BackupModelChunk[], modelName: string): Row[] {
  return chunks
    .filter((chunk) => chunk.modelName === modelName)
    .flatMap((chunk) =>
      chunk.ndjson
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Row)
    )
}

async function collect(): Promise<BackupModelChunk[]> {
  const repository = new BackofficeDatabaseBackupExportRepository()
  const chunks: BackupModelChunk[] = []
  await repository.exportSnapshot(async (chunk) => {
    chunks.push(chunk)
  })
  return chunks
}

describe("BackofficeDatabaseBackupExportRepository", () => {
  const repository = new BackofficeDatabaseBackupExportRepository()
  const [firstModel, secondModel] = repository.listExportableModelNames()

  beforeEach(() => {
    tables.clear()
    transactionOptions.length = 0
  })

  it("emite uma linha NDJSON por registro, com bigint como string", async () => {
    tables.set(delegateNameOf(firstModel!), [
      { id: "a", total: BigInt("9007199254740993"), createdAt: new Date("2026-08-25T00:00:00.000Z") },
      { id: "b", total: BigInt(0), createdAt: new Date("2026-08-26T00:00:00.000Z") },
    ])

    const chunks = await collect()
    const rows = parseNdjson(chunks, firstModel!)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      id: "a",
      total: "9007199254740993",
      createdAt: "2026-08-25T00:00:00.000Z",
    })
    expect(rows[1]?.total).toBe("0")
  })

  it("pagina alem do tamanho de pagina sem perder nem duplicar registros", async () => {
    // Acima de PAGE_SIZE (10.000) para exercitar mais de uma pagina.
    const total = 10_001
    tables.set(
      delegateNameOf(firstModel!),
      Array.from({ length: total }, (_, index) => ({ id: `row-${index}` }))
    )

    const chunks = await collect()
    const rows = parseNdjson(chunks, firstModel!)

    expect(rows).toHaveLength(total)
    expect(new Set(rows.map((row) => row.id)).size).toBe(total)
    expect(rows[0]?.id).toBe("row-0")
    expect(rows[total - 1]?.id).toBe(`row-${total - 1}`)
  })

  it("abre uma transacao RepeatableRead por modelo, e nao uma para o banco inteiro", async () => {
    await collect()

    const modelCount = repository.listExportableModelNames().length
    expect(modelCount).toBeGreaterThan(1)
    expect(transactionOptions).toHaveLength(modelCount)
    for (const options of transactionOptions) {
      expect(options.isolationLevel).toBe("RepeatableRead")
    }
  })

  it("nao deixa nenhuma string crescer com o numero de registros", async () => {
    const row = { id: "x".repeat(36), payload: "y".repeat(400) }

    tables.set(delegateNameOf(firstModel!), Array.from({ length: 5_000 }, () => row))
    const small = await collect()

    tables.set(delegateNameOf(firstModel!), Array.from({ length: 50_000 }, () => row))
    const large = await collect()

    const maxChunk = (chunks: BackupModelChunk[]) =>
      Math.max(...chunks.map((chunk) => chunk.ndjson.length))

    // 10x mais registros nao pode significar chunk maior: o teto e por bytes.
    expect(maxChunk(large)).toBeLessThanOrEqual(maxChunk(small) * 1.1)
    // Teto absoluto: CHUNK_FLUSH_BYTES (256 KB) + um registro.
    expect(maxChunk(large)).toBeLessThan(256 * 1024 + 1024)
  })

  it(
    "exporta um volume que estoura o limite maximo de string do V8",
    async () => {
      // Reproduz a falha de producao de 22-24/08/2026. O export antigo montava
      // JSON.stringify(rows) com a tabela inteira; acima de V8_MAX_STRING_LENGTH
      // o V8 recusa a string com RangeError: Invalid string length.
      //
      // Atencao: este teste roda no Bun (JavaScriptCore, teto de 2^31-1 chars),
      // enquanto a producao roda no Node/V8 da Vercel (teto de 2^29-24 chars).
      // O runner NAO reproduz a excecao — medido: JSC aceita 2.147.483.647
      // chars, V8 lanca em 536.870.889. Por isso a assercao e sobre o volume
      // que atravessou o writer versus o teto do V8, e nao sobre o throw.
      const V8_MAX_STRING_LENGTH = 2 ** 29 - 24 // 536.870.888 chars

      const oneMegabyte = "x".repeat(1024 * 1024)
      const rows = Array.from({ length: 600 }, (_, index) => ({
        id: `row-${index}`,
        payload: oneMegabyte,
      }))

      tables.set(delegateNameOf(firstModel!), rows)

      let exportedBytes = 0
      let exportedRows = 0
      let maxChunkLength = 0

      const repositoryUnderTest = new BackofficeDatabaseBackupExportRepository()
      const summary = await repositoryUnderTest.exportSnapshot(async (chunk) => {
        exportedBytes += chunk.ndjson.length
        exportedRows += chunk.rowCount
        maxChunkLength = Math.max(maxChunkLength, chunk.ndjson.length)
      })

      expect(exportedRows).toBe(600)
      expect(summary.rowCount).toBe(600)
      // O total serializado ultrapassa o teto do V8: a abordagem antiga, que
      // montava esse total como uma unica string, nao teria como concluir.
      expect(exportedBytes).toBeGreaterThan(V8_MAX_STRING_LENGTH)
      // E ainda assim a maior string viva ficou tres ordens de grandeza abaixo.
      expect(maxChunkLength).toBeLessThan(V8_MAX_STRING_LENGTH / 100)
    },
    60_000
  )

  it("cria arquivo para modelo sem nenhuma linha via lista de modelos", async () => {
    tables.set(delegateNameOf(firstModel!), [{ id: "only" }])

    const chunks = await collect()

    expect(parseNdjson(chunks, secondModel!)).toHaveLength(0)
    // O modelo vazio nao emite chunk; a entrada no ZIP vem de
    // listExportableModelNames(), consumida pelo service.
    expect(repository.listExportableModelNames()).toContain(secondModel!)
  })
})

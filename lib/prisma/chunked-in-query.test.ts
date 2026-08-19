import { describe, expect, it } from "bun:test"
import { findManyByInChunks, PRISMA_IN_CHUNK_SIZE } from "./chunked-in-query"

describe("findManyByInChunks", () => {
  it("consulta em fatias de PRISMA_IN_CHUNK_SIZE", async () => {
    const values = Array.from({ length: PRISMA_IN_CHUNK_SIZE * 2 + 1 }, (_, index) => `id-${index}`)
    const chunkSizes: number[] = []

    const rows = await findManyByInChunks(values, async (chunk) => {
      chunkSizes.push(chunk.length)
      return chunk.map((id) => ({ id }))
    })

    expect(chunkSizes).toEqual([PRISMA_IN_CHUNK_SIZE, PRISMA_IN_CHUNK_SIZE, 1])
    expect(rows).toHaveLength(values.length)
  })

  it("retorna vazio sem consultar quando a lista é vazia", async () => {
    let queried = false
    const rows = await findManyByInChunks([], async () => {
      queried = true
      return []
    })
    expect(rows).toEqual([])
    expect(queried).toBe(false)
  })
})

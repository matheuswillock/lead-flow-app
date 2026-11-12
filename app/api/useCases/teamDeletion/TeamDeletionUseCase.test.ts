import { describe, expect, it, mock } from "bun:test"
import { TeamDeletionUseCase } from "./TeamDeletionUseCase"
import type { TeamDeletionJobRecord } from "@/app/api/shared/teamDeletion/teamDeletionTypes"

const NOW = new Date("2026-11-09T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

const request = {
  teamId: "team-1",
  teamName: "Time Saúde",
  requesterProfileId: "req-1",
  requesterEmail: "req@x.com",
  requesterName: "Requerente",
  billingOwnerId: "master-1",
}

function job(overrides: Partial<TeamDeletionJobRecord> = {}): TeamDeletionJobRecord {
  return {
    id: "job-1",
    ...request,
    status: "processing",
    attempts: 1,
    filePath: null,
    expiresAt: null,
    counts: null,
    ...overrides,
  }
}

function build(order: string[] = []) {
  const store = {
    create: mock(async (_input: Record<string, unknown>) => job({ status: "pending", attempts: 0 })),
    reclaimStale: mock(async (_olderThan: Date) => 0),
    claimNext: mock(async (): Promise<TeamDeletionJobRecord | null> => null),
    markReady: mock(async (_id: string, _input: unknown) => {
      order.push("markReady")
    }),
    markFailed: mock(async (_id: string, _message: string) => {
      order.push("markFailed")
    }),
    requeue: mock(async (_id: string, _message: string) => {
      order.push("requeue")
    }),
    findById: mock(async (_id: string): Promise<TeamDeletionJobRecord | null> => null),
    registerDownload: mock(async (_id: string, _profileId: string, _at: Date) => {}),
    listExpired: mock(async (_now: Date): Promise<TeamDeletionJobRecord[]> => []),
    markPurged: mock(async (_id: string, _at: Date) => {}),
  }
  const storage = {
    upload: mock(async (_path: string, _bytes: Uint8Array) => {
      order.push("upload")
    }),
    createSignedUrl: mock(async (_path: string, _seconds: number, _name: string) => "https://signed.test/zip"),
    remove: mock(async (_path: string) => {
      order.push("remove")
    }),
  }
  const exporter = {
    buildZip: mock(async (_input: unknown) => {
      order.push("buildZip")
      return { zip: new Uint8Array([1, 2, 3]), counts: { "leads.csv": 10 } }
    }),
  }
  const deleter = {
    deleteNow: mock(async (_input: unknown) => {
      order.push("deleteNow")
      return { leads: 10, members: 3 }
    }),
  }
  const notifier = {
    notifyReady: mock(async (_job: TeamDeletionJobRecord, _input: { expiresAt: Date }) => {
      order.push("notifyReady")
    }),
    notifyFailed: mock(async (_job: TeamDeletionJobRecord, _reason: string) => {
      order.push("notifyFailed")
    }),
  }
  const details = {
    findDetails: mock(async (_profileId: string, _teamId: string) => ({ requesterName: "Requerente", teamName: "Time Saúde" })),
    findProfileIdBySupabaseId: mock(async (_supabaseId: string): Promise<string | null> => "req-1"),
  }
  const useCase = new TeamDeletionUseCase(store, storage, exporter, deleter, notifier, details, () => NOW)
  return { useCase, store, storage, exporter, deleter, notifier, details }
}

describe("TeamDeletionUseCase.requestDeletion", () => {
  it("sem exportação: exclui o time na hora e não cria pedido", async () => {
    const { useCase, store, deleter } = build()

    const output = await useCase.requestDeletion({ ...request, exportData: false })

    expect(output.isValid).toBe(true)
    expect(deleter.deleteNow).toHaveBeenCalledWith({ teamId: "team-1", actorProfileId: "req-1", billingOwnerId: "master-1" })
    expect(store.create).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ mode: "deleted" })
  })

  it("com exportação: cria o pedido e NÃO exclui o time agora", async () => {
    const { useCase, store, deleter } = build()

    const output = await useCase.requestDeletion({ ...request, exportData: true })

    expect(output.isValid).toBe(true)
    expect(store.create).toHaveBeenCalledTimes(1)
    expect(store.create.mock.calls[0][0]).toMatchObject({ teamName: "Time Saúde", requesterName: "Requerente" })
    expect(deleter.deleteNow).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ mode: "export_queued", jobId: "job-1" })
  })

  it("sem exportação, se a exclusão falhar devolve erro", async () => {
    const { useCase, deleter } = build()
    deleter.deleteNow.mockRejectedValue(new Error("falhou"))

    const output = await useCase.requestDeletion({ ...request, exportData: false })

    expect(output.isValid).toBe(false)
  })
})

describe("TeamDeletionUseCase.processJob — com exportação", () => {
  it("gera o arquivo, guarda, SÓ DEPOIS exclui o time e avisa que está pronto (validade de 7 dias)", async () => {
    const order: string[] = []
    const { useCase, store, notifier } = build(order)

    await useCase.processJob(job())

    expect(order).toEqual(["buildZip", "upload", "deleteNow", "markReady", "notifyReady"])
    const readyInput = store.markReady.mock.calls[0][1] as { expiresAt: Date; filePath: string }
    expect(readyInput.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY)
    expect(readyInput.filePath).toContain("job-1")
    expect(notifier.notifyReady).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }), {
      expiresAt: readyInput.expiresAt,
    })
  })

  it("se gerar o arquivo falhar, NÃO exclui o time e tenta de novo depois", async () => {
    const order: string[] = []
    const { useCase, exporter, deleter } = build(order)
    exporter.buildZip.mockRejectedValue(new Error("sem memória"))

    await useCase.processJob(job({ attempts: 1 }))

    expect(deleter.deleteNow).not.toHaveBeenCalled()
    expect(order).toEqual(["requeue"])
  })

  it("na terceira falha desiste: marca como falho e avisa; o time continua existindo", async () => {
    const order: string[] = []
    const { useCase, exporter, deleter, notifier } = build(order)
    exporter.buildZip.mockRejectedValue(new Error("sem memória"))

    await useCase.processJob(job({ attempts: 3 }))

    expect(deleter.deleteNow).not.toHaveBeenCalled()
    expect(order).toEqual(["markFailed", "notifyFailed"])
    expect(notifier.notifyFailed).toHaveBeenCalledTimes(1)
  })

  it("se guardar o arquivo falhar, não exclui o time", async () => {
    const order: string[] = []
    const { useCase, storage, deleter } = build(order)
    storage.upload.mockRejectedValue(new Error("storage fora"))

    await useCase.processJob(job({ attempts: 1 }))

    expect(deleter.deleteNow).not.toHaveBeenCalled()
    expect(order).toEqual(["buildZip", "requeue"])
  })

  it("se a exclusão falhar depois do arquivo pronto, marca como falho, avisa e apaga o arquivo", async () => {
    const order: string[] = []
    const { useCase, deleter, notifier } = build(order)
    deleter.deleteNow.mockRejectedValue(new Error("fk"))

    await useCase.processJob(job({ attempts: 1 }))

    expect(order).toEqual(["buildZip", "upload", "remove", "markFailed", "notifyFailed"])
    expect(notifier.notifyReady).not.toHaveBeenCalled()
  })

  it("se o aviso de pronto falhar, o pedido continua pronto (o time já foi excluído)", async () => {
    const order: string[] = []
    const { useCase, notifier } = build(order)
    notifier.notifyReady.mockRejectedValue(new Error("e-mail fora"))

    await useCase.processJob(job())

    expect(order).toEqual(["buildZip", "upload", "deleteNow", "markReady"])
    expect(notifier.notifyReady).toHaveBeenCalledTimes(1)
  })
})

describe("TeamDeletionUseCase.processPending", () => {
  it("devolve à fila os pedidos presos e processa os pendentes, no máximo 2 por execução", async () => {
    const order: string[] = []
    const { useCase, store } = build(order)
    store.claimNext
      .mockResolvedValueOnce(job({ id: "a" }))
      .mockResolvedValueOnce(job({ id: "b" }))
      .mockResolvedValueOnce(job({ id: "c" }))

    const result = await useCase.processPending()

    expect(store.reclaimStale).toHaveBeenCalledWith(new Date(NOW.getTime() - 15 * 60 * 1000))
    expect(result.processed).toBe(2)
    expect(store.claimNext).toHaveBeenCalledTimes(2)
  })
})

describe("TeamDeletionUseCase.createDownloadUrl", () => {
  const ready = job({
    status: "ready",
    filePath: "exports/job-1.zip",
    expiresAt: new Date(NOW.getTime() + DAY),
  })

  it("só quem pediu a exportação baixa", async () => {
    const { useCase, store } = build()
    store.findById.mockResolvedValue(ready)

    const output = await useCase.createDownloadUrl({ jobId: "job-1", requesterProfileId: "outra-pessoa" })

    expect(output.isValid).toBe(false)
    expect(store.registerDownload).not.toHaveBeenCalled()
  })

  it("link vencido não baixa", async () => {
    const { useCase, store } = build()
    store.findById.mockResolvedValue({ ...ready, expiresAt: new Date(NOW.getTime() - 1000) })

    const output = await useCase.createDownloadUrl({ jobId: "job-1", requesterProfileId: "req-1" })

    expect(output.isValid).toBe(false)
  })

  it("arquivo que ainda não está pronto não baixa", async () => {
    const { useCase, store } = build()
    store.findById.mockResolvedValue({ ...ready, status: "processing" })

    const output = await useCase.createDownloadUrl({ jobId: "job-1", requesterProfileId: "req-1" })

    expect(output.isValid).toBe(false)
  })

  it("devolve um código para cada motivo de recusa (rota responde 404, 409 ou 410)", async () => {
    const { useCase, store } = build()

    store.findById.mockResolvedValue(null)
    expect((await useCase.createDownloadUrl({ jobId: "x", requesterProfileId: "req-1" })).result).toMatchObject({ code: "not_found" })

    store.findById.mockResolvedValue({ ...ready, status: "processing" })
    expect((await useCase.createDownloadUrl({ jobId: "x", requesterProfileId: "req-1" })).result).toMatchObject({ code: "not_ready" })

    store.findById.mockResolvedValue({ ...ready, expiresAt: new Date(NOW.getTime() - 1000) })
    expect((await useCase.createDownloadUrl({ jobId: "x", requesterProfileId: "req-1" })).result).toMatchObject({ code: "expired" })

    store.findById.mockResolvedValue({ ...ready, status: "purged", filePath: null })
    expect((await useCase.createDownloadUrl({ jobId: "x", requesterProfileId: "req-1" })).result).toMatchObject({ code: "expired" })
  })

  it("pela pessoa logada: resolve o perfil pela conta de login e só então confere o dono", async () => {
    const { useCase, store, details } = build()
    store.findById.mockResolvedValue(ready)

    const ok = await useCase.createDownloadUrlForUser({ jobId: "job-1", supabaseId: "auth-req" })
    expect(details.findProfileIdBySupabaseId).toHaveBeenCalledWith("auth-req")
    expect(ok.isValid).toBe(true)

    details.findProfileIdBySupabaseId.mockResolvedValue("outra-pessoa")
    const denied = await useCase.createDownloadUrlForUser({ jobId: "job-1", supabaseId: "auth-outra" })
    expect(denied.isValid).toBe(false)

    details.findProfileIdBySupabaseId.mockResolvedValue(null)
    const unknown = await useCase.createDownloadUrlForUser({ jobId: "job-1", supabaseId: "auth-x" })
    expect(unknown.isValid).toBe(false)
  })

  it("quem pediu, dentro do prazo: devolve link curto e registra quem baixou e quando", async () => {
    const { useCase, store, storage } = build()
    store.findById.mockResolvedValue(ready)

    const output = await useCase.createDownloadUrl({ jobId: "job-1", requesterProfileId: "req-1" })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ url: "https://signed.test/zip" })
    expect(storage.createSignedUrl).toHaveBeenCalledWith("exports/job-1.zip", 300, expect.stringContaining(".zip"))
    expect(store.registerDownload).toHaveBeenCalledWith("job-1", "req-1", NOW)
  })
})

describe("TeamDeletionUseCase.purgeExpired", () => {
  it("apaga o arquivo dos pedidos vencidos e marca como apagados", async () => {
    const { useCase, store, storage } = build()
    store.listExpired.mockResolvedValue([
      job({ id: "x", status: "ready", filePath: "exports/x.zip" }),
      job({ id: "y", status: "ready", filePath: "exports/y.zip" }),
    ])

    const result = await useCase.purgeExpired()

    expect(storage.remove).toHaveBeenCalledWith("exports/x.zip")
    expect(storage.remove).toHaveBeenCalledWith("exports/y.zip")
    expect(store.markPurged).toHaveBeenCalledTimes(2)
    expect(result.purged).toBe(2)
  })

  it("se apagar um arquivo falhar, não marca como apagado (tenta de novo na próxima)", async () => {
    const { useCase, store, storage } = build()
    store.listExpired.mockResolvedValue([job({ id: "x", status: "ready", filePath: "exports/x.zip" })])
    storage.remove.mockRejectedValue(new Error("storage fora"))

    const result = await useCase.purgeExpired()

    expect(store.markPurged).not.toHaveBeenCalled()
    expect(result.purged).toBe(0)
  })
})

import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { deleteOrphanWhatsAppUploads } from "@/app/api/services/whatsapp/WhatsAppMediaStorage"

class CleanupOrphanWhatsAppMediaUseCase {
  async execute(): Promise<Output> {
    const result = await deleteOrphanWhatsAppUploads({
      olderThanHours: 24,
      limit: 100,
      isLinked: async (storagePath) => {
        const id = await whatsAppRepository.findMessageIdByStoragePath(storagePath)
        return id !== null
      },
    })
    console.info("[CleanupOrphanWhatsAppMediaUseCase]", {
      scanned: result.scanned,
      deleted: result.deleted,
    })
    return new Output(true, ["Limpeza de mídia órfã concluída"], [], result)
  }
}

export const cleanupOrphanWhatsAppMediaUseCase = new CleanupOrphanWhatsAppMediaUseCase()

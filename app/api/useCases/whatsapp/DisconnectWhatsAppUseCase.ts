import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface DisconnectInput {
  teamId: string
  profileId: string
}

function sanitizeDisconnectError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Erro ao desconectar WhatsApp"

  if (raw.includes("não encontrad")) {
    return "Configuração do WhatsApp não encontrada"
  }

  if (
    raw.includes("not connected") ||
    raw.includes("is not connected") ||
    raw.includes("already disconnected")
  ) {
    return "WhatsApp já está desconectado"
  }

  if (raw.includes("QR code not available")) {
    return "WhatsApp desconectado, mas o QR Code ainda não está disponível. Tente reconectar em alguns segundos."
  }

  if (raw.startsWith("[EvoApiService]") || raw.startsWith("[WhatsAppService]")) {
    return "Não foi possível desconectar o WhatsApp. Tente novamente em instantes."
  }

  return raw
}

class DisconnectWhatsAppUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: DisconnectInput): Promise<Output> {
    try {
      const result = await this.service.disconnect(input.teamId, input.profileId)
      const successMessage =
        result.status === "QR_READY"
          ? "WhatsApp desconectado. Escaneie o novo QR Code para reconectar."
          : "WhatsApp desconectado com sucesso"
      return new Output(true, [successMessage], [], result)
    } catch (error) {
      console.error("[DisconnectWhatsAppUseCase][execute]", error)
      return new Output(false, [], [sanitizeDisconnectError(error)], null)
    }
  }
}

export const disconnectWhatsAppUseCase = new DisconnectWhatsAppUseCase(whatsAppService)

import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { normalizePhone } from "@/lib/whatsapp/normalize-phone"

export async function assertPhoneNumberCanConnect(params: {
  teamId: string
  normalizedPhone: string
  configId: string
}): Promise<void> {
  const team = await whatsAppRepository.findTeamMasterContext(params.teamId)
  if (!team) {
    throw new Error("Time não encontrado")
  }

  const existingConfig = await whatsAppRepository.findConnectedConfigByNormalizedPhone(
    params.normalizedPhone,
    params.configId
  )

  if (!existingConfig) return

  if (existingConfig.masterId !== team.masterId) {
    throw new Error("Este número já está conectado em outra conta")
  }
}

export async function assertNoConflictingPhoneOnSameTeam(params: {
  teamId: string
  configId: string
  nextNormalizedPhone: string
}): Promise<void> {
  const current = await whatsAppRepository.findConfigById(params.configId)
  if (!current || current.teamId !== params.teamId) return

  if (
    current.status === "CONNECTED" &&
    current.normalizedPhone &&
    current.normalizedPhone !== params.nextNormalizedPhone
  ) {
    throw new Error("Este time já possui outro número conectado. Desconecte antes de vincular um novo.")
  }
}

export function toStoredNormalizedPhone(phoneNumber: string): string {
  return normalizePhone(phoneNumber)
}

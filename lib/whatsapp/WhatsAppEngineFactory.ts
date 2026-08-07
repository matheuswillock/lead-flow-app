import { prisma } from "@/app/api/infra/data/prisma"
import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"

/**
 * Resolve o IWhatsAppProvider do time a partir de TeamWhatsAppConfig.engine.
 * META fica reservado à Spec 03.
 */
export const WhatsAppEngineFactory = {
  async forTeam(teamId: string): Promise<IWhatsAppProvider> {
    const config = await prisma.teamWhatsAppConfig.findUnique({
      where: { teamId },
      select: { engine: true },
    })

    if (config?.engine === "META") {
      throw new Error(
        "[WhatsAppEngineFactory] engine META ainda não implementado (Spec 03)"
      )
    }

    const { openWaWhatsAppProvider } = await import(
      "@/app/api/services/whatsapp/provider/OpenWaWhatsAppProvider"
    )
    return openWaWhatsAppProvider
  },
}

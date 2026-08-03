import { Output } from "@/lib/output"
import { radarPixelService } from "@/app/api/services/radar/RadarPixelService"
import type { SaveRadarPixelConfigPayload } from "@/app/api/services/radar/IRadarPixelService"

class RadarPixelUseCase {
  async getConfig(teamId: string, appUrl: string): Promise<Output> {
    try {
      const result = await radarPixelService.getConfig(teamId, appUrl)
      return new Output(true, ["Configuração do pixel carregada"], [], result)
    } catch (error) {
      console.error("[RadarPixelUseCase][getConfig]", error)
      return new Output(false, [], ["Erro ao carregar configuração do pixel"], null)
    }
  }

  async saveConfig(
    teamId: string,
    profileId: string,
    payload: SaveRadarPixelConfigPayload,
    appUrl: string,
  ): Promise<Output> {
    try {
      const result = await radarPixelService.saveConfig(teamId, profileId, payload, appUrl)
      return new Output(true, ["Configuração do pixel salva com sucesso"], [], result)
    } catch (error) {
      console.error("[RadarPixelUseCase][saveConfig]", error)
      return new Output(false, [], ["Erro ao salvar configuração do pixel"], null)
    }
  }

  async deleteConfig(teamId: string): Promise<Output> {
    try {
      await radarPixelService.deleteConfig(teamId)
      return new Output(true, ["Pixel removido com sucesso"], [], null)
    } catch (error) {
      console.error("[RadarPixelUseCase][deleteConfig]", error)
      return new Output(false, [], ["Erro ao remover pixel"], null)
    }
  }

  async getHitLogs(teamId: string): Promise<Output> {
    try {
      const result = await radarPixelService.getHitLogs(teamId)
      return new Output(true, ["Logs carregados"], [], result)
    } catch (error) {
      console.error("[RadarPixelUseCase][getHitLogs]", error)
      return new Output(false, [], ["Erro ao carregar logs do pixel"], null)
    }
  }
}

export const radarPixelUseCase = new RadarPixelUseCase()

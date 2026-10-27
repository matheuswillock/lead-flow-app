export type RadarPixelConfigResult = {
  configured: boolean
  publicToken: string | null
  allowedOrigins: string[]
  /**
   * `true` quando `allowedOrigins` tem pelo menos uma origem. Sinaliza a
   * tela sem alterar o aceite de `isOriginAllowed` (`RadarPixelHitUseCase`),
   * que continua aceitando qualquer origem quando a allowlist está vazia
   * (W27, SPEC 30, DA1 — sinalizar, não bloquear).
   */
  originRestrictionActive: boolean
  lastUsedAt: string | null
  pixelSnippet: string | null
}

export type SaveRadarPixelConfigPayload = {
  allowedOrigins: string[]
}

export type RadarPixelHitLogItem = {
  id: string
  teamId: string
  eventType: string
  visitorSession: string
  origin: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: string
}

export type GetRadarPixelHitLogsResult = {
  logs: RadarPixelHitLogItem[]
}

export interface IRadarPixelService {
  getConfig(teamId: string, appUrl: string): Promise<RadarPixelConfigResult>
  saveConfig(teamId: string, profileId: string, payload: SaveRadarPixelConfigPayload, appUrl: string): Promise<RadarPixelConfigResult>
  deleteConfig(teamId: string): Promise<void>
  getHitLogs(teamId: string): Promise<GetRadarPixelHitLogsResult>
}

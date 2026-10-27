import { randomBytes } from "node:crypto"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import type {
  GetRadarPixelHitLogsResult,
  IRadarPixelService,
  RadarPixelConfigResult,
  SaveRadarPixelConfigPayload,
} from "./IRadarPixelService"

const PIXEL_HIT_LOGS_LIMIT = 15

type PixelConfigRecord = {
  publicToken: string
  allowedOrigins: string[]
  lastUsedAt: Date | null
}

/**
 * Único ponto que decide `originRestrictionActive` (W27, SPEC 30, DA1).
 * `getConfig` e `saveConfig` chamam este mapper em vez de repetir a
 * expressão — evita que uma delas fique defasada numa mudança futura.
 */
function toConfigResult(config: PixelConfigRecord, appUrl: string): RadarPixelConfigResult {
  return {
    configured: true,
    publicToken: config.publicToken,
    allowedOrigins: config.allowedOrigins,
    originRestrictionActive: config.allowedOrigins.length > 0,
    lastUsedAt: config.lastUsedAt?.toISOString() ?? null,
    pixelSnippet: buildPixelSnippet(appUrl, config.publicToken),
  }
}

function buildPixelSnippet(appUrl: string, publicToken: string): string {
  const hitUrl = `${appUrl}/api/v1/public-pixel/${publicToken}/hit`
  return `<script>
(function(){
  try{
    var k='_cs_vs',vs=localStorage.getItem(k);
    if(!vs){vs=crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);localStorage.setItem(k,vs);}
    fetch('${hitUrl}?vs='+encodeURIComponent(vs),{method:'POST',mode:'no-cors',keepalive:true});
  }catch(e){}
})();
</script>`
}

class RadarPixelService implements IRadarPixelService {
  async getConfig(teamId: string, appUrl: string): Promise<RadarPixelConfigResult> {
    const config = await radarRepository.findPixelConfigByTeamId(teamId)

    if (!config) {
      return {
        configured: false,
        publicToken: null,
        allowedOrigins: [],
        originRestrictionActive: false,
        lastUsedAt: null,
        pixelSnippet: null,
      }
    }

    return toConfigResult(config, appUrl)
  }

  async saveConfig(
    teamId: string,
    profileId: string,
    payload: SaveRadarPixelConfigPayload,
    appUrl: string,
  ): Promise<RadarPixelConfigResult> {
    const publicToken = randomBytes(24).toString("hex")

    const config = await radarRepository.upsertPixelConfig(teamId, profileId, {
      publicToken,
      allowedOrigins: payload.allowedOrigins,
    })

    return toConfigResult(config, appUrl)
  }

  async deleteConfig(teamId: string): Promise<void> {
    await radarRepository.deletePixelConfig(teamId)
  }

  async getHitLogs(teamId: string): Promise<GetRadarPixelHitLogsResult> {
    const logs = await radarRepository.findPixelHitLogs(teamId, PIXEL_HIT_LOGS_LIMIT)

    return {
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    }
  }
}

export const radarPixelService = new RadarPixelService()

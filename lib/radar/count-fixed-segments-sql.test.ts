import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const REPO_ROOT = path.join(import.meta.dir, "../..")
const RADAR_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "app/api/infra/data/repositories/radar/RadarRepository.ts"
)

const FORBIDDEN_MODEL_TABLES = [
  '"RadarProfile"',
  '"RadarConsent"',
  '"RadarSourceLink"',
  '"RadarIdentity"',
  '"RadarEvent"',
  '"Lead"',
]

describe("countFixedSegmentsSQL", () => {
  it("usa nomes físicos de tabela (@@map) e não nomes de model Prisma", () => {
    const source = readFileSync(RADAR_REPOSITORY_PATH, "utf8")
    const start = source.indexOf("async countFixedSegmentsSQL")
    const end = source.indexOf("export const radarRepository", start)
    const fnSource = source.slice(start, end)

    for (const forbidden of FORBIDDEN_MODEL_TABLES) {
      expect(fnSource.includes(forbidden)).toBe(false)
    }

    expect(fnSource).toContain('"corretor_studio_radar_profiles"')
    expect(fnSource).toContain('"corretor_studio_radar_channel_consents"')
    expect(fnSource).toContain('"corretor_studio_leads"')
  })

  it("usa o valor físico de LeadStatus (contract_finalized), não literais inválidos", () => {
    const source = readFileSync(RADAR_REPOSITORY_PATH, "utf8")
    const start = source.indexOf("async countFixedSegmentsSQL")
    const end = source.indexOf("export const radarRepository", start)
    const fnSource = source.slice(start, end)

    expect(fnSource).toContain("'contract_finalized'")
    expect(fnSource.includes("'WON'")).toBe(false)
    expect(fnSource.includes("'PAID'")).toBe(false)
  })
})

import { describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { calculateChecksum, readDryRunReport } from "./transfer-bruno-teams"

const checksumPayload = {
  migrationId: "test-migration",
  actorProfileId: "actor",
  source: { profileId: "bruno", email: "bruno@example.com" },
  sourceActiveTeamBefore: null,
  sourceActiveTeamAfter: null,
  plan: { transfers: [], blocked: [], profileUpdates: [] },
  remoteProvisioning: [],
  sourceDefaultRepair: null,
  before: { teams: [], profiles: [], memberships: [] },
  after: { teams: [], profiles: [], memberships: [] },
}

describe("transfer-bruno-teams dry-run report", () => {
  it("accepts the outcome metadata added to a generated dry-run", () => {
    const directory = mkdtempSync(join(tmpdir(), "transfer-bruno-teams-"))
    const reportPath = join(directory, "dry-run.json")
    const checksum = calculateChecksum(checksumPayload)

    try {
      writeFileSync(reportPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        apply: false,
        outcome: "planned",
        ...checksumPayload,
        checksum,
      }))

      expect(readDryRunReport(reportPath, checksum)).toMatchObject({
        outcome: "planned",
        checksum,
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

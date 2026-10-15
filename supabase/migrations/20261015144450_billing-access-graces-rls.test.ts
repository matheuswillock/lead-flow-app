import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const correctiveMigration = readFileSync(
  resolve(import.meta.dir, "20261015144450_billing-access-graces-rls.sql"),
  "utf8",
)
const creationMigration = readFileSync(
  resolve(import.meta.dir, "20261015125109_billing-access-graces.sql"),
  "utf8",
)

describe("billing access graces RLS migration", () => {
  it("restricts the grants table to service_role", () => {
    for (const migration of [creationMigration, correctiveMigration]) {
      expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
      expect(migration).toContain('REVOKE ALL ON TABLE "public"."billing_access_graces" FROM PUBLIC, anon, authenticated')
      expect(migration).toContain('GRANT ALL ON TABLE "public"."billing_access_graces" TO service_role')
      expect(migration).toContain('FOR ALL')
      expect(migration).toContain('TO service_role')
    }
  })
})

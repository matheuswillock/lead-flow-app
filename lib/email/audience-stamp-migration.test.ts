import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "bun:test"
import {
  audienceStampSqlDomainLiterals,
  AUDIENCE_DEAD_ISP_DOMAINS,
} from "./audience-prevalidation"

function readStampMigrationSql(): string {
  const dir = join(import.meta.dir, "../../supabase/migrations")
  const file = readdirSync(dir).find((name) =>
    name.endsWith("_stamp-invalid-and-bounced-audience.sql")
  )
  if (!file) {
    throw new Error("Migration stamp-invalid-and-bounced-audience não encontrada")
  }
  return readFileSync(join(dir, file), "utf8")
}

describe("stamp-invalid-and-bounced-audience.sql", () => {
  it("lista os mesmos domínios do motor e exclui caixa cheia / Terra / UOL", () => {
    const sql = readStampMigrationSql()

    expect(sql).toContain("inbox was full")
    expect(sql).toContain("MailboxFull")
    expect(sql).toContain(`"isBounced" = false`)
    expect(sql).toContain("corretor_studio_email_contacts")
    expect(sql).toContain("corretor_studio_radar_channel_consents")
    expect(sql).toContain("'bounce'::\"radar_consent_reason\"")
    expect(sql).toContain("'blocked'::\"radar_consent_status\"")

    for (const domain of audienceStampSqlDomainLiterals()) {
      expect(sql).toContain(`'${domain}'`)
    }

    expect(AUDIENCE_DEAD_ISP_DOMAINS).not.toContain("terra.com.br")
    expect(AUDIENCE_DEAD_ISP_DOMAINS).not.toContain("uol.com.br")
    expect(sql).not.toContain("'terra.com.br'")
    expect(sql).not.toContain("'uol.com.br'")
    expect(sql).not.toContain("'hotmail.com.br'")
    expect(sql).not.toContain("'outlook.com.br'")
  })
})

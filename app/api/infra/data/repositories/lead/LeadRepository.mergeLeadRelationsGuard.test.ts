import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  MERGE_LEAD_RELATIONS_DELIBERATELY_EXCLUDED,
  MERGE_TRANSFERRED_LEAD_RELATIONS,
} from "./LeadRepository"

/**
 * Guard estrutural do bug "mesclar lead perde vínculos e dados do lead de
 * origem" (2026-09-02): enumera, a partir do DMMF do Prisma — não de uma
 * lista escrita à mão que pode ficar desatualizada — todo model com FK
 * declarada para `Lead`, e falha se `mergeLeadsInTransaction` não tiver essa
 * relação em `MERGE_TRANSFERRED_LEAD_RELATIONS` (ou na allowlist explícita
 * de exclusão deliberada). Quando alguém criar a próxima FK para `Lead`, o
 * schema muda, o DMMF muda, e este teste aponta o merge sem precisar de
 * outra investigação de produção.
 */
function modelsWithForeignKeyToLead(): string[] {
  const models = Prisma.dmmf.datamodel.models
  const found = new Set<string>()

  for (const model of models) {
    for (const field of model.fields) {
      if (field.kind === "object" && field.type === "Lead" && field.relationFromFields?.length) {
        found.add(model.name)
      }
    }
  }

  return [...found]
}

describe("LeadRepository — guard estrutural do merge de leads", () => {
  it("toda FK para Lead no schema está coberta pelo merge ou pela allowlist de exclusão", () => {
    const structural = modelsWithForeignKeyToLead()
    const handled = new Set<string>(MERGE_TRANSFERRED_LEAD_RELATIONS)
    const excluded = new Set<string>(MERGE_LEAD_RELATIONS_DELIBERATELY_EXCLUDED)

    const missing = structural.filter((model) => !handled.has(model) && !excluded.has(model))

    expect(missing).toEqual([])
  })

  it("a lista tratada não inclui model fora do schema (evita falso-positivo por digitação)", () => {
    const structural = new Set(modelsWithForeignKeyToLead())

    const bogus = MERGE_TRANSFERRED_LEAD_RELATIONS.filter((model) => !structural.has(model))

    expect(bogus).toEqual([])
  })
})

import { describe, expect, it } from "bun:test"
import {
  buildRadarSegmentProfileWhere,
  translateProfileField,
} from "./RadarSegmentQueryService"

describe("translateProfileField (F3 gender)", () => {
  it("gender eq female usa coluna física gender", () => {
    expect(
      translateProfileField({
        kind: "profile_field",
        field: "gender",
        operator: "eq",
        value: "female",
      })
    ).toEqual({ gender: "female" })
  })

  it("gender eq male não consulta profileData JSON", () => {
    const where = translateProfileField({
      kind: "profile_field",
      field: "gender",
      operator: "eq",
      value: "male",
    })
    expect(where).toEqual({ gender: "male" })
    expect(where).not.toHaveProperty("profileData")
  })

  it("gender is_empty filtra apenas gender null (exclui unknown por eq específico)", () => {
    expect(
      translateProfileField({
        kind: "profile_field",
        field: "gender",
        operator: "is_empty",
      })
    ).toEqual({ gender: null })
  })
})

describe("buildRadarSegmentProfileWhere (F3 multi-tenant)", () => {
  it("aplica teamId no where raiz para isolar perfis do time", async () => {
    const teamId = "11111111-1111-4111-8111-111111111111"
    const where = await buildRadarSegmentProfileWhere(teamId, {
      match: "all",
      conditions: [{ kind: "profile_field", field: "gender", operator: "eq", value: "female" }],
    })

    expect(where.teamId).toBe(teamId)
    expect(where.AND).toEqual([{ gender: "female" }])
  })
})

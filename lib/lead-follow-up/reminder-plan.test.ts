import { describe, expect, it } from "bun:test"
import { availableOffsets, followUpCopy, planReminders } from "./reminder-plan"

const NOW = new Date("2026-11-10T12:00:00.000Z")

describe("planReminders", () => {
  it("calcula 2 dias, 1 dia e 1 hora antes, em ordem", () => {
    const reminders = planReminders({
      anchorAt: new Date("2026-11-13T17:30:00.000Z"),
      offsetKeys: ["1h", "2d", "1d"],
      now: NOW,
    })
    expect(reminders.map((r) => [r.offsetKey, r.dueAt.toISOString()])).toEqual([
      ["2d", "2026-11-11T17:30:00.000Z"],
      ["1d", "2026-11-12T17:30:00.000Z"],
      ["1h", "2026-11-13T16:30:00.000Z"],
    ])
  })

  it("descarta lembretes que já passaram", () => {
    const reminders = planReminders({ anchorAt: new Date("2026-11-11T08:00:00.000Z"), offsetKeys: ["2d", "1d", "1h"], now: NOW })
    expect(reminders.map((r) => r.offsetKey)).toEqual(["1h"])
  })

  it("com tolerância, mantém o aviso que venceu há pouco", () => {
    const reminders = planReminders({
      anchorAt: new Date("2026-12-09T20:00:00.000Z"),
      offsetKeys: ["90d", "60d", "30d"],
      now: NOW,
      graceMs: 24 * 60 * 60 * 1000,
    })
    expect(reminders.map((r) => r.offsetKey)).toEqual(["30d"])
  })
})

describe("availableOffsets", () => {
  it("só oferece opções que ainda caem no futuro", () => {
    expect(availableOffsets(new Date("2026-11-11T10:00:00.000Z"), ["2d", "1d", "1h"], NOW)).toEqual(["1h"])
  })
})

describe("followUpCopy", () => {
  it("vigência orienta a reestruturar o plano", () => {
    const copy = followUpCopy("plan_renewal", "60d", { leadName: "Maria", eventLabel: "em 09/01/2027" })
    expect(copy.taskTitle).toBe("Reestruturar o plano de Maria")
    expect(copy.notification).toContain("60 dias antes")
  })
})

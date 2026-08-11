import { describe, expect, it } from "bun:test"
import * as route from "@/app/api/v1/radar/cron/engagement-backfill/route"

describe("RadarCronEngagementBackfillRoute", () => {
  it("expõe GET e POST para o mesmo handler de cron", () => {
    expect(typeof route.GET).toBe("function")
    expect(typeof route.POST).toBe("function")
  })
})

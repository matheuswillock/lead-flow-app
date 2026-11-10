import { describe, expect, it } from "bun:test"
import { getStaffBadgeLabels } from "./staff-badge"

describe("getStaffBadgeLabels", () => {
  it("mostra o selo de cada função na ordem SDR, Closer", () => {
    expect(getStaffBadgeLabels(["CLOSER", "SDR"])).toEqual(["SDR Backoffice", "Closer Backoffice"])
    expect(getStaffBadgeLabels(["SDR"])).toEqual(["SDR Backoffice"])
    expect(getStaffBadgeLabels(["CLOSER"])).toEqual(["Closer Backoffice"])
  })

  it("sem função, cai no selo genérico", () => {
    expect(getStaffBadgeLabels([])).toEqual(["Backoffice"])
    expect(getStaffBadgeLabels(null)).toEqual(["Backoffice"])
  })
})

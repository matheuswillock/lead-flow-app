import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  TEAM_SWITCHING_SUPPORT_COPY,
  TeamSwitchingScreen,
  getTeamSwitchingTitle,
} from "./TeamSwitchingScreen"

describe("TeamSwitchingScreen", () => {
  it("usa o título Migrando para o time {nome} e a linha de apoio", () => {
    expect(getTeamSwitchingTitle("Backoffice")).toBe("Migrando para o time Backoffice")

    const html = renderToStaticMarkup(<TeamSwitchingScreen teamName="Backoffice" />)

    expect(html).toContain("Migrando para o time Backoffice")
    expect(html).toContain(TEAM_SWITCHING_SUPPORT_COPY)
    expect(html).toContain("<h1")
    expect(html).toContain("motion-reduce:animate-none")
    expect(html).not.toContain("aria-busy")
    expect(html).not.toContain("role=\"dialog\"")
    expect(html).not.toMatch(/\bz-\d|z-index/)
  })

  it("não usa Dialog nem overlay Radix", () => {
    const html = renderToStaticMarkup(<TeamSwitchingScreen teamName="Comercial" />)

    expect(html).not.toMatch(/data-radix|DialogContent|dialog-overlay/i)
  })
})

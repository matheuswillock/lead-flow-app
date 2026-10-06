import { describe, expect, test } from "bun:test"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { buildLandingPageMetadata } from "./metadata"

describe("buildLandingPageMetadata", () => {
  test("usa a identidade da corretora e não herda ícones", () => {
    const snapshot = { content: { brandName: "Marca padrão", heroDescription: "Descrição", templateConfig: { identity: { tradeName: "K. K. J. Corretora" } } } } as LandingPageSnapshot
    const metadata = buildLandingPageMetadata(snapshot)
    expect(metadata.title).toBe("K. K. J. Corretora")
    expect(metadata.icons).toEqual({ icon: [] })
    expect(metadata.openGraph).toMatchObject({ title: "K. K. J. Corretora", siteName: "K. K. J. Corretora", images: [] })
  })

  test("usa fallback neutro sem snapshot", () => {
    const metadata = buildLandingPageMetadata()
    expect(metadata.title).toBe("Página de cotação")
    expect(metadata.description).toBeUndefined()
  })
})

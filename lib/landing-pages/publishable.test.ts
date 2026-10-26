import { describe, expect, it } from "bun:test"
import { hasPublishableSection } from "./publishable"

describe("hasPublishableSection", () => {
  it("hides disabled and empty sections", () => {
    expect(hasPublishableSection({ enabled: false, title: "Conteúdo" })).toBeFalse()
    expect(hasPublishableSection({ enabled: true, items: [] })).toBeFalse()
  })

  it("publishes textual content", () => {
    expect(hasPublishableSection({ title: "Título" })).toBeTrue()
    expect(hasPublishableSection({ items: [{ title: "Card" }] })).toBeTrue()
  })

  it("does not publish zero-only metrics", () => {
    expect(hasPublishableSection({ items: [{ title: "", value: 0 }] })).toBeFalse()
    expect(hasPublishableSection({ items: [{ title: "", value: "0" }] })).toBeFalse()
  })

  it("publishes a non-zero metric", () => {
    expect(hasPublishableSection({ items: [{ title: "", value: 6 }] })).toBeTrue()
  })
})

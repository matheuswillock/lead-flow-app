import { describe, expect, it } from "bun:test"
import { escapeHtml } from "./escape-html"

describe("escapeHtml", () => {
  it("neutraliza texto e atributos HTML", () => {
    expect(escapeHtml(`<img src=x onerror='execute(1)'>`)).toBe("&lt;img src=x onerror=&#39;execute(1)&#39;&gt;")
  })
})

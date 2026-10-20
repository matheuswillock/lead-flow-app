import { describe, expect, it } from "bun:test"
import { selectRecommendedVercelCname } from "./resolveRecommendedVercelCname"

describe("selectRecommendedVercelCname", () => {
  it("preserva exatamente o CNAME de maior prioridade recomendado pela Vercel", () => {
    const result = selectRecommendedVercelCname({
      misconfigured: true,
      recommendedCNAME: [
        { rank: 2, value: "cname.vercel-dns.com." },
        { rank: 1, value: "e7ec430d41e066d4.vercel-dns-017.com." },
      ],
    })

    expect(result).toBe("e7ec430d41e066d4.vercel-dns-017.com.")
  })
})

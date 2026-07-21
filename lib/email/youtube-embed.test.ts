import { describe, expect, test } from "bun:test"
import {
  buildYouTubeEmailSnippet,
  buildYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "./youtube-embed"

describe("parseYouTubeVideoId", () => {
  test("extrai id de youtube.com/watch", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  test("extrai id de youtu.be", () => {
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  test("extrai id de youtube.com/embed", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  test("extrai id de youtube.com/shorts", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  test("retorna null para url inválida", () => {
    expect(parseYouTubeVideoId("https://example.com/video")).toBeNull()
    expect(parseYouTubeVideoId("")).toBeNull()
  })
})

describe("buildYouTubeEmailSnippet", () => {
  test("gera html com thumbnail e link", () => {
    const snippet = buildYouTubeEmailSnippet({ videoId: "dQw4w9WgXcQ" })

    expect(snippet).toContain('role="presentation"')
    expect(snippet).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(snippet).toContain(buildYouTubeThumbnailUrl("dQw4w9WgXcQ"))
    expect(snippet).not.toContain("<iframe")
  })
})

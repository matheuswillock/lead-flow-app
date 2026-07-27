import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import {
  assertMediaPathBelongsToTeam,
  buildClientMediaStoragePath,
  isAllowedWhatsAppMimeType,
  normalizeMimeType,
  sanitizeWhatsAppMediaFileName,
} from "./WhatsAppMediaStorage"

describe("WhatsAppMediaStorage helpers", () => {
  test("normaliza MIME com codecs", () => {
    expect(normalizeMimeType("audio/webm;codecs=opus")).toBe("audio/webm")
    expect(isAllowedWhatsAppMimeType("audio/webm;codecs=opus")).toBe(true)
    expect(isAllowedWhatsAppMimeType("application/x-msdownload")).toBe(false)
  })

  test("sanitiza nome e monta path por clientMessageId", () => {
    expect(sanitizeWhatsAppMediaFileName("../../evil name.png")).toBe("evil_name.png")
    const path = buildClientMediaStoragePath({
      teamId: "team-1",
      conversationId: "conv-1",
      clientMessageId: "11111111-1111-4111-8111-111111111111",
      fileName: "foto.png",
      mimeType: "image/png",
    })
    expect(path).toBe("team-1/conv-1/11111111-1111-4111-8111-111111111111/foto.png")
    expect(assertMediaPathBelongsToTeam(path, "team-1")).toBe(true)
    expect(assertMediaPathBelongsToTeam("../other/file", "team-1")).toBe(false)
  })

  test("sha256 estável para buffer conhecido", () => {
    const digest = createHash("sha256").update(Buffer.from("abc")).digest("hex")
    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })
})

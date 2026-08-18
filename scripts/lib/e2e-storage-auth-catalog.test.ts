import { describe, expect, it } from "bun:test"
import { parseStorageAuthCatalog } from "./e2e-storage-auth-catalog"

describe("parseStorageAuthCatalog", () => {
  it("lê a linha t|f do psql -t -A -F |", () => {
    expect(parseStorageAuthCatalog("t|f|f|f\n")).toEqual({
      storageBuckets: true,
      storageObjects: false,
      authIdentities: false,
      authEmailChangeTokenCurrent: false,
    })
  })

  it("ignora NOTICE e usa a linha com pipes", () => {
    const stdout = [
      "NOTICE:  schema \"storage\" already exists, skipping",
      "f|f|f|t",
      "",
    ].join("\n")
    expect(parseStorageAuthCatalog(stdout)).toEqual({
      storageBuckets: false,
      storageObjects: false,
      authIdentities: false,
      authEmailChangeTokenCurrent: true,
    })
  })

  it("retorna null quando o stdout não tem 4 colunas", () => {
    expect(parseStorageAuthCatalog("ready\n")).toBeNull()
    expect(parseStorageAuthCatalog("t|f|f\n")).toBeNull()
  })
})

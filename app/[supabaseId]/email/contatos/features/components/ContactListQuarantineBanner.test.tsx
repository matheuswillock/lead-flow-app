import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ContactListQuarantineBanner } from "./ContactListQuarantineBanner"
import type { ContactList } from "../context/ContatosTypes"

function buildList(overrides: Partial<ContactList> = {}): ContactList {
  return {
    id: "list-1",
    name: "Lista suja",
    description: null,
    totalContacts: 10,
    isSystemDefault: false,
    isBlocklist: false,
    isArchived: false,
    isQuarantined: true,
    quarantinedAt: new Date().toISOString(),
    quarantineReason: "Importação imp-1 com risco ALTO — 87 removidos.",
    radarSegmentId: null,
    radarSegment: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creator: null,
    ...overrides,
  }
}

describe("ContactListQuarantineBanner", () => {
  it("renderiza o motivo da quarentena e o botão de liberação", () => {
    const html = renderToStaticMarkup(
      <ContactListQuarantineBanner
        list={buildList()}
        readOnly={false}
        onRelease={async () => {}}
      />
    )
    expect(html).toContain("Lista em quarentena pelo gate de importação")
    expect(html).toContain("risco ALTO")
    expect(html).toContain("Liberar lista mesmo assim")
  })

  it("em modo somente leitura não oferece liberação", () => {
    const html = renderToStaticMarkup(
      <ContactListQuarantineBanner list={buildList()} readOnly onRelease={async () => {}} />
    )
    expect(html).toContain("Lista em quarentena pelo gate de importação")
    expect(html).not.toContain("Liberar lista mesmo assim")
  })

  it("sem motivo persistido, usa o fallback de risco ALTO", () => {
    const html = renderToStaticMarkup(
      <ContactListQuarantineBanner
        list={buildList({ quarantineReason: null })}
        readOnly={false}
        onRelease={async () => {}}
      />
    )
    expect(html).toContain("risco ALTO")
  })
})

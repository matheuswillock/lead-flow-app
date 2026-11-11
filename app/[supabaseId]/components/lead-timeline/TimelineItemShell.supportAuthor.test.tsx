import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import type { LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO"
import { TimelineItemShell } from "./TimelineItemShell"

// O corretor precisa ver quando quem alterou o lead é da equipe de suporte.

function renderShell(author: { fullName: string | null; email: string } | null) {
  const activity = {
    id: "act-1",
    type: "note",
    createdAt: "2026-11-10T12:00:00.000Z",
    author: author ? { id: "u-1", avatarUrl: null, ...author } : null,
  } as unknown as LeadActivityResponseDTO

  return render(
    <TimelineItemShell
      activity={activity}
      scheduleTimezone="America/Sao_Paulo"
      highlighted={false}
      typeIcon={null}
      typeLabel="Nota"
      itemRef={() => undefined}
    >
      <p>conteúdo</p>
    </TimelineItemShell>
  )
}

describe("TimelineItemShell e o autor da equipe de suporte", () => {
  afterEach(() => cleanup())

  it("mostra Fulano · Equipe de suporte para a equipe Corretor Studio", () => {
    renderShell({ fullName: "Joana Silva", email: "joana@corretorstudio.com.br" })

    expect(screen.getByText("Joana Silva · Equipe de suporte")).toBeTruthy()
  })

  it("mostra só o nome para quem é do cliente", () => {
    renderShell({ fullName: "Marina Souza", email: "marina@horizonte.com.br" })

    expect(screen.getByText("Marina Souza")).toBeTruthy()
    expect(screen.queryByText(/Equipe de suporte/)).toBeNull()
  })

  it("sem autor mostra Sistema", () => {
    renderShell(null)

    expect(screen.getByText("Sistema")).toBeTruthy()
  })
})

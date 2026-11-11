import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { TeamProvider, type TeamSummary } from "@/app/context/TeamContext"
import { RadarSegmentCard } from "./RadarSegmentCard"

// A equipe de suporte numa conta de cliente não exporta dados dela.

function buildTeam(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    id: "team-1",
    name: "Time Comercial",
    masterId: "master-1",
    isDefault: true,
    role: "backoffice",
    functions: [],
    canCreateAccountUsers: true,
    canManageAccountTeams: true,
    canTransferAccountLeads: true,
    canViewAllTeams: true,
    membershipCreatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function renderCard(team?: TeamSummary) {
  const card = (
    <RadarSegmentCard
      name="Compradores"
      description={null}
      count={10}
      variant="custom"
      onExport={mock(() => undefined)}
      onViewProfiles={mock(() => undefined)}
    />
  )

  if (!team) return render(card)

  return render(
    <TeamProvider supabaseId="sb-1" initialTeams={[team]} initialActiveTeamId={team.id}>
      {card}
    </TeamProvider>
  )
}

describe("RadarSegmentCard e a exportação da equipe de suporte", () => {
  afterEach(() => cleanup())

  it("fora de uma conta de suporte o botão Exportar aparece", () => {
    renderCard(buildTeam({ isSupportAccess: false, role: "manager" }))

    expect(screen.getByRole("button", { name: /Exportar/ })).toBeTruthy()
  })

  it("sem provider de times o botão Exportar continua aparecendo", () => {
    renderCard()

    expect(screen.getByRole("button", { name: /Exportar/ })).toBeTruthy()
  })

  it("na conta de um cliente como suporte o botão Exportar some, o resto fica", () => {
    renderCard(buildTeam({ isSupportAccess: true }))

    expect(screen.queryByRole("button", { name: /Exportar/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Ver perfis/ })).toBeTruthy()
  })
})

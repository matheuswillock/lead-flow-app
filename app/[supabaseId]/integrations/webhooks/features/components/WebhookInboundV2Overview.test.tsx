import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import type { TeamMemberOption } from "../services/ITeamWebhooksService"
import { WebhookInboundV2Overview } from "./WebhookInboundV2Overview"

afterEach(cleanup)

const members: TeamMemberOption[] = [
  { profileId: "a", name: "Ana", functions: ["SDR"], googleCalendarConnected: true },
  { profileId: "b", name: "Bruno", functions: ["SDR"], googleCalendarConnected: true },
]

const v2 = {
  name: "YouPop",
  contractVersion: 2,
  scopes: ["leads_create", "leads_schedule"],
  defaultAssigneeProfileIds: ["a", "b"],
  lastAssignedProfileId: "a",
  defaultMeetingLink: "https://meet.google.com/abc",
}

describe("WebhookInboundV2Overview", () => {
  test("v2: mostra versão, permissões, SDRs em rodízio com o próximo e o Meet padrão", () => {
    render(<WebhookInboundV2Overview webhook={v2} members={members} membersLoading={false} inboundListPath="/sid/integrations/webhooks/inbound" />)

    expect(screen.getByText("Versão 2")).toBeTruthy()
    expect(screen.getByText("Criar leads")).toBeTruthy()
    expect(screen.getByText("Agendar reuniões")).toBeTruthy()
    expect(screen.getByText("Bruno").parentElement?.textContent).toContain("Próximo lead")
    expect(screen.getByText("Ana").parentElement?.textContent).not.toContain("Próximo lead")
    expect(screen.getByText("https://meet.google.com/abc")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Criar webhook v2/ })).toBeNull()
  })

  test("v1: sem troca de versão, só o caminho para criar um v2 com o nome sugerido", () => {
    render(
      <WebhookInboundV2Overview
        webhook={{ ...v2, contractVersion: 1, scopes: [], defaultAssigneeProfileIds: [], defaultMeetingLink: null }}
        members={[]}
        membersLoading={false}
        inboundListPath="/sid/integrations/webhooks/inbound"
      />,
    )

    expect(screen.getByText("Versão 1 (descontinuada)")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Criar webhook v2 a partir deste/ }).getAttribute("href")).toBe(
      "/sid/integrations/webhooks/inbound/new?from_name=YouPop%20(v2)",
    )
  })

  test("v2 sem SDR padrão avisa que o lead entra sem responsável", () => {
    render(
      <WebhookInboundV2Overview
        webhook={{ ...v2, defaultAssigneeProfileIds: [], lastAssignedProfileId: null }}
        members={members}
        membersLoading={false}
        inboundListPath="/x"
      />,
    )

    expect(screen.getByText(/entram sem responsável/)).toBeTruthy()
  })
})

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { CarteiraDetailData, UpdateCarteiraDetailPayload } from "../context/CarteiraTypes"

/**
 * Regressão: editar um contrato PJ (corporate) pela Carteira enviava o PATCH
 * sem `contractType`/`holder.razaoSocial`. A API, sem saber que o contrato é
 * corporate, assume `individual` e exige CPF — campo que esse tipo de
 * contrato nunca mostra. Ver `app/api/v1/portfolio/[leadId]/detail/route.ts`.
 */

mock.module("@/app/context/TeamContext", () => ({
  useTeamContext: () => ({ activeTeamId: "team-1" }),
}))
mock.module("@/app/context/TimezoneContext", () => ({
  useTimezone: () => ({ tz: "America/Sao_Paulo" }),
}))
mock.module("@/hooks/useTeamMembersByFunction", () => ({
  useTeamClosers: () => ({ members: [] }),
}))
mock.module("@/hooks/useHealthPlans", () => ({
  useHealthPlans: () => ({ healthPlans: [] }),
}))
mock.module("next/navigation", () => ({
  useParams: () => ({ supabaseId: "team-1" }),
}))

const { CarteiraDetailModal } = await import("./CarteiraDetailModal")

const originalFetch = global.fetch

const CORPORATE_DETAIL: CarteiraDetailData = {
  portfolioId: "portfolio-1",
  leadId: "lead-1",
  leadCode: "LEAD001",
  leadName: "Empresa Teste LTDA",
  source: "crm",
  saleValue: 1500,
  portfolioStatus: "active",
  contractType: "corporate",
  sdr: null,
  closer: { id: "closer-1", name: "Closer Um" },
  soldPlan: "Plano Empresarial",
  contractDueDate: "2027-01-01T00:00:00.000Z",
  contract: {
    operadora: "Unimed",
    productName: "Plano Empresarial",
    amount: 1500,
    startDateAt: "2026-01-01T00:00:00.000Z",
    finalizedDateAt: "2026-01-05T00:00:00.000Z",
    contractFileUrl: null,
    notes: null,
    closerName: "Closer Um",
  },
  holder: {
    name: "Empresa Teste LTDA",
    razaoSocial: "Empresa Teste LTDA",
    birthDate: "1990-01-01T00:00:00.000Z",
    document: "",
    cnpj: "12345678000199",
  },
  dependents: [],
  attachments: [],
}

beforeEach(() => {
  global.fetch = mock(async () =>
    new Response(JSON.stringify({ result: { lead: { activities: [] } } }), { status: 200 }),
  ) as unknown as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe("CarteiraDetailModal", () => {
  test("editar contrato corporate envia contractType e razaoSocial no PATCH", async () => {
    const onSave = mock(async (_leadId: string, _payload: UpdateCarteiraDetailPayload) => {})

    render(
      <CarteiraDetailModal
        open
        onOpenChange={() => {}}
        detail={CORPORATE_DETAIL}
        isLoading={false}
        onSave={onSave}
      />,
    )

    fireEvent.click(await screen.findByRole("button", { name: "Editar" }))

    const submitButton = await screen.findByRole("button", { name: "Salvar alterações" })
    await act(async () => {
      await Promise.resolve()
    })
    expect((submitButton as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      fireEvent.click(submitButton)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const [, savedPayload] = onSave.mock.calls[0] as [string, UpdateCarteiraDetailPayload]
    expect(savedPayload.contractType).toBe("corporate")
    expect(savedPayload.holder?.razaoSocial).toBe("Empresa Teste LTDA")
  })
})

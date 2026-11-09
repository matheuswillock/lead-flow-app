import { describe, expect, it } from "bun:test"
import { LeadMeetingNurtureUseCase, NURTURE_LEAD_NOT_FOUND, type NurtureContact } from "./LeadMeetingNurtureUseCase"
import { fakeReminderRepository } from "./testDoubles"

const NOW = new Date("2026-11-10T12:00:00.000Z")
const MEETING = new Date("2026-11-13T17:00:00.000Z")
const scope = { leadId: "lead-1", teamId: "team-1" }

function setup(overrides: Partial<{ status: string; teamId: string }> = {}) {
  const fake = fakeReminderRepository({
    leadMeeting: {
      teamId: overrides.teamId ?? "team-1",
      name: "Maria",
      status: overrides.status ?? "scheduled",
      isTransfer: false,
      meetingDate: MEETING,
      sdrProfileId: "sdr-1",
      timezone: "America/Sao_Paulo",
    },
  })
  return { ...fake, useCase: new LeadMeetingNurtureUseCase(fake.repository, () => NOW) }
}

const contactsOf = (output: { result: unknown }) => (output.result as { contacts: NurtureContact[] }).contacts

describe("LeadMeetingNurtureUseCase", () => {
  it("mostra a cadência fixa com a dica de cada contato", async () => {
    const { useCase } = setup()
    const contacts = contactsOf(await useCase.list(scope))
    expect(contacts.map((c) => [c.whenLabel, c.title])).toEqual([
      ["2 dias antes", "Gerar expectativa"],
      ["1 dia antes", "Confirmar presença"],
      ["1 hora antes", "Lembrete final"],
    ])
    expect(contacts[1].tip).toContain("Confirme dia e horário")
  })

  it("abrir a lista de novo não duplica a cadência", async () => {
    const { useCase, stored } = setup()
    await useCase.list(scope)
    await useCase.list(scope)
    expect(stored).toHaveLength(3)
  })

  it("adiciona contato extra em outro dia e horário, para o SDR do lead", async () => {
    const { useCase, stored } = setup()
    const output = await useCase.addContact({ ...scope, dueAt: "2026-11-12T13:00:00.000Z" })
    const extra = contactsOf(output).find((c) => c.isCustom)
    expect(extra).toMatchObject({ title: "Contato extra", whenLabel: "contato extra", dueAt: "2026-11-12T13:00:00.000Z" })
    expect(stored.find((item) => item.offsetKey.startsWith("custom:"))?.ownerProfileId).toBe("sdr-1")
  })

  it("recusa contato no passado ou depois da reunião", async () => {
    const { useCase } = setup()
    expect((await useCase.addContact({ ...scope, dueAt: "2026-11-09T10:00:00.000Z" })).isValid).toBe(false)
    expect((await useCase.addContact({ ...scope, dueAt: "2026-11-14T10:00:00.000Z" })).isValid).toBe(false)
  })

  it("remove um contato extra pendente", async () => {
    const { useCase } = setup()
    const added = await useCase.addContact({ ...scope, dueAt: "2026-11-12T13:00:00.000Z" })
    const extra = contactsOf(added).find((c) => c.isCustom)!
    const output = await useCase.removeContact({ ...scope, contactId: extra.id })
    expect(contactsOf(output).some((c) => c.isCustom)).toBe(false)
  })

  it("sem reunião agendada a lista vem vazia; outro time não acessa", async () => {
    expect(contactsOf(await setup({ status: "pricingRequest" }).useCase.list(scope))).toEqual([])
    expect((await setup({ teamId: "team-2" }).useCase.list(scope)).errorMessages).toEqual([NURTURE_LEAD_NOT_FOUND])
  })
})

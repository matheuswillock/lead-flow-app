import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { IEmailCampaignRecipientRepository } from "@/app/api/infra/data/repositories/emailCampaignRecipient/IEmailCampaignRecipientRepository"
import { EmailCampaignRecipientService } from "./EmailCampaignRecipientService"

describe("EmailCampaignRecipientService.countActiveRecipients", () => {
  const findContactListMetaMock = mock(
    async () => null as { id: string; isSystemDefault: boolean } | null
  )
  const countActiveRecipientsForTeamMock = mock(async () => 0)
  const countActiveRecipientsForListMock = mock(async () => 0)

  const repository = {
    findContactListMeta: findContactListMetaMock,
    countActiveRecipientsForTeam: countActiveRecipientsForTeamMock,
    countActiveRecipientsForList: countActiveRecipientsForListMock,
    findActiveRecipientsForTeam: mock(async () => []),
    findActiveRecipientsForList: mock(async () => []),
    findActiveRecipientsByIds: mock(async () => []),
    findGlobalVariableDefaults: mock(async () => ({})),
  } as unknown as IEmailCampaignRecipientRepository

  beforeEach(() => {
    findContactListMetaMock.mockClear()
    countActiveRecipientsForTeamMock.mockClear()
    countActiveRecipientsForListMock.mockClear()
    findContactListMetaMock.mockImplementation(async () => null)
    countActiveRecipientsForTeamMock.mockImplementation(async () => 0)
    countActiveRecipientsForListMock.mockImplementation(async () => 0)
  })

  it("retorna 0 quando a lista não existe", async () => {
    const service = new EmailCampaignRecipientService(repository)
    expect(await service.countActiveRecipients("team-1", "list-1")).toBe(0)
    expect(countActiveRecipientsForTeamMock).not.toHaveBeenCalled()
    expect(countActiveRecipientsForListMock).not.toHaveBeenCalled()
  })

  it("conta com COUNT DISTINCT do time na lista padrão do sistema", async () => {
    findContactListMetaMock.mockImplementation(async () => ({
      id: "default-1",
      isSystemDefault: true,
    }))
    countActiveRecipientsForTeamMock.mockImplementation(async () => 42)

    const service = new EmailCampaignRecipientService(repository)
    expect(await service.countActiveRecipients("team-1", "default-1")).toBe(42)
    expect(countActiveRecipientsForTeamMock).toHaveBeenCalledWith("team-1")
    expect(countActiveRecipientsForListMock).not.toHaveBeenCalled()
  })

  it("conta com count() da lista quando não é a lista padrão", async () => {
    findContactListMetaMock.mockImplementation(async () => ({
      id: "list-1",
      isSystemDefault: false,
    }))
    countActiveRecipientsForListMock.mockImplementation(async () => 9)

    const service = new EmailCampaignRecipientService(repository)
    expect(await service.countActiveRecipients("team-1", "list-1")).toBe(9)
    expect(countActiveRecipientsForListMock).toHaveBeenCalledWith("list-1")
    expect(countActiveRecipientsForTeamMock).not.toHaveBeenCalled()
  })
})

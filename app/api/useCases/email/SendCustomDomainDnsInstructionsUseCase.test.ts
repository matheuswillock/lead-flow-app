import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type {
  EmailTeamSettingsRecord,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import type {
  ICustomDomainDnsInstructionsMailService,
  SendDnsInstructionsEmailInput,
} from "@/app/api/services/email/ICustomDomainDnsInstructionsMailService"
import type { assertResend } from "@/lib/email"
import { SendCustomDomainDnsInstructionsUseCase } from "./SendCustomDomainDnsInstructionsUseCase"

const DOMAIN_RECORDS = [
  {
    record: "SPF",
    type: "MX",
    name: "send",
    value: "feedback-smtp.us-east-1.amazonses.com",
    priority: 10,
    ttl: "Auto",
    status: "pending",
  },
]

const CONNECTED_SETTINGS = {
  resendDomainId: "dom-1",
  resendDomainName: "mail.empresa-exemplo.com.br",
} as EmailTeamSettingsRecord

const sendMailMock = mock(
  async (_input: SendDnsInstructionsEmailInput) => ({ success: true as boolean, error: undefined as string | undefined })
)

const domainsGetMock = mock(async (_domainId: string) => ({
  data: { id: "dom-1", name: "mail.empresa-exemplo.com.br", records: DOMAIN_RECORDS },
  error: null,
}))

function buildSettingsRepository(
  settings: EmailTeamSettingsRecord | null
): IEmailTeamSettingsRepository {
  return {
    findSettings: mock(async () => settings),
  } as unknown as IEmailTeamSettingsRepository
}

function buildResend(): ReturnType<typeof assertResend> {
  return {
    domains: { get: domainsGetMock },
  } as unknown as ReturnType<typeof assertResend>
}

function buildMailService(): ICustomDomainDnsInstructionsMailService {
  return { sendDnsInstructionsEmail: sendMailMock }
}

function buildUseCase(settings: EmailTeamSettingsRecord | null = CONNECTED_SETTINGS) {
  return new SendCustomDomainDnsInstructionsUseCase({
    settingsRepo: buildSettingsRepository(settings),
    resendFactory: buildResend,
    mailService: buildMailService(),
  })
}

const teamCtx = {
  supabaseId: "supa-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "manager@test.com",
  profileName: "Manager",
  isMaster: false,
  managerId: "manager-1",
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
} as TeamAccess

describe("SendCustomDomainDnsInstructionsUseCase", () => {
  beforeEach(() => {
    sendMailMock.mockClear()
    sendMailMock.mockResolvedValue({ success: true, error: undefined })
    domainsGetMock.mockClear()
    domainsGetMock.mockResolvedValue({
      data: { id: "dom-1", name: "mail.empresa-exemplo.com.br", records: DOMAIN_RECORDS },
      error: null,
    })
  })

  it("rejeita e-mail inválido sem tocar no provedor nem no envio", async () => {
    const output = await buildUseCase().execute(teamCtx, { recipientEmail: "nao-e-email" })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "Informe um e-mail válido para receber as instruções",
    ])
    expect(domainsGetMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("falha quando o time não tem domínio conectado", async () => {
    const output = await buildUseCase(null).execute(teamCtx, {
      recipientEmail: "hospedagem@cliente.com.br",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "Nenhum domínio conectado para enviar instruções",
    ])
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("falha quando os registros do domínio não podem ser carregados", async () => {
    domainsGetMock.mockResolvedValue({
      data: null,
      error: { statusCode: 500, message: "boom", name: "application_error" },
    } as never)

    const output = await buildUseCase().execute(teamCtx, {
      recipientEmail: "hospedagem@cliente.com.br",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "Não foi possível carregar os registros DNS do domínio",
    ])
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("reconstrói as instruções no servidor: envia domínio e registros reais do time", async () => {
    const output = await buildUseCase().execute(teamCtx, {
      recipientEmail: "  Hospedagem@Cliente.com.br  ",
    })

    expect(output.isValid).toBe(true)
    expect(output.successMessages).toEqual([
      "Instruções enviadas para hospedagem@cliente.com.br",
    ])
    expect(domainsGetMock).toHaveBeenCalledWith("dom-1")
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0]?.[0]).toEqual({
      teamId: "team-1",
      recipientEmail: "hospedagem@cliente.com.br",
      domainName: "mail.empresa-exemplo.com.br",
      records: DOMAIN_RECORDS,
    })
  })

  it("propaga falha de envio como Output inválido", async () => {
    sendMailMock.mockResolvedValue({ success: false, error: "quota" })

    const output = await buildUseCase().execute(teamCtx, {
      recipientEmail: "hospedagem@cliente.com.br",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "Não foi possível enviar as instruções por e-mail",
    ])
  })
})

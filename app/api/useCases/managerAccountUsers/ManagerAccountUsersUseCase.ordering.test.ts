import { describe, expect, it, mock } from "bun:test"

/**
 * Trava a ORDEM e a ATOMICIDADE do caminho de criação de usuário da conta,
 * chamando o USE CASE REAL — não uma reprodução do padrão.
 *
 * Este use case saiu de uma rota de 1310 linhas. A sequência é o contrato:
 * projeta cobrança → abre transação → verifica capacidade DENTRO dela → cria os
 * registros → só então toca Supabase Auth e e-mail. Inverter qualquer par disso
 * cobra em dobro, cria conta órfã, ou manda link de senha para conta inexistente.
 *
 * Só é testável sem tocar nada externo porque as dependências passaram a ser
 * injetadas pelo construtor. Supabase e e-mail, que ainda são importados
 * diretamente, são neutralizados por `mock.module`.
 */

const eventos: string[] = []

// `server-only` lança fora do runtime de servidor do Next; neutralizado para o
// runner de teste conseguir carregar a cadeia de imports.
mock.module("server-only", () => ({}))

// Estes dois leem variável de ambiente e viviam DENTRO do try/catch de
// `finalizeUserCreation`. Sem stub, um runner sem `NEXT_PUBLIC_APP_URL` faz o
// caminho feliz cair na compensação e o teste falha por ambiente, não por
// regressão — foi exatamente o que aconteceu na CI enquanto passava local.
mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://example.test${path}`,
}))

mock.module("@/lib/supabase/email-auth-link", () => ({
  buildSetPasswordEmailAuthLink: () => "https://example.test/set-password?token=abc",
}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => {
    eventos.push("supabase:createAdmin")
    return {
      auth: {
        admin: {
          generateLink: async () => {
            eventos.push("supabase:generateLink")
            return {
              data: {
                user: { id: "sb-user-1" },
                properties: { action_link: "https://example.test/set-password?token=abc" },
              },
              error: null,
            }
          },
        },
      },
    }
  },
}))

// O módulo real exporta createEmailService/getEmailService/emailService e a
// classe; um mock.module parcial faz o Bun reclamar de export ausente.
const emailServiceStub = {
  sendOperatorInviteEmail: async () => { eventos.push("email:send") },
  sendGenericEmail: async () => { eventos.push("email:send") },
  sendEmail: async () => { eventos.push("email:send") },
}

mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => emailServiceStub,
  getEmailService: () => { eventos.push("email:get"); return emailServiceStub },
  emailService: emailServiceStub,
}))

const { ManagerAccountUsersUseCase } = await import("./ManagerAccountUsersUseCase")

function montarDependencias(options: { capacidadeEsgotada?: boolean } = {}) {
  const repository = {
    findTeamNameById: mock(async () => ({ name: "Time" })),
    findProfileLabelById: mock(async () => ({ fullName: "Gestor" })),
    findProfileEmailById: mock(async () => ({ email: "gestor@test.com", fullName: "Gestor" })),
    findProfileIdByEmail: mock(async () => null),
    findOpenPendingOperatorIdByEmail: mock(async () => null),
    findOpenAddUserActionIdByEmail: mock(async () => null),
    findBillingOwnerProfile: mock(async () => ({
      id: "m1",
      email: "master@test.com",
      fullName: "Master",
      hasPermanentSubscription: false,
      asaasCustomerId: "cus_1",
      asaasSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    })),
    runInTransaction: mock(async (work: (tx: unknown) => Promise<unknown>) => {
      eventos.push("tx:inicio")
      const r = await work({ __tx: true })
      eventos.push("tx:commit")
      return r
    }),
    createAccountUserRecords: mock(async (_p: unknown, tx?: unknown) => {
      eventos.push(tx ? "createRecords:DENTRO-da-tx" : "createRecords:FORA-da-tx")
      return {
        profile: { id: "p1", email: "novo@test.com", fullName: "Novo" },
        teamMemberRecord: { id: "tm1", role: "OPERATOR", functions: [] },
      }
    }),
    updateProfileSupabaseId: mock(async () => { eventos.push("linkSupabaseId") }),
    // Compensação: só deveria rodar se o Supabase falhar. Registrada para o
    // teste acusar caso o caminho feliz caia nela por engano.
    deleteTeamMember: mock(async () => { eventos.push("COMPENSACAO:deleteTeamMember") }),
    deleteProfile: mock(async () => { eventos.push("COMPENSACAO:deleteProfile") }),
    createPendingAddUserAction: mock(async () => ({ id: "pa1" })),
    updatePendingActionPayload: mock(async () => {}),
    findTeamMember: mock(async () => null),
    findAccountUsersByTeam: mock(async () => []),
  }

  const capacity = {
    assertCapacityAvailable: mock(async () => {
      eventos.push("assertCapacity")
      if (options.capacidadeEsgotada) throw new Error("Limite de usuários atingido")
      return {}
    }),
  }

  const billing = {
    projectBilling: mock(async () => { eventos.push("projectBilling"); return { billingDelta: 0 } }),
    createIncrementalCharge: mock(async () => ({})),
    syncRecurringSubscription: mock(async () => {}),
    ensureOrSyncRecurringSubscription: mock(async () => {}),
    calculateProportionalAmount: mock(async () => ({ amount: 0 })),
  }

  const memberProBilling = {
    shouldBypassIncrementalCharge: mock(async () => false),
    syncUsageToSubscription: mock(async () => {}),
    syncBillingAfterUsageChange: mock(async () => {}),
  }

  const notifications = { createTeamMembershipNotification: mock(async () => null) }
  const profiles = { updateProfileById: mock(async () => ({})) }

  return { repository, capacity, billing, memberProBilling, notifications, profiles }
}

function novoUseCase(deps: ReturnType<typeof montarDependencias>) {
  return new ManagerAccountUsersUseCase(
    deps.repository as never,
    deps.profiles as never,
    deps.billing as never,
    deps.capacity as never,
    deps.notifications as never,
    deps.memberProBilling as never
  )
}

const PARAMS = {
  ctx: { teamId: "t1", profileId: "pf1", managerId: "m1", isMaster: true },
  userData: { name: "Novo Usuário", email: "novo@test.com", role: "OPERATOR" as never },
}

describe("ManagerAccountUsersUseCase.createAccountUser — ordem e atomicidade", () => {
  it("capacidade é verificada DENTRO da transação, antes de criar os registros", async () => {
    eventos.length = 0
    const deps = montarDependencias()
    await novoUseCase(deps).createAccountUser(PARAMS as never)

    const i = (e: string) => eventos.indexOf(e)
    expect(i("tx:inicio")).toBeGreaterThanOrEqual(0)
    expect(i("assertCapacity")).toBeGreaterThan(i("tx:inicio"))
    expect(i("createRecords:DENTRO-da-tx")).toBeGreaterThan(i("assertCapacity"))
    expect(i("tx:commit")).toBeGreaterThan(i("createRecords:DENTRO-da-tx"))
  })

  it("projeta cobrança ANTES de abrir a transação", async () => {
    eventos.length = 0
    const deps = montarDependencias()
    await novoUseCase(deps).createAccountUser(PARAMS as never)

    expect(eventos.indexOf("projectBilling")).toBeLessThan(eventos.indexOf("tx:inicio"))
  })

  it("Supabase e e-mail só são tocados DEPOIS do commit", async () => {
    // Chamada externa dentro da transação seguraria o lock durante I/O de rede,
    // e um rollback deixaria conta criada no Supabase sem registro local.
    eventos.length = 0
    const deps = montarDependencias()
    await novoUseCase(deps).createAccountUser(PARAMS as never)

    const commit = eventos.indexOf("tx:commit")
    const externos = eventos
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.startsWith("supabase:") || e.startsWith("email:"))

    expect(externos.length).toBeGreaterThan(0)
    for (const { e, idx } of externos) {
      expect(idx, `${e} deveria vir depois do commit`).toBeGreaterThan(commit)
    }
  })

  it("capacidade esgotada aborta sem criar nenhum registro", async () => {
    eventos.length = 0
    const deps = montarDependencias({ capacidadeEsgotada: true })

    await novoUseCase(deps).createAccountUser(PARAMS as never).catch(() => {})

    expect(deps.repository.createAccountUserRecords).not.toHaveBeenCalled()
    expect(eventos).not.toContain("supabase:generateLink")
    expect(eventos).not.toContain("tx:commit")
  })
})

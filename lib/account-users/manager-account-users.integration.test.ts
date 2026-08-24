import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test"
import { randomUUID } from "crypto"

/**
 * Integração contra o Postgres local (:55322), não contra mocks.
 *
 * Motivo de existir separado do teste unitário: o risco real da extração do
 * UseCase de `manager/users` (PR #1015) é a FRONTEIRA DA TRANSAÇÃO. O caminho
 * `billingDelta <= 0` roda `assertCapacityAvailable` e `createAccountUserRecords`
 * dentro do mesmo `runInTransaction`, justamente para que estourar a capacidade
 * não deixe Profile órfão. Prisma mockado não tem transação: qualquer teste com
 * `prisma` falso passa igual com e sem `runInTransaction`, então ele não prova
 * nada sobre atomicidade. Só banco real prova.
 *
 * As chamadas de saída (Supabase Auth `generateLink` com `type: "invite"`, que
 * cria usuário de verdade, e Asaas) ficam de fora por decisão: as únicas
 * credenciais disponíveis nesta máquina são de PRODUÇÃO, e exercitá-las seria
 * criar usuário e cobrança reais. O que é exercitado de verdade aqui é o que dá
 * para exercitar com segurança — e é exatamente onde estava o risco do refactor.
 *
 * Mora em `lib/` e não ao lado do UseCase pelo mesmo motivo de
 * `lib/radar/radar.integration.test.ts`: `governance:check` reprova acesso a
 * Prisma em qualquer `.ts` sob `app/api/**` fora de Repository, e a regra não
 * isenta arquivo de teste. Seed e assert aqui precisam do Prisma cru.
 *
 * Rodar:
 *   MANAGER_USERS_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test lib/account-users/manager-account-users.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.MANAGER_USERS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

// Import dinâmico pelo mesmo motivo de `radar.integration.test.ts`: import
// estático aqui carregaria o módulo real de prisma e disputaria, fora de ordem,
// com o `mock.module("@/app/api/infra/data/prisma", ...)` de outros arquivos
// rodando no mesmo processo do bun test.
let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let ManagerAccountUsersUseCase: typeof import("@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase").ManagerAccountUsersUseCase
let managerAccountUserRepository: typeof import("@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository").managerAccountUserRepository

if (RUN_INTEGRATION) {
  // Os stubs precisam ser registrados ANTES do import dinâmico: o UseCase
  // resolve `createSupabaseAdmin`/`getEmailService` no carregamento do módulo,
  // então registrar em `beforeAll` chegaria tarde demais.
  //
  // `server-only` explode fora do runtime do Next (algum módulo do grafo o
  // importa); mesmo tratamento de `leadAccessSurface.test.ts`.
  mock.module("server-only", () => ({}))

  // Supabase Auth: `generateLink({ type: "invite" })` CRIA usuário de verdade,
  // e a credencial local aponta para produção. Nunca deixar sair.
  mock.module("@/lib/supabase/server", () => ({
    createSupabaseAdmin: () => ({
      auth: {
        admin: {
          generateLink: async () => ({
            data: {
              user: { id: randomUUID() },
              properties: { action_link: "https://example.invalid/set-password" },
            },
            error: null,
          }),
        },
      },
    }),
  }))
  // O módulo inteiro é substituído, então os outros exports de runtime que o
  // grafo consome precisam existir aqui — senão o import falha com
  // "Export named 'createEmailService' not found".
  const emailServiceStub = {
    sendEmail: async () => ({ success: true }),
    sendOperatorInviteEmail: async () => ({ success: true }),
  }
  mock.module("@/lib/services/EmailService", () => ({
    getEmailService: () => emailServiceStub,
    createEmailService: () => emailServiceStub,
    emailService: emailServiceStub,
    EmailService: class {},
  }))

  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ ManagerAccountUsersUseCase } = await import(
    "@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase"
  ))
  ;({ managerAccountUserRepository } = await import(
    "@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository"
  ))
}

/** Marca as linhas do teste para o cleanup não tocar em nada preexistente. */
const RUN_TAG = `it-${randomUUID().slice(0, 8)}`
const emailFor = (label: string) => `${RUN_TAG}.${label}@integration.invalid`

type Seed = { masterId: string; teamId: string }

async function seedMasterAndTeam(): Promise<Seed> {
  const master = await prisma.profile.create({
    data: {
      fullName: `Master ${RUN_TAG}`,
      email: emailFor("master"),
      role: "manager",
      functions: [],
      isMaster: true,
    },
    select: { id: true },
  })

  const team = await prisma.team.create({
    data: { name: `Time ${RUN_TAG}`, masterId: master.id, isDefault: true },
    select: { id: true },
  })

  await prisma.teamMember.create({
    data: { teamId: team.id, profileId: master.id, role: "manager", functions: [] },
  })

  return { masterId: master.id, teamId: team.id }
}

async function cleanup() {
  const profiles = await prisma.profile.findMany({
    where: { email: { startsWith: RUN_TAG } },
    select: { id: true },
  })
  const ids = profiles.map((profile) => profile.id)
  if (ids.length === 0) return

  await prisma.teamMember.deleteMany({ where: { profileId: { in: ids } } })
  await prisma.team.deleteMany({ where: { masterId: { in: ids } } })
  await prisma.profile.deleteMany({ where: { id: { in: ids } } })
}

/** Portas de saída neutralizadas — nenhuma chamada de rede sai daqui. */
function buildUseCase(overrides: {
  assertCapacityAvailable?: (...args: never[]) => Promise<void>
}) {
  const noopBilling = {
    projectBilling: async () => ({ billingDelta: 0 }),
    calculateProportionalAmount: async () => ({ amount: 0 }),
  }
  const capacity = {
    assertCapacityAvailable:
      overrides.assertCapacityAvailable ?? (async () => {}),
  }
  const notifications = { createTeamMembershipNotification: async () => {} }
  const memberProBilling = {
    shouldBypassIncrementalCharge: async () => false,
    syncUsageToSubscription: async () => {},
    syncBillingAfterUsageChange: async () => {},
  }

  return new ManagerAccountUsersUseCase(
    managerAccountUserRepository,
    undefined as never,
    noopBilling as never,
    capacity as never,
    notifications as never,
    memberProBilling as never
  )
}

function buildParams(seed: Seed, label: string) {
  return {
    ctx: {
      teamId: seed.teamId,
      profileId: seed.masterId,
      managerId: seed.masterId,
      isMaster: true,
    },
    userData: {
      name: `Operador ${label}`,
      email: emailFor(label),
      role: "operator" as const,
      functions: [],
    },
  }
}

describe.skipIf(!RUN_INTEGRATION)("ManagerAccountUsersUseCase — transação real", () => {
  let seed: Seed

  beforeAll(async () => {
    seed = await seedMasterAndTeam()
  })

  afterAll(cleanup)

  it("persiste Profile e TeamMember de verdade quando a capacidade permite", async () => {
    const useCase = buildUseCase({})
    const result = await useCase.createAccountUser(buildParams(seed, "ok") as never)

    expect(result.status).toBe(200)

    const created = await prisma.profile.findFirst({
      where: { email: emailFor("ok") },
      select: { id: true, managerId: true, isMaster: true },
    })
    expect(created).not.toBeNull()
    expect(created?.managerId).toBe(seed.masterId)
    expect(created?.isMaster).toBe(false)

    const member = await prisma.teamMember.findFirst({
      where: { profileId: created!.id },
      select: { teamId: true, role: true },
    })
    expect(member?.teamId).toBe(seed.teamId)
    expect(member?.role).toBe("operator")
  })

  it("capacidade estourada não deixa Profile órfão — os dois writes são atômicos", async () => {
    const useCase = buildUseCase({
      assertCapacityAvailable: async () => {
        throw new Error("Capacidade esgotada")
      },
    })

    await expect(
      useCase.createAccountUser(buildParams(seed, "rollback") as never)
    ).rejects.toThrow("Capacidade esgotada")

    // O ponto do teste: `profile.create` roda ANTES do erro dentro da mesma
    // transação. Sem `runInTransaction` a linha ficaria commitada e o e-mail
    // ficaria queimado — toda tentativa seguinte cairia no 409 "Email já está
    // em uso" para um usuário que nunca chegou a existir.
    const orphan = await prisma.profile.findFirst({
      where: { email: emailFor("rollback") },
      select: { id: true },
    })
    expect(orphan).toBeNull()

    const orphanMember = await prisma.teamMember.count({
      where: { team: { id: seed.teamId }, profile: { email: emailFor("rollback") } },
    })
    expect(orphanMember).toBe(0)
  })
})

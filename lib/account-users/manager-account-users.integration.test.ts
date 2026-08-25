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

/**
 * Guarda de banco local, no mesmo espírito de `assertAsaasSandbox()`.
 *
 * `bun test` carrega o `.env` do repo automaticamente, e o `.env` desta máquina
 * aponta `DATABASE_URL` para o pooler de PRODUÇÃO. Sem esta guarda, esquecer de
 * passar a URL local faz um teste que CRIA E APAGA Profile/Team rodar contra a
 * base real. O gate de env não protege: `MANAGER_USERS_INTEGRATION_TEST=1` já
 * vem setado pelo script `test:integration`.
 */
function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:local` ou passe a URL de 127.0.0.1:55322."
    )
  }
}

// Import dinâmico pelo mesmo motivo de `radar.integration.test.ts`: import
// estático aqui carregaria o módulo real de prisma e disputaria, fora de ordem,
// com o `mock.module("@/app/api/infra/data/prisma", ...)` de outros arquivos
// rodando no mesmo processo do bun test.
let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let ManagerAccountUsersUseCase: typeof import("@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase").ManagerAccountUsersUseCase
let managerAccountUserRepository: typeof import("@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository").managerAccountUserRepository

if (RUN_INTEGRATION) {
  assertLocalDatabase()

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

  // `getFullUrl` lê NEXT_PUBLIC_APP_URL e roda DENTRO do try de
  // `finalizeUserCreation`, ANTES do generateLink. Num runner sem a variável ele
  // lança, o caminho feliz cai na compensação e o teste falha por ambiente — não
  // por regressão. Passava na minha máquina só porque `bun test` carrega o
  // `.env` do repo, que tem a variável. É exatamente a armadilha que o próprio
  // agents.md descreve em "Teste que não sabe falhar não é verificação".
  mock.module("@/lib/utils/app-url", () => ({
    getFullUrl: (path: string) => `https://example.invalid${path}`,
    getAppUrl: () => "https://example.invalid",
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

  /**
   * Este é o caso que discrimina a transação, e o único.
   *
   * A falha precisa cair ENTRE os dois writes: `assertCapacityAvailable` passa,
   * `profile.create` já rodou, e `teamMember.create` viola a FK
   * `corretor_studio_team_members.teamId -> corretor_studio_teams.id`. Só aí
   * existe algo para reverter.
   *
   * Controle negativo executado com UMA variável (a transação, sem tocar na
   * ordem): trocando `createAccountUserRecords(recordsParams, tx)` por
   * `createAccountUserRecords(recordsParams)` este caso fica VERMELHO com o
   * Profile órfão na mão, e os outros dois seguem VERDES. Esse contraste é a
   * evidência — sem ele, "verde" aqui não significaria nada.
   */
  it("falha ENTRE os dois writes não deixa Profile órfão", async () => {
    const useCase = buildUseCase({})
    const params = buildParams(seed, "fk-orphan")
    params.ctx.teamId = randomUUID() // time inexistente: quebra a FK do segundo write

    await expect(useCase.createAccountUser(params as never)).rejects.toThrow()

    // Assert só por e-mail: filtrar por `seed.teamId` daria zero por vacuidade,
    // já que o teamId usado aqui nem existe.
    const orphan = await prisma.profile.findFirst({
      where: { email: emailFor("fk-orphan") },
      select: { id: true },
    })
    expect(orphan).toBeNull()
  })

  /**
   * NÃO prova atomicidade — prova ORDEM, que é outro invariante.
   *
   * A primeira versão deste teste se chamava "os dois writes são atômicos" e
   * estava errada: `assertCapacityAvailable` roda ANTES de
   * `createAccountUserRecords`, então o throw injetado aqui acontece antes de
   * qualquer INSERT existir. Não há o que reverter, e a asserção é verdadeira
   * por vacuidade — medido: removendo `runInTransaction` e mantendo a ordem, o
   * teste continuava passando com o mesmo número de asserts.
   *
   * O que ele garante de útil: estourar capacidade não chega a tocar o banco.
   */
  it("capacidade estourada aborta antes de qualquer write", async () => {
    const useCase = buildUseCase({
      assertCapacityAvailable: async () => {
        throw new Error("Capacidade esgotada")
      },
    })

    await expect(
      useCase.createAccountUser(buildParams(seed, "sem-write") as never)
    ).rejects.toThrow("Capacidade esgotada")

    const created = await prisma.profile.findFirst({
      where: { email: emailFor("sem-write") },
      select: { id: true },
    })
    expect(created).toBeNull()
  })
})

import { mock } from "bun:test"

/**
 * Fábrica COMPLETA e compartilhada para `mock.module` de
 * `@/app/api/infra/data/prisma`.
 *
 * Por que existe: `mock.module` do Bun é global do processo e o registro que
 * roda PRIMEIRO materializa o namespace do módulo. Sem `--isolate`, um arquivo
 * que registre fábrica PARCIAL (ex.: `{ prisma: {} }`, sem `withPrismaRetry`)
 * congela o namespace incompleto — e o próximo arquivo cujo módulo de
 * produção importe o export omitido morre com
 * `SyntaxError: Export named 'withPrismaRetry' not found`, com o erro
 * aparecendo no arquivo VIZINHO, não no culpado (mesma classe do episódio do
 * claim — nota project-mock-module-partial-factories).
 *
 * Regra: todo arquivo de teste que precise mockar este módulo chama
 * `registerPrismaModuleMock()` e configura comportamento atribuindo métodos em
 * `prismaModuleMock` (objeto mutável compartilhado) — nunca registra uma
 * fábrica própria. A lista de exports abaixo espelha TODOS os exports de
 * valor do módulo real (`app/api/infra/data/prisma.ts`); export novo lá exige
 * atualização aqui.
 */
export const prismaModuleMock: Record<string, unknown> = {}

export function registerPrismaModuleMock(): void {
  mock.module("@/app/api/infra/data/prisma", () => ({
    prisma: prismaModuleMock,
    default: prismaModuleMock,
    withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
    getImportCronPrisma: () => prismaModuleMock,
    getEmailCronPrisma: () => prismaModuleMock,
    resolveQueryLogOptions: () => ({}),
  }))
}

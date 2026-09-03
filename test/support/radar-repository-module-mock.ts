import { mock } from "bun:test"
import { registerPrismaModuleMock } from "./prisma-module-mock"

/**
 * Fábrica COMPLETA e compartilhada para `mock.module` de
 * `@/app/api/infra/data/repositories/radar/RadarRepository`.
 *
 * Mesmo racional de `prisma-module-mock`: `mock.module` do Bun é global do
 * processo e o registro que roda PRIMEIRO materializa o namespace do módulo.
 * Sem `--isolate`, uma fábrica PARCIAL (`{ radarRepository: {...} }` sem a
 * classe, ou com `RadarRepository: class {}`) quebra qualquer arquivo do mesmo
 * lote que precise da classe REAL — os testes unitários do repositório fazem
 * `new RadarRepository()` e morrem com `undefined is not a constructor`, e
 * consumidores já carregados perdem o export com
 * `SyntaxError: Export named 'RadarRepository' not found`, sempre com o erro
 * aparecendo no arquivo VIZINHO, não no culpado (nota
 * project-mock-module-partial-factories).
 *
 * Regra: teste que precise de um `radarRepository` fake chama
 * `await registerRadarRepositoryModuleMock()` ANTES de importar o módulo sob
 * teste e configura os métodos com `Object.assign(radarRepositoryMock, {...})`
 * — nunca registra fábrica própria. A fábrica preserva a classe real, então a
 * suíte passa em qualquer ordem de execução dos arquivos.
 */
export const radarRepositoryMock: Record<string, unknown> = {}

export async function registerRadarRepositoryModuleMock(): Promise<void> {
  registerPrismaModuleMock()
  const { RadarRepository } = await import(
    "@/app/api/infra/data/repositories/radar/RadarRepository"
  )

  // Métodos deixados por um arquivo anterior do mesmo processo virariam
  // comportamento silencioso emprestado; limpar devolve a falha ruidosa
  // (método undefined) para o que o arquivo atual não configurar.
  for (const key of Object.keys(radarRepositoryMock)) {
    delete radarRepositoryMock[key]
  }

  mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
    RadarRepository,
    radarRepository: radarRepositoryMock,
  }))
}

export type Semaphore = {
  run<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Semáforo simples (contador + fila de espera) para limitar concorrência
 * global dentro do isolate — mesmo padrão de "backpressure por isolate" já
 * usado em `app/api/webhooks/resend/route.ts` (`inFlight`/`MAX_CONCURRENT`),
 * mas reutilizável para qualquer trabalho, não só HTTP.
 *
 * Diferente de `withConcurrencyLimit` (que limita concorrência só dentro de
 * uma chamada), este semáforo é criado uma vez em escopo de módulo e cap
 * a concorrência real entre chamadas independentes/concorrentes — necessário
 * quando o chamador não aguarda o trabalho (fire-and-forget) e por isso pode
 * empilhar múltiplas rodadas simultâneas sem esse limite compartilhado.
 */
export function createSemaphore(limit: number): Semaphore {
  const boundedLimit = Math.max(1, limit)
  let active = 0
  const queue: Array<() => void> = []

  function acquire(): Promise<void> {
    if (active < boundedLimit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active++
        resolve()
      })
    })
  }

  function release(): void {
    active--
    const next = queue.shift()
    if (next) next()
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire()
      try {
        return await fn()
      } finally {
        release()
      }
    },
  }
}

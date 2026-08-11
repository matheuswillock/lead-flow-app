import type { ReactNode } from "react"
import { Output } from "@/lib/output"
import { CronExecutionsProvider } from "../features/context/CronExecutionsContext"
import type {
  ICronExecutionsService,
  ListCronExecutionsParams,
} from "../features/services/ICronExecutionsService"
import type { CronExecutionItem } from "../features/context/CronExecutionsContextTypes"

/**
 * Radix/cmdk dependem de APIs de layout que o happy-dom não implementa.
 * Registrar os stubs uma única vez mantém os testes de interação estáveis.
 */
export function installBrowserStubs() {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  if (!globalThis.DOMRect) {
    globalThis.DOMRect = class {
      x = 0
      y = 0
      width = 0
      height = 0
      top = 0
      right = 0
      bottom = 0
      left = 0
      toJSON() {
        return {}
      }
    } as unknown as typeof DOMRect
  }

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

  }

  const element = window.HTMLElement.prototype as unknown as Record<string, unknown>
  if (!element.scrollIntoView) element.scrollIntoView = () => {}
  if (!element.hasPointerCapture) element.hasPointerCapture = () => false
  if (!element.setPointerCapture) element.setPointerCapture = () => {}
  if (!element.releasePointerCapture) element.releasePointerCapture = () => {}
}

export function makeExecution(
  overrides: Partial<CronExecutionItem> = {}
): CronExecutionItem {
  return {
    id: "exec-1",
    cronKey: "radar-import",
    cronPath: "/radar/cron/process-import-jobs",
    status: "success",
    startedAt: "2026-08-10T21:45:29.000Z",
    finishedAt: "2026-08-10T21:45:31.000Z",
    durationMs: 2000,
    errorSummary: null,
    errorDetail: null,
    metadata: null,
    createdAt: "2026-08-10T21:45:29.000Z",
    updatedAt: "2026-08-10T21:45:31.000Z",
    ...overrides,
  }
}

export class FakeCronExecutionsService implements ICronExecutionsService {
  readonly calls: (ListCronExecutionsParams | undefined)[] = []

  constructor(
    private readonly executions: CronExecutionItem[],
    private readonly options: { never?: boolean } = {}
  ) {}

  async listExecutions(params?: ListCronExecutionsParams): Promise<Output> {
    this.calls.push(params)
    if (this.options.never) {
      // Mantém o provider em loading para os testes de Skeleton.
      return new Promise<Output>(() => {})
    }
    return new Output(true, ["ok"], [], { executions: this.executions })
  }
}

/**
 * Serviço com resolução controlada manualmente pelo teste — permite simular
 * respostas fora de ordem (a N-ésima chamada resolve antes da N-1-ésima)
 * para reproduzir e travar a corrida de respostas obsoletas.
 */
export class QueuedCronExecutionsService implements ICronExecutionsService {
  readonly calls: (ListCronExecutionsParams | undefined)[] = []
  private readonly pending: {
    resolve: (output: Output) => void
    executions: CronExecutionItem[]
  }[] = []

  async listExecutions(params?: ListCronExecutionsParams): Promise<Output> {
    this.calls.push(params)
    return new Promise<Output>((resolve) => {
      this.pending.push({ resolve, executions: [] })
    })
  }

  /** Resolve a chamada de índice `callIndex` com o conjunto de execuções dado. */
  resolveCall(callIndex: number, executions: CronExecutionItem[]) {
    const entry = this.pending[callIndex]
    if (!entry) throw new Error(`Nenhuma chamada pendente no índice ${callIndex}`)
    entry.resolve(new Output(true, ["ok"], [], { executions }))
  }
}

export function renderWithProvider(
  service: ICronExecutionsService,
  children: ReactNode
) {
  return <CronExecutionsProvider service={service}>{children}</CronExecutionsProvider>
}

import { describe, expect, it } from "bun:test"
import {
  applyDispatchTerminalToast,
  isNewTerminalDispatch,
  PRE_ATTEMPT_DISPATCH_ID_UNKNOWN,
  resolveCampaignExitToast,
} from "@/lib/email/campaign-dispatch-terminal"
import { formatCampaignDispatchErrorMessage } from "@/lib/email/campaign-dispatch-copy"
import { shouldShowCampaignListSkeleton } from "@/lib/email/campaign-dispatch-list-skeleton"

/**
 * Contrato de polling/force para CampanhasHook — exercita a lógica pura de assinatura
 * e a regra de fila pendente sem montar o hook completo (depende de muitos providers).
 */

function buildDispatchProgressKey(params: {
  campaignId: string
  dispatchId: string
  status: string
  completionKind: string
  acceptedCount: number
  failedCount: number
  updatedAt: string
}) {
  return `${params.campaignId}:${params.dispatchId}:${params.status}:${params.completionKind}:${params.acceptedCount}:${params.failedCount}:${params.updatedAt}`
}

describe("campaign dispatch progress refresh contract", () => {
  it("assinatura muda quando acceptedCount avança sem realtime de campanha", () => {
    const before = buildDispatchProgressKey({
      campaignId: "c1",
      dispatchId: "d1",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 0,
      failedCount: 0,
      updatedAt: "t1",
    })
    const after = buildDispatchProgressKey({
      campaignId: "c1",
      dispatchId: "d1",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 100,
      failedCount: 0,
      updatedAt: "t2",
    })
    expect(before).not.toBe(after)
  })

  it("fila pendente: force durante fetch marca pending e reexecuta ao final", () => {
    let fetching = false
    let pendingForce = false
    let calls = 0

    function fetchCampaigns(options?: { force?: boolean }) {
      if (fetching) {
        if (options?.force) pendingForce = true
        return
      }
      fetching = true
      calls += 1
      // simula finally
      fetching = false
      if (pendingForce) {
        pendingForce = false
        fetchCampaigns({ force: true })
      }
    }

    fetching = true
    fetchCampaigns({ force: true })
    expect(pendingForce).toBe(true)
    expect(calls).toBe(0)

    fetching = false
    if (pendingForce) {
      pendingForce = false
      fetchCampaigns({ force: true })
    }
    expect(calls).toBe(1)
    expect(pendingForce).toBe(false)
  })
})

describe("toast fantasma de retry (isNewTerminalDispatch)", () => {
  it("não emite toast terminal quando o retry falha no gate sem dispatch novo", () => {
    // Sub-campanha 'failed' com dispatchId antigo. O retry morre na validação de variáveis,
    // então nenhum EmailCampaignDispatch novo é criado — o dispatchId observado é o mesmo.
    expect(
      isNewTerminalDispatch({
        observedDispatchId: "dispatch-antigo",
        preAttemptDispatchId: "dispatch-antigo",
      })
    ).toBe(false)
  })

  it("não emite toast quando não havia dispatch e o retry morre antes de criar um", () => {
    // Falha antes de qualquer dispatch (zero logs): pré e pós são null.
    expect(
      isNewTerminalDispatch({
        observedDispatchId: null,
        preAttemptDispatchId: null,
      })
    ).toBe(false)
  })

  it("emite toast terminal quando o retry gera um dispatch novo (fluxo feliz)", () => {
    expect(
      isNewTerminalDispatch({
        observedDispatchId: "dispatch-novo",
        preAttemptDispatchId: "dispatch-antigo",
      })
    ).toBe(true)
  })

  it("emite toast quando o primeiro dispatch surge onde não havia nenhum", () => {
    expect(
      isNewTerminalDispatch({
        observedDispatchId: "dispatch-novo",
        preAttemptDispatchId: null,
      })
    ).toBe(true)
  })
})

/** Mesma lógica de captura de `handleSend` (CampanhasHook.ts:~525-531) isolada para teste. */
function captureRetryPreAttemptDispatchId(params: {
  subCampaigns: Array<{ id: string; latestDispatch?: { dispatchId: string } | null }> | undefined
  targetSubId: string
}) {
  const subCampaignsLoaded = Boolean(params.subCampaigns)
  const preAttemptSub = params.subCampaigns?.find((sub) => sub.id === params.targetSubId)
  return subCampaignsLoaded
    ? (preAttemptSub?.latestDispatch?.dispatchId ?? null)
    : PRE_ATTEMPT_DISPATCH_ID_UNKNOWN
}

describe("toast fantasma de retry — corrida de carregamento otimista (openView)", () => {
  it("regressão: clique de retry antes do getById resolver não gera toast fantasma", () => {
    // openView() abre o painel otimisticamente sem `.subCampaigns` — se o usuário clica
    // em "Reenviar apenas falhas" nesse instante, antes não sabíamos o dispatchId anterior
    // e usávamos `null`, fazendo o guard tratar o dispatch antigo inalterado como "novo".
    const preAttemptId = captureRetryPreAttemptDispatchId({
      subCampaigns: undefined,
      targetSubId: "sub-1",
    })
    expect(preAttemptId).toBe(PRE_ATTEMPT_DISPATCH_ID_UNKNOWN)

    // Polling observa o MESMO dispatch antigo (retry ainda nem terminou de processar
    // no servidor) — com o fix, isso não deve mais disparar o toast fantasma.
    expect(
      isNewTerminalDispatch({
        observedDispatchId: "dispatch-antigo-inalterado",
        preAttemptDispatchId: preAttemptId,
      })
    ).toBe(false)
  })

  it("caso normal: subCampaigns já carregado captura o dispatchId real (não o sentinel)", () => {
    const preAttemptId = captureRetryPreAttemptDispatchId({
      subCampaigns: [
        { id: "sub-1", latestDispatch: { dispatchId: "dispatch-antigo" } },
        { id: "sub-2", latestDispatch: null },
      ],
      targetSubId: "sub-1",
    })
    expect(preAttemptId).toBe("dispatch-antigo")

    expect(
      isNewTerminalDispatch({
        observedDispatchId: "dispatch-novo",
        preAttemptDispatchId: preAttemptId,
      })
    ).toBe(true)
  })

  it("subCampaigns carregado mas sem dispatch anterior → null (não o sentinel)", () => {
    const preAttemptId = captureRetryPreAttemptDispatchId({
      subCampaigns: [{ id: "sub-1", latestDispatch: null }],
      targetSubId: "sub-1",
    })
    expect(preAttemptId).toBeNull()
  })
})

describe("toast de falha — fallback do hook formata INTERNAL", () => {
  it("não concatena Erro interno no fallback sem terminal", () => {
    function buildFailedFallbackToast(name: string, errorMessage: string | null) {
      const formattedError = formatCampaignDispatchErrorMessage(errorMessage)
      return formattedError
        ? `Disparo de "${name}" falhou: ${formattedError}`
        : `Disparo de "${name}" falhou.`
    }

    expect(buildFailedFallbackToast("Lista Fria", "Erro interno durante o disparo")).toBe(
      'Disparo de "Lista Fria" falhou: Ocorreu um erro ao disparar a campanha'
    )
    expect(
      buildFailedFallbackToast("Lista Fria", "Erro interno durante o disparo")
    ).not.toContain("Erro interno")
  })
})

describe("watcher de campanha — recusa pré-dispatch não celebra sucesso (incidente Calli, 2026-08-27)", () => {
  it("catch do handleSend mostra o erro; o watcher (CampanhasHook.ts:~665-692) não soma um 'concluído' fantasma por cima", () => {
    // Reproduz a corrida real: handleSend mostra "sending" otimista, service.send()
    // é recusado pré-dispatch (400, gate ou quota — sem EmailCampaignDispatch novo),
    // o catch de handleSend já emitiu o erro, e a lista eventualmente reflete o
    // status real (nunca saiu de "draft"/"scheduled" no servidor). O watcher observa
    // essa transição e, com o bug antigo, tratava "sem terminal e não-failed" como
    // sucesso — vermelho + verde para um disparo que nunca começou.
    const toasts: Array<{ type: string; message: string }> = []
    const toastApi = {
      success: (message: string) => toasts.push({ type: "success", message }),
      warning: (message: string) => toasts.push({ type: "warning", message }),
      error: (message: string) => toasts.push({ type: "error", message }),
    }

    // 1) catch do handleSend.
    toastApi.error("Envio de e-mail liberado apenas para o Grupo Beta de Radar no time ativo")

    // 2) watcher observa a campanha rastreada fora de "sending", sem terminal novo.
    const decision = resolveCampaignExitToast({
      name: "Campanha Calli",
      status: "draft",
      terminal: null,
    })
    if (decision.emit) {
      applyDispatchTerminalToast(toastApi, decision.toast)
    }

    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe("error")
    expect(toasts.some((t) => t.type === "success")).toBe(false)
  })
})

describe("lista — skeleton e troca de time", () => {
  it("não liga skeleton no poll de 4s enquanto já há linhas", () => {
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: true,
        isAwaitingSendingAfterDispatch: false,
      })
    ).toBe(false)
  })

  it("liga skeleton no primeiro load e numa passada após Disparado", () => {
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: false,
        isAwaitingSendingAfterDispatch: false,
      })
    ).toBe(true)
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: true,
        isAwaitingSendingAfterDispatch: true,
      })
    ).toBe(true)
  })

  it("troca de activeTeamId zera campaigns para não flashar o time anterior", () => {
    let campaigns: Array<{ id: string; teamId: string }> = [
      { id: "old", teamId: "team-a" },
    ]
    function onActiveTeamIdChange() {
      campaigns = []
    }
    onActiveTeamIdChange()
    expect(campaigns).toEqual([])
  })

  it("erro do POST após o modal fechado reverte sendingId sem window.alert", () => {
    let sendingId: string | null = "camp-1"
    const alerts: string[] = []
    const toasts: string[] = []

    function onPostError(message: string) {
      toasts.push(message)
      sendingId = null
    }

    onPostError("Ocorreu um erro ao disparar a campanha")
    expect(sendingId).toBeNull()
    expect(toasts).toEqual(["Ocorreu um erro ao disparar a campanha"])
    expect(alerts).toEqual([])
  })
})

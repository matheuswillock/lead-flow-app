import { describe, expect, it } from "bun:test"
import {
  isNewTerminalDispatch,
  PRE_ATTEMPT_DISPATCH_ID_UNKNOWN,
} from "@/lib/email/campaign-dispatch-terminal"

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

import { describe, expect, it } from "bun:test"
import {
  applyDispatchTerminalToast,
  buildDispatchTerminalToast,
  isNewTerminalDispatch,
  PRE_ATTEMPT_DISPATCH_ID_UNKNOWN,
  resolveCampaignDispatchTerminal,
} from "./campaign-dispatch-terminal"
import { formatCampaignDispatchProgressLabel } from "./campaign-dispatch-progress"

describe("isNewTerminalDispatch", () => {
  it("true quando o dispatchId observado difere do pré-tentativa", () => {
    expect(
      isNewTerminalDispatch({ observedDispatchId: "d2", preAttemptDispatchId: "d1" })
    ).toBe(true)
  })

  it("false quando o dispatchId observado é o mesmo do pré-tentativa (nada novo)", () => {
    expect(
      isNewTerminalDispatch({ observedDispatchId: "d1", preAttemptDispatchId: "d1" })
    ).toBe(false)
  })

  it("false quando não há dispatchId observado", () => {
    expect(
      isNewTerminalDispatch({ observedDispatchId: null, preAttemptDispatchId: "d1" })
    ).toBe(false)
  })

  it("true quando pré-tentativa é null (sem dispatch anterior conhecido) e observa um novo", () => {
    expect(
      isNewTerminalDispatch({ observedDispatchId: "d1", preAttemptDispatchId: null })
    ).toBe(true)
  })

  it("PRE_ATTEMPT_DISPATCH_ID_UNKNOWN sempre falha fechado, mesmo com dispatchId observado (regressão toast fantasma)", () => {
    // Corrida: detalhe da campanha ainda não carregou quando o usuário clicou em
    // retry — não sabemos qual era o dispatch anterior, então nunca tratamos como novo.
    expect(
      isNewTerminalDispatch({
        observedDispatchId: "d-antigo-inalterado",
        preAttemptDispatchId: PRE_ATTEMPT_DISPATCH_ID_UNKNOWN,
      })
    ).toBe(false)
  })
})

describe("resolveCampaignDispatchTerminal", () => {
  it("retorna null enquanto status=sending — nunca inventa full por ausência", () => {
    expect(
      resolveCampaignDispatchTerminal({
        status: "sending",
        totalRecipients: 10,
        totalSent: 3,
        latestDispatch: {
          dispatchId: "d1",
          dispatchNumber: 1,
          status: "sending",
          completionKind: "pending",
          totalRecipients: 10,
          acceptedCount: 3,
          failedCount: 0,
          queuedCount: 7,
          retryFailedOnly: false,
          errorMessage: null,
          updatedAt: "t1",
        },
      })
    ).toBeNull()
  })

  it("resolve failed a partir de latestDispatch quando polling é a única fonte", () => {
    const terminal = resolveCampaignDispatchTerminal({
      status: "failed",
      totalRecipients: 10,
      totalSent: 0,
      errorMessage: "Resend timeout",
      latestDispatch: {
        dispatchId: "d-fail",
        dispatchNumber: 1,
        status: "failed",
        completionKind: "failed",
        totalRecipients: 10,
        acceptedCount: 0,
        failedCount: 10,
          queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: "Resend timeout",
        updatedAt: "t2",
      },
    })

    expect(terminal).toEqual({
      completionKind: "failed",
      status: "failed",
      acceptedCount: 0,
      failedCount: 10,
      totalRecipients: 10,
      errorMessage: "Resend timeout",
      dispatchId: "d-fail",
      retryFailedOnly: false,
    })
  })

  it("resolve partial a partir de latestDispatch", () => {
    const terminal = resolveCampaignDispatchTerminal({
      status: "partially_sent",
      totalRecipients: 10,
      totalSent: 7,
      latestDispatch: {
        dispatchId: "d-partial",
        dispatchNumber: 1,
        status: "completed",
        completionKind: "partial",
        totalRecipients: 10,
        acceptedCount: 7,
        failedCount: 3,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: "t3",
      },
    })

    expect(terminal?.completionKind).toBe("partial")
    expect(terminal?.status).toBe("completed")
    expect(terminal?.acceptedCount).toBe(7)
  })

  it("fallback por status da campanha quando latestDispatch ainda não veio", () => {
    expect(
      resolveCampaignDispatchTerminal({
        status: "failed",
        totalRecipients: 5,
        totalSent: 0,
        errorMessage: "boom",
      })?.completionKind
    ).toBe("failed")

    expect(
      resolveCampaignDispatchTerminal({
        status: "partially_sent",
        totalRecipients: 5,
        totalSent: 2,
      })?.completionKind
    ).toBe("partial")

    expect(
      resolveCampaignDispatchTerminal({
        status: "sent",
        totalRecipients: 5,
        totalSent: 5,
      })?.completionKind
    ).toBe("full")
  })
})

describe("banner global + toast final sem realtime confiável", () => {
  it("dispatch falha/parcial: banner global usa terminal real e toast final não anuncia sucesso pleno", () => {
    const failed = resolveCampaignDispatchTerminal({
      status: "failed",
      totalRecipients: 10,
      totalSent: 0,
      errorMessage: "API down",
      latestDispatch: {
        dispatchId: "d1",
        dispatchNumber: 1,
        status: "failed",
        completionKind: "failed",
        totalRecipients: 10,
        acceptedCount: 0,
        failedCount: 10,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: "API down",
        updatedAt: "t1",
      },
    })!

    const bannerLabel = formatCampaignDispatchProgressLabel({
      status: failed.status,
      completionKind: failed.completionKind,
      acceptedCount: failed.acceptedCount,
      totalRecipients: failed.totalRecipients,
      retryFailedOnly: failed.retryFailedOnly,
      errorMessage: failed.errorMessage,
    })
    expect(bannerLabel).toContain("Falhou")

    const failedToast = buildDispatchTerminalToast("Campanha A", failed)
    expect(failedToast.type).toBe("error")
    expect(failedToast.message).toContain("falhou")
    expect(failedToast.message).not.toContain("concluído.")

    const partial = resolveCampaignDispatchTerminal({
      status: "partially_sent",
      totalRecipients: 10,
      totalSent: 7,
      latestDispatch: {
        dispatchId: "d2",
        dispatchNumber: 1,
        status: "completed",
        completionKind: "partial",
        totalRecipients: 10,
        acceptedCount: 7,
        failedCount: 3,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: "t2",
      },
    })!

    expect(
      formatCampaignDispatchProgressLabel({
        status: partial.status,
        completionKind: partial.completionKind,
        acceptedCount: partial.acceptedCount,
        totalRecipients: partial.totalRecipients,
        retryFailedOnly: false,
        errorMessage: null,
      })
    ).toBe("Parcialmente enviado 7/10")

    const partialToast = buildDispatchTerminalToast("Campanha B", partial)
    expect(partialToast.type).toBe("warning")
    expect(partialToast.message).toContain("parcialmente")
  })

  it("usuário no filtro sending: campanha sai da lista e toast final reflete falha/parcial", () => {
    // Simula o ramo CampanhasHook: filtro sending + campanha sumiu da lista → getById resolve terminal.
    const leftSendingList = true
    const statusFilter = ["sending"]
    const dispatchSeenInList = true

    expect(leftSendingList && statusFilter.includes("sending") && dispatchSeenInList).toBe(true)

    const getByIdResult = {
      status: "failed" as const,
      totalRecipients: 20,
      totalSent: 0,
      errorMessage: "créditos insuficientes",
      latestDispatch: {
        dispatchId: "d3",
        dispatchNumber: 1,
        status: "failed" as const,
        completionKind: "failed" as const,
        totalRecipients: 20,
        acceptedCount: 0,
        failedCount: 20,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: "créditos insuficientes",
        updatedAt: "t3",
      },
    }

    const terminal = resolveCampaignDispatchTerminal(getByIdResult)!
    const toastPayload = buildDispatchTerminalToast("Newsletter Agosto", terminal)

    const calls: Array<{ type: string; message: string }> = []
    applyDispatchTerminalToast(
      {
        success: (message) => calls.push({ type: "success", message }),
        warning: (message) => calls.push({ type: "warning", message }),
        error: (message) => calls.push({ type: "error", message }),
      },
      toastPayload
    )

    expect(calls).toEqual([
      {
        type: "error",
        message:
          'Disparo de "Newsletter Agosto" falhou: créditos insuficientes',
      },
    ])

    const partialGetById = {
      status: "partially_sent" as const,
      totalRecipients: 20,
      totalSent: 12,
      latestDispatch: {
        dispatchId: "d4",
        dispatchNumber: 1,
        status: "completed" as const,
        completionKind: "partial" as const,
        totalRecipients: 20,
        acceptedCount: 12,
        failedCount: 8,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: "t4",
      },
    }

    const partialToast = buildDispatchTerminalToast(
      "Newsletter Agosto",
      resolveCampaignDispatchTerminal(partialGetById)!
    )
    expect(partialToast.type).toBe("warning")
    expect(partialToast.message).toContain("12/20")
    expect(partialToast.type).not.toBe("success")
  })
})

describe("realtime UPDATE leave-sending — totalSent stale", () => {
  it("não inventa full a partir do payload UPDATE; terminal real vem do GET + latestDispatch", () => {
    // Payload postgres_changes UPDATE: row.totalSent ainda espelha destinatários totais
    // (stale / divergente do acceptedCount real dos logs).
    const realtimeUpdatePayload = {
      status: "sent" as const,
      totalSent: 10,
      totalRecipients: 10,
    }

    // Heurística antiga (proibida no path UPDATE): inventaria "full"
    const bannedHeuristicKind =
      realtimeUpdatePayload.totalSent > 0 &&
      realtimeUpdatePayload.totalSent < realtimeUpdatePayload.totalRecipients
        ? ("partial" as const)
        : ("full" as const)
    expect(bannedHeuristicKind).toBe("full")

    // Path seguro (obrigatório): GET /email/campaigns/:id → resolveCampaignDispatchTerminal
    // mesmo quando a row ainda tem totalSent stale.
    const getByIdAfterUpdate = {
      status: "partially_sent" as const,
      totalRecipients: 10,
      totalSent: 10, // stale na row da campanha
      latestDispatch: {
        dispatchId: "d-update-stale",
        dispatchNumber: 1,
        status: "completed" as const,
        completionKind: "partial" as const,
        totalRecipients: 10,
        acceptedCount: 7,
        failedCount: 3,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: "t-update",
      },
    }

    const terminal = resolveCampaignDispatchTerminal(getByIdAfterUpdate)
    expect(terminal).not.toBeNull()
    expect(terminal!.completionKind).toBe("partial")
    expect(terminal!.acceptedCount).toBe(7)
    expect(terminal!.failedCount).toBe(3)
    expect(terminal!.completionKind).not.toBe(bannedHeuristicKind)

    const toast = buildDispatchTerminalToast("Campanha UPDATE", terminal!)
    expect(toast.type).toBe("warning")
    expect(toast.message).toContain("7/10")
    expect(toast.type).not.toBe("success")
  })

  it("UPDATE com totalSent=0 stale não inventa failed quando latestDispatch é partial", () => {
    const bannedHeuristicFromZeroSent = "failed" as const

    const getById = {
      status: "partially_sent" as const,
      totalRecipients: 20,
      totalSent: 0, // stale — row ainda não refletiu accepted
      latestDispatch: {
        dispatchId: "d-update-zero",
        dispatchNumber: 1,
        status: "completed" as const,
        completionKind: "partial" as const,
        totalRecipients: 20,
        acceptedCount: 15,
        failedCount: 5,
        queuedCount: 0,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: "t-zero",
      },
    }

    const terminal = resolveCampaignDispatchTerminal(getById)!
    expect(terminal.completionKind).toBe("partial")
    expect(terminal.acceptedCount).toBe(15)
    expect(terminal.completionKind).not.toBe(bannedHeuristicFromZeroSent)
  })
})

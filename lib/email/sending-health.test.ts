import { describe, expect, it } from "bun:test"
import {
  applySendingHealthReleaseBaseline,
  buildPauseSnapshotFromExisting,
  buildReleaseSnapshotFromExisting,
  classifySendingHealthSeverity,
  computeSendingHealthRates,
  formatDispatchBounceAbortMessage,
  isSendingHealthBlocked,
  parseSendingHealthReleaseBaseline,
  parseSendingHealthSnapshot,
  resolveManualSendingHealthRelease,
  resolveSendingHealthTransition,
  shouldAbortDispatchForBounceSpike,
  SENDING_HEALTH_ABORT_MIN_SENT,
  SENDING_HEALTH_MIN_SENDS_7D,
  SENDING_HEALTH_RELEASE_BASELINE_DAYS,
  type SendingHealthRates,
  type SendingHealthWindowMetrics,
} from "./sending-health"

const NOW = new Date("2026-09-17T12:00:00.000Z")

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function windows(overrides: Partial<SendingHealthWindowMetrics> = {}): SendingHealthWindowMetrics {
  return {
    sent7d: 1000,
    hardBounced7d: 0,
    complained7d: 0,
    sent30d: 4000,
    hardBounced30d: 0,
    complained30d: 0,
    ...overrides,
  }
}

function rates(overrides: Partial<SendingHealthRates> = {}): SendingHealthRates {
  return { hardBounceRate7d: 0, complaintRate7d: 0, hasMinimumVolume: true, ...overrides }
}

describe("computeSendingHealthRates", () => {
  it("calcula taxas sobre a janela de 7d e marca o volume mínimo", () => {
    const result = computeSendingHealthRates(windows({ sent7d: 500, hardBounced7d: 25, complained7d: 1 }))
    expect(result.hardBounceRate7d).toBeCloseTo(0.05)
    expect(result.complaintRate7d).toBeCloseTo(0.002)
    expect(result.hasMinimumVolume).toBe(true)
  })

  it("sem envio: taxas zeradas e sem volume mínimo", () => {
    const result = computeSendingHealthRates(windows({ sent7d: 0, hardBounced7d: 0 }))
    expect(result.hardBounceRate7d).toBe(0)
    expect(result.hasMinimumVolume).toBe(false)
  })

  it(`volume mínimo é ${SENDING_HEALTH_MIN_SENDS_7D} envios/7d`, () => {
    expect(computeSendingHealthRates(windows({ sent7d: SENDING_HEALTH_MIN_SENDS_7D - 1 })).hasMinimumVolume).toBe(false)
    expect(computeSendingHealthRates(windows({ sent7d: SENDING_HEALTH_MIN_SENDS_7D })).hasMinimumVolume).toBe(true)
  })
})

describe("classifySendingHealthSeverity — limiares warn/pause", () => {
  it("bounce ≥2% = warn; ≥5% = pause", () => {
    expect(classifySendingHealthSeverity(rates({ hardBounceRate7d: 0.019 }))).toBe("ok")
    expect(classifySendingHealthSeverity(rates({ hardBounceRate7d: 0.02 }))).toBe("warn")
    expect(classifySendingHealthSeverity(rates({ hardBounceRate7d: 0.049 }))).toBe("warn")
    expect(classifySendingHealthSeverity(rates({ hardBounceRate7d: 0.05 }))).toBe("pause")
  })

  it("complaint ≥0,1% = warn; ≥0,3% = pause", () => {
    expect(classifySendingHealthSeverity(rates({ complaintRate7d: 0.0009 }))).toBe("ok")
    expect(classifySendingHealthSeverity(rates({ complaintRate7d: 0.001 }))).toBe("warn")
    expect(classifySendingHealthSeverity(rates({ complaintRate7d: 0.0029 }))).toBe("warn")
    expect(classifySendingHealthSeverity(rates({ complaintRate7d: 0.003 }))).toBe("pause")
  })

  it("sem volume mínimo, taxa alta NÃO escala — ruído não é sinal", () => {
    expect(
      classifySendingHealthSeverity(
        rates({ hardBounceRate7d: 0.5, hasMinimumVolume: false })
      )
    ).toBe("ok")
  })
})

describe("resolveSendingHealthTransition — máquina de estados", () => {
  it("healthy → paused ao cruzar o limiar de pausa", () => {
    const result = resolveSendingHealthTransition({
      current: "healthy",
      rates: rates({ hardBounceRate7d: 0.06 }),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [],
    })
    expect(result.next).toBe("paused")
    expect(result.changed).toBe(true)
    expect(result.pauseHistory).toHaveLength(1)
    expect(result.reason).toContain("pausado")
  })

  it("2ª pausa dentro de 30 dias escala DIRETO para suspended", () => {
    const result = resolveSendingHealthTransition({
      current: "warned",
      rates: rates({ hardBounceRate7d: 0.06 }),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [daysAgo(10)],
    })
    expect(result.next).toBe("suspended")
    expect(result.pauseHistory).toHaveLength(2)
  })

  it("pausa antiga (fora dos 30 dias) é podada e NÃO suspende", () => {
    const result = resolveSendingHealthTransition({
      current: "healthy",
      rates: rates({ hardBounceRate7d: 0.06 }),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [daysAgo(31)],
    })
    expect(result.next).toBe("paused")
    expect(result.pauseHistory).toHaveLength(1)
  })

  it("healthy → warned ao cruzar o limiar de alerta", () => {
    const result = resolveSendingHealthTransition({
      current: "healthy",
      rates: rates({ hardBounceRate7d: 0.03 }),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [],
    })
    expect(result.next).toBe("warned")
    expect(result.changed).toBe(true)
  })

  it("warned continua warned enquanto acima do warn (histerese) e zera a recuperação", () => {
    const result = resolveSendingHealthTransition({
      current: "warned",
      rates: rates({ hardBounceRate7d: 0.03 }),
      now: NOW,
      belowWarnSince: daysAgo(10),
      pauseHistory: [],
    })
    expect(result.next).toBe("warned")
    expect(result.changed).toBe(false)
    expect(result.belowWarnSince).toBeNull()
  })

  it("warned abaixo do warn INICIA a contagem de recuperação, sem transicionar", () => {
    const result = resolveSendingHealthTransition({
      current: "warned",
      rates: rates(),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [],
    })
    expect(result.next).toBe("warned")
    expect(result.changed).toBe(false)
    expect(result.belowWarnSince?.getTime()).toBe(NOW.getTime())
  })

  it("warned → healthy após 14 dias contínuos abaixo do warn", () => {
    const result = resolveSendingHealthTransition({
      current: "warned",
      rates: rates(),
      now: NOW,
      belowWarnSince: daysAgo(14),
      pauseHistory: [],
    })
    expect(result.next).toBe("healthy")
    expect(result.changed).toBe(true)
  })

  it("warned com 13 dias abaixo do warn ainda NÃO recupera", () => {
    const result = resolveSendingHealthTransition({
      current: "warned",
      rates: rates(),
      now: NOW,
      belowWarnSince: daysAgo(13),
      pauseHistory: [],
    })
    expect(result.next).toBe("warned")
    expect(result.changed).toBe(false)
  })

  it("paused NUNCA sai sozinho — nem com taxas limpas", () => {
    const result = resolveSendingHealthTransition({
      current: "paused",
      rates: rates(),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [daysAgo(2)],
    })
    expect(result.next).toBe("paused")
    expect(result.changed).toBe(false)
  })

  it("suspended NUNCA sai sozinho", () => {
    const result = resolveSendingHealthTransition({
      current: "suspended",
      rates: rates(),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: [daysAgo(2), daysAgo(1)],
    })
    expect(result.next).toBe("suspended")
    expect(result.changed).toBe(false)
  })
})

describe("resolveManualSendingHealthRelease — liberação manual", () => {
  it("paused: owner do time libera para warned", () => {
    const result = resolveManualSendingHealthRelease({ current: "paused", actor: "team_owner" })
    expect(result).toMatchObject({ ok: true, next: "warned" })
  })

  it("suspended: owner NÃO libera — só backoffice", () => {
    expect(
      resolveManualSendingHealthRelease({ current: "suspended", actor: "team_owner" }).ok
    ).toBe(false)
    expect(
      resolveManualSendingHealthRelease({ current: "suspended", actor: "backoffice" })
    ).toMatchObject({ ok: true, next: "warned" })
  })

  it("healthy/warned: nada a liberar", () => {
    expect(resolveManualSendingHealthRelease({ current: "healthy", actor: "backoffice" }).ok).toBe(false)
    expect(resolveManualSendingHealthRelease({ current: "warned", actor: "team_owner" }).ok).toBe(false)
  })
})

describe("shouldAbortDispatchForBounceSpike — abort mid-send", () => {
  it(`exige ≥${SENDING_HEALTH_ABORT_MIN_SENT} enviados — abaixo disso nunca aborta`, () => {
    expect(
      shouldAbortDispatchForBounceSpike({ sentCount: SENDING_HEALTH_ABORT_MIN_SENT - 1, hardBouncedCount: 50 })
    ).toBe(false)
  })

  it("aborta em exatamente 8% com 100 enviados", () => {
    expect(shouldAbortDispatchForBounceSpike({ sentCount: 100, hardBouncedCount: 8 })).toBe(true)
    expect(shouldAbortDispatchForBounceSpike({ sentCount: 100, hardBouncedCount: 7 })).toBe(false)
  })

  it("mensagem de abort declara taxa, volume e a pausa do time", () => {
    const message = formatDispatchBounceAbortMessage({
      hardBounceRate: 0.125,
      sentCount: 160,
      hardBouncedCount: 20,
    })
    expect(message).toContain("abortado por taxa de bounce")
    expect(message).toContain("160")
    expect(message).toContain("pausado")
  })
})

describe("isSendingHealthBlocked", () => {
  it("bloqueia paused e suspended; libera healthy, warned e ausente", () => {
    expect(isSendingHealthBlocked("paused")).toBe(true)
    expect(isSendingHealthBlocked("suspended")).toBe(true)
    expect(isSendingHealthBlocked("healthy")).toBe(false)
    expect(isSendingHealthBlocked("warned")).toBe(false)
    expect(isSendingHealthBlocked(null)).toBe(false)
    expect(isSendingHealthBlocked(undefined)).toBe(false)
  })
})

describe("buildPauseSnapshotFromExisting — pausa fora do cron", () => {
  it("preserva histórico dentro da janela e acrescenta a pausa atual", () => {
    const existing = {
      computedAt: daysAgo(1).toISOString(),
      windows: windows({ sent7d: 300, hardBounced7d: 30 }),
      rates: { hardBounceRate7d: 0.1, complaintRate7d: 0, hasMinimumVolume: true },
      belowWarnSince: null,
      pauseHistory: [daysAgo(5).toISOString(), daysAgo(40).toISOString()],
    }
    const { snapshot, pauseCount } = buildPauseSnapshotFromExisting(existing, NOW)
    // A de 40 dias sai; a de 5 dias fica; a de agora entra.
    expect(pauseCount).toBe(2)
    expect(snapshot.pauseHistory).toHaveLength(2)
    expect(snapshot.windows.sent7d).toBe(300)
    expect(snapshot.belowWarnSince).toBeNull()
  })

  it("JSON ausente/deformado: começa histórico novo com a pausa atual", () => {
    const { snapshot, pauseCount } = buildPauseSnapshotFromExisting(null, NOW)
    expect(pauseCount).toBe(1)
    expect(snapshot.windows.sent7d).toBe(0)
  })
})

describe("baseline de liberação — o incidente não pode ser contado duas vezes", () => {
  const incidentWindows = windows({ sent7d: 1000, hardBounced7d: 80 })

  function releasedSnapshot(releasedAt: Date) {
    return buildReleaseSnapshotFromExisting(
      {
        computedAt: releasedAt.toISOString(),
        windows: incidentWindows,
        rates: computeSendingHealthRates(incidentWindows),
        belowWarnSince: null,
        pauseHistory: [daysAgo(1).toISOString()],
      },
      releasedAt
    )
  }

  it("grava a marca de água com as janelas do instante da liberação", () => {
    const snapshot = releasedSnapshot(NOW)
    expect(snapshot.releaseBaseline?.at).toBe(NOW.toISOString())
    expect(snapshot.releaseBaseline?.windows.hardBounced7d).toBe(80)
    // A pausa liberada CONTINUA no histórico: 2 pausas em 30 dias ainda
    // suspendem — desde que a segunda venha de envio novo.
    expect(snapshot.pauseHistory).toHaveLength(1)
  })

  it("REGRESSÃO: logo após liberar, a MESMA janela não repausa o time", () => {
    const releasedAt = daysAgo(0.01)
    const parsed = parseSendingHealthSnapshot(releasedSnapshot(releasedAt))
    const applied = applySendingHealthReleaseBaseline({
      windows: incidentWindows,
      baseline: parsed.releaseBaseline,
      now: NOW,
    })
    // Janela líquida zerada ⇒ sem volume mínimo ⇒ severidade `ok`.
    expect(applied.windows.sent7d).toBe(0)
    expect(applied.windows.hardBounced7d).toBe(0)

    const transition = resolveSendingHealthTransition({
      current: "warned",
      rates: computeSendingHealthRates(applied.windows),
      now: NOW,
      belowWarnSince: parsed.belowWarnSince,
      pauseHistory: parsed.pauseHistory,
    })
    expect(transition.next).not.toBe("suspended")
    expect(transition.next).not.toBe("paused")
    expect(transition.pauseHistory).toHaveLength(1)
  })

  it("envio NOVO e ruim depois da liberação repausa — e suspende (2ª pausa em 30d)", () => {
    const releasedAt = daysAgo(1)
    const parsed = parseSendingHealthSnapshot(releasedSnapshot(releasedAt))
    // +400 envios novos com 40 hard bounces = 10% na janela líquida.
    const afterRelease = windows({ sent7d: 1400, hardBounced7d: 120 })
    const applied = applySendingHealthReleaseBaseline({
      windows: afterRelease,
      baseline: parsed.releaseBaseline,
      now: NOW,
    })
    expect(applied.windows.sent7d).toBe(400)
    expect(applied.windows.hardBounced7d).toBe(40)

    const transition = resolveSendingHealthTransition({
      current: "warned",
      rates: computeSendingHealthRates(applied.windows),
      now: NOW,
      belowWarnSince: null,
      pauseHistory: parsed.pauseHistory,
    })
    expect(transition.next).toBe("suspended")
  })

  it(`o baseline expira em ${SENDING_HEALTH_RELEASE_BASELINE_DAYS} dias — depois a janela crua volta a valer`, () => {
    const baseline = {
      at: daysAgo(SENDING_HEALTH_RELEASE_BASELINE_DAYS).toISOString(),
      windows: incidentWindows,
    }
    const applied = applySendingHealthReleaseBaseline({
      windows: incidentWindows,
      baseline,
      now: NOW,
    })
    expect(applied.baseline).toBeNull()
    expect(applied.windows.sent7d).toBe(1000)
  })

  it("uma pausa nova apaga o baseline anterior", () => {
    const { snapshot } = buildPauseSnapshotFromExisting(releasedSnapshot(daysAgo(1)), NOW)
    expect(snapshot.releaseBaseline).toBeNull()
  })

  it("JSON sem baseline: parse devolve null e a janela passa intacta", () => {
    expect(parseSendingHealthSnapshot({ pauseHistory: [] }).releaseBaseline).toBeNull()
    expect(parseSendingHealthReleaseBaseline(null)).toBeNull()
    expect(parseSendingHealthReleaseBaseline({ releaseBaseline: { at: "nao-e-data" } })).toBeNull()
    const applied = applySendingHealthReleaseBaseline({
      windows: incidentWindows,
      baseline: null,
      now: NOW,
    })
    expect(applied.windows).toEqual(incidentWindows)
  })
})

import { parseCurrencyBR } from "./masks"
import type { PublicFormSnapshot } from "./types"

export type SimulationPrice = {
  op: string
  novo: number
  eco: number
  ecoA: number
  pct: number
  novoFmt: string
  ecoFmt: string
  ecoAFmt: string
}

export type SimulationResult = {
  firstName: string
  reajustePct: number
  tempoLabel: string
  prices: SimulationPrice[]
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function answerByMapping(
  snapshot: PublicFormSnapshot,
  answers: Record<string, unknown>,
  mappingKey: string,
) {
  const question = snapshot.questions.find(
    (item) => item.mappingTarget === "native_field" && item.mappingKey === mappingKey,
  )
  if (!question) return undefined
  return answers[question.id]
}

function answerByType(snapshot: PublicFormSnapshot, answers: Record<string, unknown>, type: string) {
  const question = snapshot.questions.find((item) => item.type === type)
  if (!question) return undefined
  return answers[question.id]
}

function calcReajuste(tempo: string | undefined) {
  const mapa: Record<string, number> = {
    "Menos de 1 ano": 0.5,
    "1 a 2 anos": 1.5,
    "2 a 4 anos": 3,
    "Mais de 4 anos": 5,
  }
  const anos = mapa[tempo ?? ""] ?? 1
  return Math.round((Math.pow(1.16, anos) - 1) * 100)
}

function getOperadoras(vidas: number, valor: number, atual: string) {
  const atualLower = atual.toLowerCase()
  let pool: string[] = []
  if (vidas === 1) {
    pool = ["Alice", "Hapvida"]
  } else if (vidas === 2) {
    pool = ["Alice", "Amil", "Hapvida"]
    if (valor > 10000) pool.push("Omint")
  } else {
    pool = ["Alice", "Amil", "Bradesco", "Hapvida", "Porto Seguro", "SulAmérica"]
  }
  pool = pool.filter((op) => op.toLowerCase() !== atualLower)
  if (valor >= 1200) pool = pool.filter((op) => op !== "Hapvida")
  return pool.slice(0, 3)
}

export function runHealthPlanSimulation(
  snapshot: PublicFormSnapshot,
  answers: Record<string, unknown>,
): SimulationResult {
  const nome = String(answerByMapping(snapshot, answers, "name") ?? "Cliente")
  const firstName = nome.trim().split(/\s+/)[0] || "Cliente"
  const valorRaw = answerByMapping(snapshot, answers, "currentValue")
  const valor =
    typeof valorRaw === "number"
      ? valorRaw
      : parseCurrencyBR(String(valorRaw ?? answerByType(snapshot, answers, "currency") ?? "0"))
  const operadora = String(
    answerByMapping(snapshot, answers, "currentHealthPlan") ??
      answerByType(snapshot, answers, "health_plan") ??
      "",
  )
  const tempoQuestion = snapshot.questions.find(
    (item) =>
      item.type === "single_choice" &&
      item.options.some((option) => option.label.includes("ano") || option.value.includes("ano")),
  )
  const tempo = tempoQuestion ? String(answers[tempoQuestion.id] ?? "") : ""
  const idadeRaw = answerByMapping(snapshot, answers, "age")
  let vidas = 1
  if (typeof idadeRaw === "string" && idadeRaw.includes(",")) {
    vidas = idadeRaw.split(",").filter(Boolean).length || 1
  } else if (Array.isArray(idadeRaw)) {
    vidas = idadeRaw.length || 1
  }

  const ops = getOperadoras(vidas, valor, operadora)
  const prices = ops.map((op, i) => {
    const pct = i === 0 ? 0.38 : i === 1 ? 0.34 : 0.3
    const eco = valor * pct
    const novo = valor - eco
    return {
      op,
      novo,
      eco,
      ecoA: eco * 12,
      pct: Math.round(pct * 100),
      novoFmt: fmtBRL(novo),
      ecoFmt: fmtBRL(eco),
      ecoAFmt: fmtBRL(eco * 12),
    }
  })

  const tempoLabelMap: Record<string, string> = {
    "Menos de 1 ano": "cerca de 6 meses",
    "1 a 2 anos": "aproximadamente 1,5 anos",
    "2 a 4 anos": "cerca de 3 anos",
    "Mais de 4 anos": "mais de 4 anos",
  }

  return {
    firstName,
    reajustePct: calcReajuste(tempo),
    tempoLabel: tempoLabelMap[tempo] ?? "seu tempo",
    prices,
  }
}

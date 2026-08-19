"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, ArrowRight, CalendarIcon, Check, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { resolveVisibleQuestionIds, resolveThankYouPageId, shouldGoToThankYou, validateAnswer } from "@/lib/public-forms/engine"
import { normalizeThankYouPages, resolveThankYouPage } from "@/lib/public-forms/thank-you-pages"
import { formatCurrencyBR, formatPhoneBR } from "@/lib/public-forms/masks"
import { resolvePublicFormAutocompleteAttrs } from "@/lib/public-forms/autocomplete"
import { readFormSessionCookie, writeFormSessionCookie } from "@/lib/public-forms/session-cookie"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { SimulationResult } from "@/lib/public-forms/simulation"
import { runHealthPlanSimulation } from "@/lib/public-forms/simulation"
import type {
  PublicFormMetricEventInput,
  PublicFormSnapshot,
  PublicFormSuccessAction,
  PublicFormThemeColors,
} from "@/lib/public-forms/types"
import {
  buildPublicFormSubmitRequestKey,
} from "@/lib/public-forms/metric-keys"
import { cn } from "@/lib/utils"

type PublicQuestion = PublicFormSnapshot["questions"][number]
type SchedulingAnswer = {
  date?: string
  time?: string
  startsAt?: string
}

type Props = {
  snapshot: PublicFormSnapshot
  publicId?: string
  preview?: boolean
  className?: string
}

function getOrigin() {
  const params = new URLSearchParams(window.location.search)
  const emailLogId = params.get("cs_el")
  return {
    source: params.get("utm_source") ?? (emailLogId ? "email_campaign" : "direct"),
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    emailLogId: emailLogId || undefined,
    campaignId: params.get("campaign_id") || undefined,
    landingUrl: window.location.href,
    referrer: document.referrer,
  }
}

const DEFAULT_THEME: PublicFormThemeColors = {
  backgroundColor: "#FFFFFF",
  textColor: "#18181B",
  lineColor: "#E4E4E7",
  accentColor: "#FF6900",
  buttonTextColor: "#FFFFFF",
  inputBackgroundColor: "#FFFFFF",
}

function resolveTheme(theme: PublicFormSnapshot["theme"]): PublicFormThemeColors {
  return {
    backgroundColor: theme.backgroundColor || DEFAULT_THEME.backgroundColor,
    textColor: theme.textColor || DEFAULT_THEME.textColor,
    lineColor: theme.lineColor || DEFAULT_THEME.lineColor,
    accentColor: theme.accentColor || DEFAULT_THEME.accentColor,
    buttonTextColor: theme.buttonTextColor || DEFAULT_THEME.buttonTextColor,
    inputBackgroundColor: theme.inputBackgroundColor || DEFAULT_THEME.inputBackgroundColor,
  }
}

function buildWhatsAppUrl(action: PublicFormSuccessAction): string {
  const phone = (action.whatsappPhone ?? "").replace(/\D/g, "")
  const text = action.whatsappMessage?.trim()
  const query = text ? `?text=${encodeURIComponent(text)}` : ""
  return `https://wa.me/${phone}${query}`
}

function runSuccessAction(action: PublicFormSuccessAction) {
  switch (action.type) {
    case "link": {
      if (action.url) window.open(action.url, "_blank", "noopener,noreferrer")
      return
    }
    case "whatsapp": {
      window.open(buildWhatsAppUrl(action), "_blank", "noopener,noreferrer")
      return
    }
    case "close": {
      window.close()
      window.history.back()
      return
    }
    default: {
      const _exhaustive: never = action.type
      return _exhaustive
    }
  }
}

export function PublicFormRenderer({ snapshot, publicId, preview = false, className }: Props) {
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [resolvedThankYouPageId, setResolvedThankYouPageId] = useState<string | null>(null)
  const [session, setSession] = useState<string | null>(null)
  const [phase, setPhase] = useState<"form" | "loading" | "result" | "agenda">("form")
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const previousVisibleIds = useRef<string[]>([])
  const submitLockRef = useRef(false)

  const answerList = useMemo(
    () => Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
    [answers],
  )
  const visibleIds = useMemo(
    () => resolveVisibleQuestionIds(snapshot, answerList),
    [snapshot, answerList],
  )
  const visibleIdsKey = useMemo(() => visibleIds.join("\0"), [visibleIds])
  const questions = useMemo(
    () =>
      visibleIds
        .map((id) => snapshot.questions.find((question) => question.id === id))
        .filter((question): question is PublicQuestion => Boolean(question)),
    [visibleIds, snapshot.questions],
  )
  const pages = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, PublicQuestion[]>()
    for (const question of questions) {
      const pageKey =
        typeof question.config?.pageKey === "string" && question.config.pageKey
          ? question.config.pageKey
          : question.id
      if (!map.has(pageKey)) {
        order.push(pageKey)
        map.set(pageKey, [])
      }
      map.get(pageKey)!.push(question)
    }
    return order.map((pageKey) => map.get(pageKey)!)
  }, [questions])
  const pageQuestions = pages[Math.min(index, Math.max(0, pages.length - 1))] ?? []
  const pageHasScheduling = pageQuestions.some((item) => item.type === "scheduling")
  const pageQuestionsKey = useMemo(
    () => pageQuestions.map((item) => item.id).join("\0"),
    [pageQuestions],
  )
  const pageIsValid = useMemo(
    () => pageQuestions.every((item) => !validateAnswer(item, answers[item.id])),
    [pageQuestions, answers],
  )
  const isSimulator = snapshot.formKind === "health_plan_simulator"
  const hasCalculationQuestion = snapshot.questions.some((item) => item.type === "calculation")
  const normalizedSnapshot = useMemo(() => normalizeThankYouPages(snapshot), [snapshot])
  const thankYouPage = useMemo(
    () => resolveThankYouPage(normalizedSnapshot, resolvedThankYouPageId),
    [normalizedSnapshot, resolvedThankYouPageId],
  )
  const simulationThankYouPage = useMemo(
    () =>
      normalizedSnapshot.thankYouPages.find((page) => page.kind === "simulation") ??
      thankYouPage,
    [normalizedSnapshot.thankYouPages, thankYouPage],
  )
  const coverHighlights =
    Array.isArray(snapshot.coverHighlights) && snapshot.coverHighlights.length > 0
      ? snapshot.coverHighlights
      : null
  const coverBadge = snapshot.coverBadge?.trim() || (isSimulator ? "Simulador gratuito" : null)

  useEffect(() => {
    if (preview || !publicId) return
    const existing = readFormSessionCookie(publicId)
    const id = existing ?? crypto.randomUUID()
    writeFormSessionCookie(publicId, id)
    setSession(id)
  }, [preview, publicId])

  useEffect(() => {
    if (preview || !publicId) return
    const emailLogId = new URLSearchParams(window.location.search).get("cs_el")?.trim()
    if (!emailLogId) return

    void fetch(
      `${API_CLIENT_BASE}/public-forms/${publicId}/prefill?cs_el=${encodeURIComponent(emailLogId)}`,
    )
      .then((res) => res.json())
      .then((data: { isValid?: boolean; result?: { name: string | null; email: string | null } }) => {
        if (!data?.isValid || !data?.result) return
        const { name, email } = data.result
        setAnswers((current) => {
          const next = { ...current }
          for (const question of snapshot.questions) {
            if (question.mappingKey === "name" && name && !current[question.id]) {
              next[question.id] = name
            }
            if (question.mappingKey === "email" && email && !current[question.id]) {
              next[question.id] = email
            }
          }
          return next
        })
      })
      .catch(() => {})
  }, [preview, publicId, snapshot.questions])

  const track = useCallback(
    (eventType: PublicFormMetricEventInput["eventType"], questionId?: string) => {
      if (preview || !publicId || !session) return
      const body = JSON.stringify({
        visitorSessionId: session,
        eventType,
        questionId,
        eventKey: `${session}:${eventType}:${questionId ?? "form"}`,
        origin: getOrigin(),
      })
      const url = `${API_CLIENT_BASE}/public-forms/${publicId}/events`
      if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) {
        return
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
    },
    [preview, publicId, session],
  )

  useEffect(() => {
    if (session) track("form_viewed")
  }, [session, track])

  useEffect(() => {
    if (!started || !pageQuestionsKey) return
    for (const questionId of pageQuestionsKey.split("\0")) {
      track("question_viewed", questionId)
    }
  }, [started, pageQuestionsKey, track])

  useEffect(() => {
    if (!started) {
      previousVisibleIds.current = visibleIds
      return
    }
    const previousKey = previousVisibleIds.current.join("\0")
    if (previousKey === visibleIdsKey) return

    const next = new Set(visibleIds)
    for (const questionId of previousVisibleIds.current) {
      if (!next.has(questionId)) track("question_skipped", questionId)
    }
    previousVisibleIds.current = visibleIds
    setAnswers((current) => {
      let removed = false
      const pruned: Record<string, unknown> = {}
      for (const [questionId, value] of Object.entries(current)) {
        if (next.has(questionId)) pruned[questionId] = value
        else removed = true
      }
      if (!removed && Object.keys(pruned).length === Object.keys(current).length) {
        return current
      }
      return pruned
    })
    setIndex((current) => Math.min(current, Math.max(0, pages.length - 1)))
  }, [started, track, visibleIds, visibleIdsKey, pages.length])

  useEffect(() => {
    if (!started || phase !== "form") return
    if (!pageQuestions.some((item) => item.type === "calculation")) return
    void runSimulationFlow()
  }, [started, phase, pageQuestionsKey])

  const saveProgress = useCallback(async () => {
    if (preview || !publicId || !session) return
    await fetch(`${API_CLIENT_BASE}/public-forms/${publicId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorSessionId: session,
        answers: answerList,
        origin: getOrigin(),
      }),
      keepalive: true,
    })
  }, [answerList, preview, publicId, session])

  const sendBlurProgress = useCallback(
    (questionId: string, value: unknown) => {
      if (preview || !publicId || !session) return
      void fetch(`${API_CLIENT_BASE}/public-forms/${publicId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorSessionId: session,
          answers: [{ questionId, value }],
          origin: getOrigin(),
        }),
        keepalive: true,
      })
    },
    [preview, publicId, session],
  )

  function start() {
    previousVisibleIds.current = visibleIds
    setStarted(true)
    track("form_started")
  }

  async function goNext() {
    if (!pageQuestions.length) return
    for (const item of pageQuestions) {
      const validationError = validateAnswer(item, answers[item.id])
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setError(null)
    for (const item of pageQuestions) {
      track("question_answered", item.id)
    }
    try {
      await saveProgress()
    } catch (error) {
      console.error("[PublicFormRenderer][goNext] Falha ao salvar progresso", error)
    }
    if (shouldGoToThankYou(snapshot, answerList)) {
      await submit()
      return
    }
    if (pageQuestions.some((item) => item.type === "calculation")) {
      void runSimulationFlow()
      return
    }
    if (index < pages.length - 1) {
      const pagesAhead = pages.slice(index + 1)
      const onlySchedulingAhead = pagesAhead.every((page) =>
        page.every((item) => item.type === "scheduling"),
      )
      if (hasCalculationQuestion && phase === "form" && onlySchedulingAhead) {
        void runSimulationFlow()
        return
      }
      setIndex(index + 1)
      return
    }
    if (
      hasCalculationQuestion &&
      phase === "form" &&
      !pageQuestions.some((item) => item.type === "scheduling")
    ) {
      void runSimulationFlow()
      return
    }
    await submit()
  }

  async function runSimulationFlow() {
    setPhase("loading")
    await new Promise((resolve) => setTimeout(resolve, 2800))
    const result = runHealthPlanSimulation(snapshot, answers)
    setSimulationResult(result)
    setPhase("result")
  }

  async function submit() {
    if (preview) {
      setDone(true)
      return
    }
    if (!publicId || !session) return
    if (sending || done || submitLockRef.current) return
    submitLockRef.current = true
    const scheduleAnswer = snapshot.questions
      .filter((item) => item.type === "scheduling")
      .map((item) => answers[item.id] as SchedulingAnswer | undefined)
      .find((item) => item?.startsAt)

    setSending(true)
    const thankYouPageId = resolveThankYouPageId(snapshot, answerList)
    setResolvedThankYouPageId(thankYouPageId)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/public-forms/${publicId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: buildPublicFormSubmitRequestKey(session),
          answers: answerList,
          origin: getOrigin(),
          visitorSessionId: session,
          thankYouPageId: thankYouPageId ?? undefined,
          scheduling: scheduleAnswer?.startsAt
            ? { startsAt: scheduleAnswer.startsAt }
            : undefined,
        }),
      })
      const output = await response.json()
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join("; ") || "Não foi possível enviar")
      }
      setDone(true)
    } catch (submitError) {
      submitLockRef.current = false
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar suas respostas",
      )
    } finally {
      setSending(false)
    }
  }

  const theme = resolveTheme(snapshot.theme)
  const progressValue =
    phase === "result" || phase === "agenda"
      ? 100
      : ((index + 1) / Math.max(pages.length, 1)) * 100
  const successActions = thankYouPage.actions ?? []
  const resultTitle = (title: string, firstName: string) =>
    title.replaceAll("{firstName}", firstName)

  return (
    <div
      className={cn(
        "public-form-page light flex w-full flex-col justify-center bg-background text-foreground [color-scheme:light]",
        className ?? "min-h-[60dvh]",
      )}
      style={
        {
          "--form-background": theme.backgroundColor,
          "--form-text": theme.textColor,
          "--form-line": theme.lineColor,
          "--form-accent": theme.accentColor,
          "--form-button-text": theme.buttonTextColor,
          "--form-input-bg": theme.inputBackgroundColor,
          backgroundColor: "var(--form-background)",
          color: "var(--form-text)",
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-[60dvh] w-full max-w-[580px] flex-col overflow-hidden rounded-3xl border border-[color-mix(in_oklab,var(--form-line)_80%,transparent)] bg-[var(--form-input-bg)] text-[var(--form-text)] shadow-[0_8px_48px_color-mix(in_oklab,var(--form-accent)_12%,transparent)]">
        <div className="h-1 bg-muted">
          <div
            className="h-full transition-[width] duration-500 motion-reduce:transition-none"
            style={{
              width: `${started || phase !== "form" ? progressValue : 0}%`,
              backgroundColor: "var(--form-accent)",
            }}
          />
        </div>
        <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 sm:p-10">
          {done ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 text-center motion-reduce:animate-none">
              <div
                className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-[var(--form-line)]"
                style={{ backgroundColor: "color-mix(in oklab, var(--form-accent) 12%, transparent)" }}
              >
                <Check aria-hidden="true" style={{ color: "var(--form-accent)" }} />
              </div>
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                {thankYouPage.title}
              </h1>
              {thankYouPage.description ? (
                <p className="mt-3 text-pretty text-muted-foreground">
                  {thankYouPage.description}
                </p>
              ) : null}
              {thankYouPage.kind === "simulation" && simulationResult ? (
                <div className="mt-6 flex flex-col gap-5 text-left">
                  {simulationResult.prices.map((price, priceIndex) => (
                    <div
                      key={price.op}
                      className={cn(
                        "relative rounded-2xl border p-4",
                        priceIndex === 0
                          ? "border-primary bg-primary/5"
                          : "border-[var(--form-line)]",
                      )}
                    >
                      {priceIndex === 0 ? (
                        <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          Melhor opção
                        </span>
                      ) : null}
                      <p className="mb-3 font-semibold">{price.op}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {successActions.length > 0 ? (
                <div className="mt-8 flex flex-col gap-3">
                  {successActions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      className="w-full"
                      style={{
                        backgroundColor: "var(--form-accent)",
                        color: "var(--form-button-text)",
                      }}
                      onClick={() => runSuccessAction(action)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : phase === "loading" ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando seu plano atual...</p>
            </div>
          ) : phase === "result" && simulationResult ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <h2 className="text-xl font-semibold">
                  {resultTitle(
                    simulationThankYouPage.title,
                    simulationResult.firstName,
                  )}
                </h2>
                {simulationThankYouPage.description ? (
                  <p className="mt-2 text-sm opacity-90">
                    {resultTitle(simulationThankYouPage.description, simulationResult.firstName)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm opacity-90">
                    Em {simulationResult.tempoLabel} no plano, você acumulou em média{" "}
                    <span className="font-semibold">{simulationResult.reajustePct}% de reajuste</span>.
                  </p>
                )}
              </div>
              {simulationResult.prices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Com seu perfil, recomendamos uma análise personalizada com nosso especialista.
                </p>
              ) : (
                simulationResult.prices.map((price, priceIndex) => (
                  <div
                    key={price.op}
                    className={cn(
                      "relative rounded-2xl border p-4",
                      priceIndex === 0
                        ? "border-primary bg-primary/5"
                        : "border-[var(--form-line)]",
                    )}
                  >
                    {priceIndex === 0 ? (
                      <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        Melhor opção
                      </span>
                    ) : null}
                    <p className="mb-3 font-semibold">{price.op}</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="font-semibold text-primary">R$ {price.novoFmt}</p>
                        <p className="text-[10px] text-muted-foreground">Mensalidade est.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">R$ {price.ecoFmt}</p>
                        <p className="text-[10px] text-muted-foreground">Economia/mês</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">R$ {price.ecoAFmt}</p>
                        <p className="text-[10px] text-muted-foreground">Economia/ano</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <p className="text-[11px] text-muted-foreground">
                Os valores são estimativas baseadas em médias de mercado e podem variar.
              </p>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                {simulationThankYouPage.actions[0] ? (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => {
                      const action = simulationThankYouPage.actions[0]!
                      if (action.type === "close") {
                        const scheduleIndex = pages.findIndex((page) =>
                          page.some((item) => item.type === "scheduling"),
                        )
                        if (scheduleIndex >= 0) {
                          setIndex(scheduleIndex)
                          setPhase("form")
                          return
                        }
                      }
                      runSuccessAction(action)
                    }}
                  >
                    {simulationThankYouPage.actions[0].label}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                ) : (
                  <>
                    <h3 className="font-semibold">Quero garantir essa economia!</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Agende uma reunião gratuita com nosso especialista.
                    </p>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => {
                        const scheduleIndex = pages.findIndex((page) =>
                          page.some((item) => item.type === "scheduling"),
                        )
                        if (scheduleIndex >= 0) {
                          setIndex(scheduleIndex)
                          setPhase("form")
                          return
                        }
                        void submit()
                      }}
                    >
                      Agendar reunião gratuita
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : !started ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
              {coverBadge ? (
                <span
                  className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
                  style={{
                    borderColor: "color-mix(in oklab, var(--form-accent) 20%, transparent)",
                    backgroundColor: "color-mix(in oklab, var(--form-accent) 10%, transparent)",
                    color: "var(--form-accent)",
                  }}
                >
                  {coverBadge}
                </span>
              ) : null}
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {snapshot.coverTitle?.trim() || "Formulário"}
              </h1>
              {snapshot.coverDescription?.trim() ? (
                <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                  {snapshot.coverDescription}
                </p>
              ) : null}
              {coverHighlights ? (
                <div className="mt-8 grid grid-cols-3 gap-3">
                  {coverHighlights.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: "color-mix(in oklab, var(--form-accent) 10%, transparent)",
                      }}
                    >
                      <p className="text-lg font-semibold" style={{ color: "var(--form-accent)" }}>
                        {item.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              ) : isSimulator ? (
                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[
                    ["até 40%", "de economia possível"],
                    ["2 min", "para simular"],
                    ["100%", "gratuito"],
                  ].map(([num, lbl]) => (
                    <div
                      key={num}
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: "color-mix(in oklab, var(--form-accent) 10%, transparent)",
                      }}
                    >
                      <p className="text-lg font-semibold" style={{ color: "var(--form-accent)" }}>
                        {num}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{lbl}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button
                className="mt-8"
                size="lg"
                onClick={start}
                style={{
                  backgroundColor: "var(--form-accent)",
                  color: "var(--form-button-text)",
                }}
              >
                {snapshot.ctaLabel}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          ) : pageQuestions.some((item) => item.type === "calculation") ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparando o cálculo...</p>
            </div>
          ) : pageQuestions.length ? (
            <form
              key={pageQuestions.map((item) => item.id).join("-")}
              autoComplete="on"
              className="animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
              onSubmit={(event) => {
                event.preventDefault()
                if (sending || !pageIsValid) return
                goNext()
              }}
            >
              <p
                className="mb-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--form-accent)" }}
              >
                {index + 1} de {pages.length}
              </p>
              <FieldGroup className="gap-8">
                {pageQuestions.map((item) => (
                  <Field key={item.id}>
                    <FieldLabel className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                      {item.title}
                      {item.required ? <span aria-hidden="true"> *</span> : null}
                    </FieldLabel>
                    {item.description ? (
                      <FieldDescription className="text-pretty text-sm">
                        {item.description}
                      </FieldDescription>
                    ) : null}
                    <div className="mt-2">
                      <Question
                        question={item}
                        value={answers[item.id]}
                        onChange={(value) => {
                          setAnswers((current) => ({ ...current, [item.id]: value }))
                          setError(null)
                        }}
                        onBlur={sendBlurProgress}
                        publicId={publicId}
                        preview={preview}
                      />
                    </div>
                  </Field>
                ))}
              </FieldGroup>
              {error ? (
                <Alert variant="destructive" className="mt-5">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index === 0 || sending}
                  onClick={() => setIndex(Math.max(0, index - 1))}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={sending || !pageIsValid}
                  style={{
                    backgroundColor: "var(--form-accent)",
                    color: "var(--form-button-text)",
                  }}
                >
                  {sending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  {index === pages.length - 1
                    ? pageHasScheduling
                      ? "Confirmar agendamento"
                      : isSimulator
                        ? "Ver minha simulação"
                        : "Enviar"
                    : "Continuar"}
                  {!sending ? <ArrowRight data-icon="inline-end" /> : null}
                </Button>
              </div>
            </form>
          ) : (
            <Alert>
              <AlertDescription>Este formulário não possui perguntas visíveis.</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}

function Question({
  question,
  value,
  onChange,
  onBlur,
  publicId,
  preview,
}: {
  question: PublicQuestion
  value: unknown
  onChange: (value: unknown) => void
  onBlur?: (questionId: string, value: unknown) => void
  publicId?: string
  preview: boolean
}) {
  if (question.type === "scheduling") {
    return (
      <SchedulingQuestion
        value={(value as SchedulingAnswer | undefined) ?? {}}
        onChange={onChange}
        publicId={publicId}
        preview={preview}
      />
    )
  }

  if (["single_choice", "boolean", "health_plan"].includes(question.type)) {
    const options =
      question.type === "boolean"
        ? [
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]
        : question.options
    return (
      <RadioGroup
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        className={cn("gap-2.5", options.length > 3 && "sm:grid-cols-2 sm:grid")}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors motion-reduce:transition-none",
              value === option.value
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-input bg-background hover:border-primary hover:bg-primary/5",
            )}
          >
            <RadioGroupItem value={option.value} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
    )
  }

  if (question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? (value as string[]) : []
    const maxSelections =
      typeof question.config?.maxSelections === "number" &&
      Number.isFinite(question.config.maxSelections)
        ? Math.floor(question.config.maxSelections)
        : null
    const atLimit = maxSelections != null && maxSelections > 0 && selected.length >= maxSelections
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {question.options.map((option) => {
          const isSelected = selected.includes(option.value)
          const isDisabled = atLimit && !isSelected
          return (
            <label
              key={option.value}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-sm",
                isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background",
              )}
            >
              <Checkbox
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    if (atLimit) return
                    onChange([...selected, option.value])
                    return
                  }
                  onChange(selected.filter((item) => item !== option.value))
                }}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === "consent") {
    return (
      <label className="flex items-start gap-3 rounded-lg border border-input bg-background p-4">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span>Li e concordo com os termos apresentados.</span>
      </label>
    )
  }

  if (question.type === "text") {
    const auto = resolvePublicFormAutocompleteAttrs(question)
    return (
      <Input
        autoFocus
        name={auto.name}
        autoComplete={auto.autoComplete}
        inputMode={auto.inputMode}
        value={String(value ?? "")}
        placeholder={question.placeholder ?? "Digite sua resposta"}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onBlur?.(question.id, value)}
        className="h-14 border-input bg-background text-lg"
      />
    )
  }

  if (["textarea", "crm_field", "custom_field"].includes(question.type)) {
    return (
      <Textarea
        autoFocus
        value={String(value ?? "")}
        placeholder={question.placeholder ?? "Digite sua resposta"}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 border-input bg-background text-lg"
      />
    )
  }

  if (question.type === "currency") {
    return (
      <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background">
        <span className="px-4 text-muted-foreground">R$</span>
        <Input
          autoFocus
          inputMode="decimal"
          value={String(value ?? "")}
          placeholder={question.placeholder ?? "0,00"}
          onChange={(event) => onChange(formatCurrencyBR(event.target.value))}
          className="h-14 border-0 bg-transparent text-lg shadow-none focus-visible:ring-0"
        />
      </div>
    )
  }

  if (question.type === "phone") {
    const auto = resolvePublicFormAutocompleteAttrs(question)
    return (
      <Input
        autoFocus
        type="tel"
        name={auto.name}
        autoComplete={auto.autoComplete}
        inputMode={auto.inputMode ?? "tel"}
        value={String(value ?? "")}
        placeholder={question.placeholder ?? "(11) 99999-9999"}
        onChange={(event) => onChange(formatPhoneBR(event.target.value))}
        onBlur={() => onBlur?.(question.id, value)}
        className="h-14 border-input bg-background text-lg"
      />
    )
  }

  const inputType =
    question.type === "number"
      ? "number"
      : question.type === "date"
        ? "date"
        : question.type === "url"
          ? "url"
          : question.type === "email"
            ? "email"
            : "text"
  const auto = resolvePublicFormAutocompleteAttrs(question)
  return (
    <Input
      autoFocus
      type={inputType}
      name={auto.name}
      autoComplete={auto.autoComplete}
      inputMode={auto.inputMode}
      value={String(value ?? "")}
      placeholder={question.placeholder ?? "Digite sua resposta"}
      onChange={(event) =>
        onChange(
          inputType === "number" && event.target.value !== ""
            ? Number(event.target.value)
            : event.target.value,
        )
      }
      onBlur={() => onBlur?.(question.id, value)}
      className="h-14 border-input bg-background text-lg"
    />
  )
}

function SchedulingQuestion({
  value,
  onChange,
  publicId,
  preview,
}: {
  value: SchedulingAnswer
  onChange: (value: SchedulingAnswer) => void
  publicId?: string
  preview: boolean
}) {
  const [slots, setSlots] = useState<Array<{ time: string; startsAt: string }>>([])
  const [loading, setLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const selectedDate = value.date ? parseISO(`${value.date}T00:00:00`) : undefined
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  useEffect(() => {
    if (preview || !publicId || !value.date) {
      setSlots([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setAvailabilityError(null)
    void fetch(
      `${API_CLIENT_BASE}/public-forms/${publicId}/availability?date=${encodeURIComponent(value.date)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const output = await response.json()
        if (!response.ok || !output.isValid) {
          throw new Error(output.errorMessages?.join("; ") || "Não foi possível consultar horários")
        }
        setSlots(output.result.availableSlots ?? [])
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setAvailabilityError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível consultar horários",
        )
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [preview, publicId, value.date])

  return (
    <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="public-form-date">Data</FieldLabel>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id="public-form-date"
              type="button"
              variant="outline"
              className={cn(
                "h-10 w-full justify-start border-input bg-background font-normal",
                !value.date && "text-muted-foreground",
              )}
            >
              <CalendarIcon data-icon="inline-start" />
              {value.date
                ? format(parseISO(`${value.date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })
                : "Selecione a data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="public-form-page light w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              disabled={{ before: today }}
              onSelect={(date) => {
                if (!date) {
                  onChange({})
                  return
                }
                const nextDate = format(date, "yyyy-MM-dd")
                onChange({ date: nextDate })
                setCalendarOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field>
        <FieldLabel htmlFor="public-form-time">Horário</FieldLabel>
        <Select
          disabled={loading || (!preview && (!value.date || slots.length === 0))}
          value={value.time ?? ""}
          onValueChange={(time) => {
            const selected = (
              preview ? [{ time: "09:00", startsAt: new Date().toISOString() }] : slots
            ).find((slot) => slot.time === time)
            onChange({ ...value, time, startsAt: selected?.startsAt })
          }}
        >
          <SelectTrigger id="public-form-time" className="border-input bg-background">
            <SelectValue
              placeholder={
                !value.date ? "Selecione a data" : loading ? "Consultando..." : "Selecione"
              }
            />
          </SelectTrigger>
          <SelectContent className="public-form-page light">
            {(preview ? [{ time: "09:00", startsAt: new Date().toISOString() }] : slots).map(
              (slot) => (
                <SelectItem key={slot.startsAt} value={slot.time}>
                  {slot.time}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        {availabilityError ? <p className="text-sm text-destructive">{availabilityError}</p> : null}
      </Field>
    </FieldGroup>
  )
}

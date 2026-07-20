"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { resolveVisibleQuestionIds, validateAnswer } from "@/lib/public-forms/engine"
import type { PublicFormMetricEventInput, PublicFormSnapshot } from "@/lib/public-forms/types"

type PublicQuestion = PublicFormSnapshot["questions"][number]
type SchedulingAnswer = {
  closerId?: string
  date?: string
  time?: string
  startsAt?: string
}

type Props = {
  snapshot: PublicFormSnapshot
  publicId?: string
  preview?: boolean
}

function getOrigin() {
  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get("utm_source") ?? "direct",
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    landingUrl: window.location.href,
    referrer: document.referrer,
  }
}

export function PublicFormRenderer({ snapshot, publicId, preview = false }: Props) {
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [session, setSession] = useState<string | null>(null)
  const previousVisibleIds = useRef<string[]>([])

  const answerList = useMemo(
    () => Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
    [answers],
  )
  const visibleIds = useMemo(
    () => resolveVisibleQuestionIds(snapshot, answerList),
    [snapshot, answerList],
  )
  const questions = useMemo(
    () =>
      visibleIds
        .map((id) => snapshot.questions.find((question) => question.id === id))
        .filter((question): question is PublicQuestion => Boolean(question)),
    [visibleIds, snapshot.questions],
  )
  const question = questions[Math.min(index, Math.max(0, questions.length - 1))]

  useEffect(() => {
    if (preview || !publicId) return
    const key = `public-form-session:${publicId}`
    const id = window.sessionStorage.getItem(key) || crypto.randomUUID()
    window.sessionStorage.setItem(key, id)
    setSession(id)
  }, [preview, publicId])

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
      const url = `/api/v1/public-forms/${publicId}/events`
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
    if (started && question) track("question_viewed", question.id)
  }, [started, question, track])

  useEffect(() => {
    if (!started) {
      previousVisibleIds.current = visibleIds
      return
    }
    const next = new Set(visibleIds)
    for (const questionId of previousVisibleIds.current) {
      if (!next.has(questionId)) track("question_skipped", questionId)
    }
    previousVisibleIds.current = visibleIds
    setAnswers((current) => {
      const pruned: Record<string, unknown> = {}
      for (const [questionId, value] of Object.entries(current)) {
        if (next.has(questionId)) pruned[questionId] = value
      }
      return pruned
    })
    setIndex((current) => Math.min(current, Math.max(0, visibleIds.length - 1)))
  }, [started, track, visibleIds])

  function start() {
    previousVisibleIds.current = visibleIds
    setStarted(true)
    track("form_started")
  }

  function goNext() {
    if (!question) return
    const validationError = validateAnswer(question, answers[question.id])
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    track("question_answered", question.id)
    if (index < questions.length - 1) {
      setIndex(index + 1)
      return
    }
    void submit()
  }

  async function submit() {
    if (preview) {
      setDone(true)
      return
    }
    if (!publicId || !session) return
    const scheduleAnswer = snapshot.questions
      .filter((item) => item.type === "scheduling")
      .map((item) => answers[item.id] as SchedulingAnswer | undefined)
      .find((item) => item?.closerId && item.startsAt)

    setSending(true)
    try {
      const response = await fetch(`/api/v1/public-forms/${publicId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: `${session}:${crypto.randomUUID()}`,
          answers: answerList,
          origin: getOrigin(),
          scheduling: scheduleAnswer
            ? { closerId: scheduleAnswer.closerId, startsAt: scheduleAnswer.startsAt }
            : undefined,
        }),
      })
      const output = await response.json()
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join("; ") || "Não foi possível enviar")
      }
      setDone(true)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar suas respostas",
      )
    } finally {
      setSending(false)
    }
  }

  const theme = snapshot.theme
  return (
    <div
      className="flex min-h-[520px] w-full items-center justify-center bg-[var(--form-background)] p-4 text-[var(--form-text)] sm:p-8"
      style={
        {
          "--form-background": theme.backgroundColor,
          "--form-text": theme.textColor,
          "--form-line": theme.lineColor,
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-2xl">
        {done ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 text-center motion-reduce:animate-none">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-[var(--form-line)]">
              <Check aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{snapshot.successTitle}</h1>
            {snapshot.successDescription ? (
              <p className="mt-3 opacity-70">{snapshot.successDescription}</p>
            ) : null}
          </div>
        ) : !started ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 text-center motion-reduce:animate-none">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              {snapshot.coverTitle || snapshot.name}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base opacity-70 sm:text-lg">
              {snapshot.coverDescription || snapshot.description}
            </p>
            <Button className="mt-8" size="lg" onClick={start}>
              {snapshot.ctaLabel}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : question ? (
          <div
            key={question.id}
            className="animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <Progress
              className="mb-10 h-1"
              value={((index + 1) / Math.max(questions.length, 1)) * 100}
            />
            <p className="mb-2 text-sm opacity-60">
              {index + 1} de {questions.length}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              {question.title}
              {question.required ? <span aria-hidden="true"> *</span> : null}
            </h2>
            {question.description ? (
              <p className="mt-3 opacity-70">{question.description}</p>
            ) : null}
            <div className="mt-8">
              <Question
                question={question}
                value={answers[question.id]}
                onChange={(value) => {
                  setAnswers((current) => ({ ...current, [question.id]: value }))
                  setError(null)
                }}
                publicId={publicId}
                preview={preview}
                closers={snapshot.eligibleClosers ?? []}
              />
            </div>
            {error ? (
              <Alert variant="destructive" className="mt-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                disabled={index === 0 || sending}
                onClick={() => setIndex(Math.max(0, index - 1))}
              >
                <ArrowLeft data-icon="inline-start" />
                Voltar
              </Button>
              <Button disabled={sending} onClick={goNext}>
                {sending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                {index === questions.length - 1 ? "Enviar" : "Continuar"}
                {!sending ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>Este formulário não possui perguntas visíveis.</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

function Question({
  question,
  value,
  onChange,
  publicId,
  preview,
  closers,
}: {
  question: PublicQuestion
  value: unknown
  onChange: (value: unknown) => void
  publicId?: string
  preview: boolean
  closers: Array<{ id: string; name: string }>
}) {
  if (question.type === "scheduling") {
    return (
      <SchedulingQuestion
        value={(value as SchedulingAnswer | undefined) ?? {}}
        onChange={onChange}
        publicId={publicId}
        preview={preview}
        closers={closers}
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
      <div className="grid gap-3">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className="rounded-lg border border-[var(--form-line)] p-4 text-left transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-line)] motion-reduce:transition-none"
            data-selected={value === option.value || undefined}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="grid gap-3">
        {question.options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--form-line)] p-4"
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    )
  }

  if (question.type === "consent") {
    return (
      <label className="flex items-start gap-3 rounded-lg border border-[var(--form-line)] p-4">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span>Li e concordo com os termos apresentados.</span>
      </label>
    )
  }

  if (["text", "crm_field", "custom_field"].includes(question.type)) {
    return (
      <Textarea
        autoFocus
        value={String(value ?? "")}
        placeholder={question.placeholder ?? "Digite sua resposta"}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 border-[var(--form-line)] bg-transparent text-lg"
      />
    )
  }

  const inputType =
    question.type === "phone"
      ? "tel"
      : question.type === "number"
        ? "number"
        : question.type === "date"
          ? "date"
          : question.type === "url"
            ? "url"
            : question.type === "email"
              ? "email"
              : "text"
  return (
    <Input
      autoFocus
      type={inputType}
      value={String(value ?? "")}
      placeholder={question.placeholder ?? "Digite sua resposta"}
      onChange={(event) =>
        onChange(
          inputType === "number" && event.target.value !== ""
            ? Number(event.target.value)
            : event.target.value,
        )
      }
      className="h-14 border-[var(--form-line)] bg-transparent text-lg"
    />
  )
}

function SchedulingQuestion({
  value,
  onChange,
  publicId,
  preview,
  closers,
}: {
  value: SchedulingAnswer
  onChange: (value: SchedulingAnswer) => void
  publicId?: string
  preview: boolean
  closers: Array<{ id: string; name: string }>
}) {
  const [slots, setSlots] = useState<Array<{ time: string; startsAt: string }>>([])
  const [loading, setLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  useEffect(() => {
    if (preview || !publicId || !value.closerId || !value.date) {
      setSlots([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setAvailabilityError(null)
    void fetch(
      `/api/v1/public-forms/${publicId}/availability?closerId=${encodeURIComponent(value.closerId)}&date=${encodeURIComponent(value.date)}`,
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
  }, [preview, publicId, value.closerId, value.date])

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="public-form-closer">
          Profissional
        </label>
        <Select
          value={value.closerId ?? ""}
          onValueChange={(closerId) => onChange({ closerId, date: value.date })}
        >
          <SelectTrigger
            id="public-form-closer"
            className="border-[var(--form-line)] bg-transparent"
          >
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {closers.map((closer) => (
              <SelectItem key={closer.id} value={closer.id}>
                {closer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="public-form-date">
          Data
        </label>
        <Input
          id="public-form-date"
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          className="border-[var(--form-line)] bg-transparent"
          value={value.date ?? ""}
          onChange={(event) =>
            onChange({ closerId: value.closerId, date: event.target.value || undefined })
          }
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium" htmlFor="public-form-time">
          Horário
        </label>
        <Select
          disabled={loading || (!preview && slots.length === 0)}
          value={value.time ?? ""}
          onValueChange={(time) => {
            const selected = slots.find((slot) => slot.time === time)
            onChange({ ...value, time, startsAt: selected?.startsAt })
          }}
        >
          <SelectTrigger id="public-form-time" className="border-[var(--form-line)] bg-transparent">
            <SelectValue placeholder={loading ? "Consultando..." : "Selecione"} />
          </SelectTrigger>
          <SelectContent>
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
      </div>
    </div>
  )
}

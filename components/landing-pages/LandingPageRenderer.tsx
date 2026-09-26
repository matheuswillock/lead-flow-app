"use client"

import { useState } from "react"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

type Props = { snapshot: LandingPageSnapshot }

function questionInputType(question: PublicFormSnapshot["questions"][number]) {
  if (question.type === "email") return "email"
  if (question.type === "phone") return "tel"
  if (question.type === "number") return "number"
  return "text"
}

function LandingQuestion({
  question,
  value,
  onChange,
}: {
  question: PublicFormSnapshot["questions"][number]
  value: unknown
  onChange: (value: unknown) => void
}) {
  const options = question.options ?? []
  if (question.type === "textarea") {
    return <textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder ?? ""} />
  }
  if (options.length > 0) {
    return (
      <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione uma opção</option>
        {options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
      </select>
    )
  }
  return <input type={questionInputType(question)} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder ?? ""} />
}

export function LandingPageRenderer({ snapshot }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formQuestions = snapshot.form.questions

  const updateAnswer = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const missing = formQuestions.filter((question) => question.required && !String(answers[question.id] ?? "").trim())
    if (missing.length > 0) {
      setError("Preencha os campos obrigatórios para continuar.")
      return
    }

    setIsSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const payload = {
        requestKey: `${snapshot.landingPageId}:${crypto.randomUUID()}`,
        visitorSessionId: `${snapshot.landingPageId}:${crypto.randomUUID()}`,
        answers: formQuestions.map((question): PublicFormAnswerInput => ({ questionId: question.id, value: answers[question.id] ?? "" })),
        origin: {
          source: params.get("utm_source") ?? (params.get("cs_el") ? "email_campaign" : "direct"),
          medium: params.get("utm_medium"),
          campaign: params.get("utm_campaign"),
          campaignId: params.get("campaign_id"),
          emailLogId: params.get("cs_el"),
          landingPageId: snapshot.landingPageId,
        },
      }
      const response = await fetch(`/api/q/conversation/${snapshot.publicId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { isValid: boolean; errorMessages?: string[] }
      if (!response.ok || !result.isValid) throw new Error(result.errorMessages?.[0] ?? "Não foi possível enviar suas respostas.")
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar suas respostas.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="landing-page flex min-h-screen items-start justify-center bg-background px-4 py-8 text-foreground sm:py-12 md:px-8 md:py-16">
      <section aria-labelledby="landing-form-title" className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <h1 id="landing-form-title" className="sr-only">Formulário de cotação</h1>
        {submitted ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{snapshot.form.successTitle}</h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{snapshot.form.successDescription ?? "Recebemos suas respostas."}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-5" noValidate>
            {formQuestions.map((question) => (
              <label key={question.id} className="grid gap-2 text-sm font-medium">
                <span>{question.title}{question.required && <span aria-hidden="true"> *</span>}</span>
                <LandingQuestion question={question} value={answers[question.id]} onChange={(value) => updateAnswer(question.id, value)} />
              </label>
            ))}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button disabled={isSubmitting} className="min-h-11 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60">{isSubmitting ? "Enviando..." : snapshot.form.ctaLabel}</button>
          </form>
        )}
      </section>
    </main>
  )
}

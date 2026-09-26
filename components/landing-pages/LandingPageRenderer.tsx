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
  if (question.type === "multiple_choice") {
    const selectedValues = Array.isArray(value) ? value.map(String) : []
    return (
      <div className="grid gap-3" role="group" aria-label={question.title}>
        {options.map((option) => (
          <label key={option.id ?? option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2">
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={(event) => {
                const nextValues = event.target.checked
                  ? [...selectedValues, option.value]
                  : selectedValues.filter((selectedValue) => selectedValue !== option.value)
                onChange(nextValues)
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }
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
  const [visitorSessionId] = useState(() => `landing_${crypto.randomUUID().replaceAll("-", "")}`)
  const formQuestions = snapshot.form.questions
  const content = snapshot.content
  const offer = snapshot.offer

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
        requestKey: `landing_${crypto.randomUUID().replaceAll("-", "")}`,
        visitorSessionId,
        ...(snapshot.formPublicationId ? { publicationId: snapshot.formPublicationId } : {}),
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
    <main data-template={snapshot.templateSlug} className="landing-page min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-12 md:px-8 md:py-16">
        <header className="flex items-center justify-between gap-4">
          <span className="font-semibold tracking-tight">{content.brandName}</span>
          <a href="#landing-form" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">{snapshot.form.ctaLabel}</a>
        </header>

        <section aria-labelledby="landing-hero-title" className="grid gap-5 md:max-w-4xl">
          {content.heroEyebrow && <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{content.heroEyebrow}</p>}
          {content.heroTitle && <h1 id="landing-hero-title" className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">{content.heroTitle}</h1>}
          {content.heroDescription && <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{content.heroDescription}</p>}
          <a href="#landing-form" className="inline-flex min-h-11 w-fit items-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">{snapshot.form.ctaLabel}</a>
        </section>

        {offer.enabled && (
          <section aria-labelledby="landing-offer-title" className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-primary">{offer.badge}</p>
              <h2 id="landing-offer-title" className="text-2xl font-semibold tracking-tight">{offer.title}</h2>
              {offer.percentage !== null && <p className="text-4xl font-semibold tracking-tight text-primary">{offer.percentage}% OFF</p>}
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {offer.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">{offer.disclaimer}</p>
          </section>
        )}

        {content.processSteps && content.processSteps.length > 0 && (
          <section aria-labelledby="landing-process-title" className="grid gap-5">
            <div className="grid gap-2">
              {content.processTitle && <h2 id="landing-process-title" className="text-2xl font-semibold tracking-tight">{content.processTitle}</h2>}
              {content.processDescription && <p className="max-w-3xl text-muted-foreground">{content.processDescription}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {content.processSteps.map((step) => (
                <article key={step.id} className="grid gap-2 rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="landing-form" aria-labelledby="landing-form-title" className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <h2 id="landing-form-title" className="text-2xl font-semibold tracking-tight">{snapshot.form.name}</h2>
          {snapshot.form.description && <p className="mt-2 text-muted-foreground">{snapshot.form.description}</p>}
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

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">{content.footerText}</footer>
      </div>
    </main>
  )
}

"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart2, CalendarClock, CheckCircle2, FileText, Mail, Upload } from "lucide-react"
import type { ElementType } from "react"
import { DemoRequestDialogButton } from "./DemoRequestDialog"
import { emailBenefitsData, EMAIL_SPOTLIGHT_HEADING, EMAIL_SPOTLIGHT_SUBHEADING } from "@/lib/landing/email-spotlight-data"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

const BENEFIT_ICONS: ElementType[] = [FileText, Upload, CalendarClock, BarChart2]

const benefits = emailBenefitsData.map((b, i) => ({ ...b, icon: BENEFIT_ICONS[i] }))

const mockStats = [
  { label: "Taxa de abertura", value: "34,2%", className: "text-primary" },
  { label: "Cliques", value: "8,7%", className: "text-[var(--chart-2)]" },
  { label: "Entregues", value: "99,1%", className: "text-[var(--chart-4)]" },
  { label: "Disparados", value: "4.850", className: "text-[var(--chart-1)]" },
]

const barStyles = [
  { label: "Abertos", pct: 34, widthClass: "w-[34%]", colorClass: "bg-primary" },
  { label: "Clicados", pct: 9, widthClass: "w-[9%]", colorClass: "bg-[var(--chart-2)]" },
  { label: "Entregues", pct: 99, widthClass: "w-[99%]", colorClass: "bg-[var(--chart-4)]" },
]

export function EmailCampaignsSpotlight() {
  const badgeMotion = useLandingReveal({ distance: 16, duration: 0.5 })
  const headingMotion = useLandingReveal({ distance: 16, duration: 0.6 })
  const previewMotion = useLandingReveal({ axis: "x", distance: -20, duration: 0.6 })
  const listMotion = useLandingReveal({ axis: "x", distance: 20, duration: 0.6 })
  const benefitMotions = [
    useLandingReveal({ distance: 0, scale: true, duration: 0.4, delay: 0 }),
    useLandingReveal({ distance: 0, scale: true, duration: 0.4, delay: 0.08 }),
    useLandingReveal({ distance: 0, scale: true, duration: 0.4, delay: 0.16 }),
    useLandingReveal({ distance: 0, scale: true, duration: 0.4, delay: 0.24 }),
  ]

  return (
    <section id="email-campaigns" className="relative py-20 md:py-28 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 landing-email-orbs" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...badgeMotion} className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold landing-pill-badge">
            <Mail className="h-3.5 w-3.5" />
            Em breve
          </div>
        </MotionDiv>

        <MotionDiv {...headingMotion} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            {EMAIL_SPOTLIGHT_HEADING.split("em breve no CRM")[0]}
            <span className="text-primary">em breve no CRM</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {EMAIL_SPOTLIGHT_SUBHEADING}
          </p>
        </MotionDiv>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          <MotionDiv {...previewMotion} className="mb-12 lg:mb-0">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Preview da experiência de campanhas</p>
                    <p className="text-xs text-muted-foreground">Lançamento previsto para breve</p>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[color-mix(in_oklab,var(--chart-4)_20%,transparent)] text-[var(--chart-4)]">
                  Preview
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {mockStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border p-4 bg-card"
                  >
                    <div className={`text-2xl font-extrabold ${stat.className}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {barStyles.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{bar.label}</span>
                      <span>{bar.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-border">
                      <div className={`h-full rounded-full ${bar.widthClass} ${bar.colorClass}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MotionDiv>

          <MotionDiv {...listMotion}>
            <ul className="flex flex-col gap-6 mb-8">
              {benefits.map((benefit, idx) => (
                <li key={benefit.title} className="flex items-start gap-4">
                  <MotionDiv
                    {...benefitMotions[idx]}
                    className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary"
                  >
                    <benefit.icon className="h-5 w-5" />
                  </MotionDiv>
                  <div>
                    <p className="font-semibold text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {benefit.description}{" "}
                      <span className="font-semibold text-primary">(em breve)</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <DemoRequestDialogButton
              className="group inline-flex items-center gap-2 text-sm font-semibold mb-10 transition-colors text-primary"
            >
              Quero entrar na lista de prioridade
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </DemoRequestDialogButton>

            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Disponibilidade de lançamento</p>
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
                <p className="text-base font-semibold text-foreground">Módulo de e-mail em desenvolvimento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você pode solicitar acesso antecipado na demonstração. Avisaremos assim que a funcionalidade for liberada.
                </p>
                <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    Lista de prioridade para clientes da base
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    Acesso gradual por lotes após o lançamento
                  </li>
                </ul>
              </div>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}

"use client"

import { useMemo, useState, type FormEvent } from "react"
import { div as MotionDiv } from "framer-motion/client"
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Headphones,
  Kanban,
  Lock,
  Mail,
  MessageCircle,
  Sparkles,
  Timer,
  Users2,
} from "lucide-react"
import { toast } from "sonner"
import { isValidPhone, maskPhone, unmask } from "@/lib/masks"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

const benefits = [
  { icon: Kanban, text: "Pipeline Kanban visual e intuitivo" },
  { icon: CalendarDays, text: "Integração nativa com Google Calendar" },
  { icon: Users2, text: "Gestão de times: SDR, Closer e Manager" },
  { icon: BarChart3, text: "Dashboard com métricas em tempo real" },
  { icon: Mail, text: "Módulo de campanhas de email (em breve)" },
  { icon: MessageCircle, text: "Suporte em português, sem complicação" },
]

const trustBadges = [
  { icon: Lock, label: "LGPD" },
  { icon: Headphones, label: "Suporte PT-BR" },
  { icon: Timer, label: "Resposta em 24h" },
  { icon: Sparkles, label: "Demo gratuita" },
]

export function PricingSection() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const headingMotion = useLandingReveal({ distance: 20, duration: 0.6 })
  const leftMotion = useLandingReveal({ axis: "x", distance: -20, duration: 0.6 })
  const rightMotion = useLandingReveal({ axis: "x", distance: 20, duration: 0.6 })

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const isFormValid = useMemo(() => {
    return fullName.trim().length >= 2 && isValidEmail(email.trim()) && isValidPhone(whatsapp)
  }, [fullName, email, whatsapp])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        const message = (result?.errorMessages && result.errorMessages.join(", ")) || "Erro ao enviar. Tente novamente."
        toast.error(message)
        return
      }

      toast.success("Solicitação enviada! Em breve entraremos em contato.")
      setFullName("")
      setEmail("")
      setWhatsapp("")
    } catch (error) {
      toast.error("Erro ao enviar. Tente novamente.")
      console.error("Error submitting demo request:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="demo" className="relative py-20 md:py-28">

      <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...headingMotion} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Agende uma <span className="text-primary">demonstração</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Fale com um especialista e veja o Corretor Studio em ação.
          </p>
        </MotionDiv>

        <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-start">
          <MotionDiv {...leftMotion} className="mb-10 lg:mb-0">
            <h3 className="text-xl font-bold mb-2">Por que usar o Corretor Studio?</h3>
            <p className="text-muted-foreground mb-7">
              Veja o que os corretores de alta performance têm de diferente.
            </p>

            <ul className="flex flex-col gap-4 mb-8">
              {benefits.map((benefit) => (
                <li key={benefit.text} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <benefit.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {benefit.text.includes("(em breve)")
                      ? benefit.text.replace("(em breve)", "")
                      : benefit.text}
                    {benefit.text.includes("(em breve)") && (
                      <span className="ml-1 font-semibold text-primary">(em breve)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 gap-2">
              {trustBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 bg-card"
                >
                  <badge.icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <span className="text-xs font-semibold">{badge.label}</span>
                </div>
              ))}
            </div>
          </MotionDiv>

          <MotionDiv {...rightMotion}>
            <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
              {trustBadges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium"
                >
                  <badge.icon className="h-3 w-3 text-primary" />
                  {badge.label}
                </span>
              ))}
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 sm:p-10">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="pricing-full-name" className="text-sm font-semibold text-foreground/90">
                    Nome completo
                  </label>
                  <input
                    id="pricing-full-name"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label htmlFor="pricing-email" className="text-sm font-semibold text-foreground/90">
                    E-mail profissional
                  </label>
                  <input
                    id="pricing-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label htmlFor="pricing-whatsapp" className="text-sm font-semibold text-foreground/90">
                    WhatsApp
                  </label>
                  <input
                    id="pricing-whatsapp"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={maskPhone(whatsapp)}
                    onChange={(event) => {
                      const masked = maskPhone(event.target.value)
                      const unmasked = unmask(masked)
                      setWhatsapp(unmasked)
                    }}
                    required
                    className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full inline-flex items-center justify-center rounded-2xl px-5 py-3.5 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 landing-primary-cta"
                >
                  {isSubmitting ? "Enviando..." : "Agendar demonstração"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>Resposta em até 24 horas · Sem compromisso · Demonstração gratuita</span>
              </div>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}

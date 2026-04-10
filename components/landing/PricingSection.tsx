"use client"

import { useMemo, useState, type FormEvent } from "react"
import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Kanban, Mail, MessageCircle, Users2 } from "lucide-react"
import { toast } from "sonner"
import { isValidPhone, maskPhone, unmask } from "@/lib/masks"

const benefits = [
  { icon: Kanban, text: "Pipeline Kanban visual e intuitivo" },
  { icon: CalendarDays, text: "Integração nativa com Google Calendar" },
  { icon: Users2, text: "Gestão de times: SDR, Closer e Manager" },
  { icon: BarChart3, text: "Dashboard com métricas em tempo real" },
  { icon: Mail, text: "Modulo de campanhas de email (em breve)" },
  { icon: MessageCircle, text: "Suporte em português, sem complicação" },
]


export function PricingSection() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 landing-pricing-orbs" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Agende uma <span className="text-primary">demonstração</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Fale com um especialista e veja o Corretor Studio em ação.
          </p>
        </MotionDiv>

        <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-start">
          <MotionDiv
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 lg:mb-0"
          >
            <h3 className="text-xl font-bold mb-2">Por que usar o Corretor Studio?</h3>
            <p className="text-muted-foreground mb-7">
              Veja o que os corretores de alta performance têm de diferente.
            </p>

            <ul className="space-y-4 mb-8">
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
                      <span className="ml-1 font-semibold landing-primary-gradient">(em breve)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {/*
            <div className="grid grid-cols-2 gap-3">
              {trustBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 bg-card/60"
                >
                  <badge.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-xs font-semibold">{badge.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-primary/25 p-5 bg-primary/5 landing-surface-card-soft">
              <p className="text-sm font-semibold mb-1">Planos a partir de</p>
              <p className="text-3xl font-extrabold text-primary">
                R$ 59,90<span className="text-base font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Plano semestral · R$ 79,90/mês no plano mensal · + R$ 19,90/operador
              </p>
            </div>
            */}
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-3xl border border-border p-8 sm:p-10 shadow-2xl backdrop-blur landing-surface-card">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-semibold text-foreground/90">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground/90">
                    E-mail profissional
                  </label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground/90">
                    WhatsApp
                  </label>
                  <input
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
                  className="w-full inline-flex items-center justify-center rounded-2xl px-5 py-3.5 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 landing-primary-cta"
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

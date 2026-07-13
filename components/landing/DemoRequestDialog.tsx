"use client"

import Link from "next/link"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react"
import { ArrowRight, Check, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { isValidPhone, maskPhone, unmask } from "@/lib/masks"

const guidedBenefits = [
  {
    title: "Demonstração personalizada",
    description: "Adaptamos a apresentação ao seu segmento e volume de clientes.",
  },
  {
    title: "Migração da sua base",
    description: "Mostramos como importar seus contatos e histórico sem perder nada.",
  },
  {
    title: "Sem compromisso",
    description: "Você decide no seu tempo. Nada de contratos ou cartão de crédito.",
  },
]

const teamSizeOptions = [
  "Só eu",
  "2 a 5 corretores",
  "6 a 15 corretores",
  "Mais de 15",
]

const contactTimeOptions = ["Manhã", "Tarde", "Fim do dia"]

const inputClassName =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
const fieldClassName = "gap-1.5"

type DemoRequestDialogContextValue = {
  openDialog: () => void
}

const DemoRequestDialogContext = createContext<DemoRequestDialogContextValue | null>(null)

function useDemoRequestDialog() {
  const context = useContext(DemoRequestDialogContext)

  if (!context) {
    throw new Error("DemoRequestDialogButton must be used inside DemoRequestDialogProvider")
  }

  return context
}

type DemoRequestDialogProviderProps = {
  children: ReactNode
}

export function DemoRequestDialogProvider({ children }: DemoRequestDialogProviderProps) {
  const [open, setOpen] = useState(false)

  const value = useMemo(
    () => ({
      openDialog: () => setOpen(true),
    }),
    [],
  )

  return (
    <DemoRequestDialogContext.Provider value={value}>
      {children}
      <DemoRequestDialog open={open} onOpenChange={setOpen} />
    </DemoRequestDialogContext.Provider>
  )
}

type DemoRequestDialogButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function DemoRequestDialogButton({
  children,
  type = "button",
  onClick,
  ...props
}: DemoRequestDialogButtonProps) {
  const { openDialog } = useDemoRequestDialog()

  return (
    <button
      type={type}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) openDialog()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

type DemoRequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DemoRequestDialog({ open, onOpenChange }: DemoRequestDialogProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [teamSize, setTeamSize] = useState(teamSizeOptions[0])
  const [preferredContactTime, setPreferredContactTime] = useState("Manhã")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const resetForm = useCallback(() => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setWhatsapp("")
    setTeamSize(teamSizeOptions[0])
    setPreferredContactTime("Manhã")
    setIsSubmitting(false)
    setIsSuccess(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const fullName = useMemo(() => `${firstName.trim()} ${lastName.trim()}`.trim(), [firstName, lastName])

  const isFormValid = useMemo(() => {
    return firstName.trim().length >= 2 && isValidEmail(email.trim()) && isValidPhone(whatsapp)
  }, [email, firstName, whatsapp])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          teamSize,
          preferredContactTime,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        const message = (result?.errorMessages && result.errorMessages.join(", ")) || "Erro ao enviar. Tente novamente."
        toast.error(message)
        return
      }

      toast.success("Solicitação enviada! Em breve entraremos em contato.")
      setIsSuccess(true)
      setFirstName("")
      setLastName("")
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="landing-page max-h-[92vh] !w-[min(940px,calc(100vw-48px))] !max-w-[940px] gap-0 overflow-hidden rounded-[28px] border-0 bg-card p-0 shadow-2xl"
      >
        <DialogClose className="absolute right-4 top-4 z-10 grid size-[38px] place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] text-landing-ink transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="size-5" aria-hidden />
          <span className="sr-only">Fechar</span>
        </DialogClose>
        <DialogTitle className="sr-only">Solicitar demonstração guiada do Corretor Studio</DialogTitle>
        <DialogDescription className="sr-only">
          Formulário para solicitar uma demonstração guiada do Corretor Studio.
        </DialogDescription>

        <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[1fr_440px]">
          <section className="hidden bg-[color-mix(in_srgb,var(--primary)_7%,var(--card))] px-10 py-11 lg:block">
            <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">
              Demonstração guiada
            </p>
            <h2 className="mt-3.5 max-w-[420px] font-display text-[27px] font-extrabold leading-[1.12] tracking-[-0.02em] text-landing-ink">
              Veja o Corretor Studio com os
              <span className="block">seus próprios números</span>
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-muted-foreground">
              Em 30 minutos mostramos como organizar seus leads, disparar campanhas e acompanhar sua carteira,
              sem compromisso.
            </p>

            <ul className="mt-[26px] flex flex-col gap-[18px]">
              {guidedBenefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/15 text-primary">
                    <Check className="size-4" aria-hidden />
                  </span>
                  <span>
                    <strong className="block font-display text-sm font-semibold text-landing-ink">
                      {benefit.title}
                    </strong>
                    <span className="mt-0.5 block text-[13.5px] leading-[1.45] text-muted-foreground">
                      {benefit.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-6 py-10 sm:px-[38px] lg:py-11">
            <div className="mb-6 lg:hidden">
              <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">
                Demonstração guiada
              </p>
              <h2 className="mt-3 pr-10 font-display text-2xl font-extrabold leading-tight text-landing-ink">
                Veja o Corretor Studio com os seus próprios números
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Em 30 minutos mostramos como organizar seus leads, campanhas e carteira.
              </p>
            </div>

            {isSuccess ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="grid size-16 place-items-center rounded-full bg-primary/12 text-primary">
                  <CheckCircle2 className="size-8" aria-hidden />
                </div>
                <h3 className="mt-5 font-display text-2xl font-extrabold text-landing-ink">
                  Solicitação enviada!
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Recebemos seu pedido. Um especialista vai entrar em contato pelo WhatsApp em até{" "}
                  <strong className="font-semibold text-landing-ink">1 dia útil</strong> para confirmar o melhor horário.
                </p>
                <DialogClose className="landing-primary-cta mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl px-6 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  Fechar
                </DialogClose>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup className="gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field className={fieldClassName}>
                      <FieldLabel htmlFor="demo-first-name" className="font-display text-sm font-semibold text-landing-ink">
                        Nome <span className="text-primary">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <input
                          id="demo-first-name"
                          type="text"
                          placeholder="Seu nome"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          required
                          className={inputClassName}
                        />
                      </FieldContent>
                    </Field>

                    <Field className={fieldClassName}>
                      <FieldLabel htmlFor="demo-last-name" className="font-display text-sm font-semibold text-landing-ink">
                        Sobrenome
                      </FieldLabel>
                      <FieldContent>
                        <input
                          id="demo-last-name"
                          type="text"
                          placeholder="Sobrenome"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          className={inputClassName}
                        />
                      </FieldContent>
                    </Field>
                  </div>

                  <Field className={fieldClassName}>
                    <FieldLabel htmlFor="demo-email" className="font-display text-sm font-semibold text-landing-ink">
                      E-mail profissional <span className="text-primary">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <input
                        id="demo-email"
                        type="email"
                        placeholder="voce@empresa.com.br"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        className={inputClassName}
                      />
                    </FieldContent>
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field className={fieldClassName}>
                      <FieldLabel htmlFor="demo-whatsapp" className="font-display text-sm font-semibold text-landing-ink">
                        WhatsApp <span className="text-primary">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <input
                          id="demo-whatsapp"
                          type="tel"
                          placeholder="(11) 90000-0000"
                          value={maskPhone(whatsapp)}
                          onChange={(event) => {
                            const masked = maskPhone(event.target.value)
                            const unmasked = unmask(masked)
                            setWhatsapp(unmasked)
                          }}
                          required
                          className={inputClassName}
                        />
                      </FieldContent>
                    </Field>

                    <Field className={fieldClassName}>
                      <FieldLabel htmlFor="demo-team-size" className="font-display text-sm font-semibold text-landing-ink">
                        Tamanho da equipe
                      </FieldLabel>
                      <FieldContent>
                        <select
                          id="demo-team-size"
                          value={teamSize}
                          onChange={(event) => setTeamSize(event.target.value)}
                          className={inputClassName}
                        >
                          {teamSizeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FieldContent>
                    </Field>
                  </div>

                  <Field className={fieldClassName}>
                    <FieldLabel className="font-display text-sm font-semibold text-landing-ink">
                      Melhor horário para o contato
                    </FieldLabel>
                    <FieldContent>
                      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Melhor horário para contato">
                        {contactTimeOptions.map((option) => {
                          const isSelected = preferredContactTime === option

                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={cn(
                                "min-h-10 rounded-xl border border-border px-2 text-sm font-medium text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                                isSelected && "border-primary bg-primary text-primary-foreground",
                              )}
                              onClick={() => setPreferredContactTime(option)}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    </FieldContent>
                  </Field>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-disabled={!isFormValid || isSubmitting}
                    className="landing-primary-cta inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Enviando..." : "Agendar minha demonstração"}
                    <ArrowRight className="size-5" aria-hidden />
                  </button>
                </FieldGroup>

                <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                  Ao enviar, você concorda com nossa{" "}
                  <Link href="/privacy-policy" className="font-semibold text-primary">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

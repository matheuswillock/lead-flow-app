"use client"

import { useState } from "react"
import Image from "next/image"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatDocumentInput, isValidCNPJ, isValidCPF, sanitizeDocumentDigits } from "@/lib/masks"
import { useBackofficePublicLeadFormContext } from "../context/BackofficePublicLeadFormContext"

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function isValidCpfOrCnpj(value: string): boolean {
  const digits = sanitizeDocumentDigits(value)
  if (!digits) return true
  if (digits.length <= 11) return isValidCPF(digits)
  return isValidCNPJ(digits)
}

const formSchema = z
  .object({
    name: z.string().trim().min(2, "Informe ao menos 2 caracteres."),
    email: z
      .string()
      .trim()
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "E-mail inválido.",
      }),
    phone: z
      .string()
      .trim()
      .refine(
        (value) => {
          if (!value) return true
          const digits = value.replace(/\D/g, "")
          return digits.length === 10 || digits.length === 11
        },
        { message: "Telefone deve conter 10 ou 11 dígitos." },
      ),
    cpfCnpj: z
      .string()
      .trim()
      .refine((value) => !value || isValidCpfOrCnpj(value), {
        message: "CPF ou CNPJ inválido.",
      }),
    notes: z.string().trim(),
    qualificationLeadOrganization: z.string().trim(),
    qualificationAvgUsers: z.string().trim(),
    qualificationProfileFit: z.string().trim(),
  })
  .refine((data) => Boolean(data.email.trim() || data.phone.trim()), {
    message: "Informe e-mail ou telefone.",
    path: ["email"],
  })

type FormValues = z.infer<typeof formSchema>

const emptyValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  cpfCnpj: "",
  notes: "",
  qualificationLeadOrganization: "",
  qualificationAvgUsers: "",
  qualificationProfileFit: "",
}

function nullIfEmpty(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function BackofficePublicLeadForm() {
  const { isSubmitting, isSubmitted, submitLead, resetForm } =
    useBackofficePublicLeadFormContext()
  const [locked, setLocked] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: emptyValues,
  })

  async function onSubmit(values: FormValues) {
    if (isSubmitting || locked) return
    setLocked(true)

    try {
      const ok = await submitLead({
        name: values.name.trim(),
        email: nullIfEmpty(values.email),
        phone: nullIfEmpty(values.phone.replace(/\D/g, "")),
        cpfCnpj: nullIfEmpty(sanitizeDocumentDigits(values.cpfCnpj)),
        notes: nullIfEmpty(values.notes),
        qualificationLeadOrganization: nullIfEmpty(values.qualificationLeadOrganization),
        qualificationAvgUsers: nullIfEmpty(values.qualificationAvgUsers),
        qualificationProfileFit: nullIfEmpty(values.qualificationProfileFit),
      })

      if (ok) {
        form.reset(emptyValues)
      }
    } finally {
      setLocked(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex w-full max-w-md flex-col gap-6 text-center">
          <BrandHeader />
          <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
            <CheckCircle2 className="size-16 text-primary" />
            <h2 className="text-xl font-semibold">Cadastro enviado com sucesso</h2>
            <p className="text-sm text-muted-foreground">
              Recebemos suas informações. Nossa equipe entrará em contato em breve.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                form.reset(emptyValues)
              }}
            >
              Enviar outro cadastro
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const pending = isSubmitting || locked

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <BrandHeader />
        <div className="rounded-lg border p-6">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Fale com o Corretor Studio</h1>
            <p className="text-sm text-muted-foreground">
              Preencha seus dados para que nossa equipe entre em contato.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Seu nome completo"
                        disabled={pending}
                        autoComplete="name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
                          disabled={pending}
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(formatPhoneInput(event.target.value))
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="(11) 99999-9999"
                          disabled={pending}
                          autoComplete="tel"
                          inputMode="tel"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cpfCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF ou CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(formatDocumentInput(event.target.value))
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        placeholder="000.000.000-00"
                        disabled={pending}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Conte um pouco sobre sua necessidade"
                        rows={3}
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <section className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Qualificação</h2>
                  <p className="text-xs text-muted-foreground">
                    Respostas opcionais sobre seu perfil e necessidades.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="qualificationLeadOrganization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Como você organiza seus leads e carteira?</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Ex: Uso planilha, WhatsApp, CRM..."
                          rows={2}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualificationAvgUsers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantos usuários em média você precisa?</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Ex: 1 a 5 usuários"
                          rows={2}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualificationProfileFit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>O que você busca no Corretor Studio?</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Ex: Organizar funil, agenda, follow-up..."
                          rows={2}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <Button
                type="submit"
                className="w-full"
                disabled={pending || !form.formState.isValid}
              >
                {pending ? (
                  <>
                    <Loader2 data-icon="inline-start" />
                    Enviando...
                  </>
                ) : (
                  "Enviar cadastro"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}

function BrandHeader() {
  return (
    <div className="flex items-center justify-center gap-2">
      <Image
        src="/corretor-studio-icon.svg"
        alt="Corretor Studio"
        width={32}
        height={32}
        className="size-8"
        priority
      />
      <span className="text-lg font-semibold">Corretor Studio</span>
    </div>
  )
}

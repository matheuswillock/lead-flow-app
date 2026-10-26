"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { createSupabaseBrowser } from "@/lib/supabase/browser"

type Props = { params: Promise<{ token: string }> }
type CardForm = {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  addressComplement: string
  phone: string
  mobilePhone: string
}

const initialForm: CardForm = {
  holderName: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  ccv: "",
  name: "",
  email: "",
  cpfCnpj: "",
  postalCode: "",
  addressNumber: "",
  addressComplement: "",
  phone: "",
  mobilePhone: "",
}

export default function ReauthorizePaymentPage({ params }: Props) {
  const [token, setToken] = useState<string>()
  const [form, setForm] = useState<CardForm>(initialForm)
  const [clientName, setClientName] = useState<string>("")
  const [state, setState] = useState<"loading" | "ready" | "submitting" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    void params.then(({ token: nextToken }) => {
      setToken(nextToken)
      const supabase = createSupabaseBrowser()
      if (!supabase) {
        setMessage("Não foi possível iniciar a sessão segura")
        setState("error")
        return
      }
      void supabase.auth.getUser().then(({ data }) => {
        const supabaseId = data.user?.id
        if (!supabaseId) throw new Error("Faça login como master para continuar")
        return fetch(`${API_CLIENT_BASE}/billing/card-reauthorization/${encodeURIComponent(nextToken)}`, {
          cache: "no-store",
          headers: { "x-supabase-user-id": supabaseId },
        })
      })
        .then(async (response) => {
          const body = await response.json()
          if (!response.ok || !body.isValid) throw new Error(body.errorMessages?.[0] ?? "Link inválido")
          setClientName(body.result?.clientName ?? "")
          setState("ready")
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Link inválido ou expirado")
          setState("error")
        })
    })
  }, [params])

  function update(field: keyof CardForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setState("submitting")
    setMessage("")
    const supabase = createSupabaseBrowser()
    const { data: authData } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
    const response = await fetch(`${API_CLIENT_BASE}/billing/card-reauthorization/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authData.user?.id ? { "x-supabase-user-id": authData.user.id } : {}),
      },
      body: JSON.stringify({
        card: {
          holderName: form.holderName,
          number: form.number.replace(/\s/g, ""),
          expiryMonth: form.expiryMonth,
          expiryYear: form.expiryYear,
          ccv: form.ccv,
        },
        cardholder: {
          name: form.name,
          email: form.email,
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
          postalCode: form.postalCode.replace(/\D/g, ""),
          addressNumber: form.addressNumber,
          addressComplement: form.addressComplement || null,
          phone: form.phone || null,
          mobilePhone: form.mobilePhone || null,
        },
      }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.isValid) {
      setMessage(body?.errorMessages?.[0] ?? "Não foi possível autorizar o cartão")
      setState("error")
      return
    }
    setState("success")
    setMessage("Pagamento confirmado. Sua assinatura será retomada em instantes.")
  }

  if (state === "loading") return <main className="flex min-h-screen items-center justify-center bg-background p-6 text-muted-foreground">Validando seu link seguro…</main>
  if (state === "error") return <main className="flex min-h-screen items-center justify-center bg-background p-6"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Não foi possível continuar</CardTitle><CardDescription>{message}</CardDescription></CardHeader></Card></main>
  if (state === "success") return <main className="flex min-h-screen items-center justify-center bg-background p-6"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Pagamento confirmado</CardTitle><CardDescription>{message}</CardDescription></CardHeader></Card></main>

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Atualize o cartão da sua assinatura</CardTitle>
          <CardDescription>Olá, {clientName || "master"}. Seus dados serão enviados com segurança para autorizar a renovação da sua assinatura.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-6" autoComplete="on">
            <FieldGroup>
              <Field><FieldLabel htmlFor="holderName">Nome no cartão</FieldLabel><Input id="holderName" autoComplete="cc-name" required value={form.holderName} onChange={(event) => update("holderName", event.target.value)} /></Field>
              <Field><FieldLabel htmlFor="number">Número do cartão</FieldLabel><Input id="number" inputMode="numeric" autoComplete="cc-number" required value={form.number} onChange={(event) => update("number", event.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field><FieldLabel htmlFor="expiryMonth">Mês</FieldLabel><Input id="expiryMonth" inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} required value={form.expiryMonth} onChange={(event) => update("expiryMonth", event.target.value)} /></Field>
                <Field><FieldLabel htmlFor="expiryYear">Ano</FieldLabel><Input id="expiryYear" inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} required value={form.expiryYear} onChange={(event) => update("expiryYear", event.target.value)} /></Field>
                <Field><FieldLabel htmlFor="ccv">CVV</FieldLabel><Input id="ccv" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required value={form.ccv} onChange={(event) => update("ccv", event.target.value)} /></Field>
              </div>
              <Field><FieldLabel htmlFor="name">Nome completo do titular</FieldLabel><Input id="name" autoComplete="name" required value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
              <Field><FieldLabel htmlFor="email">E-mail</FieldLabel><Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(event) => update("email", event.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="cpfCnpj">CPF ou CNPJ</FieldLabel><Input id="cpfCnpj" inputMode="numeric" required value={form.cpfCnpj} onChange={(event) => update("cpfCnpj", event.target.value)} /></Field>
                <Field><FieldLabel htmlFor="postalCode">CEP</FieldLabel><Input id="postalCode" inputMode="numeric" autoComplete="postal-code" required value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} /></Field>
              </div>
              <Field><FieldLabel htmlFor="addressNumber">Número do endereço</FieldLabel><Input id="addressNumber" autoComplete="address-line2" required value={form.addressNumber} onChange={(event) => update("addressNumber", event.target.value)} /></Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">Você verá a confirmação assim que a renovação da assinatura for autorizada.</p>
            {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
            <Button type="submit" size="lg" disabled={state === "submitting"}>{state === "submitting" ? "Autorizando…" : "Autorizar cartão e renovar assinatura"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

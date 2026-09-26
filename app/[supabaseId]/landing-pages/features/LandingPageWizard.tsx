"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { usePublicForms } from "../../forms/features/context/PublicFormsContext"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

const defaultContent = {
  brandName: "Corretor Studio",
  heroEyebrow: "Uma nova perspectiva em plano de saúde",
  heroTitle: "Cansado da abordagem superficial das corretoras de plano?",
  heroDescription: "Antes de falar em preço, entendemos quem são as vidas, qual rede é inegociável e quanto o reajuste já tirou do seu caixa. Só depois vem a proposta.",
  processTitle: "Como trabalhamos: corretagem vira consultoria.",
  processDescription: "Primeiro entender, depois estudar o mercado, e só então apresentar o que faz sentido para sua família e para o caixa da sua empresa.",
  processSteps: [
    { id: "understand", title: "Entender", description: "Conhecemos suas necessidades antes de apresentar opções." },
    { id: "study", title: "Estudar", description: "Comparamos o mercado a partir do seu perfil real." },
    { id: "present", title: "Apresentar", description: "Você recebe uma proposta que faz sentido para o seu momento." },
  ],
  testimonialsEnabled: false,
  footerText: "Corretor Studio",
}

export function LandingPageWizard() {
  const router = useRouter()
  const forms = usePublicForms()
  const [name, setName] = useState("")
  const [selectedFormId, setSelectedFormId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const publishedForms = useMemo(() => forms.items.filter((item) => item.status === "published"), [forms.items])

  async function createLanding() {
    if (!forms.ids || !name.trim() || !selectedFormId) {
      toast.error("Informe o nome e selecione um formulário publicado.")
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-supabase-user-id": forms.ids.supabaseId,
          "x-team-id": forms.ids.teamId,
        },
        body: JSON.stringify({
          name: name.trim(),
          publicFormId: selectedFormId,
          templateSlug: "cotacao-corretor-studio",
          content: defaultContent,
          offer: {
            enabled: true,
            badge: "Condição para empresas",
            percentage: 40,
            title: "No plano de saúde do seu CNPJ",
            items: ["Para quem ainda não tem plano", "Para quem quer reduzir o plano atual", "Para você, sua família e seus sócios"],
            disclaimer: "Desconto sujeito à análise do perfil e às condições da operadora.",
          },
        }),
      })
      const output = (await response.json()) as { isValid: boolean; errorMessages?: string[]; result?: { id: string } }
      if (!response.ok || !output.isValid) throw new Error(output.errorMessages?.[0] ?? "Não foi possível criar a landing.")
      if (output.result?.id) {
        const publishResponse = await fetch(`${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages/${output.result.id}?action=publish`, {
          method: "POST",
          headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId },
        })
        const publishOutput = (await publishResponse.json()) as { isValid: boolean; errorMessages?: string[] }
        if (!publishResponse.ok || !publishOutput.isValid) throw new Error(publishOutput.errorMessages?.[0] ?? "Landing criada, mas não publicada.")
      }
      toast.success("Landing de cotação criada")
      router.push(`/${forms.ids.supabaseId}/forms`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a landing.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container mx-auto flex max-w-3xl flex-1 flex-col gap-8 p-4 md:p-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Criar landing de cotação</h1>
        <p className="text-muted-foreground">Escolha o formulário que será apresentado na página de conversão.</p>
      </div>
      <section className="rounded-xl border bg-card p-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="landing-name">Nome interno</FieldLabel>
            <Input id="landing-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cotação de plano empresarial" />
            <FieldDescription>Esse nome é usado apenas dentro do Corretor Studio.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Formulário publicado</FieldLabel>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger><SelectValue placeholder="Selecione um formulário" /></SelectTrigger>
              <SelectContent>{publishedForms.map((form) => <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>)}</SelectContent>
            </Select>
            <FieldDescription>A landing não duplica perguntas. Ela usa o formulário selecionado.</FieldDescription>
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button type="button" disabled={isSaving} onClick={() => void createLanding()}>{isSaving ? "Criando..." : "Criar landing"}</Button>
          </div>
        </FieldGroup>
      </section>
    </main>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { usePublicForms } from "../../../forms/features/context/PublicFormsContext"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { LandingTemplateConfig, LandingTemplateSlug } from "@/lib/landing-pages/types"

const templates: Array<{ slug: Exclude<LandingTemplateSlug, "cotacao-corretor-studio">; name: string; description: string }> = [
  { slug: "black-and-white", name: "Black and White", description: "Consultoria editorial em preto e branco." },
  { slug: "alvora", name: "Alvorá", description: "Página institucional de corretora com imagem e prova social." },
]

function createTemplateConfig(templateSlug: string): LandingTemplateConfig {
  return {
    identity: { tradeName: "Sua marca", legalName: "", cnpj: "", logoUrl: null, copyright: "" },
    contact: { phoneDisplay: "", phoneE164: "", whatsappE164: "", whatsappMessage: "", email: "" },
    seo: { title: "", description: "", canonical: "", socialImageUrl: null },
    hero: templateSlug === "alvora"
      ? { eyebrow: "Compare planos de saúde", title: "para você e sua família.", description: "Descubra opções pelo seu CNPJ, além de alternativas individuais e por adesão.", primaryCta: "Quero comparar os planos" }
      : { eyebrow: "Antes de escolher, compare com contexto", title: "Antes de trocar ou contratar um plano, entenda o que realmente vale a pena comparar.", description: "Uma análise ajuda você a entender essas diferenças antes de decidir.", primaryCta: "Quero analisar minhas opções" },
    sections: {}, media: {},
  }
}

export function TemplateLandingPageWizard() {
  const router = useRouter(); const forms = usePublicForms(); const publishedForms = useMemo(() => forms.items.filter((form) => form.status === "published"), [forms.items])
  const [step, setStep] = useState<1 | 2>(1); const [name, setName] = useState(""); const [publicFormId, setPublicFormId] = useState(""); const [templateSlug, setTemplateSlug] = useState<Exclude<LandingTemplateSlug, "cotacao-corretor-studio">>("black-and-white"); const [config, setConfig] = useState(() => createTemplateConfig("black-and-white")); const [isSaving, setIsSaving] = useState(false)
  const updateIdentity = (key: keyof LandingTemplateConfig["identity"], value: string) => setConfig((current) => ({ ...current, identity: { ...current.identity, [key]: value } }))
  const updateContact = (key: keyof LandingTemplateConfig["contact"], value: string) => setConfig((current) => ({ ...current, contact: { ...current.contact, [key]: value } }))
  const updateHero = (key: keyof NonNullable<LandingTemplateConfig["hero"]>, value: string) => setConfig((current) => ({ ...current, hero: { ...current.hero, [key]: value } }))
  async function createLanding() {
    if (!forms.ids || !name.trim() || !publicFormId || !config.identity.tradeName.trim()) return toast.error("Informe o nome, o formulário e a identidade da corretora.")
    setIsSaving(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages`, { method: "POST", headers: { "content-type": "application/json", "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId }, body: JSON.stringify({ name, publicFormId, templateSlug, content: { brandName: config.identity.tradeName, heroTitle: config.hero?.title, heroDescription: config.hero?.description, footerText: config.identity.copyright, templateConfig: config }, offer: { enabled: false, badge: "", percentage: null, title: "", items: [], disclaimer: "" } }) })
      const output = await response.json() as { isValid: boolean; result?: { id: string }; errorMessages?: string[] }; if (!response.ok || !output.isValid || !output.result) throw new Error(output.errorMessages?.[0] ?? "Não foi possível criar a landing.")
      const publication = await fetch(`${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages/${output.result.id}?action=publish`, { method: "POST", headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId } }); if (!publication.ok) throw new Error("Landing criada, mas não publicada.")
      toast.success("Landing criada e publicada"); router.push(`/${forms.ids.supabaseId}/landing-pages`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a landing.") } finally { setIsSaving(false) }
  }
  return <main className="container mx-auto flex max-w-4xl flex-1 flex-col gap-8 p-4 md:p-8"><div className="grid gap-2"><h1 className="text-2xl font-semibold tracking-tight">Criar landing de cotação</h1><p className="text-muted-foreground">{step === 1 ? "Escolha o template e o formulário que receberá os contatos." : "Configure os dados que serão exibidos nesta campanha."}</p></div>{step === 1 ? <section className="rounded-xl border bg-card p-6"><FieldGroup><Field><FieldLabel htmlFor="landing-name">Nome interno</FieldLabel><Input id="landing-name" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field><FieldLabel>Formulário publicado</FieldLabel><Select value={publicFormId} onValueChange={setPublicFormId}><SelectTrigger><SelectValue placeholder="Selecione um formulário" /></SelectTrigger><SelectContent>{publishedForms.map((form) => <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel>Template</FieldLabel><div className="grid gap-4 md:grid-cols-2">{templates.map((template) => <button key={template.slug} type="button" onClick={() => { setTemplateSlug(template.slug); setConfig(createTemplateConfig(template.slug)) }} className={`rounded-xl border p-6 text-left ${templateSlug === template.slug ? "border-primary" : "border-border"}`}><strong>{template.name}</strong><p className="mt-2 text-sm text-muted-foreground">{template.description}</p></button>)}</div></Field><div className="flex justify-end"><Button type="button" onClick={() => setStep(2)}>Continuar</Button></div></FieldGroup></section> : <section className="rounded-xl border bg-card p-6"><FieldGroup><Field><FieldLabel htmlFor="trade-name">Nome da corretora</FieldLabel><Input id="trade-name" value={config.identity.tradeName} onChange={(event) => updateIdentity("tradeName", event.target.value)} /></Field><Field><FieldLabel htmlFor="cnpj">CNPJ</FieldLabel><Input id="cnpj" value={config.identity.cnpj ?? ""} onChange={(event) => updateIdentity("cnpj", event.target.value)} /></Field><Field><FieldLabel htmlFor="phone">Telefone</FieldLabel><Input id="phone" value={config.contact.phoneDisplay ?? ""} onChange={(event) => updateContact("phoneDisplay", event.target.value)} /></Field><Field><FieldLabel htmlFor="whatsapp">WhatsApp E.164</FieldLabel><Input id="whatsapp" value={config.contact.whatsappE164 ?? ""} onChange={(event) => updateContact("whatsappE164", event.target.value)} /></Field><Field><FieldLabel htmlFor="hero-title">Título da hero</FieldLabel><Textarea id="hero-title" value={config.hero?.title ?? ""} onChange={(event) => updateHero("title", event.target.value)} /></Field><Field><FieldLabel htmlFor="hero-description">Descrição da hero</FieldLabel><Textarea id="hero-description" value={config.hero?.description ?? ""} onChange={(event) => updateHero("description", event.target.value)} /><FieldDescription>Os demais blocos são opcionais: quando não configurados, não serão publicados.</FieldDescription></Field><div className="flex justify-between gap-3"><Button type="button" variant="outline" onClick={() => setStep(1)}>Voltar</Button><Button type="button" disabled={isSaving} onClick={() => void createLanding()}>{isSaving ? "Criando..." : "Criar landing"}</Button></div></FieldGroup></section>}</main>
}

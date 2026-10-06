"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { maskPhone, formatDocumentInput, normalizeLeadPhoneDigits, sanitizeDocumentDigits, isValidCNPJ, isValidPhone } from "@/lib/masks"
import { usePublicForms } from "../../../forms/features/context/PublicFormsContext"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { LandingTemplateConfig, LandingTemplateSlug } from "@/lib/landing-pages/types"

const templates: Array<{
  slug: Exclude<LandingTemplateSlug, "cotacao-corretor-studio">
  name: string
  description: string
}> = [
  {
    slug: "black-and-white",
    name: "Black and White",
    description: "Consultoria editorial em preto e branco.",
  },
  {
    slug: "alvora",
    name: "Alvorá",
    description: "Página institucional de corretora com imagem e prova social.",
  },
]

function createTemplateConfig(templateSlug: string): LandingTemplateConfig {
  return {
    templateSlug: templateSlug === "alvora" ? "alvora" : "black-and-white",
    identity: { tradeName: "Sua marca", legalName: "", cnpj: "", logoUrl: null, copyright: "" },
    contact: { phoneDisplay: "", phoneE164: "", whatsappE164: "", whatsappMessage: "", email: "" },
    seo: { title: "", description: "", canonical: "", socialImageUrl: null },
    hero:
      templateSlug === "alvora"
        ? {
            eyebrow: "Compare planos de saúde",
            title: "para você e sua família.",
            description:
              "Descubra opções pelo seu CNPJ, além de alternativas individuais e por adesão.",
            primaryCta: "Quero comparar os planos",
          }
        : {
            eyebrow: "Antes de escolher, compare com contexto",
            title:
              "Antes de trocar ou contratar um plano, entenda o que realmente vale a pena comparar.",
            description: "Uma análise ajuda você a entender essas diferenças antes de decidir.",
            primaryCta: "Quero analisar minhas opções",
          },
    sections:
      templateSlug === "alvora"
        ? {
            statistics: { enabled: true, items: [] },
            operators: { enabled: true, items: [] },
            differentials: { enabled: false, items: [] },
            faq: { enabled: true, title: "Plano de saúde sem complicação", items: [] },
            testimonials: { enabled: false, items: [] },
          }
        : {
            situations: {
              enabled: true,
              title: "Qual cenário mais parece com o seu?",
              items: [
                {
                  title: "Meu plano ficou caro",
                  description:
                    "O reajuste chegou e comecei a questionar se ainda faz sentido continuar no mesmo contrato.",
                },
                {
                  title: "Quero contratar um plano",
                  description:
                    "Estou pesquisando, mas é difícil entender o que realmente muda entre tantas opções.",
                },
                {
                  title: "Quero trocar de plano",
                  description: "Preço, rede ou minha realidade mudaram.",
                },
                {
                  title: "Tenho CNPJ",
                  description:
                    "Quero entender possibilidades para mim, minha família, sócios ou colaboradores.",
                },
              ],
            },
            process: {
              enabled: true,
              title: "Primeiro entendemos. Depois mostramos as possibilidades.",
              description: "Conte seu cenário, receba uma análise e compare com clareza.",
            },
            faq: {
              enabled: true,
              title: "Antes de fazer sua análise...",
              items: [
                {
                  title: "Já tenho plano. Posso fazer uma análise?",
                  description:
                    "Sim. Seu cenário atual pode servir como ponto de partida para entender possíveis alternativas.",
                },
                {
                  title: "Preciso trocar de plano?",
                  description:
                    "Não. O objetivo é entender se uma mudança realmente faz sentido antes de decidir.",
                },
                {
                  title: "Preciso ter CNPJ?",
                  description:
                    "Depende da modalidade analisada. Existem possibilidades diferentes conforme o perfil.",
                },
                {
                  title: "Posso manter meus hospitais e laboratórios?",
                  description:
                    "A rede deve fazer parte da comparação. As possibilidades dependem dos produtos disponíveis para o perfil e a região.",
                },
                {
                  title: "Como funciona carência?",
                  description: "As condições variam conforme produto, operadora e situação.",
                },
              ],
            },
          },
    media: {},
  }
}

export function TemplateLandingPageWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const forms = usePublicForms()
  const publishedForms = useMemo(
    () => forms.items.filter((form) => form.status === "published"),
    [forms.items],
  )
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState("")
  const [publicFormId, setPublicFormId] = useState("")
  const [templateSlug, setTemplateSlug] =
    useState<Exclude<LandingTemplateSlug, "cotacao-corretor-studio">>("black-and-white")
  const [config, setConfig] = useState(() => createTemplateConfig("black-and-white"))
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [isLookingUpCompany, setIsLookingUpCompany] = useState(false)
  const editingLandingId = searchParams.get("edit")
  const updateIdentity = (key: keyof LandingTemplateConfig["identity"], value: string) =>
    setConfig((current) => ({ ...current, identity: { ...current.identity, [key]: value } }))
  const updateContact = (key: keyof LandingTemplateConfig["contact"], value: string) =>
    setConfig((current) => ({ ...current, contact: { ...current.contact, [key]: value } }))
  const updatePhone = (value: string) =>
    setConfig((current) => ({
      ...current,
      contact: { ...current.contact, phoneDisplay: value, phoneE164: value },
    }))

  async function lookupCompany(cnpjValue: string) {
    if (!forms.ids) return
    const cnpj = sanitizeDocumentDigits(cnpjValue)
    if (!isValidCNPJ(cnpj)) return
    setIsLookingUpCompany(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/portfolio/cnpj-lookup?cnpj=${cnpj}`, {
        headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId },
      })
      const output = (await response.json()) as { isValid?: boolean; result?: { razaoSocial?: string } }
      if (response.ok && output.isValid && output.result?.razaoSocial) {
        updateIdentity("legalName", output.result.razaoSocial)
      } else {
        toast.error("Não foi possível consultar a Razão Social.")
      }
    } catch {
      toast.error("Não foi possível consultar a Razão Social.")
    } finally {
      setIsLookingUpCompany(false)
    }
  }

  useEffect(() => {
    if (!editingLandingId || !forms.ids) return
    let cancelled = false
    setIsLoadingEdit(true)
    void (async () => {
      try {
        const response = await fetch(
          `${API_CLIENT_BASE}/teams/${forms.ids!.teamId}/landing-pages/${editingLandingId}`,
          { headers: { "x-supabase-user-id": forms.ids!.supabaseId, "x-team-id": forms.ids!.teamId } },
        )
        const output = (await response.json()) as {
          isValid: boolean
          errorMessages?: string[]
          result?: {
            name: string
            publicFormId: string
            templateSlug: string
            content: { templateConfig?: LandingTemplateConfig; brandName?: string; heroTitle?: string; heroDescription?: string }
          }
        }
        if (!response.ok || !output.isValid || !output.result)
          throw new Error(output.errorMessages?.[0] ?? "Não foi possível carregar a landing.")
        if (cancelled) return
        setName(output.result.name)
        setPublicFormId(output.result.publicFormId)
        const loadedConfig = output.result.content.templateConfig ?? {
          ...createTemplateConfig(output.result.templateSlug),
          identity: {
            ...createTemplateConfig(output.result.templateSlug).identity,
            tradeName: output.result.content.brandName ?? output.result.name,
          },
          hero: {
            ...createTemplateConfig(output.result.templateSlug).hero,
            title: output.result.content.heroTitle ?? undefined,
            description: output.result.content.heroDescription ?? undefined,
          },
        }
        setTemplateSlug(loadedConfig.templateSlug === "alvora" ? "alvora" : "black-and-white")
        setConfig(loadedConfig)
        setStep(2)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar a landing.")
      } finally {
        if (!cancelled) setIsLoadingEdit(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editingLandingId, forms.ids?.supabaseId, forms.ids?.teamId])
  async function uploadLogo(file: File) {
    if (!forms.ids) return
    try {
      const body = new FormData()
      body.set("asset", file)
      const response = await fetch(`${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages/assets`, {
        method: "POST",
        headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId },
        body,
      })
      const output = (await response.json()) as { isValid: boolean; result?: { publicUrl: string }; errorMessages?: string[] }
      if (!response.ok || !output.isValid || !output.result) throw new Error(output.errorMessages?.[0] ?? "Não foi possível enviar o logo.")
      updateIdentity("logoUrl", output.result.publicUrl)
      toast.success("Logo enviado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o logo.")
    }
  }
  async function createLanding() {
    if (!forms.ids || !name.trim() || !publicFormId || !config.identity.tradeName.trim())
      return toast.error("Informe o nome, o formulário e a identidade da corretora.")
    const cnpj = sanitizeDocumentDigits(config.identity.cnpj ?? "")
    const phone = normalizeLeadPhoneDigits(config.contact.phoneDisplay ?? config.contact.phoneE164 ?? "")
    const whatsapp = normalizeLeadPhoneDigits(config.contact.whatsappE164 ?? "")
    if (cnpj && !isValidCNPJ(cnpj)) return toast.error("CNPJ inválido.")
    if (phone && !isValidPhone(phone)) return toast.error("Telefone inválido.")
    if (whatsapp && !isValidPhone(whatsapp)) return toast.error("WhatsApp inválido.")
    setIsSaving(true)
    const normalizedConfig: LandingTemplateConfig = {
      ...config,
      identity: { ...config.identity, cnpj },
      contact: { ...config.contact, phoneDisplay: phone, phoneE164: phone, whatsappE164: whatsapp, email: config.contact.email?.trim() || undefined },
      seo: config.seo
        ? { ...config.seo, canonical: config.seo.canonical?.trim() || undefined }
        : undefined,
    }
    try {
      const domainResponse = await fetch(`${API_CLIENT_BASE}/email/settings/studio-domain`, {
        headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId },
      })
      const domainOutput = (await domainResponse.json()) as {
        isValid?: boolean
        result?: { studioDomain?: { status?: string } | null }
        errorMessages?: string[]
      }
      if (!domainResponse.ok || domainOutput.isValid === false)
        throw new Error(domainOutput.errorMessages?.[0] ?? "Não foi possível verificar o domínio studio.")
      if (domainOutput.result?.studioDomain?.status !== "verified")
        throw new Error("Configure e verifique o subdomínio studio antes de criar a landing.")
      const endpoint = editingLandingId
        ? `${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages/${editingLandingId}`
        : `${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages`
      const response = await fetch(endpoint, {
        method: editingLandingId ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
          "x-supabase-user-id": forms.ids.supabaseId,
          "x-team-id": forms.ids.teamId,
        },
        body: JSON.stringify({
          name,
          publicFormId,
          templateSlug,
          content: {
            brandName: config.identity.tradeName,
            heroTitle: config.hero?.title,
            heroDescription: config.hero?.description,
            footerText: config.identity.copyright,
            templateConfig: normalizedConfig,
          },
          offer: {
            enabled: false,
            badge: "",
            percentage: null,
            title: "",
            items: [],
            disclaimer: "",
          },
        }),
      })
      const output = (await response.json()) as {
        isValid: boolean
        result?: { id: string }
        errorMessages?: string[]
      }
      if (!response.ok || !output.isValid || !output.result)
        throw new Error(output.errorMessages?.[0] ?? "Não foi possível criar a landing.")
      const publication = await fetch(
        `${API_CLIENT_BASE}/teams/${forms.ids.teamId}/landing-pages/${output.result.id}?action=publish`,
        {
          method: "POST",
          headers: { "x-supabase-user-id": forms.ids.supabaseId, "x-team-id": forms.ids.teamId },
        },
      )
      const publicationOutput = (await publication.json()) as { errorMessages?: string[] }
      if (!publication.ok) throw new Error(publicationOutput.errorMessages?.[0] ?? "Não foi possível publicar a landing.")
      toast.success(editingLandingId ? "Landing atualizada e publicada" : "Landing criada e publicada")
      router.push(`/${forms.ids.supabaseId}/landing-pages`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a landing.")
    } finally {
      setIsSaving(false)
    }
  }
  return (
    <main className="container mx-auto flex max-w-4xl flex-1 flex-col gap-8 p-4 md:p-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {editingLandingId ? "Editar landing de cotação" : "Criar landing de cotação"}
        </h1>
        <p className="text-muted-foreground">
          {step === 1
            ? "Escolha o template e o formulário que receberá os contatos."
            : "Configure os dados que serão exibidos nesta campanha."}
        </p>
      </div>
      {step === 1 ? (
        <section className="rounded-xl border bg-card p-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="landing-name">Nome interno</FieldLabel>
              <Input
                id="landing-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Formulário publicado</FieldLabel>
              <Select value={publicFormId} onValueChange={setPublicFormId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um formulário" />
                </SelectTrigger>
                <SelectContent>
                  {publishedForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Template</FieldLabel>
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.slug}
                    type="button"
                    onClick={() => {
                      setTemplateSlug(template.slug)
                      setConfig(createTemplateConfig(template.slug))
                    }}
                    className={`rounded-xl border p-6 text-left ${templateSlug === template.slug ? "border-primary" : "border-border"}`}
                  >
                    <strong>{template.name}</strong>
                    <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex justify-end">
              <Button type="button" disabled={isLoadingEdit} onClick={() => setStep(2)}>
                {isLoadingEdit ? "Carregando..." : "Continuar"}
              </Button>
            </div>
          </FieldGroup>
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="trade-name">Nome da corretora</FieldLabel>
              <Input
                id="trade-name"
                value={config.identity.tradeName}
                onChange={(event) => updateIdentity("tradeName", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="legal-name">Razão social</FieldLabel>
              <Input id="legal-name" value={config.identity.legalName ?? ""} readOnly disabled={isLookingUpCompany} placeholder="Preenchida automaticamente pelo CNPJ" />
            </Field>
            <Field>
              <FieldLabel htmlFor="landing-logo">Logo</FieldLabel>
              <Input
                id="landing-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadLogo(file)
                }}
              />
              <FieldDescription>
                Opcional. Quando enviada, a logo substitui a marca textual do template.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
              <Input
                id="cnpj"
                value={formatDocumentInput(config.identity.cnpj ?? "")}
                onChange={(event) => updateIdentity("cnpj", sanitizeDocumentDigits(event.target.value))}
                onBlur={(event) => void lookupCompany(event.target.value)}
                inputMode="numeric"
                maxLength={18}
              />
              {isLookingUpCompany ? <FieldDescription>Consultando Razão Social...</FieldDescription> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefone para contato</FieldLabel>
              <Input
                id="phone"
                value={maskPhone(normalizeLeadPhoneDigits(config.contact.phoneDisplay ?? config.contact.phoneE164 ?? ""))}
                onChange={(event) => {
                  const digits = normalizeLeadPhoneDigits(event.target.value)
                  updatePhone(digits)
                }}
                inputMode="tel"
                type="tel"
                maxLength={16}
                placeholder="(11) 91234-1234"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
              <Input
                id="whatsapp"
                value={maskPhone(normalizeLeadPhoneDigits(config.contact.whatsappE164 ?? ""))}
                onChange={(event) => updateContact("whatsappE164", normalizeLeadPhoneDigits(event.target.value))}
                inputMode="tel"
                type="tel"
                maxLength={16}
                placeholder="(11) 91234-1234"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-email">E-mail de contato</FieldLabel>
              <Input
                id="contact-email"
                type="email"
                value={config.contact.email ?? ""}
                onChange={(event) => updateContact("email", event.target.value)}
              />
              <FieldDescription>
                O título e a descrição da hero seguem a copy aprovada do template. Os demais blocos são opcionais.
              </FieldDescription>
            </Field>
            <div className="flex justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="button" disabled={isSaving || isLoadingEdit} onClick={() => void createLanding()}>
                {isSaving ? "Salvando..." : editingLandingId ? "Salvar alterações" : "Criar landing"}
              </Button>
            </div>
          </FieldGroup>
        </section>
      )}
    </main>
  )
}

"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { Check, CreditCard, KeyRound, Pencil, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AccordionHeader, AccordionItem, AccordionPanel, AccordionRoot, AccordionTrigger } from "@/components/smoothui/accordion"
import AnimatedFileUpload from "@/components/smoothui/animated-file-upload"
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from "@/components/smoothui/collapsible"
import { TabsList, TabsPanel, TabsRoot, TabsTab } from "@/components/smoothui/tabs"
import { usePaymentProviderInstances } from "../context/PaymentProviderInstancesHook"
import type { CreatePaymentProviderInstance, PaymentProviderInstance } from "../services/IPaymentProviderInstancesService"
import { paymentProviderInstancesService } from "../services/PaymentProviderInstancesService"
import { CardConfigCard } from "../card-config/CardConfigCard"

const PROVIDERS = [
  { key: "ABACATE_PAY", name: "Abacate Pay", description: "PIX e cartão de crédito" },
  { key: "ASAAS", name: "Asaas", description: "Credenciais de integração" },
] as const satisfies ReadonlyArray<{ key: PaymentProviderInstance["provider"]; name: string; description: string }>

const CREDENTIAL_FIELDS: Record<PaymentProviderInstance["provider"], Array<{ key: string; label: string }>> = {
  ABACATE_PAY: [
    { key: "API_KEY", label: "Chave de API" },
    { key: "WEBHOOK_SECRET", label: "Segredo do webhook" },
    { key: "PUBLIC_KEY", label: "Chave pública" },
  ],
  ASAAS: [
    { key: "API_KEY", label: "Chave de API" },
    { key: "WEBHOOK_TOKEN", label: "Token do webhook" },
  ],
}

const ENVIRONMENTS = [
  { value: "DEV", label: "Desenvolvimento", detail: "testes e validações" },
  { value: "PRODUCTION", label: "Produção", detail: "cobranças reais" },
] as const

type Environment = PaymentProviderInstance["environment"]
type Provider = PaymentProviderInstance["provider"]
type UpdateInstance = (input: {
  id: string
  isDefault?: boolean
  credentials?: Record<string, string>
  displayName?: string
  logoUrl?: string | null
  logoAltText?: string | null
}) => Promise<void>

export function PaymentProviderInstancesContainer() {
  const { instances, loading, saving, error, refresh, create, update, checkHealth } = usePaymentProviderInstances()

  return (
    <main id="backoffice-main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8 [&_.text-muted-foreground:not([role=tab])]:text-foreground/70">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Backoffice · Pagamentos</p>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Providers de pagamento</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Uma conta por provider, com credenciais independentes para testes e cobranças reais.</p>
        </div>
      </header>

      <CardConfigCard />

      <section aria-label="Providers de pagamento" className="flex flex-col gap-4">
        {loading ? (
          <><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></>
        ) : error ? (
          <Card><CardContent className="flex flex-col gap-3 p-6"><p role="alert">{error}</p><Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></CardContent></Card>
        ) : PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.key}
            provider={provider.key}
            providerName={provider.name}
            description={provider.description}
            instances={instances.filter((instance) => instance.provider === provider.key)}
            saving={saving}
            create={create}
            update={update}
            checkHealth={checkHealth}
          />
        ))}
      </section>
    </main>
  )
}

function ProviderCard({
  provider,
  providerName,
  description,
  instances,
  saving,
  create,
  update,
  checkHealth,
}: {
  provider: Provider
  providerName: string
  description: string
  instances: PaymentProviderInstance[]
  saving: boolean
  create: (input: CreatePaymentProviderInstance) => Promise<void>
  update: UpdateInstance
  checkHealth: (provider: Provider, environment: Environment) => Promise<void>
}) {
  const [activeEnvironment, setActiveEnvironment] = useState<Environment>("DEV")
  const [displayName, setDisplayName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoAltText, setLogoAltText] = useState("")
  const [identityDirty, setIdentityDirty] = useState(false)
  const [identitySaving, setIdentitySaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoRemoving, setLogoRemoving] = useState(false)
  const [logoUploadRevision, setLogoUploadRevision] = useState(0)
  const [identityAccordion, setIdentityAccordion] = useState("")

  const identitySource = useMemo(() => instances.find((instance) => instance.displayName || instance.logoUrl) ?? instances[0], [instances])
  useEffect(() => {
    if (identityDirty) return
    setDisplayName(identitySource?.displayName ?? providerName)
    setLogoUrl(identitySource?.logoUrl ?? "")
    setLogoAltText(identitySource?.logoAltText ?? "")
  }, [identityDirty, identitySource, providerName])

  const defaultEnvironmentCount = instances.filter((item) => item.isDefault).length
  const defaultContext = provider === "ABACATE_PAY" ? "abacate-pay" : "asaas"
  const identitySaved = instances.length > 0

  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!instances.length) {
      toast.info("A identificação será salva junto à primeira configuração de ambiente.")
      return
    }
    setIdentitySaving(true)
    try {
      for (const instance of instances) {
        await update({
          id: instance.id,
          displayName: displayName.trim() || providerName,
          logoUrl: logoUrl || null,
          logoAltText: logoAltText.trim() || null,
        })
      }
      setIdentityDirty(false)
      setIdentityAccordion("")
      toast.success("Identificação da integração salva")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar a identificação")
    } finally {
      setIdentitySaving(false)
    }
  }

  async function onLogoSelected(files: File[]) {
    const file = files[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const uploadedLogoUrl = await paymentProviderInstancesService.uploadLogo(file)
      setLogoUrl(uploadedLogoUrl)
      setIdentityDirty(true)
      setLogoUploadRevision((revision) => revision + 1)
      toast.success("Logo enviada. Salve a identificação para aplicá-la ao provider.")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar a logo")
    } finally {
      setLogoUploading(false)
    }
  }

  async function removeLogo() {
    setLogoRemoving(true)
    try {
      setLogoUrl("")
      setIdentityDirty(true)
      if (instances.length) {
        for (const instance of instances) await update({ id: instance.id, logoUrl: null, logoAltText: null })
        setIdentityDirty(false)
        toast.success("Logo removida da integração")
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível remover a logo")
    } finally {
      setLogoRemoving(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderLogo logoUrl={identitySource?.logoUrl ?? logoUrl} alt={identitySource?.logoAltText ?? (logoAltText || providerName)} />
          <div className="min-w-0">
            <CardTitle className="truncate">{identitySource?.displayName || displayName || providerName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{providerName} · {description}</p>
          </div>
        </div>
        <Badge variant={defaultEnvironmentCount ? "default" : "secondary"} className="w-fit">
          {defaultEnvironmentCount ? `Padrão em ${defaultEnvironmentCount === 1 ? "um ambiente" : `${defaultEnvironmentCount} ambientes`}` : instances.length ? "Configurado" : "Não configurado"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <AccordionRoot type="multiple" multiple value={identityAccordion ? [identityAccordion] : []} onValueChange={(values) => setIdentityAccordion(values[0] ?? "")} className="rounded-lg border border-border">
          <AccordionItem value="identity" className="border-0">
            <AccordionHeader>
              <AccordionTrigger>
                <span className="flex flex-col gap-0.5">
                  <span>Identificação da integração</span>
                  <span className="text-xs font-normal text-muted-foreground">Nome e logo compartilhados entre os ambientes</span>
                </span>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <form onSubmit={saveIdentity} className="space-y-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`${provider}-display-name`}>Nome da integração</FieldLabel>
                    <Input id={`${provider}-display-name`} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setIdentityDirty(true) }} maxLength={80} required />
                    <FieldDescription>Rótulo para reconhecer esta conta. Desenvolvimento e Produção são ambientes da mesma integração.</FieldDescription>
                    <CollapsibleRoot className="mt-1 border-0 bg-transparent">
                      <CollapsibleTrigger className="min-h-11 justify-start px-0 text-xs text-muted-foreground hover:bg-transparent">O que é o nome da integração?</CollapsibleTrigger>
                      <CollapsiblePanel className="border-0">
                        <p>É um rótulo para reconhecer esta conexão no backoffice. Não cria nem altera a conta no provider e não é uma credencial; os tokens de Desenvolvimento e Produção continuam separados.</p>
                      </CollapsiblePanel>
                    </CollapsibleRoot>
                  </Field>
                  <Field>
                    <FieldLabel>Logo do provider</FieldLabel>
                    {logoUrl && (
                      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <ProviderLogo logoUrl={logoUrl} alt={logoAltText || providerName} large />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">Logo atual</p>
                          <p className="text-xs text-muted-foreground">Armazenada no Corretor Studio</p>
                        </div>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => void removeLogo()} disabled={logoRemoving || identitySaving} aria-label="Remover logo">
                          <X data-icon="inline-start" /> Remover
                        </Button>
                      </div>
                    )}
                    <AnimatedFileUpload
                      key={logoUploadRevision}
                      accept="image/jpeg,image/png,image/webp"
                      helperText={logoUploading ? "Enviando logo…" : "PNG, JPG ou WebP · até 2 MB"}
                      multiple={false}
                      maxSize={2 * 1024 * 1024}
                      disabled={logoUploading || identitySaving}
                      onFilesSelected={(files) => void onLogoSelected(files)}
                    />
                    <FieldDescription>O arquivo é enviado para o armazenamento do Corretor Studio, sem depender de um link externo.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${provider}-logo-alt`}>Texto alternativo da logo</FieldLabel>
                    <Input id={`${provider}-logo-alt`} value={logoAltText} onChange={(event) => { setLogoAltText(event.target.value); setIdentityDirty(true) }} maxLength={120} placeholder={`Logo ${providerName}`} />
                  </Field>
                </FieldGroup>
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{identitySaved ? "As alterações serão aplicadas aos ambientes já configurados." : "A identificação será salva ao configurar o primeiro ambiente."}</p>
                  <Button type="submit" className="min-h-11" disabled={identitySaving || logoUploading || logoRemoving || !identityDirty || !identitySaved}>
                    <Check data-icon="inline-start" /> {identitySaving ? "Salvando…" : "Salvar identificação"}
                  </Button>
                </div>
              </form>
            </AccordionPanel>
          </AccordionItem>
        </AccordionRoot>

        <TabsRoot value={activeEnvironment} onValueChange={(value) => setActiveEnvironment(value as Environment)}>
          <TabsList variant="segment" className="w-full sm:w-fit" aria-label={`Ambientes do ${providerName}`}>
            {ENVIRONMENTS.map(({ value, label }) => (
              <TabsTab key={value} value={value} className="min-h-11 flex-1 sm:min-w-44 sm:flex-none">
                <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                  <span>{label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{value === "DEV" ? "Testes" : "Cobranças reais"}</span>
                </span>
              </TabsTab>
            ))}
          </TabsList>
          {ENVIRONMENTS.map(({ value, label, detail }) => (
            <TabsPanel key={value} value={value} forceMount className="pt-5">
              <EnvironmentPanel
                provider={provider}
                environment={value}
                environmentLabel={label}
                environmentDetail={detail}
                instance={instances.find((item) => item.environment === value) ?? null}
                siblingInstance={instances.find((item) => item.environment !== value) ?? null}
                displayName={displayName.trim() || providerName}
                logoUrl={logoUrl || null}
                logoAltText={logoAltText.trim() || null}
                defaultContext={defaultContext}
                saving={saving}
                create={create}
                update={update}
                checkHealth={checkHealth}
              />
            </TabsPanel>
          ))}
        </TabsRoot>
      </CardContent>
    </Card>
  )
}

function EnvironmentPanel({
  provider,
  environment,
  environmentLabel,
  environmentDetail,
  instance,
  siblingInstance,
  displayName,
  logoUrl,
  logoAltText,
  defaultContext,
  saving,
  create,
  update,
  checkHealth,
}: {
  provider: Provider
  environment: Environment
  environmentLabel: string
  environmentDetail: string
  instance: PaymentProviderInstance | null
  siblingInstance: PaymentProviderInstance | null
  displayName: string
  logoUrl: string | null
  logoAltText: string | null
  defaultContext: string
  saving: boolean
  create: (input: CreatePaymentProviderInstance) => Promise<void>
  update: UpdateInstance
  checkHealth: (provider: Provider, environment: Environment) => Promise<void>
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [externalAccountContext, setExternalAccountContext] = useState(instance?.externalAccountContext ?? siblingInstance?.externalAccountContext ?? defaultContext)
  const [accordionValue, setAccordionValue] = useState("")
  const [localSaving, setLocalSaving] = useState(false)
  const credentialsSummary = Object.entries(instance?.credentials ?? {})

  useEffect(() => {
    setExternalAccountContext(instance?.externalAccountContext ?? siblingInstance?.externalAccountContext ?? defaultContext)
    setCredentials({})
  }, [defaultContext, instance?.id, siblingInstance?.externalAccountContext])

  async function saveEnvironment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const configuredCredentials = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()))
    setLocalSaving(true)
    try {
      if (instance) {
        if (!Object.keys(configuredCredentials).length) {
          toast.info("Informe ao menos uma credencial para salvar.")
          return
        }
        await update({ id: instance.id, credentials: configuredCredentials })
        toast.success(`Credenciais de ${environmentLabel.toLocaleLowerCase("pt-BR")} atualizadas`)
      } else {
        await create({
          provider,
          environment,
          displayName,
          logoUrl,
          logoAltText,
          externalAccountContext: externalAccountContext.trim(),
          isDefault: false,
          credentials: configuredCredentials,
        })
        toast.success(`${environmentLabel} configurado`)
      }
      setCredentials({})
      setAccordionValue("")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar as credenciais")
    } finally {
      setLocalSaving(false)
    }
  }

  async function setAsDefault() {
    if (!instance) return
    setLocalSaving(true)
    try {
      await update({ id: instance.id, isDefault: true })
      toast.success(`Provider padrão atualizado para ${environmentLabel.toLocaleLowerCase("pt-BR")}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível definir o provider padrão")
    } finally {
      setLocalSaving(false)
    }
  }

  async function verifyHealth() {
    setLocalSaving(true)
    try {
      await checkHealth(provider, environment)
      toast.success("Verificação concluída")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível verificar o provider")
    } finally {
      setLocalSaving(false)
    }
  }

  const isSaving = saving || localSaving
  const required = (key: string) => !instance && (key !== "PUBLIC_KEY" || environment === "DEV")
  const needsHealthCheck = provider === "ABACATE_PAY" && instance?.isDefault

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{environmentLabel}</span>
            <Badge variant={instance ? (instance.healthStatus === "HEALTHY" ? "default" : "secondary") : "outline"}>
              {instance ? `Estado: ${instance.healthStatus}` : "Ainda não configurado"}
            </Badge>
            {instance?.isDefault && <Badge variant="default">Padrão neste ambiente</Badge>}
            {instance && !instance.isSelectable && <Badge variant="outline">Somente credenciais</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{instance ? `Credenciais próprias para ${environmentDetail}.` : `Adicione as credenciais usadas em ${environmentDetail}.`}</p>
          {instance?.lastHealthCheckAt && <p className="text-xs text-muted-foreground">Última verificação: {new Date(instance.lastHealthCheckAt).toLocaleString("pt-BR")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {needsHealthCheck && <Button type="button" variant="outline" className="min-h-11" onClick={() => void verifyHealth()} disabled={isSaving}><ShieldCheck data-icon="inline-start" /> Verificar saúde</Button>}
          {instance && !instance.isDefault && instance.isSelectable && instance.enabled && instance.rolloutState === "ACTIVE" && instance.healthStatus === "HEALTHY" && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void setAsDefault()} disabled={isSaving}>Definir como padrão</Button>
          )}
        </div>
      </div>

      {instance && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Credenciais cadastradas</p>
          {credentialsSummary.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma credencial salva.</p> : (
            <div className="flex flex-wrap gap-2">
              {credentialsSummary.map(([key, value]) => (
                <Badge key={key} variant="outline" className="gap-1.5 px-2.5 py-1.5 font-normal">
                  <KeyRound aria-hidden="true" className="size-3.5" />
                  <span>{CREDENTIAL_FIELDS[provider].find((field) => field.key === key)?.label ?? key}</span>
                  <span className="text-muted-foreground">{value.isSet ? (value.last4 ? `Final ${value.last4}` : "configurada") : "não configurada"}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <AccordionRoot type="multiple" multiple value={accordionValue ? [accordionValue] : []} onValueChange={(values) => setAccordionValue(values[0] ?? "")} className="rounded-lg border border-border">
        <AccordionItem value="environment-settings" className="border-0">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex flex-col gap-0.5">
                <span>{instance ? "Editar credenciais" : `Configurar ${environmentLabel.toLocaleLowerCase("pt-BR")}`}</span>
                <span className="text-xs font-normal text-muted-foreground">{instance ? "Os valores atuais não são exibidos; preencha apenas os que deseja substituir." : "Esta configuração usa tokens separados da outra aba."}</span>
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <form onSubmit={saveEnvironment} className="space-y-5">
              <Field>
                <FieldLabel htmlFor={`${provider}-${environment}-context`}>Identificador técnico do ambiente</FieldLabel>
                <Input
                  id={`${provider}-${environment}-context`}
                  value={instance?.externalAccountContext ?? externalAccountContext}
                  onChange={(event) => setExternalAccountContext(event.target.value)}
                  maxLength={120}
                  required={!instance}
                  disabled={Boolean(instance)}
                  readOnly={Boolean(instance)}
                />
                <FieldDescription>Código interno usado para associar notificações do provider a esta configuração. Não é uma credencial nem o nome visível da integração.</FieldDescription>
              </Field>
              <FieldGroup>
                {CREDENTIAL_FIELDS[provider].map(({ key, label }) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`${provider}-${environment}-${key}`}>{label}{required(key) ? " *" : ""}</FieldLabel>
                    <Input
                      id={`${provider}-${environment}-${key}`}
                      type="password"
                      autoComplete="new-password"
                      value={credentials[key] ?? ""}
                      onChange={(event) => setCredentials((current) => ({ ...current, [key]: event.target.value }))}
                      required={required(key)}
                      placeholder={instance ? "Deixe vazio para manter a credencial salva" : "Cole a credencial deste ambiente"}
                      aria-describedby={instance ? `${provider}-${environment}-${key}-help` : undefined}
                    />
                    {instance && <FieldDescription id={`${provider}-${environment}-${key}-help`}>O segredo salvo nunca é revelado. Um novo valor substitui o atual.</FieldDescription>}
                  </Field>
                ))}
              </FieldGroup>
              {provider === "ASAAS" && <p className="text-sm text-muted-foreground">O provider Asaas ainda não está disponível para novos pagamentos.</p>}
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">As credenciais desta aba não alteram as do outro ambiente.</p>
                <Button type="submit" className="min-h-11" disabled={isSaving}>
                  <Pencil data-icon="inline-start" /> {isSaving ? "Salvando…" : instance ? "Salvar credenciais" : `Salvar ${environmentLabel.toLocaleLowerCase("pt-BR")}`}
                </Button>
              </div>
            </form>
          </AccordionPanel>
        </AccordionItem>
      </AccordionRoot>
    </div>
  )
}

function ProviderLogo({ logoUrl, alt, large = false }: { logoUrl?: string | null; alt: string; large?: boolean }) {
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background ${large ? "size-14" : "size-12"}`}>
      {logoUrl ? <Image src={logoUrl} alt={alt} fill sizes={large ? "56px" : "48px"} className="object-contain p-1" unoptimized /> : <CreditCard aria-hidden="true" className="size-5 text-muted-foreground" />}
    </div>
  )
}

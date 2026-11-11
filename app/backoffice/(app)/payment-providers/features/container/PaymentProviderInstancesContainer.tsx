"use client"

import { useState } from "react"
import { KeyRound, Pencil, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePaymentProviderInstances } from "../context/PaymentProviderInstancesHook"
import type { CreatePaymentProviderInstance, PaymentProviderInstance } from "../services/IPaymentProviderInstancesService"

const CREDENTIAL_FIELDS: Record<PaymentProviderInstance["provider"], Array<{ key: string; label: string }>> = {
  ABACATE_PAY: [
    { key: "API_KEY", label: "API key" },
    { key: "WEBHOOK_SECRET", label: "Webhook secret" },
    { key: "PUBLIC_KEY", label: "Public key" },
  ],
  ASAAS: [{ key: "API_KEY", label: "API key" }, { key: "WEBHOOK_TOKEN", label: "Webhook token" }],
}

export function PaymentProviderInstancesContainer() {
  const { instances, loading, saving, error, refresh, create, update, checkHealth } = usePaymentProviderInstances()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<PaymentProviderInstance | null>(null)
  const [provider, setProvider] = useState<PaymentProviderInstance["provider"]>("ABACATE_PAY")
  const [environment, setEnvironment] = useState<PaymentProviderInstance["environment"]>("DEV")
  const [displayName, setDisplayName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoAltText, setLogoAltText] = useState("")
  const [externalAccountContext, setExternalAccountContext] = useState("")
  const [credentials, setCredentials] = useState<Record<string, string>>({})

  async function saveInstance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const rotatedCredentials = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()))
    try {
      if (editingInstance) {
        await update({
          id: editingInstance.id,
          credentials: rotatedCredentials,
          displayName: displayName.trim(),
          logoUrl: logoUrl.trim() || null,
          logoAltText: logoAltText.trim() || null,
        })
        toast.success("Instância atualizada")
      } else {
        const input: CreatePaymentProviderInstance = {
          provider,
          environment,
          displayName,
          logoUrl: logoUrl.trim() || null,
          logoAltText: logoAltText.trim() || null,
          externalAccountContext,
          isDefault: false,
          credentials: rotatedCredentials,
        }
        await create(input)
        toast.success("Instância criada")
      }
      setDialogOpen(false)
      setEditingInstance(null)
      setDisplayName("")
      setLogoUrl("")
      setLogoAltText("")
      setExternalAccountContext("")
      setCredentials({})
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar a instância")
    }
  }

  function openCreate() {
    setEditingInstance(null)
    setProvider("ABACATE_PAY")
    setEnvironment("DEV")
    setCredentials({})
    setDisplayName("")
    setLogoUrl("")
    setLogoAltText("")
    setDialogOpen(true)
  }

  function openRotation(instance: PaymentProviderInstance) {
    setEditingInstance(instance)
    setProvider(instance.provider)
    setEnvironment(instance.environment)
    setDisplayName(instance.displayName ?? "")
    setLogoUrl(instance.logoUrl ?? "")
    setLogoAltText(instance.logoAltText ?? "")
    setCredentials({})
    setDialogOpen(true)
  }

  return (
    <main id="backoffice-main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Backoffice · Pagamentos</p>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Providers de pagamento</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Gerencie contas por ambiente e credenciais sem exibir valores já salvos.</p>
        </div>
        <Button onClick={openCreate} className="min-h-11 rounded-2xl shadow-[0_12px_28px_-8px_color-mix(in_srgb,var(--primary)_60%,transparent)]">
          <Plus data-icon="inline-start" /> Nova instância
        </Button>
      </header>

      <section aria-label="Instâncias de pagamento" className="flex flex-col gap-3">
        {loading ? <Skeleton className="h-40 w-full" /> : error ? (
          <Card><CardContent className="flex flex-col gap-3 p-6"><p role="alert">{error}</p><Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></CardContent></Card>
        ) : instances.length === 0 ? (
          <Card><CardContent className="flex flex-col items-start gap-3 p-6"><p className="font-medium">Nenhuma instância configurada</p><p className="text-sm text-muted-foreground">Crie uma instância para cadastrar credenciais de pagamento.</p><Button className="min-h-11" variant="outline" onClick={openCreate}><Plus data-icon="inline-start" /> Nova instância</Button></CardContent></Card>
        ) : instances.map((instance) => <InstanceCard key={instance.id} instance={instance} onEdit={() => openRotation(instance)} onCheckHealth={async () => {
          try { await checkHealth(instance.provider, instance.environment); toast.success("Verificação concluída") }
          catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível verificar o provider") }
        }} onSetDefault={async () => {
          try { await update({ id: instance.id, isDefault: true }); toast.success("Provider padrão atualizado") }
          catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível definir padrão") }
        }} onRotate={() => openRotation(instance)} />)}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingInstance ? `Editar ${editingInstance.displayName ?? "instância"}` : "Nova instância"}</DialogTitle></DialogHeader>
          <form onSubmit={saveInstance} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex-1 overflow-y-auto pr-1">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="provider-name">Nome da instância</FieldLabel>
                  <Input id="provider-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="provider-logo-url">URL da logo (opcional)</FieldLabel>
                  <Input id="provider-logo-url" type="url" inputMode="url" placeholder="https://..." value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="provider-logo-alt">Texto alternativo da logo</FieldLabel>
                  <Input id="provider-logo-alt" value={logoAltText} onChange={(event) => setLogoAltText(event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="provider-context">Contexto da conta</FieldLabel>
                  <Input id="provider-context" value={externalAccountContext} onChange={(event) => setExternalAccountContext(event.target.value)} required disabled={Boolean(editingInstance)} />
                  <FieldDescription>Identificador interno único para esta conta.</FieldDescription>
                </Field>
                <Field>
                  <Label htmlFor="provider-select">Provider</Label>
                  <Select value={provider} disabled={Boolean(editingInstance)} onValueChange={(value) => { setProvider(value as PaymentProviderInstance["provider"]); setCredentials({}) }}>
                    <SelectTrigger id="provider-select"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ABACATE_PAY">Abacate Pay</SelectItem><SelectItem value="ASAAS">Asaas · somente credenciais</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor="environment-select">Ambiente</Label>
                  <Select value={environment} disabled={Boolean(editingInstance)} onValueChange={(value) => setEnvironment(value as PaymentProviderInstance["environment"])}>
                    <SelectTrigger id="environment-select"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="DEV">Desenvolvimento</SelectItem><SelectItem value="PRODUCTION">Produção</SelectItem></SelectContent>
                  </Select>
                </Field>
                {CREDENTIAL_FIELDS[provider].map(({ key, label }) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`credential-${key}`}>{label}</FieldLabel>
                    <Input id={`credential-${key}`} type="password" autoComplete="new-password" value={credentials[key] ?? ""} onChange={(event) => setCredentials((current) => ({ ...current, [key]: event.target.value }))} required={!editingInstance && (key !== "PUBLIC_KEY" || environment === "DEV")} />
                  </Field>
                ))}
                {provider === "ASAAS" && <p className="text-sm text-muted-foreground">O adapter Asaas ainda não pode ser selecionado para novos pagamentos.</p>}
              </FieldGroup>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando…" : editingInstance ? "Salvar alterações" : "Salvar instância"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function InstanceCard({ instance, onEdit, onCheckHealth, onSetDefault, onRotate }: {
  instance: PaymentProviderInstance
  onEdit: () => void
  onCheckHealth: () => void
  onSetDefault: () => void
  onRotate: () => void
}) {
  const providerName = instance.provider === "ASAAS" ? "Asaas" : "Abacate Pay"
  const credentials = Object.entries(instance.credentials)
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1"><CardTitle>{instance.displayName ?? providerName}</CardTitle><p className="text-sm text-muted-foreground">{providerName} · {instance.environment} · {instance.externalAccountContext}</p></div>
        <div className="flex flex-wrap justify-end gap-2"><Badge variant={instance.isDefault ? "default" : "secondary"}>{instance.isDefault ? "Padrão" : "Instância"}</Badge>{!instance.isSelectable && <Badge variant="outline">Somente credenciais</Badge>}</div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil data-icon="inline-start" /> Editar instância</Button>
          <Button size="sm" variant="outline" onClick={onRotate}>Rotacionar credenciais</Button>
          {instance.provider === "ABACATE_PAY" && instance.isDefault && <Button size="sm" variant="outline" onClick={onCheckHealth}>Verificar saúde</Button>}
          {instance.isSelectable && !instance.isDefault && instance.enabled && instance.rolloutState === "ACTIVE" && instance.healthStatus === "HEALTHY" && <Button size="sm" variant="outline" onClick={onSetDefault}>Definir como padrão</Button>}
        </div>
        <div className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-muted-foreground" /> Estado: {instance.healthStatus}</div>
        {instance.lastHealthCheckAt && <p className="text-xs text-muted-foreground">Última verificação: {new Date(instance.lastHealthCheckAt).toLocaleString("pt-BR")}</p>}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Credenciais</p>
          {credentials.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma credencial salva</p> : credentials.map(([key, value]) => <div key={key} className="flex flex-wrap items-center gap-2 text-sm"><KeyRound className="size-4 text-muted-foreground" /><span>{key}</span><Badge variant="outline">{value.isSet ? `Final ${value.last4 ?? "····"}` : "Não configurada"}</Badge></div>)}
        </div>
      </CardContent>
    </Card>
  )
}

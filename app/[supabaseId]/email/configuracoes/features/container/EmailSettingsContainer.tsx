"use client"

import { CheckCircle2, LoaderCircle, Mail, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import { AccessPermissionsCard } from "../components/AccessPermissionsCard"
import { CustomDomainCard } from "../components/CustomDomainCard"
import { StudioDomainCard } from "../components/StudioDomainCard"
import { StudioTrackingCard } from "../components/StudioTrackingCard"
import { DispatchRestrictionsCard } from "../components/DispatchRestrictionsCard"
import { GlobalVariablesCard } from "../components/GlobalVariablesCard"
import { SenderCard } from "../components/SenderCard"
import { TemplateApprovalCard } from "../components/TemplateApprovalCard"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"

export function EmailSettingsContainer() {
  const { readOnly } = useStudioEmailRuntime()
  const { saving, loading, senders, handleSave, hasUnsavedChanges, domainStatus, settings } = useEmailSettingsContext()
  const health = settings?.domainHealth ?? (domainStatus === "verified" ? "healthy" : "attention")

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 rounded-[1.75rem] border border-border/60 bg-[linear-gradient(135deg,var(--surface-1),var(--surface-0))] px-6 py-7 shadow-[var(--precision-shadow-2)] md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings2 className="size-6" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[family-name:var(--font-poppins)] text-[clamp(1.625rem,2vw,2rem)] font-bold tracking-[-0.02em] text-foreground">
                  Configurações de E-mail
                </h1>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Ajuste identidade de envio, permissões, aprovações e domínio próprio em uma única área operacional.
              </p>
            </div>
          </div>

          <div className="flex min-w-[220px] flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="size-4 text-primary" />
              Resumo rápido
            </div>
            <p className="text-sm text-muted-foreground">
              {senders.length > 0
                ? `${senders.length} remetente${senders.length > 1 ? "s" : ""} cadastrado${senders.length > 1 ? "s" : ""}`
                : "Nenhum remetente configurado ainda"}
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Estado do domínio">
              <Badge variant={domainStatus === "verified" ? "outline" : "secondary"}>
                Temperatura: {settings?.domainTemperature === "stable" ? "estável" : "aquecendo"}
              </Badge>
              <Badge variant={health === "healthy" ? "outline" : "secondary"}>
                Saúde: {health === "healthy" ? "saudável" : health === "paused" ? "pausada" : "atenção"}
              </Badge>
              {settings?.warmupStatus === "warming" ? <Badge variant="secondary">Em aquecimento · {settings.warmupUsed ?? 0}/{settings.warmupLimit ?? 100}</Badge> : null}
              <Badge variant={settings?.dmarcStatus === "aligned" ? "outline" : "secondary"}>
                DMARC: {settings?.dmarcStatus === "aligned" ? "alinhado" : settings?.dmarcStatus === "failed" ? "falhou" : settings?.dmarcStatus === "attention" ? "atenção" : "pendente"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Seções das configurações de e-mail" className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {[
          ["visao-geral", "Visão geral"],
          ["entrega", "Entrega e reputação"],
          ["identidade", "Domínios e remetentes"],
          ["conteudo", "Conteúdo e variáveis"],
          ["governanca", "Governança"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <fieldset disabled={readOnly} className={readOnly ? "pointer-events-none flex flex-col gap-6 opacity-60" : "flex flex-col gap-6"}>
        <section id="visao-geral" className="flex flex-col gap-6 scroll-mt-6">
          <div id="entrega"><CustomDomainCard /></div>
          <StudioDomainCard />
          <StudioTrackingCard />
        </section>
        <section id="identidade" className="flex flex-col gap-6 scroll-mt-6">
          <SenderCard />
        </section>
        <section id="conteudo" className="flex flex-col gap-6 scroll-mt-6">
          <GlobalVariablesCard />
        </section>
        <section id="governanca" className="flex flex-col gap-6 scroll-mt-6">
          <DispatchRestrictionsCard />
          <AccessPermissionsCard />
          <TemplateApprovalCard />
        </section>
      </fieldset>

      {!readOnly && hasUnsavedChanges ? (
      <div className="sticky bottom-4 z-10 mt-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-[var(--precision-shadow-2)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-semantic-success/10 text-semantic-success">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                Configuração centralizada
              </p>
              <p className="text-sm text-muted-foreground">
                Salve as regras gerais depois de revisar permissões, bloqueios e aprovação de templates.
              </p>
            </div>
          </div>

          <Button onClick={() => void handleSave()} disabled={saving || loading} className="md:min-w-52 max-lg:h-11">
            {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </div>
      ) : readOnly ? (
        <p className="text-sm text-muted-foreground">
          Você tem acesso somente leitura às configurações de e-mail deste cliente.
        </p>
      ) : null}
    </div>
  )
}

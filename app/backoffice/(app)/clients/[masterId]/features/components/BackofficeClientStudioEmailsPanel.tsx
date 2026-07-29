"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudioEmailHostProvider } from "@/lib/email/studio-email-host"
import { CampanhasProvider } from "@/app/[supabaseId]/email/campanhas/features/context/CampanhasContext"
import { CampanhasContainer } from "@/app/[supabaseId]/email/campanhas/features/container/CampanhasContainer"
import { ContactsProvider } from "@/app/[supabaseId]/email/contatos/features/context/ContactsContext"
import { ContatosContainer } from "@/app/[supabaseId]/email/contatos/features/container/ContatosContainer"
import { TemplatesProvider } from "@/app/[supabaseId]/email/templates/features/context/TemplatesContext"
import { TemplatesContainer } from "@/app/[supabaseId]/email/templates/features/container/TemplatesContainer"
import { HistoricoProvider } from "@/app/[supabaseId]/email/historico/features/context/HistoricoContext"
import { HistoricoContainer } from "@/app/[supabaseId]/email/historico/features/container/HistoricoContainer"
import { EmailSettingsProvider } from "@/app/[supabaseId]/email/configuracoes/features/context/EmailSettingsContext"
import { EmailSettingsContainer } from "@/app/[supabaseId]/email/configuracoes/features/container/EmailSettingsContainer"
import { createStudioEmailHost } from "../emails/createStudioEmailHost"
import { BackofficeEmailMetricsContainer } from "../emails/metricas/container/BackofficeEmailMetricsContainer"

type EmailSubSection =
  | "campanhas"
  | "contatos"
  | "templates"
  | "historico"
  | "configuracoes"
  | "metricas"

type TeamOption = { id: string; name: string }

type Props = {
  masterId: string
  teams: TeamOption[]
  selectedTeamId: string | null
  onSelectedTeamIdChange: (teamId: string | null) => void
  canManage: boolean
}

export function BackofficeClientStudioEmailsPanel({
  masterId,
  teams,
  selectedTeamId,
  onSelectedTeamIdChange,
}: Props) {
  const [subSection, setSubSection] = useState<EmailSubSection>("campanhas")
  const teamId = selectedTeamId
  const host = useMemo(
    () => (teamId ? createStudioEmailHost(masterId, teamId) : null),
    [masterId, teamId]
  )

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Este cliente ainda não possui times para gerenciar e-mails.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-[220px]">
          <FieldLabel>Time</FieldLabel>
          <Select
            value={selectedTeamId ?? undefined}
            onValueChange={(value) => onSelectedTeamIdChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um time" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button asChild variant="outline" type="button">
          <Link href="/backoffice/emails/campanhas">Campanhas operacionais do CS</Link>
        </Button>
      </div>

      {!teamId || !host ? (
        <p className="text-sm text-muted-foreground">Selecione um time para continuar.</p>
      ) : (
        <StudioEmailHostProvider host={host}>
          <Tabs
            value={subSection}
            onValueChange={(value) => setSubSection(value as EmailSubSection)}
          >
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
              <TabsTrigger value="contatos">Contatos</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
              <TabsTrigger value="metricas">Métricas</TabsTrigger>
            </TabsList>

            <TabsContent value="campanhas" className="mt-4">
              <CampanhasProvider supabaseId={masterId}>
                <CampanhasContainer />
              </CampanhasProvider>
            </TabsContent>

            <TabsContent value="contatos" className="mt-4">
              <ContactsProvider supabaseId={masterId}>
                <ContatosContainer />
              </ContactsProvider>
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <TemplatesProvider supabaseId={masterId}>
                <TemplatesContainer />
              </TemplatesProvider>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <HistoricoProvider supabaseId={masterId}>
                <HistoricoContainer />
              </HistoricoProvider>
            </TabsContent>

            <TabsContent value="configuracoes" className="mt-4">
              <EmailSettingsProvider>
                <EmailSettingsContainer />
              </EmailSettingsProvider>
            </TabsContent>

            <TabsContent value="metricas" className="mt-4">
              <BackofficeEmailMetricsContainer />
            </TabsContent>
          </Tabs>
        </StudioEmailHostProvider>
      )}
    </div>
  )
}

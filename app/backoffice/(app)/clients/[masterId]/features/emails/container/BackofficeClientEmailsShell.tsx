"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBackofficeClientEmailsContext } from "../context/BackofficeClientEmailsContext"
import type { EmailSection } from "../context/BackofficeClientEmailsTypes"
import { BackofficeCampanhasContainer } from "../campanhas/container/BackofficeCampanhasContainer"
import { BackofficeContatosContainer } from "../contatos/container/BackofficeContatosContainer"
import { BackofficeTemplatesContainer } from "../templates/container/BackofficeTemplatesContainer"
import { BackofficeHistoricoContainer } from "../historico/container/BackofficeHistoricoContainer"
import { BackofficeSettingsContainer } from "../configuracoes/container/BackofficeSettingsContainer"
import { BackofficeMetricsContainer } from "../metricas/container/BackofficeMetricsContainer"

const EMAIL_SECTIONS: Array<{ value: EmailSection; label: string }> = [
  { value: "campaigns", label: "Campanhas" },
  { value: "contacts", label: "Contatos" },
  { value: "templates", label: "Templates" },
  { value: "historico", label: "Histórico" },
  { value: "configuracoes", label: "Configurações" },
  { value: "metricas", label: "Métricas" },
]

export function BackofficeClientEmailsShell() {
  const {
    teams,
    selectedTeamId,
    onSelectedTeamIdChange,
    emailSection,
    setEmailSection,
    bumpRefresh,
  } = useBackofficeClientEmailsContext()

  useEffect(() => {
    if (!selectedTeamId && teams[0]?.id) {
      onSelectedTeamIdChange(teams[0].id)
    }
  }, [selectedTeamId, teams, onSelectedTeamIdChange])

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
        <FieldGroup className="min-w-55">
          <Field>
            <FieldLabel>Time</FieldLabel>
            <Select
              value={selectedTeamId ?? ""}
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
        </FieldGroup>
        <Button
          type="button"
          variant="outline"
          onClick={bumpRefresh}
          disabled={!selectedTeamId}
        >
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      {!selectedTeamId ? (
        <p className="text-sm text-muted-foreground">Selecione um time para continuar.</p>
      ) : (
        <Tabs
          value={emailSection}
          onValueChange={(value) => setEmailSection(value as EmailSection)}
        >
          <TabsList className="flex h-auto flex-wrap">
            {EMAIL_SECTIONS.map((section) => (
              <TabsTrigger key={section.value} value={section.value}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <BackofficeCampanhasContainer />
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            <BackofficeContatosContainer />
          </TabsContent>
          <TabsContent value="templates" className="mt-4">
            <BackofficeTemplatesContainer />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <BackofficeHistoricoContainer />
          </TabsContent>
          <TabsContent value="configuracoes" className="mt-4">
            <BackofficeSettingsContainer />
          </TabsContent>
          <TabsContent value="metricas" className="mt-4">
            <BackofficeMetricsContainer />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

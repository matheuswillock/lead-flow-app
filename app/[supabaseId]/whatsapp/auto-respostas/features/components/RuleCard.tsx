"use client"

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Pencil } from 'lucide-react'
import type { WhatsAppAutoResponseRule } from '../context/WhatsAppAutoResponsesTypes'
import { useWhatsAppAutoResponsesContext } from '../context/WhatsAppAutoResponsesContext'
import { RuleFormDialog } from './RuleFormDialog'

const RULE_LABELS: Record<WhatsAppAutoResponseRule['type'], string> = {
  WELCOME: 'Boas-vindas',
  OFF_HOURS: 'Fora do horário',
  KEYWORD: 'Palavra-chave',
}

const RULE_DESCRIPTIONS: Record<WhatsAppAutoResponseRule['type'], string> = {
  WELCOME: 'Enviada no primeiro contato e cria lead no CRM automaticamente.',
  OFF_HOURS: 'Responde quando a mensagem chega fora do horário comercial configurado.',
  KEYWORD: 'Dispara quando o texto recebido corresponde às palavras-chave.',
}

interface RuleCardProps {
  rule: WhatsAppAutoResponseRule
}

export function RuleCard({ rule }: RuleCardProps) {
  const { toggleRule, isSaving } = useWhatsAppAutoResponsesContext()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{RULE_LABELS[rule.type]}</CardTitle>
              <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                {rule.isActive ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            <CardDescription>{RULE_DESCRIPTIONS[rule.type]}</CardDescription>
          </div>
          <Switch
            checked={rule.isActive}
            disabled={isSaving}
            onCheckedChange={(checked) => {
              toggleRule(rule.id, checked).catch(() => undefined)
            }}
            aria-label={`Ativar regra ${RULE_LABELS[rule.type]}`}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {rule.replyMessage.trim() || 'Nenhuma mensagem configurada.'}
          </p>
          {rule.type === 'KEYWORD' && rule.triggerKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rule.triggerKeywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
        </CardContent>
      </Card>

      <RuleFormDialog rule={rule} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

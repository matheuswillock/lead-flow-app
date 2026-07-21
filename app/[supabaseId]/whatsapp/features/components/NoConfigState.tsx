"use client"

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'

interface NoConfigStateProps {
  supabaseId: string
}

export function NoConfigState({ supabaseId }: NoConfigStateProps) {
  const { config } = useWhatsAppInboxContext()

  const statusLabel =
    config?.status === 'DISCONNECTED'
      ? 'desconectado'
      : config?.status === 'ERROR'
        ? 'com erro'
        : config?.status === 'BANNED'
          ? 'banido'
          : config?.status === 'PENDING'
            ? 'pendente'
            : config?.status === 'QR_READY'
              ? 'aguardando leitura do QR Code'
              : null

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="size-8 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">WhatsApp não configurado</h2>
          <p className="text-sm text-muted-foreground">
            {statusLabel
              ? `O WhatsApp do seu time está ${statusLabel}. `
              : ''}
            Configure o número do seu time em Configurações do WhatsApp para usar a inbox.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${supabaseId}/whatsapp/configuracoes`}>Ir para Configurações do WhatsApp</Link>
        </Button>
      </div>
    </div>
  )
}

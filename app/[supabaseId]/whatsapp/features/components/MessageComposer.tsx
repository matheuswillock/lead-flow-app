"use client"

import { useCallback, useRef, useState } from 'react'
import { SendHorizonal, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'

interface MessageComposerProps {
  disabled?: boolean
}

export function MessageComposer({ disabled = false }: MessageComposerProps) {
  const { isSending, sendMessage, config } = useWhatsAppInboxContext()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDisconnected = config?.status !== 'CONNECTED'
  const isDisabled = disabled || isSending || isDisconnected

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isDisabled) return
    sendMessage(trimmed)
    setText('')
    textareaRef.current?.focus()
  }, [text, isDisabled, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex flex-col gap-2">
      {isDisconnected && (
        <p className="text-xs text-muted-foreground">
          O WhatsApp está desconectado. Reconecte em Integrações para enviar mensagens.
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          disabled={isDisabled}
          rows={1}
          className={cn(
            'max-h-24 flex-1 resize-none',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        />
        <Button
          type="button"
          size="icon"
          disabled={isDisabled || !text.trim()}
          onClick={handleSend}
          aria-label="Enviar mensagem"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { Loader2, Plus, SendHorizonal, Smile } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((mod) => mod.default), {
  ssr: false,
})

type EmojiPickerData = {
  emoji: string
}

interface WhatsAppMessageInputShellProps {
  children: ReactNode
  trailingInPill?: ReactNode
  onAttach: () => void
  attachDisabled?: boolean
  showAttachEmoji?: boolean
  emojiDisabled?: boolean
  onEmojiSelect: (emoji: string) => void
  showSendButton: boolean
  onSend: () => void
  isSending?: boolean
  sendDisabled?: boolean
  sendAriaLabel?: string
}

export function WhatsAppMessageInputShell({
  children,
  trailingInPill,
  onAttach,
  attachDisabled = false,
  showAttachEmoji = true,
  emojiDisabled = false,
  onEmojiSelect,
  showSendButton,
  onSend,
  isSending = false,
  sendDisabled = false,
  sendAriaLabel = "Enviar mensagem",
}: WhatsAppMessageInputShellProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)

  useEffect(() => {
    if (!showAttachEmoji) setEmojiOpen(false)
  }, [showAttachEmoji])

  return (
    <div className="flex items-end gap-2">
      <div className="flex min-h-10 min-w-0 flex-1 items-end gap-1 rounded-full bg-muted px-2 py-1.5">
        {showAttachEmoji ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={attachDisabled}
              onClick={onAttach}
              aria-label="Anexar arquivo"
            >
              <Plus />
            </Button>

            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={emojiDisabled}
                  aria-label="Inserir emoji"
                >
                  <Smile />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-auto border-0 p-0 shadow-lg">
                <EmojiPicker
                  onEmojiClick={(emojiData: EmojiPickerData) => {
                    if (!emojiData?.emoji) return
                    onEmojiSelect(emojiData.emoji)
                    setEmojiOpen(false)
                  }}
                  width={320}
                  height={400}
                  lazyLoadEmojis
                />
              </PopoverContent>
            </Popover>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center">{children}</div>

        {trailingInPill ? <div className="shrink-0">{trailingInPill}</div> : null}
      </div>

      {showSendButton ? (
        <Button
          type="button"
          size="icon"
          className={cn("size-10 shrink-0 rounded-full")}
          disabled={sendDisabled || isSending}
          onClick={onSend}
          aria-label={sendAriaLabel}
        >
          {isSending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
        </Button>
      ) : null}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { SendMessageMediaInput, WhatsAppTeamContact } from "../context/WhatsAppInboxTypes"
import { useWhatsAppAudioRecorder } from "../hooks/useWhatsAppAudioRecorder"
import { WhatsAppAudioRecordingBar } from "./WhatsAppAudioRecordingBar"
import { WhatsAppMessageInputShell } from "./WhatsAppMessageInputShell"
import { getChatKind } from "../utils/whatsappDisplay"
import {
  getMicrophoneUnsupportedMessage,
  isMicrophoneSupported,
  MICROPHONE_PERMISSION_DENIED_MESSAGE,
} from "../utils/microphonePermission"

interface MessageComposerProps {
  disabled?: boolean
}

const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_CHARS = 4096

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler arquivo"))
        return
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result
      resolve(base64 ?? "")
    }
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"))
    reader.readAsDataURL(file)
  })
}

function resolveMediaType(file: File): SendMessageMediaInput["mediatype"] | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("audio/")) return "audio"
  if (file.type.startsWith("video/")) return "video"
  if (
    file.type === "application/pdf" ||
    file.type.startsWith("application/") ||
    file.type === "text/plain"
  ) {
    return "document"
  }
  return null
}

function getContactLabel(contact: WhatsAppTeamContact): string {
  return contact.displayName?.trim() || contact.pushName?.trim() || contact.phoneNumber || contact.opaqueId
}

function detectMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor)
  const match = /(^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return null
  const query = match[2] ?? ""
  const start = before.length - query.length - 1
  return { start, query }
}

export function MessageComposer({ disabled = false }: MessageComposerProps) {
  const { isSending, sendMessage, config, selectedConversation, contacts } = useWhatsAppInboxContext()
  const [text, setText] = useState("")
  const [mentionedJids, setMentionedJids] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isGroupChat = getChatKind(selectedConversation?.externalChatId ?? null) === "group"
  const isDisconnected = config?.status !== "CONNECTED"
  const charCount = text.length
  const isNearLimit = charCount >= MAX_CHARS * 0.8
  const isAtLimit = charCount >= MAX_CHARS
  const hasText = text.trim().length > 0

  const filteredMentionContacts = useMemo(() => {
    const term = mentionQuery.trim().toLowerCase()
    const list = contacts.filter((contact) => contact.remoteJid && !contact.remoteJid.endsWith("@g.us"))
    if (!term) return list.slice(0, 8)
    return list
      .filter((contact) => {
        const label = getContactLabel(contact).toLowerCase()
        return label.includes(term) || contact.opaqueId.includes(term)
      })
      .slice(0, 8)
  }, [contacts, mentionQuery])

  useEffect(() => {
    setMentionHighlight(0)
  }, [mentionQuery, mentionOpen])

  const handleSendAudio = useCallback(
    async (file: File) => {
      const base64 = await fileToBase64(file)
      // sendMessage é fire-and-forget (retorna void, não Promise) — o envio
      // real acontece de forma assíncrona via performSend/optimistic update.
      sendMessage("", {
        mediatype: "audio",
        mimeType: file.type,
        fileName: file.name,
        base64,
      })
    },
    [sendMessage]
  )

  const recorder = useWhatsAppAudioRecorder({
    onSend: handleSendAudio,
    onError: (error) => {
      if (error.code === "NotAllowedError") {
        setMicPermissionDenied(true)
      }
      toast.error(error.message)
    },
  })

  useEffect(() => {
    if (recorder.status === "recording") {
      setMicPermissionDenied(false)
    }
  }, [recorder.status])

  const isRecording = recorder.isRecording
  const isDisabled = disabled || isSending || isDisconnected || isRecording

  const resetMentionState = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery("")
  }, [])

  const handleSendText = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isDisabled) return
    sendMessage(trimmed, undefined, mentionedJids.length > 0 ? mentionedJids : undefined)
    setText("")
    setMentionedJids([])
    resetMentionState()
    textareaRef.current?.focus()
  }, [text, isDisabled, sendMessage, mentionedJids, resetMentionState])

  const insertMention = useCallback(
    (contact: WhatsAppTeamContact) => {
      const label = getContactLabel(contact)
      const before = text.slice(0, mentionStart)
      const cursor = textareaRef.current?.selectionStart ?? text.length
      const after = text.slice(cursor)
      const insertion = `@${label} `
      const next = `${before}${insertion}${after}`.slice(0, MAX_CHARS)
      setText(next)
      setMentionedJids((prev) =>
        prev.includes(contact.remoteJid) ? prev : [...prev, contact.remoteJid]
      )
      resetMentionState()
      const nextCursor = Math.min(before.length + insertion.length, MAX_CHARS)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
      })
    },
    [mentionStart, resetMentionState, text]
  )

  const handleTextChange = useCallback(
    (value: string) => {
      const next = value.slice(0, MAX_CHARS)
      setText(next)
      if (!isGroupChat) {
        resetMentionState()
        return
      }
      const cursor = textareaRef.current?.selectionStart ?? next.length
      const mention = detectMentionQuery(next, cursor)
      if (mention) {
        setMentionOpen(true)
        setMentionQuery(mention.query)
        setMentionStart(mention.start)
      } else {
        resetMentionState()
      }
    },
    [isGroupChat, resetMentionState]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && filteredMentionContacts.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setMentionHighlight((prev) => (prev + 1) % filteredMentionContacts.length)
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setMentionHighlight((prev) =>
            prev === 0 ? filteredMentionContacts.length - 1 : prev - 1
          )
          return
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault()
          const contact = filteredMentionContacts[mentionHighlight]
          if (contact) insertMention(contact)
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          resetMentionState()
          return
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSendText()
      }
    },
    [
      filteredMentionContacts,
      handleSendText,
      insertMention,
      mentionHighlight,
      mentionOpen,
      resetMentionState,
    ]
  )

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file || isDisabled) return

      if (file.size > MAX_FILE_BYTES) {
        toast.error("Arquivo muito grande. O limite é 16 MB.")
        return
      }

      const mediatype = resolveMediaType(file)
      if (!mediatype) {
        toast.error("Tipo de arquivo não suportado.")
        return
      }

      try {
        const base64 = await fileToBase64(file)
        const caption = text.trim() || undefined
        sendMessage(caption ?? "", {
          mediatype,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
          base64,
          caption,
        })
        setText("")
        setMentionedJids([])
        resetMentionState()
      } catch {
        toast.error("Falha ao enviar arquivo.")
      }
    },
    [isDisabled, resetMentionState, sendMessage, text]
  )

  const insertEmojiAtCursor = useCallback((emoji: string) => {
    setText((current) => {
      const target = textareaRef.current
      if (!target) {
        return (current + emoji).slice(0, MAX_CHARS)
      }
      const start = target.selectionStart ?? current.length
      const end = target.selectionEnd ?? current.length
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`.slice(0, MAX_CHARS)
      const cursor = Math.min(start + emoji.length, MAX_CHARS)
      requestAnimationFrame(() => {
        target.focus()
        target.setSelectionRange(cursor, cursor)
      })
      return next
    })
  }, [])

  const handleStartRecording = useCallback(() => {
    if (isDisabled || hasText) return
    if (!isMicrophoneSupported()) {
      toast.error(getMicrophoneUnsupportedMessage())
      return
    }
    void recorder.start()
  }, [hasText, isDisabled, recorder])

  const showSendButton = hasText || isRecording
  const shellDisabled = isDisabled && !isRecording

  return (
    <div className="flex flex-col gap-2">
      {isDisconnected && (
        <p className="text-xs text-muted-foreground">
          O WhatsApp está desconectado. Reconecte em Integrações para enviar mensagens.
        </p>
      )}

      {micPermissionDenied && (
        <Alert variant="destructive">
          <MicOff />
          <AlertDescription>{MICROPHONE_PERMISSION_DENIED_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => void handleFileChange(e)}
      />

      <Popover open={mentionOpen && isGroupChat} onOpenChange={setMentionOpen}>
        <PopoverAnchor asChild>
          <div>
            <WhatsAppMessageInputShell
              onAttach={() => fileInputRef.current?.click()}
              attachDisabled={shellDisabled}
              showAttachEmoji={!isRecording}
              emojiDisabled={shellDisabled}
              onEmojiSelect={insertEmojiAtCursor}
              showSendButton={showSendButton}
              onSend={() => {
                if (isRecording) {
                  void recorder.send()
                  return
                }
                handleSendText()
              }}
              isSending={isSending}
              sendDisabled={isRecording ? false : !hasText || shellDisabled}
              sendAriaLabel={isRecording ? "Enviar áudio" : "Enviar mensagem"}
              trailingInPill={
                !isRecording && !hasText ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={shellDisabled}
                    onClick={handleStartRecording}
                    aria-label="Gravar áudio"
                  >
                    <Mic />
                  </Button>
                ) : undefined
              }
            >
              {isRecording ? (
                <WhatsAppAudioRecordingBar
                  status={recorder.status}
                  elapsedMs={recorder.elapsedMs}
                  waveformLevels={recorder.waveformLevels}
                  onCancel={recorder.cancel}
                  onPause={recorder.pause}
                  onResume={recorder.resume}
                />
              ) : (
                <div className="relative w-full">
                  <Textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={() => {
                      const cursor = textareaRef.current?.selectionStart ?? text.length
                      const mention = detectMentionQuery(text, cursor)
                      if (mention && isGroupChat) {
                        setMentionOpen(true)
                        setMentionQuery(mention.query)
                        setMentionStart(mention.start)
                      }
                    }}
                    placeholder={isGroupChat ? "Digite uma mensagem (@ para mencionar)" : "Digite uma mensagem"}
                    disabled={shellDisabled}
                    rows={1}
                    className={cn(
                      "max-h-24 min-h-8 w-full resize-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0",
                      shellDisabled && "cursor-not-allowed opacity-50"
                    )}
                  />
                  {isNearLimit && (
                    <span
                      className={cn(
                        "pointer-events-none absolute bottom-1 right-0 text-[10px]",
                        isAtLimit ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {MAX_CHARS - charCount}
                    </span>
                  )}
                </div>
              )}
            </WhatsAppMessageInputShell>
          </div>
        </PopoverAnchor>
        {isGroupChat && filteredMentionContacts.length > 0 ? (
          <PopoverContent className="w-64 p-1" align="start" side="top">
            <div className="flex flex-col gap-0.5">
              {filteredMentionContacts.map((contact, index) => (
                <button
                  key={contact.id}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-sm",
                    index === mentionHighlight ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(contact)
                  }}
                >
                  <span className="font-medium">{getContactLabel(contact)}</span>
                  {contact.phoneNumber ? (
                    <span className="ml-1 text-xs text-muted-foreground">{contact.phoneNumber}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  )
}

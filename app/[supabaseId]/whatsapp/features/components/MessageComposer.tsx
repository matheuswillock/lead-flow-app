"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Mic, MicOff, X } from "lucide-react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { SendMessageMediaInput, WhatsAppTeamContact } from "../context/WhatsAppInboxTypes"
import { useWhatsAppAudioRecorder } from "../hooks/useWhatsAppAudioRecorder"
import { WhatsAppAudioRecordingBar } from "./WhatsAppAudioRecordingBar"
import { WhatsAppMessageInputShell } from "./WhatsAppMessageInputShell"
import { getChatKind } from "../utils/whatsappDisplay"
import { createMediaUploadAndPut } from "../utils/uploadWhatsAppMedia"
import {
  getMicrophoneUnsupportedMessage,
  isMicrophoneSupported,
  MICROPHONE_PERMISSION_DENIED_MESSAGE,
  queryMicrophonePermission,
  requestMicrophoneStream,
  MicrophoneAccessError,
} from "../utils/microphonePermission"

interface MessageComposerProps {
  disabled?: boolean
}

const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_CHARS = 4096

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  webm: "audio/webm",
}

type AttachmentDraft = {
  file: File
  previewUrl: string | null
  mediatype: SendMessageMediaInput["mediatype"]
  mimeType: string
}

function inferMimeType(file: File): string {
  if (file.type) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension && EXTENSION_MIME_MAP[extension]) {
    return EXTENSION_MIME_MAP[extension]!
  }
  return "application/octet-stream"
}

function resolveMediaType(file: File): SendMessageMediaInput["mediatype"] | null {
  const mimeType = inferMimeType(file)
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.startsWith("video/")) return "video"
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("application/") ||
    mimeType === "text/plain" ||
    mimeType === "application/octet-stream"
  ) {
    return "document"
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const {
    isSending,
    sendMessage,
    config,
    selectedConversation,
    contacts,
    activeTeamId,
    supabaseId,
    replyTarget,
    setReplyTarget,
    contactIsTyping,
  } = useWhatsAppInboxContext()
  const [text, setText] = useState("")
  const [mentionedJids, setMentionedJids] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [howToOpenMicDialog, setHowToOpenMicDialog] = useState(false)
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  const isGroupChat = getChatKind(selectedConversation?.externalChatId ?? null) === "group"
  const isDisconnected = config?.status !== "CONNECTED"
  const charCount = text.length
  const isNearLimit = charCount >= MAX_CHARS * 0.8
  const isAtLimit = charCount >= MAX_CHARS
  const hasText = text.trim().length > 0

  const clearAttachmentDraft = useCallback(() => {
    setAttachmentDraft((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setUploadProgress(null)
  }, [])

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setIsUploading(false)
    setUploadProgress(null)
  }, [])

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

  useEffect(() => () => {
    cancelUpload()
    clearAttachmentDraft()
  }, [cancelUpload, clearAttachmentDraft])

  const uploadAndSendFile = useCallback(
    async (file: File, mediatype: SendMessageMediaInput["mediatype"], caption?: string) => {
      if (!activeTeamId || !selectedConversation?.id || !supabaseId) {
        toast.error("Conversa indisponível para envio.")
        return
      }
      const clientMessageId = crypto.randomUUID()
      const controller = new AbortController()
      uploadAbortRef.current = controller
      setIsUploading(true)
      setUploadProgress(0)
      try {
        const uploaded = await createMediaUploadAndPut({
          teamId: activeTeamId,
          supabaseId,
          conversationId: selectedConversation.id,
          clientMessageId,
          file,
          signal: controller.signal,
          onProgress: (ratio) => setUploadProgress(Math.round(ratio * 100)),
        })
        sendMessage(
          "",
          {
            mediatype,
            mimeType: uploaded.mimeType,
            fileName: uploaded.fileName,
            storagePath: uploaded.storagePath,
            sha256: uploaded.sha256,
            sizeBytes: uploaded.sizeBytes,
            caption,
          },
          undefined,
          {
            clientMessageId,
            quotedMessageId: replyTarget?.id,
          }
        )
        clearAttachmentDraft()
        setText("")
        setMentionedJids([])
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          toast.message("Upload cancelado")
          return
        }
        toastUserError(error)
      } finally {
        uploadAbortRef.current = null
        setIsUploading(false)
        setUploadProgress(null)
      }
    },
    [activeTeamId, clearAttachmentDraft, replyTarget?.id, selectedConversation?.id, sendMessage, supabaseId]
  )

  const handleSendAudio = useCallback(
    async (file: File) => {
      await uploadAndSendFile(file, "audio")
    },
    [uploadAndSendFile]
  )

  const [waveformBarCount, setWaveformBarCount] = useState(56)

  const recorder = useWhatsAppAudioRecorder({
    onSend: handleSendAudio,
    waveformBarCount,
    onError: (error) => {
      if (error.code === "NotAllowedError") {
        setMicPermissionDenied(true)
      }
      toastUserError(error)
    },
  })

  useEffect(() => {
    if (recorder.status === "recording") {
      setMicPermissionDenied(false)
    }
  }, [recorder.status])

  useEffect(() => {
    if (!isMicrophoneSupported()) return
    let permissionStatus: PermissionStatus | null = null
    const syncPermissionState = (state: PermissionState) => {
      setMicPermissionDenied(state === "denied")
    }
    void queryMicrophonePermission().then((state) => {
      if (state) syncPermissionState(state)
    })
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        permissionStatus = status
        syncPermissionState(status.state)
        status.onchange = () => syncPermissionState(status.state)
      })
      .catch(() => undefined)
    return () => {
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  const isRecording = recorder.isRecording
  const isDisabled = disabled || isSending || isDisconnected || isRecording || isUploading

  const resetMentionState = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery("")
  }, [])

  const handleSendText = useCallback(() => {
    const trimmed = text.trim()
    if (attachmentDraft) {
      if (isDisabled) return
      void uploadAndSendFile(attachmentDraft.file, attachmentDraft.mediatype, trimmed || undefined)
      resetMentionState()
      return
    }
    if (!trimmed || isDisabled) return
    sendMessage(trimmed, undefined, mentionedJids.length > 0 ? mentionedJids : undefined, {
      quotedMessageId: replyTarget?.id,
    })
    setText("")
    setMentionedJids([])
    resetMentionState()
    textareaRef.current?.focus()
  }, [
    attachmentDraft,
    isDisabled,
    mentionedJids,
    replyTarget?.id,
    resetMentionState,
    sendMessage,
    text,
    uploadAndSendFile,
  ])

  const insertMention = useCallback(
    (contact: WhatsAppTeamContact) => {
      const label = getContactLabel(contact)
      const before = text.slice(0, mentionStart)
      const cursor = textareaRef.current?.selectionStart ?? text.length
      const after = text.slice(cursor)
      const insertion = `@${label} `
      const next = `${before}${insertion}${after}`.slice(0, MAX_CHARS)
      setText(next)
      setMentionedJids((prev) => (prev.includes(contact.remoteJid) ? prev : [...prev, contact.remoteJid]))
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
          setMentionHighlight((prev) => (prev === 0 ? filteredMentionContacts.length - 1 : prev - 1))
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
    [filteredMentionContacts, handleSendText, insertMention, mentionHighlight, mentionOpen, resetMentionState]
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
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
      clearAttachmentDraft()
      const mimeType = inferMimeType(file)
      const previewUrl = mediatype === "image" ? URL.createObjectURL(file) : null
      setAttachmentDraft({ file, previewUrl, mediatype, mimeType })
    },
    [clearAttachmentDraft, isDisabled]
  )

  const insertEmojiAtCursor = useCallback((emoji: string) => {
    setText((current) => {
      const target = textareaRef.current
      if (!target) return (current + emoji).slice(0, MAX_CHARS)
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

  const handleStartRecording = useCallback(async () => {
    if (isDisabled || hasText || attachmentDraft) return
    if (!isMicrophoneSupported()) {
      toast.error(getMicrophoneUnsupportedMessage())
      return
    }
    try {
      const stream = await requestMicrophoneStream()
      await recorder.startWithStream(stream)
    } catch (error) {
      if (error instanceof MicrophoneAccessError && error.code === "NotAllowedError") {
        setMicPermissionDenied(true)
      }
      toastUserError(error)
    }
  }, [attachmentDraft, hasText, isDisabled, recorder])

  const handleRetestMicrophone = useCallback(async () => {
    try {
      const stream = await requestMicrophoneStream()
      stream.getTracks().forEach((track) => track.stop())
      setMicPermissionDenied(false)
      toast.success("Microfone liberado. Você já pode gravar.")
    } catch (error) {
      if (error instanceof MicrophoneAccessError && error.code === "NotAllowedError") {
        setMicPermissionDenied(true)
      }
      toastUserError(error)
    }
  }, [])

  const showSendButton = hasText || isRecording || Boolean(attachmentDraft)
  const shellDisabled = isDisabled && !isRecording
  const showMicPermissionPrompt = isMicrophoneSupported() && micPermissionDenied

  const replyPreview = replyTarget
    ? replyTarget.contentText?.trim() ||
      replyTarget.caption?.trim() ||
      `[${replyTarget.messageType}]`
    : null

  return (
    <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
      {isDisconnected && (
        <p className="text-xs text-muted-foreground">
          O WhatsApp está desconectado. Reconecte em Configurações do WhatsApp para enviar mensagens.
        </p>
      )}

      {contactIsTyping ? (
        <p className="px-1 pb-1 text-xs text-muted-foreground">digitando...</p>
      ) : null}

      {replyTarget ? (
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Respondendo a…</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{replyPreview}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancelar resposta"
          >
            <X />
          </Button>
        </div>
      ) : null}

      {showMicPermissionPrompt ? (
        <Alert variant="destructive">
          <MicOff />
          <AlertTitle>Microfone bloqueado</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{MICROPHONE_PERMISSION_DENIED_MESSAGE}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setHowToOpenMicDialog(true)}>
                Como liberar
              </Button>
              <Button type="button" size="sm" onClick={() => void handleRetestMicrophone()}>
                Testar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={howToOpenMicDialog} onOpenChange={setHowToOpenMicDialog}>
        <DialogContent className="flex max-h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>Como liberar o microfone</DialogTitle>
            <DialogDescription>
              Autorize o microfone nas permissões do site e teste novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Abra o cadeado ou ícone de informações ao lado da URL.</li>
              <li>Em Permissões, altere Microfone para Permitir.</li>
              <li>Recarregue a página se o navegador pedir.</li>
              <li>Toque em Testar novamente e grave o áudio.</li>
            </ol>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHowToOpenMicDialog(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setHowToOpenMicDialog(false)
                void handleRetestMicrophone()
              }}
            >
              Testar novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {attachmentDraft ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            {attachmentDraft.previewUrl ? (
              <img
                src={attachmentDraft.previewUrl}
                alt="Pré-visualização do anexo"
                className="size-16 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                Arquivo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{attachmentDraft.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(attachmentDraft.file.size)}</p>
              <p className="mt-1 text-xs text-muted-foreground">A legenda usa o texto do composer ao enviar.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              disabled={isUploading}
              onClick={clearAttachmentDraft}
              aria-label="Remover anexo"
            >
              <X />
            </Button>
          </div>
          {uploadProgress !== null ? <Progress value={uploadProgress} /> : null}
          <div className="flex flex-wrap gap-2">
            {isUploading ? (
              <Button type="button" variant="outline" size="sm" onClick={cancelUpload}>
                Cancelar upload
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={shellDisabled}
                onClick={() =>
                  void uploadAndSendFile(
                    attachmentDraft.file,
                    attachmentDraft.mediatype,
                    text.trim() || undefined
                  )
                }
              >
                Enviar anexo
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileChange}
      />

      <Popover open={mentionOpen && isGroupChat} onOpenChange={setMentionOpen}>
        <PopoverAnchor asChild>
          <div>
            <WhatsAppMessageInputShell
              onAttach={() => fileInputRef.current?.click()}
              attachDisabled={shellDisabled || Boolean(attachmentDraft)}
              showAttachEmoji={!isRecording}
              emojiDisabled={shellDisabled}
              onEmojiSelect={insertEmojiAtCursor}
              showSendButton={showSendButton}
              onSend={() => {
                if (isRecording) {
                  if (recorder.status === "preview") {
                    void recorder.confirmSend()
                    return
                  }
                  void recorder.send()
                  return
                }
                handleSendText()
              }}
              isSending={isSending || isUploading}
              sendDisabled={isRecording ? false : (!hasText && !attachmentDraft) || shellDisabled}
              sendAriaLabel={isRecording ? "Enviar áudio" : "Enviar mensagem"}
              trailingInPill={
                !isRecording && !hasText && !attachmentDraft ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
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
                  onConfirmSend={recorder.confirmSend}
                  previewUrl={recorder.previewUrl}
                  onWaveformBarCountChange={setWaveformBarCount}
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
                      "max-h-24 min-h-11 w-full resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0",
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
                    "min-h-11 rounded-md px-2 py-2 text-left text-sm",
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

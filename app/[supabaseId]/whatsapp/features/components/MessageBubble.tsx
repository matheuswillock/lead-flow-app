"use client"

import { useCallback, useEffect, useMemo, useState, Fragment, memo } from "react"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MessagingMessageBubble } from "@/components/messaging/MessagingMessageBubble"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppMessage, WhatsAppMessageActionCapabilities } from "../context/WhatsAppInboxTypes"
import { WhatsAppApiError, whatsAppInboxService } from "../services/WhatsAppInboxService"
import { mapWhatsAppMessageToMessaging } from "../utils/mapWhatsAppToMessaging"
import {
  getMessageActions,
  type MessageActionDefinition,
  type MessageActionKind,
} from "../utils/messageActions"
import { getChatKind } from "../utils/whatsappDisplay"
import { shouldShowOutboundOperatorName } from "../utils/shouldShowOutboundOperatorName"
import { ForwardMessageDialog } from "./ForwardMessageDialog"
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface MessageBubbleProps {
  message: WhatsAppMessage
  previousMessage?: WhatsAppMessage | null
}

const DEFAULT_CAPS: WhatsAppMessageActionCapabilities = {
  reply: true,
  forward: true,
  react: false,
  deleteForEveryone: false,
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const

function resolveQuotedPreview(
  message: WhatsAppMessage,
  messages: WhatsAppMessage[]
): string | null {
  if (message.quotedPreview?.trim()) return message.quotedPreview.trim()
  if (!message.quotedMessageId) return null
  const quoted = messages.find((item) => item.id === message.quotedMessageId)
  if (!quoted) return "Mensagem citada"
  return (
    quoted.contentText?.trim() ||
    quoted.caption?.trim() ||
    `[${quoted.messageType}]`
  )
}

function ActionItems({
  items,
  onSelect,
  ItemComponent,
  SeparatorComponent,
}: {
  items: MessageActionDefinition[]
  onSelect: (kind: MessageActionKind) => void
  ItemComponent: typeof ContextMenuItem | typeof DropdownMenuItem
  SeparatorComponent: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
}) {
  let lastGroup: MessageActionDefinition["group"] | null = null
  return (
    <>
      {items.map((item) => {
        const showSeparator = lastGroup !== null && lastGroup !== item.group
        lastGroup = item.group
        return (
          <Fragment key={item.kind}>
            {showSeparator ? <SeparatorComponent /> : null}
            <ItemComponent
              disabled={!item.enabled && item.capability !== "UNAVAILABLE"}
              className={cn(item.group === "danger" && "text-destructive focus:text-destructive")}
              onSelect={() => onSelect(item.kind)}
            >
              {item.label}
              {item.capability === "UNAVAILABLE" ? " (indisponível)" : null}
            </ItemComponent>
          </Fragment>
        )
      })}
    </>
  )
}

function MessageBubbleInner({ message, previousMessage = null }: MessageBubbleProps) {
  const {
    resendMessage,
    teamMembers,
    selectedConversation,
    activeTeamId,
    contactLookup,
    messages,
    setReplyTarget,
    supabaseId,
  } = useWhatsAppInboxContext()

  const [caps, setCaps] = useState<WhatsAppMessageActionCapabilities>(DEFAULT_CAPS)
  const [isPinned, setIsPinned] = useState(Boolean(message.isPinned))
  const [isFavorite, setIsFavorite] = useState(Boolean(message.isFavorite))
  const [isHiddenForMe, setIsHiddenForMe] = useState(Boolean(message.isHiddenForMe))
  const [deletedForEveryoneAt, setDeletedForEveryoneAt] = useState(
    message.deletedForEveryoneAt ?? null
  )
  const [forwardOpen, setForwardOpen] = useState(false)
  const [deleteEveryoneOpen, setDeleteEveryoneOpen] = useState(false)
  const [reactPickerOpen, setReactPickerOpen] = useState(false)
  const [actionPending, setActionPending] = useState(false)

  const isOutbound = message.direction === "OUTBOUND"
  const operatorName =
    isOutbound && message.sentByProfileId
      ? (teamMembers.find((m) => m.id === message.sentByProfileId)?.name ?? "Operador")
      : null

  const isGroupChat =
    getChatKind(selectedConversation?.externalChatId) === "group" && !isOutbound
  const showSenderName = isGroupChat && Boolean(message.senderDisplayName)
  const showOperatorName = shouldShowOutboundOperatorName(message, previousMessage)

  const type = message.messageType.toUpperCase()
  const hasMedia = ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "STICKER", "PTT"].includes(type)
  const mediaUnavailable =
    message.mediaStatus === "EXPIRED" || message.mediaStatus === "FAILED"
  const mediaProcessing = message.mediaStatus === "PROCESSING"
  const mediaProxyUrl =
    activeTeamId &&
    hasMedia &&
    !message.id.startsWith("optimistic-") &&
    !mediaUnavailable &&
    !mediaProcessing
      ? `${API_CLIENT_BASE}/teams/${encodeURIComponent(activeTeamId)}/whatsapp/messages/${encodeURIComponent(message.id)}/media`
      : null

  const mappedPrevious = previousMessage ? mapWhatsAppMessageToMessaging(previousMessage) : null
  const quotedPreview = resolveQuotedPreview(message, messages)
  const hasTextOrCaption = Boolean(message.contentText?.trim() || message.caption?.trim())

  const actionItems = useMemo(
    () =>
      getMessageActions({
        isOutbound,
        hasTextOrCaption,
        isDeletedForEveryone: Boolean(deletedForEveryoneAt),
        isHiddenForMe,
        isPinned,
        isFavorite,
        caps,
      }),
    [
      caps,
      deletedForEveryoneAt,
      hasTextOrCaption,
      isFavorite,
      isHiddenForMe,
      isOutbound,
      isPinned,
    ]
  )

  const loadActionsState = useCallback(async () => {
    if (!activeTeamId || message.id.startsWith("optimistic-")) return
    try {
      const state = await whatsAppInboxService.fetchMessageActionsState(
        activeTeamId,
        supabaseId,
        message.id
      )
      setCaps(state.capabilities)
      setIsPinned(state.state.isPinned)
      setIsFavorite(state.state.isFavorite)
      setIsHiddenForMe(state.state.isHiddenForMe)
      setDeletedForEveryoneAt(state.state.deletedForEveryoneAt)
    } catch {
      setCaps(DEFAULT_CAPS)
    }
  }, [activeTeamId, message.id, supabaseId])

  useEffect(() => {
    setIsPinned(Boolean(message.isPinned))
    setIsFavorite(Boolean(message.isFavorite))
    setIsHiddenForMe(Boolean(message.isHiddenForMe))
    setDeletedForEveryoneAt(message.deletedForEveryoneAt ?? null)
  }, [message.deletedForEveryoneAt, message.isFavorite, message.isHiddenForMe, message.isPinned])

  const postAction = useCallback(
    async (kind: Extract<MessageActionKind, "PIN" | "UNPIN" | "FAVORITE" | "UNFAVORITE" | "DELETE_FOR_ME" | "DELETE_FOR_EVERYONE">) => {
      if (!activeTeamId || actionPending) return
      setActionPending(true)
      try {
        await whatsAppInboxService.postMessageAction(
          activeTeamId,
          supabaseId,
          message.id,
          crypto.randomUUID(),
          { kind }
        )
        switch (kind) {
          case "PIN":
            setIsPinned(true)
            toast.success("Mensagem fixada")
            break
          case "UNPIN":
            setIsPinned(false)
            toast.success("Mensagem desafixada")
            break
          case "FAVORITE":
            setIsFavorite(true)
            toast.success("Mensagem favoritada")
            break
          case "UNFAVORITE":
            setIsFavorite(false)
            toast.success("Removida dos favoritos")
            break
          case "DELETE_FOR_ME":
            setIsHiddenForMe(true)
            toast.success("Mensagem apagada para você")
            break
          case "DELETE_FOR_EVERYONE":
            setDeletedForEveryoneAt(new Date().toISOString())
            toast.success("Mensagem apagada para todos")
            break
          default: {
            const _exhaustive: never = kind
            return _exhaustive
          }
        }
      } catch (error) {
        if (error instanceof WhatsAppApiError && error.code === "CAPABILITY_UNAVAILABLE") {
          toast.error("Ação indisponível neste provedor")
          return
        }
        toastUserError(error)
      } finally {
        setActionPending(false)
      }
    },
    [actionPending, activeTeamId, message.id, supabaseId]
  )

  const postReaction = useCallback(
    async (emoji: string) => {
      if (!activeTeamId || actionPending) return
      setReactPickerOpen(false)
      setActionPending(true)
      try {
        await whatsAppInboxService.postMessageAction(
          activeTeamId,
          supabaseId,
          message.id,
          crypto.randomUUID(),
          { kind: "REACT", emoji }
        )
      } catch (error) {
        if (error instanceof WhatsAppApiError && error.code === "CAPABILITY_UNAVAILABLE") {
          toast.error("Reação indisponível neste provedor")
          return
        }
        toastUserError(error)
      } finally {
        setActionPending(false)
      }
    },
    [actionPending, activeTeamId, message.id, supabaseId]
  )

  const handleAction = useCallback(
    (kind: MessageActionKind) => {
      const definition = actionItems.find((item) => item.kind === kind)
      if (!definition) return
      if (definition.capability === "UNAVAILABLE") {
        toast.error("Ação indisponível neste provedor")
        return
      }
      if (!definition.enabled) return

      switch (kind) {
        case "REPLY":
          setReplyTarget(message)
          break
        case "COPY": {
          const text = message.contentText?.trim() || message.caption?.trim() || ""
          if (!text) {
            toast.error("Nada para copiar")
            return
          }
          void navigator.clipboard.writeText(text).then(
            () => toast.success("Copiado"),
            () => toast.error("Não foi possível copiar")
          )
          break
        }
        case "FORWARD":
          setForwardOpen(true)
          break
        case "REACT":
          if (caps.react) setReactPickerOpen(true)
          else toast.error("Reação indisponível neste provedor")
          break
        case "PIN":
        case "UNPIN":
        case "FAVORITE":
        case "UNFAVORITE":
        case "DELETE_FOR_ME":
          void postAction(kind)
          break
        case "DELETE_FOR_EVERYONE":
          setDeleteEveryoneOpen(true)
          break
        default: {
          const _exhaustive: never = kind
          return _exhaustive
        }
      }
    },
    [actionItems, message, postAction, setReplyTarget]
  )

  if (isHiddenForMe || deletedForEveryoneAt) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm italic text-muted-foreground">
        {deletedForEveryoneAt ? "Mensagem apagada para todos" : "Mensagem apagada"}
      </div>
    )
  }

  if (hasMedia && mediaProcessing) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Processando mídia…
      </div>
    )
  }

  if (hasMedia && mediaUnavailable) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Mídia indisponível
      </div>
    )
  }

  const bubble = (
    <div className={cn("group relative flex w-full flex-col gap-1", isOutbound ? "items-end" : "items-start")}>
      {quotedPreview ? (
        <div
          className={cn(
            "max-w-[80%] rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground",
            isOutbound && "bg-primary/15 text-primary-foreground/80"
          )}
        >
          <p className="font-medium text-foreground/80">Respondendo a</p>
          <p className="line-clamp-2">{quotedPreview}</p>
        </div>
      ) : null}
      <div className="relative w-full max-w-full">
        <MessagingMessageBubble
          message={mapWhatsAppMessageToMessaging(message)}
          previousMessage={mappedPrevious}
          contactLookup={contactLookup}
          mediaUrl={mediaProxyUrl}
          operatorDisplayName={operatorName}
          showSenderName={showSenderName}
          showOperatorName={showOperatorName}
          onResend={resendMessage}
          renderAudio={(src, variant) => <WhatsAppAudioPlayer src={src} variant={variant} />}
        />
        <div
          className={cn(
            "absolute top-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
            isOutbound ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
          )}
        >
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) void loadActionsState()
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Mais ações"
                aria-keyshortcuts="ContextMenu"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOutbound ? "end" : "start"}>
              <ActionItems
                items={actionItems}
                onSelect={handleAction}
                ItemComponent={DropdownMenuItem}
                SeparatorComponent={DropdownMenuSeparator}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) void loadActionsState()
        }}
      >
        <ContextMenuTrigger asChild>
          <div className="w-full outline-none">{bubble}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ActionItems
            items={actionItems}
            onSelect={handleAction}
            ItemComponent={ContextMenuItem}
            SeparatorComponent={ContextMenuSeparator}
          />
        </ContextMenuContent>
      </ContextMenu>

      <Popover open={reactPickerOpen} onOpenChange={setReactPickerOpen}>
        <PopoverTrigger asChild>
          <span aria-hidden className="sr-only" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align={isOutbound ? "end" : "start"} side="top">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-lg"
                disabled={actionPending}
                onClick={() => void postReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <ForwardMessageDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        message={message}
      />

      <AlertDialog open={deleteEveryoneOpen} onOpenChange={setDeleteEveryoneOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta mensagem será removida para todos os participantes. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionPending}
              onClick={(event) => {
                event.preventDefault()
                void postAction("DELETE_FOR_EVERYONE").then(() => setDeleteEveryoneOpen(false))
              }}
            >
              Apagar para todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const MessageBubble = memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.deletedForEveryoneAt === next.message.deletedForEveryoneAt &&
    prev.message.mediaStatus === next.message.mediaStatus &&
    prev.message.isPinned === next.message.isPinned &&
    prev.message.isFavorite === next.message.isFavorite &&
    prev.message.isHiddenForMe === next.message.isHiddenForMe &&
    prev.previousMessage?.id === next.previousMessage?.id,
)

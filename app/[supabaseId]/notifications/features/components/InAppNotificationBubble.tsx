"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildNotificationPath,
  getMeetingLink,
  hasLeadNotificationLink,
} from "@/lib/notifications/build-notification-url";
import type { NotificationItem } from "../types/notification.types";

type InAppNotificationBubbleProps = {
  notification: NotificationItem & { queueId: string };
  onDismiss: (queueId: string) => void;
};

export function InAppNotificationBubble({ notification, onDismiss }: InAppNotificationBubbleProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const metadata = notification.metadata;
  const leadHref = buildNotificationPath({
    supabaseId,
    type: notification.type,
    metadata,
  });
  const meetingLink = getMeetingLink(metadata);
  const showLeadLink = hasLeadNotificationLink(notification.type, metadata) && !leadHref.startsWith("http");
  const isExternalLeadHref = leadHref.startsWith("http");
  const sdrName =
    metadata && typeof metadata === "object" && typeof metadata.sdrName === "string" && metadata.sdrName.trim()
      ? metadata.sdrName.trim()
      : null;
  const isTransferActivated = notification.type === "LEAD_TRANSFER_ACTIVATED";

  return (
    <motion.div
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 120 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) {
          onDismiss(notification.queueId);
        }
      }}
      initial={{ opacity: 0, y: 16, x: 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 120 }}
      className={cn(
        "pointer-events-auto w-[min(100vw-2rem,22rem)] rounded-lg border border-border/70 bg-card p-4 shadow-lg",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{notification.message}</p>
          {isTransferActivated && sdrName ? (
            <p className="mt-1 text-xs text-muted-foreground">SDR: {sdrName}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {showLeadLink ? (
              <Link href={leadHref} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Abrir lead
                <ExternalLink data-icon="inline-end" />
              </Link>
            ) : null}
            {isExternalLeadHref ? (
              <a
                href={leadHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Abrir destino
                <ExternalLink data-icon="inline-end" />
              </a>
            ) : null}
            {meetingLink ? (
              <a
                href={meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Abrir reunião
                <ExternalLink data-icon="inline-end" />
              </a>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onDismiss(notification.queueId)}
          aria-label="Fechar notificação"
        >
          <X />
        </Button>
      </div>
    </motion.div>
  );
}

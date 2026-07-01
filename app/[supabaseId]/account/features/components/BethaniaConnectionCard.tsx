"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CircleCheckBig, ExternalLink, Link2, MessageCircle, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BethaniaLinkInitiateResult, BethaniaLinkStatus } from "../services/IBethaniaLinkService";
import { bethaniaLinkService } from "../services/BethaniaLinkService";

type BethaniaConnectionCardProps = {
  supabaseId: string;
  teamId: string | null;
};

function formatLinkedAt(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function formatExpiresAt(value: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function BethaniaConnectionCard({ supabaseId, teamId }: BethaniaConnectionCardProps) {
  const [status, setStatus] = useState<BethaniaLinkStatus | null>(null);
  const [pendingOtp, setPendingOtp] = useState<BethaniaLinkInitiateResult | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const statusRequestKeyRef = useRef<string | null>(null);
  const statusInFlightRef = useRef(false);
  const lastStatusSuccessKeyRef = useRef<string | null>(null);

  const requestContext = teamId ? { supabaseId, teamId } : null;

  const loadStatus = useCallback(async () => {
    if (!requestContext) {
      setIsLoadingStatus(false);
      return;
    }

    const requestKey = `${requestContext.supabaseId}:${requestContext.teamId}`;
    if (statusInFlightRef.current || lastStatusSuccessKeyRef.current === requestKey) {
      return;
    }

    statusRequestKeyRef.current = requestKey;
    statusInFlightRef.current = true;
    setIsLoadingStatus(true);

    try {
      const nextStatus = await bethaniaLinkService.getStatus(requestContext);
      if (statusRequestKeyRef.current !== requestKey) {
        return;
      }
      setStatus(nextStatus);
      lastStatusSuccessKeyRef.current = requestKey;
    } catch (error) {
      if (statusRequestKeyRef.current === requestKey) {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar vínculo da Bethânia");
      }
    } finally {
      if (statusRequestKeyRef.current === requestKey) {
        statusInFlightRef.current = false;
        setIsLoadingStatus(false);
      }
    }
  }, [requestContext]);

  useEffect(() => {
    lastStatusSuccessKeyRef.current = null;
    void loadStatus();
  }, [loadStatus]);

  const handleInitiate = async () => {
    if (!requestContext || isInitiating) {
      return;
    }

    setIsInitiating(true);
    try {
      const result = await bethaniaLinkService.initiate(requestContext);
      setPendingOtp(result);
      toast.success("Código gerado. Envie a mensagem no WhatsApp da Bethânia.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar código");
    } finally {
      setIsInitiating(false);
    }
  };

  const handleRevoke = async () => {
    if (!requestContext || isRevoking) {
      return;
    }

    setIsRevoking(true);
    try {
      await bethaniaLinkService.revoke(requestContext);
      setPendingOtp(null);
      setStatus({ linked: false });
      lastStatusSuccessKeyRef.current = null;
      setRevokeDialogOpen(false);
      toast.success("Vínculo com a Bethânia revogado.");
      await loadStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao revogar vínculo");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyCommand = async () => {
    if (!pendingOtp) {
      return;
    }

    const command = bethaniaLinkService.buildLinkCommand(pendingOtp.code);
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Comando copiado.");
    } catch {
      toast.error("Não foi possível copiar o comando.");
    }
  };

  const linked = status?.linked ?? false;
  const linkedAtLabel = formatLinkedAt(status?.linkedAt);
  const whatsappDeepLink = pendingOtp ? bethaniaLinkService.buildWhatsappDeepLink(pendingOtp.code) : null;
  const linkCommand = pendingOtp ? bethaniaLinkService.buildLinkCommand(pendingOtp.code) : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Bethânia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vincule seu WhatsApp à assistente do Corretor Studio para consultar leads e receber
            alertas pelo chat.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
          {isLoadingStatus ? (
            <Skeleton className="size-4 rounded-full" />
          ) : linked ? (
            <CircleCheckBig className="size-4 text-emerald-500" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {isLoadingStatus ? "Carregando..." : linked ? "Vinculado" : "Não vinculado"}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {linked ? "WhatsApp vinculado" : "Vincular Bethânia"}
          </p>
          <p className="text-xs text-muted-foreground">
            {linked
              ? `Número ${status?.normalizedPhone ?? "—"}${linkedAtLabel ? ` · desde ${linkedAtLabel}` : ""}.`
              : "Gere um código e envie VINCULAR + código no chat da Bethânia."}
          </p>
        </div>

        {!teamId ? (
          <p className="text-xs text-muted-foreground">Selecione um time ativo para vincular.</p>
        ) : linked ? (
          <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-2 border-foreground/20 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={isRevoking}
              >
                <Unlink data-icon="inline-start" />
                {isRevoking ? "Revogando..." : "Revogar vínculo"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-destructive/40">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-5" />
                  Revogar vínculo com a Bethânia?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Você precisará autenticar novamente no WhatsApp para usar a assistente. Esta ação
                  não remove o histórico de conversas no backoffice.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => void handleRevoke()}
                  disabled={isRevoking}
                >
                  {isRevoking ? "Revogando..." : "Confirmar revogação"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() => void handleInitiate()}
            disabled={isInitiating || isLoadingStatus}
          >
            <Link2 data-icon="inline-start" />
            {isInitiating ? "Gerando código..." : "Gerar código"}
          </Button>
        )}
      </div>

      {pendingOtp && !linked ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Código de vínculo</p>
            <Badge variant="secondary">Expira em {formatExpiresAt(pendingOtp.expiresAt)}</Badge>
          </div>

          <p className="font-mono text-2xl font-semibold tracking-widest">{pendingOtp.code}</p>

          <p className="text-sm text-muted-foreground">
            Envie no WhatsApp da Bethânia:{" "}
            <span className="font-medium text-foreground">{linkCommand}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyCommand()}>
              Copiar comando
            </Button>
            {whatsappDeepLink ? (
              <Button type="button" variant="default" size="sm" asChild>
                <a href={whatsappDeepLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Abrir WhatsApp
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground self-center">
                Configure NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER para o atalho do WhatsApp.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

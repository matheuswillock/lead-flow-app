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
import { formatWhatsappPhoneDisplay } from "@/lib/studio-bot/phone";
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
  const lastEffectKeyRef = useRef<string | null>(null);

  const statusRequestKey = teamId ? `${supabaseId}:${teamId}` : null;

  const loadStatus = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (!teamId) {
        setIsLoadingStatus(false);
        return null;
      }

      const requestKey = `${supabaseId}:${teamId}`;
      const force = options?.force === true;
      const silent = options?.silent === true;

      if (statusInFlightRef.current) {
        return null;
      }
      if (!force && lastStatusSuccessKeyRef.current === requestKey) {
        return null;
      }

      const requestContext = { supabaseId, teamId };
      statusRequestKeyRef.current = requestKey;
      statusInFlightRef.current = true;
      if (!silent) {
        setIsLoadingStatus(true);
      }

      try {
        const nextStatus = await bethaniaLinkService.getStatus(requestContext);
        if (statusRequestKeyRef.current !== requestKey) {
          return null;
        }
        setStatus(nextStatus);
        lastStatusSuccessKeyRef.current = requestKey;
        return nextStatus;
      } catch (error) {
        if (statusRequestKeyRef.current === requestKey && !silent) {
          toast.error(error instanceof Error ? error.message : "Erro ao carregar vínculo da Bethânia");
        }
        return null;
      } finally {
        if (statusRequestKeyRef.current === requestKey) {
          statusInFlightRef.current = false;
          if (!silent) {
            setIsLoadingStatus(false);
          }
        }
      }
    },
    [supabaseId, teamId]
  );

  useEffect(() => {
    if (lastEffectKeyRef.current !== statusRequestKey) {
      lastEffectKeyRef.current = statusRequestKey;
      lastStatusSuccessKeyRef.current = null;
    }
    void loadStatus({ force: true });
  }, [loadStatus, statusRequestKey]);

  // Enquanto há OTP pendente, consulta o status até vincular ou expirar.
  useEffect(() => {
    if (!pendingOtp || !teamId) {
      return;
    }

    let cancelled = false;
    const expiresAtMs = Date.parse(pendingOtp.expiresAt);

    const tick = async () => {
      if (cancelled) {
        return;
      }
      if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
        setPendingOtp(null);
        toast.message("Código expirado. Gere um novo para vincular.");
        return;
      }

      const nextStatus = await loadStatus({ force: true, silent: true });
      if (cancelled) {
        return;
      }
      if (nextStatus?.linked) {
        setPendingOtp(null);
        toast.success("WhatsApp vinculado à Bethânia.");
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pendingOtp, teamId, loadStatus]);

  const handleInitiate = async () => {
    if (!teamId || isInitiating) {
      return;
    }

    setIsInitiating(true);
    try {
      const result = await bethaniaLinkService.initiate({ supabaseId, teamId });
      lastStatusSuccessKeyRef.current = null;
      setPendingOtp(result);
      toast.success("Código gerado. Abra o WhatsApp da Bethânia e envie o comando.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar código");
    } finally {
      setIsInitiating(false);
    }
  };

  const handleRevoke = async () => {
    if (!teamId || isRevoking) {
      return;
    }

    setIsRevoking(true);
    try {
      await bethaniaLinkService.revoke({ supabaseId, teamId });
      setPendingOtp(null);
      setStatus((prev) => ({
        linked: false,
        botAvailable: prev?.botAvailable ?? false,
        botStatus: prev?.botStatus ?? "unavailable",
        assistantPhone: prev?.assistantPhone ?? null,
      }));
      lastStatusSuccessKeyRef.current = null;
      setRevokeDialogOpen(false);
      toast.success("Vínculo com a Bethânia revogado.");
      await loadStatus({ force: true });
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
  const botAvailable = status?.botAvailable ?? false;
  const assistantPhone = status?.assistantPhone ?? null;
  const canLink =
    !isLoadingStatus && status !== null && botAvailable && Boolean(assistantPhone);
  const cannotLink = !isLoadingStatus && status !== null && !canLink && !linked;
  const linkedAtLabel = formatLinkedAt(status?.linkedAt);
  const assistantPhoneLabel = bethaniaLinkService.formatAssistantPhone(assistantPhone);
  const whatsappChatLink = bethaniaLinkService.buildWhatsappChatLink(assistantPhone);
  const whatsappDeepLink = pendingOtp
    ? bethaniaLinkService.buildWhatsappDeepLink(pendingOtp.code, assistantPhone)
    : null;
  const linkCommand = pendingOtp ? bethaniaLinkService.buildLinkCommand(pendingOtp.code) : null;

  const statusBadgeLabel = (() => {
    if (isLoadingStatus) return "Carregando...";
    if (cannotLink) return "Assistente indisponível";
    if (linked) return "Vinculado";
    return "Não vinculado";
  })();

  // Bot desabilitado no backoffice: não mostrar opção de vincular em Conexões.
  if (!isLoadingStatus && status !== null && !botAvailable && !linked) {
    return null;
  }

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
          ) : cannotLink ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : linked ? (
            <CircleCheckBig className="size-4 text-emerald-500" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {statusBadgeLabel}
        </div>
      </div>

      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">WhatsApp vinculado</p>
            <p className="text-xs text-muted-foreground">
              Número {status?.normalizedPhone ?? "—"}
              {linkedAtLabel ? ` · desde ${linkedAtLabel}` : ""}.
            </p>
          </div>

          {!teamId ? (
            <p className="text-xs text-muted-foreground">Selecione um time ativo para gerenciar.</p>
          ) : (
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
          )}
        </div>
      ) : cannotLink ? (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">
              Não é possível conectar ao bot no momento
            </p>
            <p className="text-xs text-muted-foreground">
              A Bethânia precisa estar conectada e com número WhatsApp configurado. Tente novamente
              mais tarde.
            </p>
          </div>
        </div>
      ) : canLink ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Como vincular</p>
            <p className="text-xs text-muted-foreground">
              Abra o chat da Bethânia no WhatsApp, gere o código e envie o comando de vínculo.
            </p>
          </div>

          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  1
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Abra o WhatsApp da Bethânia</p>
                  <p className="text-xs text-muted-foreground">
                    Converse com {assistantPhoneLabel} — é o número oficial da assistente.
                  </p>
                </div>
              </div>
              {whatsappChatLink ? (
                <Button type="button" variant="default" size="sm" asChild>
                  <a href={whatsappChatLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Abrir chat
                  </a>
                </Button>
              ) : null}
            </li>

            <li className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  2
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Gere o código de vínculo</p>
                  <p className="text-xs text-muted-foreground">
                    O código expira em poucos minutos. Use-o só no chat da Bethânia.
                  </p>
                </div>
              </div>
              {!teamId ? (
                <p className="text-xs text-muted-foreground">Selecione um time ativo.</p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handleInitiate()}
                  disabled={isInitiating || isLoadingStatus}
                >
                  <Link2 data-icon="inline-start" />
                  {isInitiating ? "Gerando..." : pendingOtp ? "Gerar novo código" : "Gerar código"}
                </Button>
              )}
            </li>

            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                3
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">Envie o comando no chat</p>
                <p className="text-xs text-muted-foreground">
                  Mensagem no formato{" "}
                  <span className="font-medium text-foreground">VINCULAR 123456</span>.
                </p>
              </div>
            </li>
          </ol>

          {pendingOtp ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Seu código</p>
                <Badge variant="secondary">Expira em {formatExpiresAt(pendingOtp.expiresAt)}</Badge>
              </div>

              <p className="font-mono text-2xl font-semibold tracking-widest">{pendingOtp.code}</p>

              {pendingOtp.expectedPhone ? (
                <p className="text-sm text-muted-foreground">
                  Envie pelo WhatsApp cadastrado na Account:{" "}
                  <span className="font-medium text-foreground">
                    {formatWhatsappPhoneDisplay(pendingOtp.expectedPhone) ?? pendingOtp.expectedPhone}
                  </span>
                  . Outro número será rejeitado.
                </p>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Envie exatamente:{" "}
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
                      Abrir WhatsApp com comando
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </section>
  );
}

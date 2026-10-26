"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Copy, KeyRound, RefreshCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type {
  TeamWebhookDirection,
  TeamWebhookLogItem,
  TeamWebhookLogResult,
  TeamWebhookSummary,
  UpdateTeamWebhookPayload,
} from "../services/ITeamWebhooksService";
import { WebhookStatusBadge } from "./WebhookStatusBadge";
import {
  WebhookInboundConfigFields,
  type WebhookInboundFormValues,
} from "./WebhookInboundConfigFields";
import {
  WebhookOutboundConfigFields,
  type WebhookOutboundFormValues,
} from "./WebhookOutboundConfigFields";
import { WebhookSignatureVerificationGuide } from "./WebhookSignatureVerificationGuide";
import { WebhookLogsPanel } from "./WebhookLogsPanel";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — as chamadas de rede
 * passam pelo Service page-local (`InboundWebhookDetailService` /
 * `OutboundWebhookDetailService`), injetado via Hook/Context da rota. A mesma
 * interface estrutural serve para as duas direções. Sem `service`, o
 * componente usa `teamWebhooksService` (uso direto e testes do painel de logs).
 */
type WebhookDetailServiceLike = {
  getById(supabaseId: string, teamId: string, id: string): Promise<TeamWebhookSummary>;
  update(
    supabaseId: string,
    teamId: string,
    id: string,
    payload: UpdateTeamWebhookPayload
  ): Promise<TeamWebhookSummary>;
  changeStatus(
    supabaseId: string,
    teamId: string,
    id: string,
    body: { status: "active" | "disabled" } | { action: "reactivate" }
  ): Promise<TeamWebhookSummary>;
  listLogs(
    supabaseId: string,
    teamId: string,
    id: string,
    params: { page?: number; pageSize?: number; result?: TeamWebhookLogResult }
  ): Promise<{ items: TeamWebhookLogItem[]; total: number; page: number; pageSize: number }>;
  testDelivery(
    supabaseId: string,
    teamId: string,
    id: string
  ): Promise<{ ok: boolean; statusCode: number | null; errorMessage: string | null }>;
  rotateSigningSecret(supabaseId: string, teamId: string, id: string): Promise<TeamWebhookSummary>;
  resendLog(
    supabaseId: string,
    teamId: string,
    webhookId: string,
    logId: string
  ): Promise<{ ok: boolean; statusCode: number | null; errorMessage: string | null }>;
};

type Props = {
  supabaseId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
  /** SPEC 10, R10-5: caminho de volta à lista, derivado pelo Hook page-local. */
  listPath: string;
  service?: WebhookDetailServiceLike;
};

// SPEC 10, DA4/A-E4: "none" saiu da UI de edição — um webhook histórico
// nesse modo (0 medidos em produção em 21/09) abre o formulário em "auto"
// como valor de edição; salvar (rotacionar) sempre gera um token real.
function inferInboundTokenMode(_webhook: TeamWebhookSummary): WebhookInboundFormValues["tokenMode"] {
  return "auto";
}

function inboundValuesFromWebhook(webhook: TeamWebhookSummary): WebhookInboundFormValues {
  return {
    name: webhook.name,
    tokenMode: inferInboundTokenMode(webhook),
    manualToken: "",
    expiryMode: webhook.expiryMode ?? "indeterminate",
  };
}

function outboundValuesFromWebhook(webhook: TeamWebhookSummary): WebhookOutboundFormValues {
  return {
    name: webhook.name,
    targetUrl: webhook.targetUrl ?? "",
    destinationPreset: webhook.destinationPreset ?? "generic",
    selectedEvents: webhook.selectedEvents.length > 0 ? webhook.selectedEvents : ["lead_created"],
    failureThreshold: webhook.failureThreshold,
  };
}

function buildInboundUpdatePayload(
  draft: WebhookInboundFormValues,
  initial: WebhookInboundFormValues
): UpdateTeamWebhookPayload | null {
  const payload: UpdateTeamWebhookPayload = {};
  if (draft.name.trim() !== initial.name.trim()) payload.name = draft.name.trim();
  if (draft.expiryMode !== initial.expiryMode) payload.expiryMode = draft.expiryMode;

  const tokenModeChanged = draft.tokenMode !== initial.tokenMode;
  const manualTokenProvided =
    draft.tokenMode === "manual" && draft.manualToken.trim().length >= 8;

  if (tokenModeChanged || manualTokenProvided) {
    payload.tokenMode = draft.tokenMode;
    if (draft.tokenMode === "manual") {
      payload.manualToken = draft.manualToken.trim();
    }
    if (draft.expiryMode !== initial.expiryMode) {
      payload.expiryMode = draft.expiryMode;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function buildOutboundUpdatePayload(
  draft: WebhookOutboundFormValues,
  initial: WebhookOutboundFormValues
): UpdateTeamWebhookPayload | null {
  const payload: UpdateTeamWebhookPayload = {};
  if (draft.name.trim() !== initial.name.trim()) payload.name = draft.name.trim();
  if (draft.targetUrl.trim() !== initial.targetUrl.trim()) payload.targetUrl = draft.targetUrl.trim();
  if (draft.destinationPreset !== initial.destinationPreset) {
    payload.destinationPreset = draft.destinationPreset;
  }
  if (draft.failureThreshold !== initial.failureThreshold) {
    payload.failureThreshold = draft.failureThreshold;
  }
  const eventsChanged =
    draft.selectedEvents.length !== initial.selectedEvents.length ||
    draft.selectedEvents.some((event) => !initial.selectedEvents.includes(event));
  if (eventsChanged) payload.selectedEvents = draft.selectedEvents;

  return Object.keys(payload).length > 0 ? payload : null;
}

export function WebhookDetailContainer({
  supabaseId,
  webhookId,
  direction,
  listPath,
  service = teamWebhooksService,
}: Props) {
  const { activeTeam } = useTeamContext();
  const { tz } = useTimezone();
  const [webhook, setWebhook] = useState<TeamWebhookSummary | null>(null);
  const [inboundDraft, setInboundDraft] = useState<WebhookInboundFormValues | null>(null);
  const [outboundDraft, setOutboundDraft] = useState<WebhookOutboundFormValues | null>(null);
  const [inboundInitial, setInboundInitial] = useState<WebhookInboundFormValues | null>(null);
  const [outboundInitial, setOutboundInitial] = useState<WebhookOutboundFormValues | null>(null);
  const [logs, setLogs] = useState<TeamWebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("config");
  const [rotatedToken, setRotatedToken] = useState<{ url: string; token?: string } | null>(null);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [revealedSigningSecret, setRevealedSigningSecret] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingRotateSecret, setConfirmingRotateSecret] = useState(false);
  const [showSignatureGuide, setShowSignatureGuide] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const logsRequestIdRef = useRef(0);


  const applyWebhookToDraft = useCallback((detail: TeamWebhookSummary) => {
    setWebhook(detail);
    if (detail.direction === "inbound") {
      const values = inboundValuesFromWebhook(detail);
      setInboundDraft(values);
      setInboundInitial(values);
      setOutboundDraft(null);
      setOutboundInitial(null);
    } else {
      const values = outboundValuesFromWebhook(detail);
      setOutboundDraft(values);
      setOutboundInitial(values);
      setInboundDraft(null);
      setInboundInitial(null);
    }
  }, []);

  const loadConfiguration = useCallback(async () => {
    if (!activeTeam?.id) return;
    setLoading(true);
    // SPEC 10, B-E2 (W14): erro de carregamento é um estado próprio, nunca
    // um skeleton que trava para sempre porque `webhook` nunca chega a
    // existir. Controle negativo: voltar ao `if (loading || !webhook)` e a
    // tela trava em skeleton quando a API falha.
    setLoadError(null);
    try {
      const detail = await service.getById(supabaseId, activeTeam.id, webhookId);
      applyWebhookToDraft(detail);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar este webhook");
      toastUserError(error);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, applyWebhookToDraft, service, supabaseId, webhookId]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const fetchLogsPage = useCallback(async (page: number) => {
    if (!activeTeam?.id) return null;
    const requestId = ++logsRequestIdRef.current;
    const result = await service.listLogs(supabaseId, activeTeam.id, webhookId, {
      page,
      pageSize: 20,
    });
    if (requestId !== logsRequestIdRef.current) return null;
    setLogs(result.items);
    setLogsTotal(result.total);
    setSelectedLogId((current) =>
      current && result.items.some((log: TeamWebhookLogItem) => log.id === current)
        ? current
        : (result.items[0]?.id ?? null)
    );
    return result;
  }, [activeTeam?.id, service, supabaseId, webhookId]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      await fetchLogsPage(logsPage);
    } catch (error) {
      toastUserError(error);
    } finally {
      setLogsLoading(false);
    }
  }, [fetchLogsPage, logsPage]);

  const refreshLogs = useCallback(async () => {
    setLogsRefreshing(true);
    try {
      await fetchLogsPage(logsPage);
    } catch (error) {
      toastUserError(error);
    } finally {
      setLogsRefreshing(false);
    }
  }, [fetchLogsPage, logsPage]);

  useEffect(() => {
    if (activeTab !== "logs") return;

    void loadLogs();
    const intervalId = window.setInterval(() => {
      void refreshLogs();
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
      logsRequestIdRef.current += 1;
    };
  }, [activeTab, loadLogs, refreshLogs]);

  const updatePayload = useMemo(() => {
    if (direction === "inbound" && inboundDraft && inboundInitial) {
      return buildInboundUpdatePayload(inboundDraft, inboundInitial);
    }
    if (direction === "outbound" && outboundDraft && outboundInitial) {
      return buildOutboundUpdatePayload(outboundDraft, outboundInitial);
    }
    return null;
  }, [direction, inboundDraft, inboundInitial, outboundDraft, outboundInitial]);

  const canSaveInbound =
    inboundDraft &&
    inboundDraft.name.trim().length > 0 &&
    (inboundDraft.tokenMode !== "manual" || inboundDraft.manualToken.trim().length >= 8);

  const canSaveOutbound =
    outboundDraft &&
    outboundDraft.name.trim().length > 0 &&
    outboundDraft.targetUrl.trim().length > 0 &&
    outboundDraft.selectedEvents.length > 0;

  const canSave =
    Boolean(updatePayload) &&
    !saving &&
    !actionPending &&
    (direction === "inbound" ? canSaveInbound : canSaveOutbound);

  const runStatus = async (body: { status: "active" | "disabled" } | { action: "reactivate" }) => {
    if (!activeTeam?.id || actionPending) return;
    setActionPending(true);
    try {
      const updated = await service.changeStatus(
        supabaseId,
        activeTeam.id,
        webhookId,
        body
      );
      setWebhook(updated);
      toast.success("Status atualizado");
    } catch (error) {
      toastUserError(error);
    } finally {
      setActionPending(false);
    }
  };

  const runTest = async () => {
    if (!activeTeam?.id || actionPending) return;
    setActionPending(true);
    try {
      await service.testDelivery(supabaseId, activeTeam.id, webhookId);
      toast.success("Envio de teste concluído");
      setLogsPage(1);
      const result = await fetchLogsPage(1);
      setSelectedLogId(result?.items[0]?.id ?? null);
    } catch (error) {
      toastUserError(error);
    } finally {
      setActionPending(false);
    }
  };

  const runRotateSigningSecret = async () => {
    if (!activeTeam?.id || rotatingSecret) return;
    setRotatingSecret(true);
    try {
      const updated = await service.rotateSigningSecret(
        supabaseId,
        activeTeam.id,
        webhookId
      );
      // Achado da 2ª revisão final (Opus): rotacionar o segredo só muda
      // signingSecretCipher/signingSecretPreview no servidor — usar applyWebhookToDraft
      // aqui reconstruía outboundDraft/outboundInitial a partir da resposta e descartava
      // em silêncio qualquer edição de nome/URL/eventos que o gestor ainda não salvou.
      // setWebhook basta: signingSecretPreview vem de `webhook`, não do draft.
      setWebhook(updated);
      setRevealedSigningSecret(updated.signingSecret ?? null);
      toast.success("Segredo de assinatura rotacionado");
    } catch (error) {
      toastUserError(error);
    } finally {
      setRotatingSecret(false);
    }
  };

  const runResend = async (log: TeamWebhookLogItem) => {
    if (!activeTeam?.id || resendingLogId) return;
    setResendingLogId(log.id);
    try {
      const result = await service.resendLog(
        supabaseId,
        activeTeam.id,
        webhookId,
        log.id
      );
      if (result.ok) {
        toast.success("Webhook reenviado com sucesso");
      } else {
        toast.error(result.errorMessage ?? "O reenvio foi registrado com falha");
      }
      setLogsPage(1);
      const refreshed = await fetchLogsPage(1);
      setSelectedLogId(refreshed?.items[0]?.id ?? null);
    } catch (error) {
      toastUserError(error);
    } finally {
      setResendingLogId(null);
    }
  };

  const runSave = async () => {
    if (!activeTeam?.id || !updatePayload || !canSave) return;
    setSaving(true);
    try {
      const updated = await service.update(
        supabaseId,
        activeTeam.id,
        webhookId,
        updatePayload
      );
      applyWebhookToDraft(updated);
      toast.success("Configuração salva");
      if (updated.token || (updated.direction === "inbound" && updatePayload.tokenMode)) {
        setRotatedToken({
          url: updated.webhookUrl ?? "",
          token: updated.token,
        });
      }
    } catch (error) {
      toastUserError(error);
    } finally {
      setSaving(false);
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!webhook) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={listPath}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar este webhook</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{loadError ?? "Tente novamente em instantes."}</p>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              <RefreshCcw data-icon="inline-start" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" asChild className="min-h-11 w-fit px-0">
            <Link href={listPath}>
              <ArrowLeft data-icon="inline-start" />
              Voltar
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{webhook.name}</h1>
            <WebhookStatusBadge status={webhook.status} />
            <Badge variant="outline">{direction === "inbound" ? "Entrada" : "Saída"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {webhook.status === "paused" ? (
            <Button onClick={() => runStatus({ action: "reactivate" })} disabled={actionPending}>
              Reativar
            </Button>
          ) : null}
          {webhook.status === "active" ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                direction === "outbound"
                  ? setConfirmingDeactivate(true)
                  : runStatus({ status: "disabled" })
              }
              disabled={actionPending}
            >
              Desativar
            </Button>
          ) : null}
          {webhook.status === "disabled" ? (
            <Button onClick={() => runStatus({ status: "active" })} disabled={actionPending}>
              Ativar
            </Button>
          ) : null}
          {direction === "outbound" ? (
            <Button variant="secondary" className="min-h-11" onClick={runTest} disabled={actionPending}>
              Testar envio
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => void loadConfiguration()}
            disabled={actionPending}
            aria-label="Atualizar webhook"
          >
            <RefreshCcw />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config" className="min-h-11">Configuração</TabsTrigger>
          <TabsTrigger value="logs" className="min-h-11">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="flex flex-col gap-4 pt-4">
          <div className="mx-auto w-full max-w-2xl">
            {direction === "inbound" && inboundDraft ? (
              <WebhookInboundConfigFields
                idPrefix="detail-inbound"
                values={inboundDraft}
                onChange={(patch) => setInboundDraft((current) => (current ? { ...current, ...patch } : current))}
                showUrl
                webhookUrl={webhook.webhookUrl}
                tokenPreview={webhook.tokenPreview}
                onCopyUrl={(value) => void copyValue(value)}
              />
            ) : null}
            {direction === "outbound" && outboundDraft ? (
              <>
                <WebhookOutboundConfigFields
                  idPrefix="detail-outbound"
                  values={outboundDraft}
                  onChange={(patch) =>
                    setOutboundDraft((current) => (current ? { ...current, ...patch } : current))
                  }
                />
                <p className="mt-4 text-sm text-muted-foreground">
                  Falhas consecutivas: {webhook.failureStreak}/{webhook.failureThreshold}
                </p>

                <div className="mt-6 flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Label>Segredo de assinatura (HMAC)</Label>
                      <p className="font-mono text-sm text-muted-foreground">
                        {webhook.signingSecretPreview ?? "não configurado"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmingRotateSecret(true)}
                      disabled={rotatingSecret || actionPending}
                    >
                      <KeyRound data-icon="inline-start" />
                      {rotatingSecret ? "Rotacionando..." : "Rotacionar segredo"}
                    </Button>
                  </div>
                  {!webhook.signingSecretPreview ? (
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      Sem segredo configurado, as entregas deste webhook falham e não são
                      reenviadas. Rotacione um segredo para retomar o envio.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-0"
                    onClick={() => setShowSignatureGuide((current) => !current)}
                  >
                    {showSignatureGuide ? "Ocultar guia de verificação" : "Ver guia de verificação"}
                  </Button>
                  {showSignatureGuide ? <WebhookSignatureVerificationGuide /> : null}
                </div>
              </>
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => void runSave()} disabled={!canSave}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="logs" className="min-w-0 pt-4">
          <WebhookLogsPanel
            logs={logs}
            selectedLogId={selectedLogId}
            timezone={tz}
            isLoading={logsLoading}
            isRefreshing={logsRefreshing}
            resendingLogId={resendingLogId}
            canResend={direction === "outbound" && webhook.status !== "disabled"}
            onSelect={setSelectedLogId}
            onRefresh={() => void refreshLogs()}
            onResend={(log) => void runResend(log)}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {logsPage} · {logsTotal} registro(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={logsPage <= 1 || actionPending}
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={logsPage * 20 >= logsTotal || actionPending}
                onClick={() => setLogsPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(rotatedToken)} onOpenChange={(open) => !open && setRotatedToken(null)}>
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Token atualizado</AlertDialogTitle>
            <AlertDialogDescription>
              Copie a URL e o token agora. Depois desta tela o token completo não será exibido novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rotated-url">URL do webhook</Label>
              <div className="flex gap-2">
                <Input id="rotated-url" readOnly value={rotatedToken?.url ?? ""} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => rotatedToken?.url && void copyValue(rotatedToken.url)}
                >
                  <Copy />
                </Button>
              </div>
            </div>
            {rotatedToken?.token ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rotated-token">Token</Label>
                <div className="flex gap-2">
                  <Input id="rotated-token" readOnly value={rotatedToken.token} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyValue(rotatedToken.token!)}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRotatedToken(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(revealedSigningSecret)}
        onOpenChange={(open) => !open && setRevealedSigningSecret(null)}
      >
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Segredo de assinatura atualizado</AlertDialogTitle>
            <AlertDialogDescription>
              Copie o segredo agora e atualize o verificador no destino. Depois desta tela ele
              não será exibido novamente — o segredo anterior para de validar assinaturas
              imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rotated-signing-secret">Segredo de assinatura (HMAC)</Label>
              <div className="flex gap-2">
                <Input
                  id="rotated-signing-secret"
                  readOnly
                  value={revealedSigningSecret ?? ""}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="max-lg:size-11"
                  aria-label="Copiar segredo de assinatura"
                  onClick={() => revealedSigningSecret && void copyValue(revealedSigningSecret)}
                >
                  <Copy />
                </Button>
              </div>
            </div>
            <WebhookSignatureVerificationGuide />
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRevealedSigningSecret(null)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingDeactivate} onOpenChange={setConfirmingDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              O webhook é desativado, não excluído: nenhum evento novo é entregue, mas os logs
              de entrega e o histórico continuam disponíveis nesta tela. Você pode reativá-lo a
              qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingDeactivate(false);
                void runStatus({ status: "disabled" });
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingRotateSecret} onOpenChange={setConfirmingRotateSecret}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotacionar o segredo de assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              O segredo atual para de validar assinaturas imediatamente, sem período de
              graça. Toda entrega feita com o segredo anterior passa a ser rejeitada pelo
              destino até você atualizar o verificador com o novo segredo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingRotateSecret(false);
                void runRotateSigningSecret();
              }}
            >
              Rotacionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

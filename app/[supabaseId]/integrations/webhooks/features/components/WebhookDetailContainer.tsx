"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, KeyRound, RefreshCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type {
  TeamWebhookDirection,
  TeamWebhookLogItem,
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

type Props = {
  supabaseId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
};

function inferInboundTokenMode(webhook: TeamWebhookSummary): WebhookInboundFormValues["tokenMode"] {
  if (webhook.tokenPreview === "sem-token") return "none";
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

/** R20-10: `null`/`undefined` viram "—" (não o texto "null"); string crua não é reescapada como JSON. */
function formatLogBody(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
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

export function WebhookDetailContainer({ supabaseId, webhookId, direction }: Props) {
  const { activeTeam } = useTeamContext();
  const { tz } = useTimezone();
  const [webhook, setWebhook] = useState<TeamWebhookSummary | null>(null);
  const [inboundDraft, setInboundDraft] = useState<WebhookInboundFormValues | null>(null);
  const [outboundDraft, setOutboundDraft] = useState<WebhookOutboundFormValues | null>(null);
  const [inboundInitial, setInboundInitial] = useState<WebhookInboundFormValues | null>(null);
  const [outboundInitial, setOutboundInitial] = useState<WebhookOutboundFormValues | null>(null);
  const [logs, setLogs] = useState<TeamWebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [rotatedToken, setRotatedToken] = useState<{ url: string; token?: string } | null>(null);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [revealedSigningSecret, setRevealedSigningSecret] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<TeamWebhookLogItem | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingRotateSecret, setConfirmingRotateSecret] = useState(false);
  const [showSignatureGuide, setShowSignatureGuide] = useState(false);

  const listPath = `/${supabaseId}/integrations/webhooks/${direction}`;

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

  const load = useCallback(async () => {
    if (!activeTeam?.id) return;
    setLoading(true);
    try {
      const [detail, logResult] = await Promise.all([
        teamWebhooksService.getById(supabaseId, activeTeam.id, webhookId),
        teamWebhooksService.listLogs(supabaseId, activeTeam.id, webhookId, {
          page: logsPage,
          pageSize: 20,
        }),
      ]);
      applyWebhookToDraft(detail);
      setLogs(logResult.items);
      setLogsTotal(logResult.total);
    } catch (error) {
      toastUserError(error);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, applyWebhookToDraft, logsPage, supabaseId, webhookId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const updated = await teamWebhooksService.changeStatus(
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
      await teamWebhooksService.testDelivery(supabaseId, activeTeam.id, webhookId);
      toast.success("Envio de teste concluído");
      setLogsPage(1);
      await load();
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
      const updated = await teamWebhooksService.rotateSigningSecret(
        supabaseId,
        activeTeam.id,
        webhookId
      );
      applyWebhookToDraft(updated);
      setRevealedSigningSecret(updated.signingSecret ?? null);
      toast.success("Segredo de assinatura rotacionado");
    } catch (error) {
      toastUserError(error);
    } finally {
      setRotatingSecret(false);
    }
  };

  const runSave = async () => {
    if (!activeTeam?.id || !updatePayload || !canSave) return;
    setSaving(true);
    try {
      const updated = await teamWebhooksService.update(
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

  if (loading || !webhook) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" asChild className="w-fit px-0">
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
            <Button variant="secondary" onClick={runTest} disabled={actionPending}>
              Testar envio
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={actionPending}>
            <RefreshCcw />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
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
                      Sem segredo configurado, as entregas deste webhook ficam em espera
                      (não são descartadas) até você rotacionar um segredo.
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
        <TabsContent value="logs" className="pt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Erro</TableHead>
                  {direction === "outbound" ? (
                    <TableHead className="text-right">Detalhe</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={direction === "outbound" ? 5 : 4}
                      className="text-center text-muted-foreground"
                    >
                      Nenhum log ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {formatIntimezone(new Date(log.createdAt), "dd/MM/yyyy HH:mm", tz)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.result === "success"
                              ? "default"
                              : log.result === "rejected"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {log.result}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.statusCode ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">
                        {log.errorMessage ?? "—"}
                      </TableCell>
                      {direction === "outbound" ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            Ver detalhes
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {logsPage} · {logsTotal} registro(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={logsPage <= 1 || actionPending}
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
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

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhe da entrega</DialogTitle>
            <DialogDescription>
              {selectedLog
                ? formatIntimezone(new Date(selectedLog.createdAt), "dd/MM/yyyy HH:mm:ss", tz)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={
                  selectedLog?.result === "success"
                    ? "default"
                    : selectedLog?.result === "rejected"
                      ? "secondary"
                      : "destructive"
                }
              >
                {selectedLog?.result}
              </Badge>
              <span className="text-sm text-muted-foreground">
                HTTP {selectedLog?.statusCode ?? "—"}
              </span>
            </div>

            {selectedLog?.errorMessage ? (
              <div className="flex flex-col gap-1">
                <Label>Erro completo</Label>
                <p className="rounded-md bg-muted p-3 text-sm text-destructive">
                  {selectedLog.errorMessage}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label>Payload enviado</Label>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                <code className="font-mono">
                  {selectedLog ? formatLogBody(selectedLog.requestPayload) : ""}
                </code>
              </pre>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Corpo da resposta</Label>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                <code className="font-mono">
                  {selectedLog ? formatLogBody(selectedLog.responsePayload) : ""}
                </code>
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Copy, Eye, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
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

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — as chamadas de rede
 * passam pelo Service page-local (`InboundWebhookDetailService` /
 * `OutboundWebhookDetailService`), injetado via Hook/Context da rota. Este
 * componente compartilhado não importa `teamWebhooksService` diretamente
 * — a mesma interface estrutural serve para as duas direções.
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
};

type Props = {
  supabaseId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
  /** SPEC 10, R10-5: caminho de volta à lista, derivado pelo Hook page-local. */
  listPath: string;
  service: WebhookDetailServiceLike;
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

/**
 * R10-15 (revisão Opus, sugestão) — o Sheet e a tabela mostravam
 * `log.result` cru ("success"/"rejected"/"failure"), em inglês.
 */
const LOG_RESULT_LABEL: Record<string, string> = {
  success: "Sucesso",
  rejected: "Rejeitado",
  failure: "Falha",
};

function formatLogResultLabel(result: string): string {
  return LOG_RESULT_LABEL[result] ?? result;
}

/** SPEC 10, B-E3: mesmo formatador usado no widget legado (StudioWebhookIntegration.tsx). */
function formatLogPayloadForDetails(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (typeof payload === "undefined" || payload === null) return "null";

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return JSON.stringify({ serializationError: "unserializable_payload" }, null, 2);
  }
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

export function WebhookDetailContainer({ supabaseId, webhookId, direction, listPath, service }: Props) {
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<TeamWebhookLogItem | null>(null);


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
    // SPEC 10, B-E2 (W14): erro de carregamento é um estado próprio, nunca
    // um skeleton que trava para sempre porque `webhook` nunca chega a
    // existir. Controle negativo: voltar ao `if (loading || !webhook)` e a
    // tela trava em skeleton quando a API falha.
    setLoadError(null);
    try {
      const [detail, logResult] = await Promise.all([
        service.getById(supabaseId, activeTeam.id, webhookId),
        service.listLogs(supabaseId, activeTeam.id, webhookId, {
          page: logsPage,
          pageSize: 20,
        }),
      ]);
      applyWebhookToDraft(detail);
      setLogs(logResult.items);
      setLogsTotal(logResult.total);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar este webhook");
      toastUserError(error);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, applyWebhookToDraft, logsPage, service, supabaseId, webhookId]);

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
      await load();
    } catch (error) {
      toastUserError(error);
    } finally {
      setActionPending(false);
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
              onClick={() => runStatus({ status: "disabled" })}
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
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                          {formatLogResultLabel(log.result)}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.statusCode ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">
                        {log.errorMessage ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLogForDetail(log)}
                        >
                          <Eye data-icon="inline-start" />
                          Ver detalhes
                        </Button>
                      </TableCell>
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

      {/* SPEC 10, B-E3 (W17): payload de request/response e erro completo —
          já mascarados pela API (A-E6). Sem "ver original": a tela nunca
          reverte a máscara. */}
      <Sheet open={Boolean(selectedLogForDetail)} onOpenChange={(open) => !open && setSelectedLogForDetail(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalhe do log</SheetTitle>
            <SheetDescription>
              {selectedLogForDetail
                ? formatIntimezone(new Date(selectedLogForDetail.createdAt), "dd/MM/yyyy HH:mm:ss", tz)
                : null}
            </SheetDescription>
          </SheetHeader>
          {selectedLogForDetail ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    selectedLogForDetail.result === "success"
                      ? "default"
                      : selectedLogForDetail.result === "rejected"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {formatLogResultLabel(selectedLogForDetail.result)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedLogForDetail.method ?? "—"} · HTTP {selectedLogForDetail.statusCode ?? "—"}
                </span>
              </div>

              {selectedLogForDetail.endpoint ? (
                <p className="break-all text-sm text-muted-foreground">{selectedLogForDetail.endpoint}</p>
              ) : null}

              {selectedLogForDetail.errorMessage ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{selectedLogForDetail.errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">Payload da requisição</p>
                {selectedLogForDetail.requestPayload ? (
                  <pre className="max-h-[280px] overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                    {formatLogPayloadForDetails(selectedLogForDetail.requestPayload)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de requisição.</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">Payload da resposta</p>
                {selectedLogForDetail.responsePayload ? (
                  <pre className="max-h-[280px] overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
                    {formatLogPayloadForDetails(selectedLogForDetail.responsePayload)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de resposta.</p>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
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
      toast.error(error instanceof Error ? error.message : "Erro ao carregar webhook");
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
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status");
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
      toast.error(error instanceof Error ? error.message : "Falha no teste");
    } finally {
      setActionPending(false);
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
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configuração");
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
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
    </div>
  );
}

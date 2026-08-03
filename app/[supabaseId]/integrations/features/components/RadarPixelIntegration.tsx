"use client";

import { Code, Copy, Radio, RefreshCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useIntegrationsContext } from "../context/IntegrationsContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import type { RadarPixelHitLogItem } from "../services/IIntegrationsService";

const LOG_EVENT_TYPE_LABEL: Record<string, string> = {
  "pixel.pageview": "Pageview",
  "pixel.click": "Clique",
};

function PixelHitLogRow({ log, isSelected, onSelect }: { log: RadarPixelHitLogItem; isSelected: boolean; onSelect: () => void }) {
  const { tz } = useTimezone();

  return (
    <TableRow
      className="cursor-pointer"
      data-state={isSelected ? "selected" : undefined}
      onClick={onSelect}
    >
      <TableCell>
        <Badge variant="secondary">{LOG_EVENT_TYPE_LABEL[log.eventType] ?? log.eventType}</Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
        {log.visitorSession}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
        {log.origin ?? "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatIntimezone(new Date(log.createdAt), tz, "dd/MM/yyyy HH:mm")}
      </TableCell>
    </TableRow>
  );
}

export function RadarPixelIntegration() {
  const {
    radarPixelConfig,
    radarPixelAllowedOriginsInput,
    radarPixelLoading,
    radarPixelSaving,
    radarPixelDeleting,
    radarPixelHitLogs,
    radarPixelHitLogsLoading,
    selectedRadarPixelHitLogId,
    setRadarPixelAllowedOriginsInput,
    setSelectedRadarPixelHitLogId,
    saveRadarPixelConfig,
    deleteRadarPixelConfig,
    copyRadarPixelSnippet,
    loadRadarPixelHitLogs,
  } = useIntegrationsContext();

  const selectedLog = radarPixelHitLogs.find((l) => l.id === selectedRadarPixelHitLogId) ?? null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="setup">
        <AccordionTrigger className="gap-2">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-muted-foreground" />
            <span className="font-semibold">Corretor Studio Pixel</span>
            {radarPixelConfig?.configured && (
              <Badge variant="default" className="ml-1">Ativo</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4">
          <Alert>
            <AlertDescription>
              Instale o snippet abaixo em qualquer página do seu site para rastrear visitantes anônimos e enriquecer
              automaticamente os perfis no Radar.
            </AlertDescription>
          </Alert>

          {radarPixelLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pixel-origins">
                  Origens permitidas
                  <span className="ml-1 text-xs text-muted-foreground">(uma por linha, ex: https://seusite.com)</span>
                </Label>
                <Textarea
                  id="pixel-origins"
                  rows={4}
                  placeholder={"https://seusite.com\nhttps://blog.seusite.com"}
                  value={radarPixelAllowedOriginsInput}
                  onChange={(e) => setRadarPixelAllowedOriginsInput(e.target.value)}
                  disabled={radarPixelSaving || radarPixelDeleting}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para aceitar qualquer origem (não recomendado em produção).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={saveRadarPixelConfig}
                  disabled={radarPixelSaving || radarPixelDeleting}
                  size="sm"
                >
                  <Save />
                  {radarPixelSaving ? "Salvando…" : radarPixelConfig?.configured ? "Atualizar pixel" : "Ativar pixel"}
                </Button>

                {radarPixelConfig?.configured && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyRadarPixelSnippet}
                      disabled={radarPixelSaving || radarPixelDeleting}
                    >
                      <Copy />
                      Copiar snippet
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={radarPixelDeleting || radarPixelSaving}
                        >
                          <Trash2 />
                          {radarPixelDeleting ? "Removendo…" : "Remover pixel"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover pixel de rastreamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O token atual ficará inativo e o snippet instalado nos seus sites deixará de funcionar.
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteRadarPixelConfig}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>

              {radarPixelConfig?.pixelSnippet && (
                <div className="flex flex-col gap-1">
                  <Label className="flex items-center gap-1">
                    <Code className="size-4" />
                    Snippet para instalação
                  </Label>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {radarPixelConfig.pixelSnippet}
                  </pre>
                </div>
              )}

              {radarPixelConfig?.lastUsedAt && (
                <p className="text-xs text-muted-foreground">
                  Último hit registrado:{" "}
                  {new Date(radarPixelConfig.lastUsedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="activity">
        <AccordionTrigger className="gap-2">
          <div className="flex items-center gap-2">
            <RefreshCcw className="size-4 text-muted-foreground" />
            <span className="font-semibold">Atividade do pixel</span>
            {radarPixelHitLogs.length > 0 && (
              <Badge variant="secondary" className="ml-1">{radarPixelHitLogs.length}</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadRadarPixelHitLogs({ force: true })}
              disabled={radarPixelHitLogsLoading}
            >
              <RefreshCcw className={radarPixelHitLogsLoading ? "animate-spin" : undefined} />
              Atualizar
            </Button>
          </div>

          {radarPixelHitLogsLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : radarPixelHitLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum hit registrado ainda. Instale o snippet e aguarde.
            </p>
          ) : (
            <div className="flex gap-4">
              <ScrollArea className="flex-1 rounded-md border max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Sessão</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {radarPixelHitLogs.map((log) => (
                      <PixelHitLogRow
                        key={log.id}
                        log={log}
                        isSelected={log.id === selectedRadarPixelHitLogId}
                        onSelect={() => setSelectedRadarPixelHitLogId(log.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {selectedLog && (
                <div className="w-64 flex-shrink-0 rounded-md border p-3 text-xs flex flex-col gap-2">
                  <p className="font-semibold">Detalhes</p>
                  <div>
                    <p className="text-muted-foreground">Evento</p>
                    <p>{LOG_EVENT_TYPE_LABEL[selectedLog.eventType] ?? selectedLog.eventType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sessão</p>
                    <p className="font-mono break-all">{selectedLog.visitorSession}</p>
                  </div>
                  {selectedLog.origin && (
                    <div>
                      <p className="text-muted-foreground">Origem</p>
                      <p className="break-all">{selectedLog.origin}</p>
                    </div>
                  )}
                  {selectedLog.userAgent && (
                    <div>
                      <p className="text-muted-foreground">User-Agent</p>
                      <p className="break-all">{selectedLog.userAgent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

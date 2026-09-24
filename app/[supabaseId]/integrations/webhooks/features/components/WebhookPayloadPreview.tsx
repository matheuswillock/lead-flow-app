"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildOutboundPayloadExample } from "@/lib/webhooks/webhookPayloadExamples";
import {
  WEBHOOK_EVENT_OPTIONS,
  type TeamWebhookDestinationPreset,
  type TeamWebhookEventKey,
} from "../services/ITeamWebhooksService";

type Props = {
  selectedEvents: TeamWebhookEventKey[];
  destinationPreset: TeamWebhookDestinationPreset;
};

export function WebhookPayloadPreview({ selectedEvents, destinationPreset }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<TeamWebhookEventKey>(
    selectedEvents[0] ?? "lead_created"
  );
  const [copied, setCopied] = useState(false);
  const activeEvent = selectedEvents.includes(selectedEvent)
    ? selectedEvent
    : (selectedEvents[0] ?? "lead_created");

  const payloadJson = useMemo(
    () => JSON.stringify(buildOutboundPayloadExample(activeEvent, destinationPreset), null, 2),
    [activeEvent, destinationPreset]
  );

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      toast.success("Payload copiado");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o payload");
    }
  };

  if (selectedEvents.length === 0) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-lg border bg-muted/20" aria-labelledby="payload-preview-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="min-w-0">
          <h2 id="payload-preview-title" className="text-sm font-semibold">
            Modelo do payload
          </h2>
          <p className="text-xs text-muted-foreground">Exemplo enviado com o preset atual</p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Select value={activeEvent} onValueChange={(value) => setSelectedEvent(value as TeamWebhookEventKey)}>
            <SelectTrigger className="min-h-11 w-[min(15rem,calc(100vw-8rem))]" aria-label="Evento do payload">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBHOOK_EVENT_OPTIONS.filter((option) => selectedEvents.includes(option.value)).map(
                (option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Copiar modelo do payload"
                  onClick={() => void copyPayload()}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copiado" : "Copiar payload"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-xs leading-5 text-foreground">
        <code>{payloadJson}</code>
      </pre>
    </section>
  );
}

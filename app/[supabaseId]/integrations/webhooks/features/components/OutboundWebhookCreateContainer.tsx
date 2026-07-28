"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup } from "@/components/ui/field";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import {
  WEBHOOK_EVENT_OPTIONS,
  type TeamWebhookDestinationPreset,
  type TeamWebhookEventKey,
} from "../services/ITeamWebhooksService";

type Props = { supabaseId: string };

const PRESET_HELP: Record<TeamWebhookDestinationPreset, string> = {
  generic: "Cole qualquer URL HTTPS que aceite POST JSON (n8n, Make, etc.).",
  slack: "Use uma Incoming Webhook URL do Slack (hooks.slack.com).",
  teams: "Use a URL do Incoming Webhook do Microsoft Teams.",
  zapier: "Cole a Catch Hook URL do Zapier ou similar.",
};

export function OutboundWebhookCreateContainer({ supabaseId }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [preset, setPreset] = useState<TeamWebhookDestinationPreset>("generic");
  const [selectedEvents, setSelectedEvents] = useState<TeamWebhookEventKey[]>(["lead_created"]);
  const [failureThreshold, setFailureThreshold] = useState(10);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (eventKey: TeamWebhookEventKey, checked: boolean) => {
    setSelectedEvents((current) =>
      checked ? [...new Set([...current, eventKey])] : current.filter((item) => item !== eventKey)
    );
  };

  const canSubmit =
    Boolean(activeTeam?.id) &&
    name.trim().length > 0 &&
    targetUrl.trim().length > 0 &&
    selectedEvents.length > 0 &&
    !saving;

  const onSubmit = async () => {
    if (!activeTeam?.id || !canSubmit) return;
    setSaving(true);
    try {
      const created = await teamWebhooksService.create(supabaseId, activeTeam.id, {
        direction: "outbound",
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        destinationPreset: preset,
        selectedEvents,
        failureThreshold,
      });
      toast.success("Webhook de saída criado");
      router.push(`/${supabaseId}/integrations/webhooks/outbound/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar webhook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de saída</h1>
      </div>

      <FieldGroup>
        <Field>
          <Label htmlFor="out-name">Nome</Label>
          <Input id="out-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field>
          <Label>Preset de destino</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as TeamWebhookDestinationPreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="generic">URL genérica</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="teams">Microsoft Teams</SelectItem>
              <SelectItem value="zapier">Zapier / n8n</SelectItem>
            </SelectContent>
          </Select>
          <Alert>
            <AlertDescription>{PRESET_HELP[preset]}</AlertDescription>
          </Alert>
        </Field>
        <Field>
          <Label htmlFor="out-url">URL de destino (HTTPS)</Label>
          <Input id="out-url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
        </Field>
        <Field>
          <Label>Eventos</Label>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            {WEBHOOK_EVENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedEvents.includes(option.value)}
                  onCheckedChange={(checked) => toggleEvent(option.value, checked === true)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>
        <Field>
          <Label htmlFor="threshold">Limiar de auto-pause</Label>
          <Input
            id="threshold"
            type="number"
            min={1}
            max={100}
            value={failureThreshold}
            onChange={(e) => setFailureThreshold(Number(e.target.value) || 10)}
          />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild disabled={saving}>
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}

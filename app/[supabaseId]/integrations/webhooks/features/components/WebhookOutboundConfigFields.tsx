"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup } from "@/components/ui/field";
import {
  WEBHOOK_EVENT_OPTIONS,
  type TeamWebhookDestinationPreset,
  type TeamWebhookEventKey,
} from "../services/ITeamWebhooksService";

export type WebhookOutboundFormValues = {
  name: string;
  targetUrl: string;
  destinationPreset: TeamWebhookDestinationPreset;
  selectedEvents: TeamWebhookEventKey[];
  failureThreshold: number;
};

const PRESET_HELP: Record<TeamWebhookDestinationPreset, string> = {
  generic: "Cole qualquer URL HTTPS que aceite POST JSON (n8n, Make, etc.).",
  slack: "Use uma Incoming Webhook URL do Slack (hooks.slack.com).",
  teams: "Use a URL do Incoming Webhook do Microsoft Teams.",
  zapier: "Cole a Catch Hook URL do Zapier ou similar.",
};

type Props = {
  values: WebhookOutboundFormValues;
  onChange: (patch: Partial<WebhookOutboundFormValues>) => void;
  idPrefix?: string;
};

export function WebhookOutboundConfigFields({ values, onChange, idPrefix = "outbound" }: Props) {
  const toggleEvent = (eventKey: TeamWebhookEventKey, checked: boolean) => {
    onChange({
      selectedEvents: checked
        ? [...new Set([...values.selectedEvents, eventKey])]
        : values.selectedEvents.filter((item) => item !== eventKey),
    });
  };

  return (
    <FieldGroup>
      <Field>
        <Label htmlFor={`${idPrefix}-name`}>Nome</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={120}
        />
      </Field>
      <Field>
        <Label>Preset de destino</Label>
        <Select
          value={values.destinationPreset}
          onValueChange={(v) =>
            onChange({ destinationPreset: v as TeamWebhookDestinationPreset })
          }
        >
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
          <AlertDescription>{PRESET_HELP[values.destinationPreset]}</AlertDescription>
        </Alert>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-url`}>URL de destino (HTTPS)</Label>
        <Input
          id={`${idPrefix}-url`}
          value={values.targetUrl}
          onChange={(e) => onChange({ targetUrl: e.target.value })}
          placeholder="https://..."
        />
      </Field>
      <Field>
        <Label>Eventos</Label>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          {WEBHOOK_EVENT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.selectedEvents.includes(option.value)}
                onCheckedChange={(checked) => toggleEvent(option.value, checked === true)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-threshold`}>Limiar de auto-pause</Label>
        <Input
          id={`${idPrefix}-threshold`}
          type="number"
          min={1}
          max={100}
          value={values.failureThreshold}
          onChange={(e) => onChange({ failureThreshold: Number(e.target.value) || 10 })}
        />
      </Field>
    </FieldGroup>
  );
}

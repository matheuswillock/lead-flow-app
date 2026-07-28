"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldGroup } from "@/components/ui/field";

export type WebhookInboundFormValues = {
  name: string;
  tokenMode: "manual" | "auto" | "none";
  manualToken: string;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
};

type Props = {
  values: WebhookInboundFormValues;
  onChange: (patch: Partial<WebhookInboundFormValues>) => void;
  idPrefix?: string;
  webhookUrl?: string | null;
  tokenPreview?: string | null;
  onCopyUrl?: (value: string) => void;
  showUrl?: boolean;
};

export function WebhookInboundConfigFields({
  values,
  onChange,
  idPrefix = "inbound",
  webhookUrl,
  tokenPreview,
  onCopyUrl,
  showUrl = false,
}: Props) {
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
      {showUrl && webhookUrl ? (
        <Field>
          <Label htmlFor={`${idPrefix}-url`}>URL do webhook</Label>
          <div className="flex gap-2">
            <Input id={`${idPrefix}-url`} readOnly value={webhookUrl} />
            {onCopyUrl ? (
              <Button type="button" variant="outline" size="icon" onClick={() => onCopyUrl(webhookUrl)}>
                <Copy />
              </Button>
            ) : null}
          </div>
          {tokenPreview ? (
            <p className="text-sm text-muted-foreground">Token: {tokenPreview}</p>
          ) : null}
        </Field>
      ) : null}
      <Field>
        <Label>Modo do token</Label>
        <RadioGroup
          value={values.tokenMode}
          onValueChange={(v) => onChange({ tokenMode: v as WebhookInboundFormValues["tokenMode"] })}
          className="gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="auto" id={`${idPrefix}-token-auto`} />
            <Label htmlFor={`${idPrefix}-token-auto`}>Token automático</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="manual" id={`${idPrefix}-token-manual`} />
            <Label htmlFor={`${idPrefix}-token-manual`}>Token manual</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="none" id={`${idPrefix}-token-none`} />
            <Label htmlFor={`${idPrefix}-token-none`}>Sem token</Label>
          </div>
        </RadioGroup>
      </Field>
      {values.tokenMode === "manual" ? (
        <Field>
          <Label htmlFor={`${idPrefix}-manual-token`}>Token manual</Label>
          <Input
            id={`${idPrefix}-manual-token`}
            value={values.manualToken}
            onChange={(e) => onChange({ manualToken: e.target.value })}
          />
        </Field>
      ) : null}
      <Field>
        <Label>Expiração</Label>
        <RadioGroup
          value={values.expiryMode}
          onValueChange={(v) => onChange({ expiryMode: v as WebhookInboundFormValues["expiryMode"] })}
          className="gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="indeterminate" id={`${idPrefix}-exp-ind`} />
            <Label htmlFor={`${idPrefix}-exp-ind`}>Indeterminado</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="hours_24" id={`${idPrefix}-exp-24`} />
            <Label htmlFor={`${idPrefix}-exp-24`}>24 horas</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="months_6" id={`${idPrefix}-exp-6`} />
            <Label htmlFor={`${idPrefix}-exp-6`}>6 meses</Label>
          </div>
        </RadioGroup>
      </Field>
    </FieldGroup>
  );
}

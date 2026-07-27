"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldGroup } from "@/components/ui/field";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type { TeamWebhookSummary } from "../services/ITeamWebhooksService";

type Props = { supabaseId: string };

export function InboundWebhookCreateContainer({ supabaseId }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [name, setName] = useState("Webhook Genérico de Leads");
  const [tokenMode, setTokenMode] = useState<"manual" | "auto" | "none">("auto");
  const [manualToken, setManualToken] = useState("");
  const [expiryMode, setExpiryMode] = useState<"hours_24" | "months_6" | "indeterminate">(
    "indeterminate"
  );
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<TeamWebhookSummary | null>(null);

  const canSubmit =
    Boolean(activeTeam?.id) &&
    name.trim().length > 0 &&
    (tokenMode !== "manual" || manualToken.trim().length >= 8) &&
    !saving;

  const onSubmit = async () => {
    if (!activeTeam?.id || !canSubmit) return;
    setSaving(true);
    try {
      const result = await teamWebhooksService.create(supabaseId, activeTeam.id, {
        direction: "inbound",
        name: name.trim(),
        tokenMode,
        manualToken: tokenMode === "manual" ? manualToken.trim() : undefined,
        expiryMode,
      });
      toast.success("Webhook de entrada criado");
      // Mantém token/URL reais na tela — o GET de detalhe mascara o token.
      setCreated(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar webhook");
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
    }
  };

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Webhook criado</h1>
          <p className="text-sm text-muted-foreground">
            Copie a URL (e o token, se houver) agora. Depois desta tela o token completo não será
            exibido novamente.
          </p>
        </div>

        <FieldGroup>
          <Field>
            <Label htmlFor="created-url">URL do webhook</Label>
            <div className="flex gap-2">
              <Input id="created-url" readOnly value={created.webhookUrl ?? ""} />
              <Button
                type="button"
                variant="outline"
                disabled={!created.webhookUrl}
                onClick={() => {
                  if (created.webhookUrl) void copyText(created.webhookUrl, "URL");
                }}
              >
                <Copy data-icon="inline-start" />
                Copiar
              </Button>
            </div>
          </Field>
          {created.token ? (
            <Field>
              <Label htmlFor="created-token">Token</Label>
              <div className="flex gap-2">
                <Input id="created-token" readOnly value={created.token} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copyText(created.token!, "Token");
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Copiar
                </Button>
              </div>
            </Field>
          ) : null}
        </FieldGroup>

        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              router.push(`/${supabaseId}/integrations/webhooks/inbound/${created.id}`);
            }}
          >
            Ir para detalhes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={`/${supabaseId}/integrations/webhooks/inbound`}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de entrada</h1>
      </div>

      <FieldGroup>
        <Field>
          <Label htmlFor="inbound-name">Nome</Label>
          <Input id="inbound-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field>
          <Label>Modo do token</Label>
          <RadioGroup value={tokenMode} onValueChange={(v) => setTokenMode(v as typeof tokenMode)} className="gap-3">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="token-auto" />
              <Label htmlFor="token-auto">Token automático</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="token-manual" />
              <Label htmlFor="token-manual">Token manual</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="none" id="token-none" />
              <Label htmlFor="token-none">Sem token</Label>
            </div>
          </RadioGroup>
        </Field>
        {tokenMode === "manual" ? (
          <Field>
            <Label htmlFor="manual-token">Token manual</Label>
            <Input id="manual-token" value={manualToken} onChange={(e) => setManualToken(e.target.value)} />
          </Field>
        ) : null}
        <Field>
          <Label>Expiração</Label>
          <RadioGroup value={expiryMode} onValueChange={(v) => setExpiryMode(v as typeof expiryMode)} className="gap-3">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="indeterminate" id="exp-ind" />
              <Label htmlFor="exp-ind">Indeterminado</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="hours_24" id="exp-24" />
              <Label htmlFor="exp-24">24 horas</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="months_6" id="exp-6" />
              <Label htmlFor="exp-6">6 meses</Label>
            </div>
          </RadioGroup>
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild disabled={saving}>
          <Link href={`/${supabaseId}/integrations/webhooks/inbound`}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}

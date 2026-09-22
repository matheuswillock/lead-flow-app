"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type { TeamWebhookSummary } from "../services/ITeamWebhooksService";
import {
  WebhookOutboundConfigFields,
  type WebhookOutboundFormValues,
} from "./WebhookOutboundConfigFields";
import { WebhookSignatureVerificationGuide } from "./WebhookSignatureVerificationGuide";

type Props = { supabaseId: string };

export function OutboundWebhookCreateContainer({ supabaseId }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [values, setValues] = useState<WebhookOutboundFormValues>({
    name: "",
    targetUrl: "",
    destinationPreset: "generic",
    selectedEvents: ["lead_created"],
    failureThreshold: 10,
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<TeamWebhookSummary | null>(null);

  const canSubmit =
    Boolean(activeTeam?.id) &&
    values.name.trim().length > 0 &&
    values.targetUrl.trim().length > 0 &&
    values.selectedEvents.length > 0 &&
    !saving;

  const onSubmit = async () => {
    if (!activeTeam?.id || !canSubmit) return;
    setSaving(true);
    try {
      const result = await teamWebhooksService.create(supabaseId, activeTeam.id, {
        direction: "outbound",
        name: values.name.trim(),
        targetUrl: values.targetUrl.trim(),
        destinationPreset: values.destinationPreset,
        selectedEvents: values.selectedEvents,
        failureThreshold: values.failureThreshold,
      });
      toast.success("Webhook de saída criado");
      setCreated(result);
    } catch (error) {
      toastUserError(error);
    } finally {
      setSaving(false);
    }
  };

  const copySecret = async () => {
    if (!created?.signingSecret) return;
    try {
      await navigator.clipboard.writeText(created.signingSecret);
      toast.success("Segredo copiado");
    } catch {
      toast.error("Não foi possível copiar o segredo");
    }
  };

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Webhook de saída criado</h1>
          <p className="text-sm text-muted-foreground">
            Copie o segredo de assinatura agora. Depois desta tela ele não será exibido
            novamente — só o preview fica disponível no detalhe do webhook.
          </p>
        </div>

        {created.signingSecret ? (
          <FieldGroup>
            <Field>
              <Label htmlFor="created-signing-secret">Segredo de assinatura (HMAC)</Label>
              <div className="flex gap-2">
                <Input
                  id="created-signing-secret"
                  readOnly
                  value={created.signingSecret}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="max-lg:h-11"
                  onClick={() => void copySecret()}
                >
                  <Copy data-icon="inline-start" />
                  Copiar
                </Button>
              </div>
            </Field>
          </FieldGroup>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              O segredo de assinatura não pôde ser gerado. Rotacione o segredo no detalhe do
              webhook antes de confiar nas entregas.
            </AlertDescription>
          </Alert>
        )}

        <WebhookSignatureVerificationGuide />

        <div className="flex justify-end gap-2">
          <Button
            className="max-lg:h-11"
            onClick={() => {
              router.push(`/${supabaseId}/integrations/webhooks/outbound/${created.id}`);
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
        <Button variant="ghost" size="sm" asChild className="w-fit px-0 max-lg:h-11">
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de saída</h1>
      </div>

      <WebhookOutboundConfigFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild disabled={saving} className="max-lg:h-11">
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit} className="max-lg:h-11">
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}

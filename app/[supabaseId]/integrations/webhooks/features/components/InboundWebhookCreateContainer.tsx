"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTeamContext } from "@/app/context/TeamContext";
import type {
  CreateInboundWebhookPayload,
  TeamMemberOption,
  TeamWebhookSummary,
} from "../services/ITeamWebhooksService";
import { WebhookInboundConfigFields } from "./WebhookInboundConfigFields";
import { WebhookInboundV2Fields } from "./WebhookInboundV2Fields";
import {
  buildInboundCreatePayload,
  INITIAL_INBOUND_CREATE_FORM,
  validateInboundCreateForm,
  type InboundCreateFormState,
} from "./inboundWebhookCreateForm";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — a chamada real de
 * criação passa pelo Service page-local (`InboundWebhookCreateService`),
 * injetado via Hook/Context da rota, em vez deste componente compartilhado
 * importar `teamWebhooksService` direto.
 */
type InboundWebhookCreateServiceLike = {
  create(supabaseId: string, teamId: string, payload: CreateInboundWebhookPayload): Promise<TeamWebhookSummary>;
  listTeamMembers(supabaseId: string, teamId: string): Promise<TeamMemberOption[]>;
};

type Props = {
  supabaseId: string;
  /** SPEC 10, R10-5: caminhos vêm do Hook page-local (InboundWebhookCreateHook), não hardcoded aqui. */
  listPath: string;
  buildDetailPath: (webhookId: string) => string;
  service: InboundWebhookCreateServiceLike;
};

export function InboundWebhookCreateContainer({ supabaseId, listPath, buildDetailPath, service }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [form, setForm] = useState<InboundCreateFormState>(INITIAL_INBOUND_CREATE_FORM);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<TeamWebhookSummary | null>(null);

  const teamId = activeTeam?.id;
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    setMembersLoading(true);
    service
      .listTeamMembers(supabaseId, teamId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((error) => {
        if (!cancelled) toastUserError(error);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service, supabaseId, teamId]);

  const validation = validateInboundCreateForm(form, members);
  // Com a lista de membros ainda carregando não dá para saber se falta Google: não libera o envio.
  const canSubmit = Boolean(teamId) && validation.ok && !saving && (form.version === 1 || !membersLoading);

  const patchForm = (patch: Partial<InboundCreateFormState>) => setForm((current) => ({ ...current, ...patch }));

  const onSubmit = async () => {
    if (!teamId || !canSubmit) return;
    setSaving(true);
    try {
      const result = await service.create(supabaseId, teamId, buildInboundCreatePayload(form));
      toast.success("Webhook de entrada criado");
      setCreated(result);
    } catch (error) {
      toastUserError(error);
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
          {created.contractVersion === 2 ? (
            <p className="text-sm text-muted-foreground">
              Versão 2: o token vai no header <code>Authorization: Bearer</code>, nunca na URL. O webhook responde só
              que recebeu o evento; o resultado de cada um aparece nos logs deste webhook.
            </p>
          ) : null}
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
              router.push(buildDetailPath(created.id));
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
          <Link href={listPath}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de entrada</h1>
      </div>

      <FieldGroup>
        <Field>
          <Label>Versão do contrato</Label>
          <RadioGroup
            value={String(form.version)}
            onValueChange={(value) => patchForm({ version: value === "1" ? 1 : 2 })}
            className="gap-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="2" id="inbound-version-2" />
              <Label htmlFor="inbound-version-2">Versão 2 (recomendada): token no header, agenda e rodízio de SDR</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1" id="inbound-version-1" />
              <Label htmlFor="inbound-version-1">Versão 1 (legada): token na URL, só cria o lead</Label>
            </div>
          </RadioGroup>
        </Field>
      </FieldGroup>

      {form.version === 1 ? (
        <WebhookInboundConfigFields values={form.base} onChange={(patch) => patchForm({ base: { ...form.base, ...patch } })} />
      ) : (
        <>
          <FieldGroup>
            <Field>
              <Label htmlFor="inbound-v2-name">Nome</Label>
              <Input
                id="inbound-v2-name"
                value={form.base.name}
                maxLength={120}
                onChange={(event) => patchForm({ base: { ...form.base, name: event.target.value } })}
              />
            </Field>
            <Field>
              <Label>Validade do token</Label>
              <RadioGroup
                value={form.base.expiryMode}
                onValueChange={(value) =>
                  patchForm({ base: { ...form.base, expiryMode: value as InboundCreateFormState["base"]["expiryMode"] } })
                }
                className="gap-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="months_6" id="inbound-v2-exp-6" />
                  <Label htmlFor="inbound-v2-exp-6">6 meses</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="hours_24" id="inbound-v2-exp-24" />
                  <Label htmlFor="inbound-v2-exp-24">24 horas (só para teste)</Label>
                </div>
              </RadioGroup>
            </Field>
          </FieldGroup>
          <WebhookInboundV2Fields state={form} members={members} membersLoading={membersLoading} onChange={patchForm} />
        </>
      )}

      {!validation.ok ? <p className="text-sm text-muted-foreground">{validation.reason}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild disabled={saving}>
          <Link href={listPath}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}

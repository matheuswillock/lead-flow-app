"use client";

import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup } from "@/components/ui/field";
import type { TeamMemberOption } from "../services/ITeamWebhooksService";
import {
  listClosersWithoutGoogle,
  listSdrs,
  moveAssignee,
  toggleAssignee,
  type InboundCreateFormState,
} from "./inboundWebhookCreateForm";

type Props = {
  state: InboundCreateFormState;
  members: TeamMemberOption[];
  membersLoading: boolean;
  onChange: (patch: Partial<InboundCreateFormState>) => void;
  idPrefix?: string;
};

/**
 * Campos próprios do webhook de entrada v2 (SPEC 11, B-E1): escopo de agenda, SDRs padrão em rodízio e
 * link de Meet padrão. Só os campos; a regra de validação vive em `inboundWebhookCreateForm.ts`.
 */
export function WebhookInboundV2Fields({ state, members, membersLoading, onChange, idPrefix = "inbound-v2" }: Props) {
  const sdrs = listSdrs(members);
  const closersWithoutGoogle = listClosersWithoutGoogle(members);
  const nameByProfileId = new Map(members.map((member) => [member.profileId, member.name]));

  return (
    <FieldGroup>
      <Field>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-schedule`}>Permitir agendar reuniões</Label>
            <p className="text-sm text-muted-foreground">
              Com o escopo de agenda, o evento pode trazer o horário de um closer. Sem ele, o lead é criado e a
              reunião pedida é ignorada.
            </p>
          </div>
          <Switch
            id={`${idPrefix}-schedule`}
            checked={state.scopeSchedule}
            onCheckedChange={(checked) => onChange({ scopeSchedule: checked })}
          />
        </div>
      </Field>

      <Field>
        <Label>SDRs que recebem os leads</Label>
        <p className="text-sm text-muted-foreground">
          Com mais de um SDR, os leads são distribuídos em rodízio, um para cada, na ordem abaixo.
        </p>
        {membersLoading ? (
          <p className="text-sm text-muted-foreground">Carregando o time...</p>
        ) : sdrs.length === 0 ? (
          <Alert>
            <AlertDescription>Este time não tem SDR. Adicione um SDR ao time para receber leads pelo webhook.</AlertDescription>
          </Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {sdrs.map((sdr) => {
              const position = state.assigneeProfileIds.indexOf(sdr.profileId);
              const selected = position !== -1;
              return (
                <li key={sdr.profileId} className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id={`${idPrefix}-sdr-${sdr.profileId}`}
                    checked={selected}
                    onCheckedChange={() =>
                      onChange({ assigneeProfileIds: toggleAssignee(state.assigneeProfileIds, sdr.profileId) })
                    }
                  />
                  <Label htmlFor={`${idPrefix}-sdr-${sdr.profileId}`} className="flex-1 cursor-pointer">
                    {sdr.name}
                  </Label>
                  {selected ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground tabular-nums">{position + 1}º</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="max-lg:size-11"
                        aria-label={`Subir ${sdr.name} na ordem do rodízio`}
                        disabled={position === 0}
                        onClick={() =>
                          onChange({ assigneeProfileIds: moveAssignee(state.assigneeProfileIds, sdr.profileId, -1) })
                        }
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="max-lg:size-11"
                        aria-label={`Descer ${sdr.name} na ordem do rodízio`}
                        disabled={position === state.assigneeProfileIds.length - 1}
                        onClick={() =>
                          onChange({ assigneeProfileIds: moveAssignee(state.assigneeProfileIds, sdr.profileId, 1) })
                        }
                      >
                        <ChevronDown />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {state.assigneeProfileIds.length > 1 ? (
          <p className="text-sm text-muted-foreground">
            Ordem do rodízio: {state.assigneeProfileIds.map((id) => nameByProfileId.get(id) ?? "SDR").join(", ")}.
          </p>
        ) : null}
      </Field>

      <Field>
        <Label htmlFor={`${idPrefix}-meet-link`}>
          Link de Meet padrão{closersWithoutGoogle.length > 0 ? " (obrigatório)" : " (opcional)"}
        </Label>
        {closersWithoutGoogle.length > 0 ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Há closers sem Google conectado</AlertTitle>
            <AlertDescription>
              Estes closers não têm conta Google conectada, então o sistema não consegue gerar o link do Google Meet
              para as reuniões online deles: {closersWithoutGoogle.map((closer) => closer.name).join(", ")}. O link
              abaixo será usado nessas reuniões e enviado por e-mail aos participantes.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todos os closers têm Google conectado. Use este campo só se quiser um link fixo de reserva.
          </p>
        )}
        <Input
          id={`${idPrefix}-meet-link`}
          inputMode="url"
          placeholder="https://meet.google.com/..."
          value={state.defaultMeetingLink}
          onChange={(event) => onChange({ defaultMeetingLink: event.target.value })}
        />
      </Field>
    </FieldGroup>
  );
}

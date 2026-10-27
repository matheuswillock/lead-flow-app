import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamMemberOption, TeamWebhookSummary } from "../services/ITeamWebhooksService";
import { buildCreateV2Href, buildOverviewAssignees, describeScopes } from "./inboundV2Overview";

type Props = {
  webhook: Pick<
    TeamWebhookSummary,
    "name" | "contractVersion" | "scopes" | "defaultAssigneeProfileIds" | "lastAssignedProfileId" | "defaultMeetingLink"
  >;
  members: TeamMemberOption[];
  membersLoading: boolean;
  inboundListPath: string;
};

/** Resumo do contrato de um webhook de entrada (SPEC 11, B-E2): versão, escopos, rodízio de SDRs e Meet padrão. */
export function WebhookInboundV2Overview({ webhook, members, membersLoading, inboundListPath }: Props) {
  if (webhook.contractVersion !== 2) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="inbound-version-title" data-testid="inbound-overview">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="inbound-version-title" className="text-sm font-semibold">
            Versão do contrato
          </h3>
          <Badge variant="secondary">Versão 1 (descontinuada)</Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          A versão 1 não distribui leads em rodízio nem agenda reuniões. A versão de um webhook não muda depois de
          criado: crie um webhook v2 e passe a integração para ele.
        </p>
        <Link
          href={buildCreateV2Href(inboundListPath, webhook.name)}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm underline underline-offset-4"
        >
          Criar webhook v2 a partir deste
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const assignees = buildOverviewAssignees({
    assigneeProfileIds: webhook.defaultAssigneeProfileIds,
    lastAssignedProfileId: webhook.lastAssignedProfileId,
    members,
  });

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4" aria-labelledby="inbound-version-title" data-testid="inbound-overview">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="inbound-version-title" className="text-sm font-semibold">
          Versão do contrato
        </h3>
        <Badge>Versão 2</Badge>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Permissões do token</p>
        <div className="flex flex-wrap gap-2">
          {describeScopes(webhook.scopes).map((scope) => (
            <Badge key={scope} variant="outline">
              {scope}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">SDRs que recebem os leads, em rodízio</p>
        {membersLoading ? (
          <Skeleton className="h-5 w-48" />
        ) : assignees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum SDR padrão: os leads entram sem responsável.</p>
        ) : (
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {assignees.map((assignee) => (
              <li key={assignee.profileId} className="flex flex-wrap items-center gap-2">
                <span>{assignee.name}</span>
                {assignee.isNext ? <Badge variant="secondary">Próximo lead</Badge> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {webhook.defaultMeetingLink ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Link de Meet padrão</p>
          <p className="break-all text-sm text-muted-foreground">{webhook.defaultMeetingLink}</p>
        </div>
      ) : null}
    </section>
  );
}

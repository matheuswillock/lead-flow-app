import type { Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import { invalidateDialerCampaignCache } from "@/lib/cache/invalidation";
import { DialerRepository } from "@/app/api/infra/data/repositories/dialer/DialerRepository";
import type {
  DialerTeamContext,
  IDialerRepository,
} from "@/app/api/infra/data/repositories/dialer/IDialerRepository";
import {
  DialerContactParserService,
  DIALER_CONTACTS_UPLOAD_LIMIT,
} from "@/app/api/services/DialerContactParser/DialerContactParserService";
import type { IDialerContactParserService } from "@/app/api/services/DialerContactParser/IDialerContactParserService";
import type {
  IUploadDialerContactsUseCase,
  UploadDialerContactsInput,
} from "./IUploadDialerContactsUseCase";

export const DIALER_UPLOAD_ERROR_MESSAGES = {
  CAMPAIGN_NOT_FOUND: "Campanha não encontrada",
  CAMPAIGN_LOCKED: "Não é possível adicionar contatos a uma campanha em discagem",
  NO_VALID_CONTACTS: "Nenhum contato válido encontrado no arquivo",
  LIMIT_EXCEEDED: `Limite de ${DIALER_CONTACTS_UPLOAD_LIMIT.toLocaleString("pt-BR")} contatos por campanha excedido`,
  INTERNAL_ERROR: "Erro interno ao processar o arquivo de contatos",
} as const;

export class UploadDialerContactsUseCase implements IUploadDialerContactsUseCase {
  constructor(
    private readonly repository: IDialerRepository,
    private readonly parser: IDialerContactParserService
  ) {}

  async uploadContacts(
    ctx: DialerTeamContext,
    campaignId: string,
    input: UploadDialerContactsInput
  ): Promise<Output> {
    try {
      const campaign = await this.repository.findCampaignByIdWithCtx(ctx, campaignId);
      if (!campaign) {
        return new Output(false, [], [DIALER_UPLOAD_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND], null);
      }
      if (campaign.status === "running") {
        return new Output(false, [], [DIALER_UPLOAD_ERROR_MESSAGES.CAMPAIGN_LOCKED], null);
      }

      const parseResult =
        input.fileType === "xlsx"
          ? this.parser.parseXlsx(input.buffer)
          : this.parser.parseJson(input.buffer.toString("utf-8"));

      if (parseResult.contacts.length === 0) {
        return new Output(
          false,
          [],
          [DIALER_UPLOAD_ERROR_MESSAGES.NO_VALID_CONTACTS, ...parseResult.errors],
          null
        );
      }

      const existingPhones = new Set(
        await this.repository.findContactPhonesWithCtx(ctx, campaignId)
      );
      const newContacts = parseResult.contacts.filter(
        (contact) => !existingPhones.has(contact.phone)
      );

      if (newContacts.length === 0) {
        return new Output(
          false,
          [],
          ["Todos os contatos do arquivo já existem na campanha"],
          null
        );
      }

      const existingCount = existingPhones.size;
      if (existingCount + newContacts.length > DIALER_CONTACTS_UPLOAD_LIMIT) {
        return new Output(false, [], [DIALER_UPLOAD_ERROR_MESSAGES.LIMIT_EXCEEDED], null);
      }

      const { inserted, totalContacts } = await this.repository.appendContactsWithCtx(
        ctx,
        campaignId,
        newContacts.map((contact) => ({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          metadata: contact.metadata ? (contact.metadata as Prisma.InputJsonObject) : undefined,
        }))
      );

      invalidateDialerCampaignCache({ teamId: ctx.teamId, campaignId });

      // Inclui duplicados barrados pela unique (campaignId, phone) em uploads concorrentes
      const duplicates = parseResult.contacts.length - inserted;

      console.info(
        `[UploadDialerContactsUseCase] Campanha ${campaignId}: ${inserted} contatos importados de "${input.fileName}" (${parseResult.skipped} inválidos, ${duplicates} duplicados)`
      );

      return new Output(true, [`${inserted} contatos importados com sucesso`], [], {
        inserted,
        totalContacts,
        invalidRows: parseResult.skipped,
        duplicates,
        errors: parseResult.errors,
      });
    } catch (error) {
      console.error("[UploadDialerContactsUseCase][uploadContacts]", error);
      return new Output(false, [], [DIALER_UPLOAD_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }
}

export const uploadDialerContactsUseCase = new UploadDialerContactsUseCase(
  new DialerRepository(),
  new DialerContactParserService()
);

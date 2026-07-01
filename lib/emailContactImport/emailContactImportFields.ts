import type { ImportFieldDef } from "@/components/import/types";

export type EmailContactImportFieldKey = "email" | "name";

export interface EmailContactImportRow {
  line?: number;
  email: string;
  name?: string;
  customFields?: Record<string, string>;
}

export const EMAIL_CONTACT_IMPORT_MAX_ROWS = 5000;

export const EMAIL_CONTACT_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: "email",
    label: "E-mail",
    description:
      "Endereço de e-mail do contato. Campo obrigatório: linhas sem e-mail válido são ignoradas.",
    required: true,
    formatHint: "Ex.: contato@empresa.com.br",
    aliases: ["email", "e-mail", "e_mail", "mail", "email_address"],
  },
  {
    key: "name",
    label: "Nome",
    description: "Nome do contato. Opcional — pode ficar em branco se o arquivo não tiver essa coluna.",
    required: false,
    aliases: ["name", "nome", "full_name", "nome_completo", "fullname"],
  },
];

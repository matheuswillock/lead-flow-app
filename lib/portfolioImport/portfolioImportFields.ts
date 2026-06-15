export type PortfolioImportFieldKey =
  | "name"
  | "email"
  | "phone"
  | "cnpj"
  | "operadora"
  | "productName"
  | "amount"
  | "startDateAt"
  | "finalizedDateAt"
  | "contractDueDate"
  | "notes"
  | "holderName"
  | "holderBirthDate"
  | "holderDocument";

export interface PortfolioImportFieldDef {
  key: PortfolioImportFieldKey;
  label: string;
  description: string;
  required: boolean;
  formatHint?: string;
  /** Nomes de coluna comuns usados para sugerir o mapeamento automaticamente. */
  aliases: string[];
}

export const PORTFOLIO_IMPORT_MAX_ROWS = 2000;

export const PORTFOLIO_IMPORT_FIELDS: PortfolioImportFieldDef[] = [
  {
    key: "name",
    label: "Nome do cliente",
    description: "Nome da pessoa ou razão social da empresa. Campo obrigatório: linhas sem nome são ignoradas.",
    required: true,
    aliases: ["nome", "name", "cliente", "razao social", "empresa"],
  },
  {
    key: "email",
    label: "E-mail",
    description: "E-mail de contato do cliente. Também é usado para evitar clientes duplicados dentro do time.",
    required: false,
    aliases: ["email", "e-mail", "mail"],
  },
  {
    key: "phone",
    label: "Telefone",
    description: "Telefone ou WhatsApp do cliente, com DDD. Campo obrigatório: linhas sem telefone são ignoradas.",
    required: true,
    formatHint: "Aceita com ou sem máscara, ex.: (11) 99999-9999",
    aliases: ["telefone", "phone", "celular", "whatsapp", "fone"],
  },
  {
    key: "cnpj",
    label: "CNPJ",
    description: "CNPJ da empresa do cliente. Também é usado para evitar duplicidade dentro do time.",
    required: false,
    formatHint: "Aceita com ou sem máscara, ex.: 00.000.000/0000-00",
    aliases: ["cnpj", "documento"],
  },
  {
    key: "operadora",
    label: "Operadora",
    description: "Operadora do plano de saúde contratado pelo cliente. Campo obrigatório.",
    required: true,
    aliases: ["operadora", "plano de saude", "convenio", "plano"],
  },
  {
    key: "productName",
    label: "Produto",
    description: "Nome do produto ou plano contratado junto à operadora.",
    required: false,
    aliases: ["produto", "plano contratado", "product", "plano vendido"],
  },
  {
    key: "amount",
    label: "Valor do contrato",
    description: "Valor mensal do contrato em reais. Campo obrigatório.",
    required: true,
    formatHint: "Aceita formato brasileiro, ex.: R$ 1.234,56",
    aliases: ["valor", "valor do contrato", "mensalidade", "amount", "ticket"],
  },
  {
    key: "startDateAt",
    label: "Data de início do contrato",
    description: "Data em que o contrato começou a vigorar. Campo obrigatório.",
    required: true,
    formatHint: "Aceita dd/mm/aaaa ou aaaa-mm-dd",
    aliases: ["data de inicio", "inicio do contrato", "data de contrato", "data contrato"],
  },
  {
    key: "finalizedDateAt",
    label: "Data de fechamento",
    description: "Data em que o negócio foi fechado. Sem valor, usamos a data de início do contrato.",
    required: false,
    formatHint: "Aceita dd/mm/aaaa ou aaaa-mm-dd",
    aliases: ["data de fechamento", "fechamento", "data de finalizacao", "finalizacao"],
  },
  {
    key: "contractDueDate",
    label: "Vencimento do contrato",
    description: "Data de vencimento ou renovação do contrato, usada nos alertas de renovação da carteira.",
    required: false,
    formatHint: "Aceita dd/mm/aaaa ou aaaa-mm-dd",
    aliases: ["vencimento", "vigencia", "data de vencimento", "renovacao"],
  },
  {
    key: "notes",
    label: "Observações",
    description: "Anotações gerais sobre o cliente ou o contrato.",
    required: false,
    aliases: ["observacoes", "observacao", "notas", "notes", "obs"],
  },
  {
    key: "holderName",
    label: "Nome do titular",
    description: "Nome completo do titular do contrato. O titular só é criado quando nome, nascimento e CPF estiverem presentes.",
    required: false,
    aliases: ["titular", "nome do titular", "responsavel"],
  },
  {
    key: "holderBirthDate",
    label: "Nascimento do titular",
    description: "Data de nascimento do titular do contrato.",
    required: false,
    formatHint: "Aceita dd/mm/aaaa ou aaaa-mm-dd",
    aliases: ["nascimento do titular", "data de nascimento", "nascimento"],
  },
  {
    key: "holderDocument",
    label: "CPF do titular",
    description: "CPF do titular do contrato.",
    required: false,
    formatHint: "Aceita com ou sem máscara",
    aliases: ["cpf do titular", "cpf", "documento do titular"],
  },
];

export type PortfolioImportRow = Partial<Record<PortfolioImportFieldKey, string>> & {
  /** Linha original no arquivo do usuário, usada no relatório final. */
  line?: number;
};

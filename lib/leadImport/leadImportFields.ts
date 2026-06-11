export type LeadImportFieldKey =
  | "name"
  | "email"
  | "phone"
  | "cnpj"
  | "age"
  | "currentHealthPlan"
  | "currentValue"
  | "ticket"
  | "referenceHospital"
  | "currentTreatment"
  | "notes"
  | "status"
  | "soldPlan"
  | "contractDueDate";

export type LeadImportFieldType = "text" | "currency" | "date" | "status" | "healthPlan";

export interface LeadImportFieldDef {
  key: LeadImportFieldKey;
  label: string;
  description: string;
  required: boolean;
  formatHint?: string;
  type: LeadImportFieldType;
  /** Nomes de coluna comuns usados para sugerir o mapeamento automaticamente. */
  aliases: string[];
}

export const LEAD_IMPORT_MAX_ROWS = 2000;

export const LEAD_IMPORT_FIELDS: LeadImportFieldDef[] = [
  {
    key: "name",
    label: "Nome do lead",
    description: "Nome da pessoa ou razão social da empresa. É o único campo obrigatório: linhas sem nome são ignoradas.",
    required: true,
    type: "text",
    aliases: ["nome", "name", "lead", "razao social", "empresa", "cliente", "task name"],
  },
  {
    key: "email",
    label: "E-mail",
    description: "E-mail de contato do lead. Também é usado para evitar leads duplicados dentro do time.",
    required: false,
    type: "text",
    aliases: ["email", "e-mail", "mail", "email (email)"],
  },
  {
    key: "phone",
    label: "Telefone",
    description: "Telefone ou WhatsApp de contato do lead, com DDD.",
    required: false,
    formatHint: "Aceita com ou sem máscara, ex.: (11) 99999-9999",
    type: "text",
    aliases: ["telefone", "phone", "celular", "whatsapp", "fone", "telefone (phone)"],
  },
  {
    key: "cnpj",
    label: "CNPJ",
    description: "CNPJ da empresa do lead. Também é usado para evitar duplicidade dentro do time.",
    required: false,
    formatHint: "Aceita com ou sem máscara, ex.: 00.000.000/0000-00",
    type: "text",
    aliases: ["cnpj", "documento", "cnpj (short text)"],
  },
  {
    key: "age",
    label: "Idades",
    description: "Idades das pessoas que entrarão no plano (texto livre), usadas para a cotação.",
    required: false,
    formatHint: "Ex.: 34, 32 e 5",
    type: "text",
    aliases: ["idades", "idade", "age", "vidas", "idades (short text)"],
  },
  {
    key: "currentHealthPlan",
    label: "Plano de saúde atual",
    description: "Operadora ou plano de saúde que o lead possui hoje. O valor é normalizado para as operadoras conhecidas do sistema.",
    required: false,
    type: "healthPlan",
    aliases: ["plano atual", "plano de saude", "operadora", "convenio", "plano", "qual o plano no momento"],
  },
  {
    key: "currentValue",
    label: "Valor atual",
    description: "Quanto o lead paga hoje no plano atual, em reais. Serve de referência para a proposta.",
    required: false,
    formatHint: "Aceita formato brasileiro, ex.: R$ 1.234,56",
    type: "currency",
    aliases: ["valor atual", "valor", "mensalidade", "valor atual (currency)"],
  },
  {
    key: "ticket",
    label: "Ticket",
    description: "Valor vendido (ticket) quando o negócio já foi fechado, em reais.",
    required: false,
    formatHint: "Aceita formato brasileiro, ex.: R$ 1.234,56",
    type: "currency",
    aliases: ["ticket", "valor vendido", "valor fechado", "ticket (currency)"],
  },
  {
    key: "referenceHospital",
    label: "Hospital de referência",
    description: "Hospital que o lead deseja manter no atendimento da nova cotação.",
    required: false,
    type: "text",
    aliases: ["hospital", "hospital referencia", "hospital de referencia"],
  },
  {
    key: "currentTreatment",
    label: "Tratamento em andamento",
    description: "Tratamento médico em andamento que precisa ser considerado na troca de plano.",
    required: false,
    type: "text",
    aliases: ["tratamento", "tratamento atual", "tratamento em andamento"],
  },
  {
    key: "notes",
    label: "Observações",
    description: "Anotações gerais sobre o lead. Ficam visíveis no card e nos detalhes do lead.",
    required: false,
    type: "text",
    aliases: ["observacoes", "observacao", "notas", "notes", "obs", "observacoes adicionais"],
  },
  {
    key: "status",
    label: "Status no funil",
    description: "Etapa do funil em que o lead está. Termos em português como Agendado, Negociação ou Perdido são convertidos para o status interno; sem valor, o lead entra como Nova oportunidade.",
    required: false,
    formatHint: "Ex.: Agendado, Negociação, Perdido, Fechado",
    type: "status",
    aliases: ["status", "etapa", "fase", "estagio", "situacao"],
  },
  {
    key: "soldPlan",
    label: "Plano vendido",
    description: "Plano de saúde contratado quando o negócio já foi fechado.",
    required: false,
    type: "text",
    aliases: ["plano vendido", "plano fechado", "plano contratado"],
  },
  {
    key: "contractDueDate",
    label: "Vigência do contrato",
    description: "Data de início de vigência do contrato fechado.",
    required: false,
    formatHint: "Aceita dd/mm/aaaa ou aaaa-mm-dd",
    type: "date",
    aliases: ["vigencia", "vigencia do contrato", "data de vigencia", "inicio do contrato"],
  },
];

export const LEAD_IMPORT_FIELD_KEYS = LEAD_IMPORT_FIELDS.map((field) => field.key);

export type LeadImportRow = Partial<Record<LeadImportFieldKey, string>>;

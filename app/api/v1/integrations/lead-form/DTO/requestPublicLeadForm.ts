import { z } from "zod";
import { MAX_DECIMAL_VALUE, MAX_DECIMAL_LABEL } from "../../../leads/DTO/leadValueLimits";

const isValidCnpj = (value: string): boolean => {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number.parseInt(digit, 10) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstDigit === Number.parseInt(cnpj[12], 10) && secondDigit === Number.parseInt(cnpj[13], 10);
};

export const PublicLeadFormRequestSchema = z
  .object({
    supabaseId: z.string().uuid("supabaseId deve ser um UUID válido"),
    teamId: z.string().uuid("teamId deve ser um UUID válido"),

    // Lead fields
    name: z.string().min(2, "Nome inválido"),
    email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
    phone: z.string().min(8, "Telefone inválido").max(20, "Telefone inválido"),
    cnpj: z
      .string()
      .nullish()
      .refine((value) => {
        if (!value || value.trim() === "") return true;
        return isValidCnpj(value);
      }, "CNPJ deve ser válido")
      .transform((val) => val || undefined),
    age: z
      .string()
      .min(1, "Informe as idades")
      .regex(/^[0-9,\s]+$/, "Use apenas números, vírgulas e espaços")
      .refine((val) => {
        const ages = val
          .split(",")
          .map((age) => Number.parseInt(age.trim(), 10))
          .filter((age) => !Number.isNaN(age));
        return ages.every((age) => age <= 120);
      }, "Todas as idades devem ser no máximo 120 anos"),
    currentHealthPlan: z.string().trim().min(1, "Selecione um plano de saúde"),
    currentValue: z
      .number()
      .min(0, "Valor deve ser maior ou igual a zero")
      .max(MAX_DECIMAL_VALUE, `Valor deve ser menor que ${MAX_DECIMAL_LABEL}`)
      .nullish()
      .transform((val) => val ?? undefined),
    referenceHospital: z.string().min(2, "O hospital de referência é obrigatório"),
    currentTreatment: z.string().min(2, "Descreva o tratamento em andamento"),
    notes: z.string().nullish().transform((val) => val || undefined),

    // Scheduling fields (optional)
    closerId: z.string().uuid("ID do closer deve ser um UUID válido").nullish().transform((val) => val || undefined),
    meetingDate: z.string().datetime().nullish().transform((val) => val || undefined),
    meetingTitle: z.string().nullish().transform((val) => val || undefined),
    meetingNotes: z.string().nullish().transform((val) => val || undefined),

    // Tracking/origin fields (optional)
    source: z.string().nullish().transform((val) => val || undefined),
    utmSource: z.string().nullish().transform((val) => val || undefined),
    utmMedium: z.string().nullish().transform((val) => val || undefined),
    utmCampaign: z.string().nullish().transform((val) => val || undefined),
    utmContent: z.string().nullish().transform((val) => val || undefined),
    utmTerm: z.string().nullish().transform((val) => val || undefined),
    landingUrl: z.string().nullish().transform((val) => val || undefined),
    referrer: z.string().nullish().transform((val) => val || undefined),
  })
  .refine(
    (data) => {
      if (data.closerId && (!data.meetingDate || !data.meetingTitle)) {
        return false;
      }
      return true;
    },
    {
      message: "Ao selecionar um closer, data e título da reunião são obrigatórios",
      path: ["meetingDate"],
    }
  );

export type PublicLeadFormRequest = z.infer<typeof PublicLeadFormRequestSchema>;

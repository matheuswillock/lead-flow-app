import { z } from "zod";
import { isValidCNPJ } from "@/lib/masks";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";

export const loginFormSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(6, "Senha inválida"),
});

export type loginFormData = z.infer<typeof loginFormSchema>;


const signUpCoreSchema = z.object({
  fullName: z
    .string()
    .min(2, "Informe seu nome completo"),
  email: z.string().email("Digite um email válido").min(1, "O email é obrigatório"),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido"),
  cpfCnpj: z
    .string()
    .min(11, "CPF/CNPJ inválido")
    .refine((val) => {
      const numbers = val.replace(/\D/g, '');
      return numbers.length === 11 || numbers.length === 14;
    }, "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos")
    .refine((val) => {
      const numbers = val.replace(/\D/g, '');
      if (numbers.length === 11) {
        // Validação CPF
        if (/^(\d)\1+$/.test(numbers)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(numbers.charAt(i)) * (10 - i);
        let digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(numbers.charAt(9))) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(numbers.charAt(i)) * (11 - i);
        digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        return digit === parseInt(numbers.charAt(10));
      } else if (numbers.length === 14) {
        // Validação CNPJ
        if (/^(\d)\1+$/.test(numbers)) return false;
        let sum = 0;
        let weight = 5;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(numbers.charAt(i)) * weight;
          weight = weight === 2 ? 9 : weight - 1;
        }
        let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (digit !== parseInt(numbers.charAt(12))) return false;
        sum = 0;
        weight = 6;
        for (let i = 0; i < 13; i++) {
          sum += parseInt(numbers.charAt(i)) * weight;
          weight = weight === 2 ? 9 : weight - 1;
        }
        digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return digit === parseInt(numbers.charAt(13));
      }
      return true;
    }, "CPF ou CNPJ inválido"),
  postalCode: z
    .string()
    .min(8, "CEP inválido")
    .max(9, "CEP inválido")
    .refine((val) => {
      const numbers = val.replace(/\D/g, '');
      return numbers.length === 8;
    }, "CEP deve ter 8 dígitos"),
  address: z
    .string()
    .min(3, "Endereço é obrigatório"),
  addressNumber: z
    .string()
    .min(1, "Número é obrigatório"),
  neighborhood: z
    .string()
    .min(2, "Bairro é obrigatório"),
  complement: z
    .string()
    .optional(),
  city: z
    .string()
    .min(2, "Cidade é obrigatória"),
  state: z
    .string()
    .length(2, "UF deve ter 2 letras"),
});

export const signupFormSchema = signUpCoreSchema.extend({
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número")
    .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caracter especial"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export const signupFormSchemaOAuth = signUpCoreSchema.extend({
  password: z.string().optional()
    .refine((val) => !val || val.length >= 8, "A senha deve ter no mínimo 8 caracteres")
    .refine((val) => !val || /[A-Z]/.test(val), "A senha deve conter pelo menos uma letra maiúscula")
    .refine((val) => !val || /[a-z]/.test(val), "A senha deve conter pelo menos uma letra minúscula")
    .refine((val) => !val || /[0-9]/.test(val), "A senha deve conter pelo menos um número")
    .refine((val) => !val || /[^A-Za-z0-9]/.test(val), "A senha deve conter pelo menos um caracter especial"),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (!data.password && !data.confirmPassword) {
    return true;
  }
  return data.password === data.confirmPassword;
}, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export type signUpFormData = z.infer<typeof signupFormSchema>;
export type signUpOAuthFormData = z.infer<typeof signupFormSchemaOAuth>;

export const updateAccountFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Informe seu nome completo"),
  email: z.string().email("Digite um email válido").min(1, "O email é obrigatório"),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido"),
  cpfCnpj: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const numbers = val.replace(/\D/g, '');
      return numbers.length === 11 || numbers.length === 14;
    }, "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos"),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  password: z.string().min(0).optional()
    .refine((val) => !val || val.length >= 6, "A senha deve ter no mínimo 6 caracteres")
    .refine((val) => !val || val.length <= 50, "A senha deve ter no máximo 50 caracteres")
    .refine((val) => !val || /[A-Z]/.test(val), "A senha deve conter pelo menos uma letra maiúscula")
    .refine((val) => !val || /[a-z]/.test(val), "A senha deve conter pelo menos uma letra minúscula")
    .refine((val) => !val || /[0-9]/.test(val), "A senha deve conter pelo menos um número")
    .refine((val) => !val || /[^A-Za-z0-9]/.test(val), "A senha deve conter pelo menos um caracter especial")
    .optional(),
});

export type updateAccountFormData = z.infer<typeof updateAccountFormSchema>;

export const leadFormSchema = z.object({
  name: z.string().min(2, "Nome inválido"),
  phone: z.string().min(8, "Telefone inválido").max(20, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cnpj: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || value.trim() === "") return true;
      return isValidCNPJ(value);
    }, "CNPJ inválido"),
  razaoSocial: z.string().optional().or(z.literal("")),
  closerId: z.string().min(0).optional(),
  age: z.string().optional().or(z.literal("")),
  currentHealthPlan: z.string().trim().optional().or(z.literal("")),
  currentValue: z.string().optional(),
  referenceHospital: z.string().optional().or(z.literal("")),
  ongoingTreatment: z.string().optional().or(z.literal("")),
  additionalNotes: z.string().min(0).optional(),
  meetingDate: z.string().min(0).optional(),
  meetingTitle: z.string().min(0).optional(),
  meetingNotes: z.string().min(0).optional(),
  // SPEC 13 (Agenda na Criação de Lead), A-E1d — usa a mesma validação de
  // lib/validations/meetingLink.ts (DA8: só https) em vez de z.string().url(),
  // que aceitava http:. Achado da revisão (R13d-1): este campo só existe no
  // form para EXIBIR o link já gravado (LeadDialog carrega
  // `currentLead.meetingLink` em `defaultValues`; `transformToCreateRequest`/
  // `transformToUpdateRequest` sempre mandam `meetingLink: undefined` — o
  // valor nunca volta ao backend por aqui). Sem `allowLegacyHttp`, um lead
  // com reunião já gravada com link `http:` (carry-over legado da A-E1c)
  // ficava com o formulário inteiro inválido — bloqueando edição de
  // QUALQUER outro campo (nome, telefone, notas), mesmo sem tocar no link.
  // `allowLegacyHttp: true` aqui é seguro porque este campo nunca é
  // reenviado como escrita: continua recusando esquemas perigosos
  // (`javascript:`, etc.) via `new URL(...).protocol`, só deixa de exigir
  // `https:` para o valor que já veio persistido.
  meetingLink: z
    .string()
    .refine(
      (val) => validateMeetingLinkValue(val, { required: false, allowLegacyHttp: true }).isValid,
      "Link da reuniao invalido (use https)"
    )
    .optional()
    .or(z.literal("")),
  // Allow null so UI can explicitly clear the "reuniao realizada" flag.
  meetingHeald: z.enum(["yes", "no"]).nullable().optional(),
  isTransfer: z.boolean().optional(),
  extraGuests: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || value.trim() === "") return true;
      const emails = value
        .split(/[,;\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      return emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    }, "Informe apenas emails válidos"),
  responsible: z.string().min(2, "O responsável é obrigatório"),

  // Novos campos para leads finalizados (opcionais, apenas em edição)
  ticket: z.string().min(0).optional(),
  contractDueDate: z.string().min(0).optional(),
  soldPlan: z.string().trim().min(1, "Selecione o plano vendido").optional(),

  // Indicação / Referral
  isReferral: z.boolean().optional(),
  referrerLeadId: z.string().uuid().optional().or(z.literal("")),
  referrerName: z.string().optional().or(z.literal("")),
  referrerPhone: z.string().optional().or(z.literal("")),
});

export type leadFormData = z.infer<typeof leadFormSchema>;

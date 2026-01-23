import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(6, "Senha inválida"),
});

export type loginFormData = z.infer<typeof loginFormSchema>;


export const signupFormSchema = z.object({
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

export type signUpFormData = z.infer<typeof signupFormSchema>;

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
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  cnpj: z.string().min(0).optional(),
  age: z.string()
    .min(1, "Informe as idades")
    .regex(/^[0-9,\s]+$/, "Use apenas números, vírgulas e espaços")
    .refine((val) => {
      // Extrai todos os números da string
      const ages = val.split(',').map(age => parseInt(age.trim())).filter(age => !isNaN(age));
      // Verifica se todas as idades são <= 120
      return ages.every(age => age <= 120);
    }, "Todas as idades devem ser no máximo 120 anos"),
  currentHealthPlan: z.enum([
    "NOVA_ADESAO",
    "AMIL",
    "BRADESCO",
    "HAPVIDA",
    "MEDSENIOR",
    "GNDI",
    "OMINT",
    "PLENA",
    "PORTO_SEGURO",
    "PREVENT_SENIOR",
    "SULAMERICA",
    "UNIMED",
    "OUTROS"
  ], { message: "Selecione um plano de saúde" }),
  currentValue: z.string().min(1, "O valor atual é obrigatório"),
  referenceHospital: z.string().min(2, "O hospital de referência é obrigatório"),
  ongoingTreatment: z.string().min(2, "Descreva o tratamento em andamento"),
  additionalNotes: z.string().min(0).optional(),
  meetingDate: z.string().min(0).optional(),
  meetingNotes: z.string().min(0).optional(),
  meetingLink: z.string().url("Link da reuniao invalido").optional().or(z.literal("")),
  responsible: z.string().min(2, "O responsável é obrigatório"),
  
  // Novos campos para leads finalizados (opcionais, apenas em edição)
  ticket: z.string().min(0).optional(), // Valor vendido
  contractDueDate: z.string().min(0).optional(), // Data de vigência
  soldPlan: z.enum([
    "NOVA_ADESAO",
    "AMIL",
    "BRADESCO",
    "HAPVIDA",
    "MEDSENIOR",
    "GNDI",
    "OMINT",
    "PLENA",
    "PORTO_SEGURO",
    "PREVENT_SENIOR",
    "SULAMERICA",
    "UNIMED",
    "OUTROS"
  ]).optional(), // Plano vendido
});

export type leadFormData = z.infer<typeof leadFormSchema>;

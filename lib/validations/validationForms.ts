import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(6, "Senha inválida"),
});

export const signupFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Informe seu nome completo"),
  email: z.string().email("Digite um email válido").min(1, "O email é obrigatório"),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido"),
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

export const updateAccountFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Informe seu nome completo"),
  email: z.string().email("Digite um email válido").min(1, "O email é obrigatório"),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido"),
  password: z.string().min(0).optional()
    .refine((val) => !val || val.length >= 6, "A senha deve ter no mínimo 6 caracteres")
    .refine((val) => !val || val.length <= 50, "A senha deve ter no máximo 50 caracteres")
    .refine((val) => !val || /[A-Z]/.test(val), "A senha deve conter pelo menos uma letra maiúscula")
    .refine((val) => !val || /[a-z]/.test(val), "A senha deve conter pelo menos uma letra minúscula")
    .refine((val) => !val || /[0-9]/.test(val), "A senha deve conter pelo menos um número")
    .refine((val) => !val || /[^A-Za-z0-9]/.test(val), "A senha deve conter pelo menos um caracter especial")
    .optional(),
});
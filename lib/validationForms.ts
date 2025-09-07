import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(6, "Senha inválida"),
});
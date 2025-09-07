import z from "zod";
import { loginFormSchema } from "@/lib/validationForms";

export type loginFormData = z.infer<typeof loginFormSchema>;
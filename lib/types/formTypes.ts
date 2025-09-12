import z from "zod";
import { loginFormSchema } from "@/lib/validations/validationForms";
import { signupFormSchema } from "@/lib/validations/validationForms";

export type loginFormData = z.infer<typeof loginFormSchema>;
export type signUpFormData = z.infer<typeof signupFormSchema>;
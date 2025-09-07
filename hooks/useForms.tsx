import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema } from "@/lib/validationForms";
import { loginFormData } from "@/lib/types/formTypes";

export function useLoginForm() {
  return useForm<loginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
}
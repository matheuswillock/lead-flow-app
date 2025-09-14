"use client";

import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema, signupFormSchema } from "@/lib/validations/validationForms";
import { loginFormData, signUpFormData } from "@/lib/types/formTypes";

export function useLoginForm(): UseFormReturn<loginFormData> {
  return useForm<loginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
}

export function useSignUpForm(): UseFormReturn<signUpFormData> {
  return useForm<signUpFormData>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });
}
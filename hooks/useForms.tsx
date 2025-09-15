"use client";

import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema, signupFormSchema, updateAccountFormSchema } from "@/lib/validations/validationForms";
import { loginFormData, signUpFormData, updateAccountFormData } from "@/lib/types/formTypes";

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

export function useUpdateAccountForm(): UseFormReturn<updateAccountFormData> {
  return useForm<updateAccountFormData>({
    resolver: zodResolver(updateAccountFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });
}

      
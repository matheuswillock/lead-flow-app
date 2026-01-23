"use client";

import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leadFormData, leadFormSchema, loginFormData, loginFormSchema, signUpFormData, signupFormSchema, updateAccountFormData, updateAccountFormSchema } from "@/lib/validations/validationForms";

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
    mode: "onChange", // Valida em tempo real para habilitar botão
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      cpfCnpj: "", // Campo obrigatório no schema
      postalCode: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      complement: "",
      city: "",
      state: "",
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
      cpfCnpj: "",
      postalCode: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      complement: "",
      city: "",
      state: "",
      password: "",
    },
  });
}

export function useLeadForm() {
  return useForm<leadFormData>({
    resolver: zodResolver(leadFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      cnpj: "",
      age: "",
      currentValue: "",
      referenceHospital: "",
      ongoingTreatment: "",
      meetingDate: "",
      additionalNotes: "",
      responsible: "",
    },
  });
}

      

"use client";

import { useMemo } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leadFormData, leadFormSchema, loginFormData, loginFormSchema, signUpFormData, signUpOAuthFormData, signupFormSchema, signupFormSchemaOAuth, updateAccountFormData, updateAccountFormSchema } from "@/lib/validations/validationForms";
import { buildLeadCustomFieldsSchema } from "@/lib/leadCustomFields/schema";
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types";

export type LeadFormWithCustomFields = leadFormData & {
  customFields?: Record<string, unknown>;
};

export function useLoginForm(): UseFormReturn<loginFormData> {
  return useForm<loginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
}

export function useSignUpForm(mode: "default" | "oauth" = "default"): UseFormReturn<signUpFormData | signUpOAuthFormData> {
  return useForm<signUpFormData | signUpOAuthFormData>({
    resolver: zodResolver(mode === "oauth" ? signupFormSchemaOAuth : signupFormSchema),
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

export function useLeadForm(customFieldDefinitions: LeadCustomFieldDefinitionDTO[] = []) {
  const schema = useMemo(() => {
    if (customFieldDefinitions.length === 0) {
      return leadFormSchema;
    }
    return leadFormSchema.merge(buildLeadCustomFieldsSchema(customFieldDefinitions));
  }, [customFieldDefinitions]);

  return useForm<LeadFormWithCustomFields>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      cnpj: "",
      razaoSocial: "",
      closerId: "",
      age: "",
      currentValue: "",
      referenceHospital: "",
      ongoingTreatment: "",
      meetingDate: "",
      meetingHeald: undefined,
      additionalNotes: "",
      responsible: "",
      isReferral: false,
      referrerLeadId: "",
      referrerName: "",
      referrerPhone: "",
      customFields: {},
    },
  });
}

      

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";

// Schema de validação Zod conforme documentação Asaas
const creditCardSchema = z.object({
  // Dados do Cartão
  holderName: z.string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-Z\s]+$/, "Nome deve conter apenas letras"),
  
  number: z.string()
    .min(13, "Número do cartão inválido")
    .max(19, "Número do cartão inválido")
    .regex(/^\d+$/, "Apenas números"),
  
  expiryMonth: z.string()
    .length(2, "Mês inválido")
    .regex(/^(0[1-9]|1[0-2])$/, "Mês deve ser entre 01 e 12"),
  
  expiryYear: z.string()
    .length(4, "Ano inválido")
    .regex(/^\d{4}$/, "Ano deve ter 4 dígitos")
    .refine((year) => parseInt(year) >= new Date().getFullYear(), "Ano deve ser atual ou futuro"),
  
  ccv: z.string()
    .min(3, "CVV deve ter 3 ou 4 dígitos")
    .max(4, "CVV deve ter 3 ou 4 dígitos")
    .regex(/^\d+$/, "Apenas números"),
  
  // Dados do Titular (creditCardHolderInfo)
  name: z.string()
    .min(3, "Nome completo obrigatório")
    .max(100, "Nome muito longo"),
  
  cpfCnpj: z.string()
    .min(11, "CPF/CNPJ inválido")
    .max(14, "CPF/CNPJ inválido")
    .regex(/^\d+$/, "Apenas números"),
  
  postalCode: z.string()
    .length(8, "CEP deve ter 8 dígitos")
    .regex(/^\d+$/, "Apenas números"),
  
  addressNumber: z.string()
    .min(1, "Número do endereço obrigatório")
    .max(10, "Número muito longo"),
  
  mobilePhone: z.string()
    .min(10, "Celular inválido")
    .max(11, "Celular inválido")
    .regex(/^\d+$/, "Apenas números"),
  
  phone: z.string()
    .min(10, "Telefone inválido")
    .max(11, "Telefone inválido")
    .regex(/^\d+$/, "Apenas números")
    .optional()
    .or(z.literal("")),
});

export type CreditCardFormData = z.infer<typeof creditCardSchema>;

interface CreditCardFormProps {
  initialData?: Partial<CreditCardFormData>;
  onFormChange: (data: CreditCardFormData, isValid: boolean) => void;
}

export function CreditCardForm({ initialData, onFormChange }: CreditCardFormProps) {
  
  // Inicializar form com Zod resolver
  const form = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    mode: "onChange", // Valida enquanto digita
    defaultValues: {
      holderName: initialData?.holderName || "",
      number: initialData?.number || "",
      expiryMonth: initialData?.expiryMonth || "",
      expiryYear: initialData?.expiryYear || "",
      ccv: initialData?.ccv || "",
      name: initialData?.name || "",
      cpfCnpj: initialData?.cpfCnpj || "",
      postalCode: initialData?.postalCode || "",
      addressNumber: initialData?.addressNumber || "",
      mobilePhone: initialData?.mobilePhone || "",
      phone: initialData?.phone || "",
    },
  });

  // Observar mudanças no formulário e notificar parent
  useEffect(() => {
    const subscription = form.watch((data) => {
      const isValid = form.formState.isValid;
      onFormChange(data as CreditCardFormData, isValid);
    });
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);

  // Máscaras de formatação
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    return parts.length ? parts.join(' ') : value;
  };

  const formatCPF = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCEP = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 10) {
      return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* Card: Dados do Cartão */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold mb-3">Dados do Cartão</h3>
            
            {/* Nome no Cartão */}
            <FormField
              control={form.control}
              name="holderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome no Cartão *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome como está no cartão"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      maxLength={50}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Número do Cartão */}
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Cartão *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={formatCardNumber(field.value)}
                      onChange={(e) => {
                        const formatted = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                        field.onChange(formatted);
                      }}
                      maxLength={19}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validade e CVV */}
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="expiryMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MM"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                          field.onChange(value);
                        }}
                        maxLength={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="expiryYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AAAA"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                          field.onChange(value);
                        }}
                        maxLength={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="ccv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVV *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="123"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                          field.onChange(value);
                        }}
                        maxLength={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card: Dados do Titular */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold mb-3">Dados do Titular</h3>
            
            {/* Nome Completo */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome completo do titular"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CPF/CNPJ e CEP */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cpfCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        value={formatCPF(field.value)}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                        maxLength={18}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        value={formatCEP(field.value)}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                        maxLength={9}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Celular e Número */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="mobilePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          value={formatPhone(field.value)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }}
                          maxLength={15}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="addressNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Telefone Fixo (Opcional) */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone Fixo (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(00) 0000-0000"
                      value={field.value ? formatPhone(field.value) : ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                      maxLength={14}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          * Campos obrigatórios. Os dados devem ser exatamente como cadastrados no banco emissor do cartão.
        </p>
      </form>
    </Form>
  );
}

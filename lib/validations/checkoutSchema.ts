import { z } from "zod";

const creditCardSchema = z.object({
  holderName: z.string().min(3, "Nome do titular deve ter no minimo 3 caracteres"),
  number: z.string().regex(/^\d{13,19}$/, "Numero do cartao invalido"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Mes invalido (01-12)"),
  expiryYear: z.string().regex(/^\d{4}$/, "Ano invalido (YYYY)"),
  ccv: z.string().regex(/^\d{3,4}$/, "CVV invalido (3-4 digitos)"),
});

export const signUpCheckoutSchema = z.object({
  billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD"], {
    message: "Forma de pagamento invalida",
  }),
  cardPaymentType: z.enum(["CREDIT", "DEBIT"]),
  creditCard: creditCardSchema.optional(),
}).refine(
  (data) => {
    if (data.billingType === "CREDIT_CARD") {
      return !!data.creditCard;
    }
    return true;
  },
  {
    message: "Dados do cartao sao obrigatorios",
    path: ["creditCard"],
  }
);

export type SignUpCheckoutFormData = z.infer<typeof signUpCheckoutSchema>;

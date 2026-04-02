import { z } from "zod";
import { leadFormSchema } from "./validationForms";

export const publicLeadFormSchema = leadFormSchema
  .pick({
    name: true,
    phone: true,
    email: true,
    cnpj: true,
    age: true,
    currentHealthPlan: true,
    currentValue: true,
    referenceHospital: true,
    ongoingTreatment: true,
    additionalNotes: true,
    extraGuests: true,
    responsible: true,
  })
  .extend({
    closerId: z.string().uuid().optional().or(z.literal("")),
    meetingDate: z.string().min(0).optional(),
    meetingTitle: z.string().min(0).optional(),
    meetingNotes: z.string().min(0).optional(),
  });

export type PublicLeadFormData = z.infer<typeof publicLeadFormSchema>;

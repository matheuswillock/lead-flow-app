import type { Metadata } from "next";
import { createPublicPageMetadata } from "@/lib/metadata/policies";
import { AdquirirCreditosProvider } from "./features/context/AdquirirCreditosContext";
import { AdquirirCreditosContainer } from "./features/container/AdquirirCreditosContainer";

export const metadata: Metadata = createPublicPageMetadata({
  title: "Créditos de E-mail — Corretor Studio",
  description:
    "Ative seu volume mensal de disparo de e-mail. 25 mil por R$375/mês ou 50 mil por R$650/mês. Editor de template, segmentação e métricas inclusos.",
  canonicalPath: "/adquirir/creditos",
  keywords: ["créditos e-mail corretor studio", "disparo e-mail", "e-mail marketing corretor"],
});

export default function AdquirirCreditosRoute() {
  return (
    <AdquirirCreditosProvider>
      <AdquirirCreditosContainer />
    </AdquirirCreditosProvider>
  );
}
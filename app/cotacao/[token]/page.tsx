import type { Metadata } from "next";
import { clientQuoteService } from "./features/services/ClientQuoteService";
import { ClientQuoteProvider } from "./features/context/ClientQuoteContext";
import { ClientQuoteContainer } from "./features/container/ClientQuoteContainer";

export const metadata: Metadata = {
  title: "Cotação de planos de saúde · Corretor Studio",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/** Visão do cliente: leitura pública pelo token, sem login e sem edição. */
export default async function ClientQuotePage({ params }: Props) {
  const { token } = await params;
  const result = await clientQuoteService.getByToken(token);

  return (
    <ClientQuoteProvider result={result}>
      <ClientQuoteContainer />
    </ClientQuoteProvider>
  );
}

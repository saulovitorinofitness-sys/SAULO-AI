import type { Metadata } from "next";

import { ProfessionalServiceReceiptViewer } from "@/components/financial/professional-service-receipt-viewer";

export const metadata: Metadata = {
  title: "Recibo de Serviço | Centro de Gestão SV",
};

export default async function ProfessionalServiceReceiptPage({ params, searchParams }: {
  readonly params: Promise<{ receiptId: string }>;
  readonly searchParams: Promise<{ print?: string | string[] }>;
}) {
  const [{ receiptId }, query] = await Promise.all([params, searchParams]);
  return <ProfessionalServiceReceiptViewer autoPrint={query.print === "1"} receiptId={receiptId} />;
}

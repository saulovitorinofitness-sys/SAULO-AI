import type { Metadata } from "next";

import { ProfessionalServiceReceiptPreview } from "@/components/financial/professional-service-receipt-preview";

export const metadata: Metadata = { title: "Prévia não emitida | Recibos de Serviços" };

export default async function ProfessionalReceiptPreviewPage({ params }: { params: Promise<{ chargeId: string }> }) {
  const { chargeId } = await params;
  return <ProfessionalServiceReceiptPreview chargeId={chargeId} />;
}

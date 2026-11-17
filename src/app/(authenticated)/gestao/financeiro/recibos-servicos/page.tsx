import type { Metadata } from "next";

import { ProfessionalServiceReceiptsWorkspace } from "@/components/financial/professional-service-receipts-workspace";

export const metadata: Metadata = {
  title: "Recibos de Serviços | Centro de Gestão SV",
};

export default async function ProfessionalServiceReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ financialSettlementId?: string }>;
}) {
  const query = await searchParams;
  const financialSettlementId = /^[0-9a-f-]{36}$/iu.test(query.financialSettlementId ?? "")
    ? query.financialSettlementId
    : undefined;

  return <ProfessionalServiceReceiptsWorkspace financialSettlementId={financialSettlementId} />;
}

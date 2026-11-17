import type { Metadata } from "next";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ProfessionalReceiptRegularization } from "@/components/financial/professional-receipt-regularization";
import { PageHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Detalhes do recebimento | Recibos de Serviços" };

export default async function ProfessionalReceiptRegularizationPage({ params }: { params: Promise<{ chargeId: string }> }) {
  const { chargeId } = await params;
  return <div className="space-y-5 pt-3 sm:pt-4">
    <PatientBreadcrumb items={[
      { label: "Gestão", href: "/gestao" },
      { label: "Financeiro", href: "/gestao/financeiro" },
      { label: "Recibos de Serviços", href: "/gestao/financeiro/recibos-servicos" },
      { label: "Detalhes do recebimento" },
    ]} />
    <PageHeading backHref="/gestao/financeiro/recibos-servicos" description="Consulte o recebimento existente, suas pendências ou o histórico preservado de cancelamento." eyebrow="Gestão · Financeiro · Recibos de Serviços" title="Detalhes do recebimento" />
    <ProfessionalReceiptRegularization chargeId={chargeId} />
  </div>;
}

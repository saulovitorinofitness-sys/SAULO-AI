import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayrollReceiptDocument } from "@/components/financial/payroll-receipt-document";
import { managementDocumentsRepository } from "@/features/financial/management-documents/repository";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Demonstrativo de pagamento | Documentos da Gestão" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PayrollDemonstrativePage({ params, searchParams }: {
  readonly params: Promise<{ statementId: string }>;
  readonly searchParams: Promise<{ print?: string | string[] }>;
}) {
  const session = await mvpService.getSession();
  if (session.user?.id !== BUILT_IN_IDS.users.sauloXavierVitorino) notFound();
  const [{ statementId }, query] = await Promise.all([params, searchParams]);
  if (!uuid.test(statementId)) notFound();
  const document = await managementDocumentsRepository.findDemonstrative(statementId);
  if (!document) notFound();
  return <PayrollReceiptDocument autoPrint={query.print === "1"} receipt={document} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayrollReceiptDocument } from "@/components/financial/payroll-receipt-document";
import { managementDocumentsRepository } from "@/features/financial/management-documents/repository";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Documento salarial | Documentos da Gestão" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Query = { businessUnitId?: string | string[]; payrollStatementId?: string | string[]; employmentId?: string | string[]; employeeId?: string | string[]; print?: string | string[] };

export default async function PaymentReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ receiptId: string }>;
  searchParams: Promise<Query>;
}) {
  const session = await mvpService.getSession();
  if (session.user?.id !== BUILT_IN_IDS.users.sauloXavierVitorino) notFound();

  const [{ receiptId }, query] = await Promise.all([params, searchParams]);
  const { businessUnitId, payrollStatementId, employmentId, employeeId } = query;
  if (!uuid.test(receiptId)) notFound();
  const identityValues = [businessUnitId, payrollStatementId, employmentId, employeeId];
  const hasIdentity = identityValues.every((value) => typeof value === "string" && uuid.test(value));
  if (identityValues.some(Boolean) && !hasIdentity) notFound();

  const receipt = hasIdentity
    ? await managementDocumentsRepository.findExact({
      receiptId,
      businessUnitId: businessUnitId as string,
      payrollStatementId: payrollStatementId as string,
      employmentId: employmentId as string,
      employeeId: employeeId as string,
    })
    : await managementDocumentsRepository.findByReceiptId(receiptId);
  if (!receipt) notFound();
  return <PayrollReceiptDocument autoPrint={query.print === "1"} receipt={receipt} />;
}

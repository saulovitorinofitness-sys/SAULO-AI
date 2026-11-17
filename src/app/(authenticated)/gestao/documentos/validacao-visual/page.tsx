import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PayrollReceiptDocument } from "@/components/financial/payroll-receipt-document";
import { mvpService } from "@/features/mvp";
import { salaryDocumentPreviewFixture, type SalaryDocumentPreviewState } from "@/features/financial/payroll/salary-document-preview-fixtures";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Validação visual salarial | Documentos da Gestão" };

const states: readonly { value: SalaryDocumentPreviewState; label: string }[] = [
  { value: "demonstrativo", label: "Demonstrativo" },
  { value: "legado", label: "Demonstrativo legado" },
  { value: "recibo-confirmado", label: "Recibo confirmado" },
];

export default async function SalaryDocumentVisualValidationPage({ searchParams }: {
  readonly searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const session = await mvpService.getSession();
  if (session.user?.id !== BUILT_IN_IDS.users.sauloXavierVitorino) notFound();

  const query = await searchParams;
  const requested = typeof query.estado === "string" ? query.estado : "demonstrativo";
  const state = states.some((item) => item.value === requested) ? requested as SalaryDocumentPreviewState : "demonstrativo";
  const document = salaryDocumentPreviewFixture(state);

  return <div className="space-y-4">
    <section className="receipt-controls mx-auto max-w-5xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="status">
      <p className="font-black">Prévia isolada para validação visual</p>
      <p className="mt-1 text-sm">Todos os dados desta página são fictícios. Esta rota não consulta nem grava recibos e não permite emissão.</p>
      <nav aria-label="Estados do documento salarial" className="mt-3 flex flex-wrap gap-2">
        {states.map((item) => <Link aria-current={state === item.value ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold ${state === item.value ? "border-emerald-800 bg-emerald-800 text-white" : "border-amber-400 bg-white text-amber-950"}`} href={`/gestao/documentos/validacao-visual?estado=${item.value}`} key={item.value}>{item.label}</Link>)}
      </nav>
    </section>
    <PayrollReceiptDocument receipt={document} />
  </div>;
}

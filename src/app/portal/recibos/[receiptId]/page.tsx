import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  StudentPortalAccessError,
  studentPortalService,
} from "@/features/student-portal/service";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function StudentReceiptPage({
  params,
}: {
  readonly params: Promise<{ receiptId: string }>;
}) {
  let receipt: Awaited<ReturnType<typeof studentPortalService.getReceipt>>;
  try {
    receipt = await studentPortalService.getReceipt((await params).receiptId);
  } catch (error) {
    if (error instanceof StudentPortalAccessError) {
      if (error.reason === "UNAUTHENTICATED") redirect("/?returnTo=%2Fportal");
      notFound();
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-[#edf4f0] px-4 py-6 text-[#183029]">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <nav className="flex flex-wrap gap-2 print:hidden">
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black" href="/portal">Voltar ao Portal</Link>
          <a
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-black text-white"
            download
            href={`/api/student-portal/receipts/${encodeURIComponent(receipt.id)}/pdf`}
          >
            Baixar recibo em PDF
          </a>
        </nav>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <header className="border-b border-slate-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Clínica SV · Recibo</p>
            <h1 className="mt-2 text-2xl font-black">{receipt.provider}</h1>
            <p className="mt-1 text-sm text-slate-600">Recibo {receipt.number ? `nº ${receipt.number}` : receipt.id}</p>
          </header>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Aluno</dt><dd className="mt-1 font-black">{receipt.studentName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Cadastro</dt><dd className="mt-1 font-black">{receipt.studentCode}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Valor recebido</dt><dd className="mt-1 font-black">{money.format(Number(receipt.receivedAmount))}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Data do pagamento</dt><dd className="mt-1 font-black">{date.format(new Date(receipt.paidAt))}</dd></div>
          </dl>
          <section className="mt-6">
            <h2 className="font-black">Serviços</h2>
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
              {receipt.services.map((service) => <li className="flex justify-between gap-4 p-3 text-sm" key={`${service.description}-${service.serviceDate}`}><span>{service.description}<small className="mt-1 block text-slate-500">{date.format(new Date(service.serviceDate))}</small></span><strong>{money.format(Number(service.grossAmount))}</strong></li>)}
            </ul>
          </section>
          <p className="mt-6 text-xs text-slate-500">Documento disponível exclusivamente no Portal do Aluno autenticado.</p>
        </article>
      </div>
    </main>
  );
}

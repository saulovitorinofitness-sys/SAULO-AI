"use client";

import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, PageState } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type { ProfessionalReceiptPreview } from "@/features/financial/service-receipts";
import { loadProfessionalReceiptPreview, printProfessionalReceiptPreview } from "@/features/financial/service-receipts/preview-client";
import { brlAmountInWords, presentationTitleCase, professionalRegistrationLabel } from "@/features/financial/service-receipts/preview-presentation";

function currency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function date(value: string | null, long = false) {
  if (!value) return "Dado ausente";
  return new Intl.DateTimeFormat("pt-BR", long
    ? { dateStyle: "long", timeStyle: "short" }
    : { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

function Missing({ children }: { children: string }) {
  return <span className="font-bold text-rose-700">{children}</span>;
}

export function ProfessionalServiceReceiptPreview({ chargeId }: { chargeId: string }) {
  const [preview, setPreview] = useState<ProfessionalReceiptPreview>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void loadProfessionalReceiptPreview(chargeId, fetch, developmentUserRequestHeaders(), controller.signal).then(setPreview).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a prévia.");
    });
    return () => controller.abort();
  }, [chargeId]);

  const returnHref = `/gestao/financeiro/recibos-servicos/pendencias/${encodeURIComponent(chargeId)}`;
  if (error) return <div className="pt-4"><PageState action={<Link className="font-black text-emerald-700 hover:underline" href={returnHref}>Voltar ao recebimento</Link>} description={error} title="Prévia indisponível" tone="danger" /></div>;
  if (!preview) return <div aria-busy="true" className="grid min-h-64 place-items-center text-sm font-bold text-slate-500">Carregando prévia…</div>;

  return <div className="space-y-4 pt-3 print:space-y-0 print:pt-0" data-receipt-preview>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <Link className="inline-flex min-h-11 items-center gap-2 font-black text-emerald-700 hover:underline" href={returnHref}><ArrowLeft aria-hidden="true" className="size-4" />Voltar ao recebimento</Link>
      <Button onClick={() => printProfessionalReceiptPreview(() => window.print())}><Printer aria-hidden="true" className="size-4" />Imprimir ou salvar como PDF</Button>
    </div>
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-950 print:hidden"><AlertTriangle aria-hidden="true" className="mr-2 inline size-4" />Esta visualização não emite recibo, não reserva número e não altera o recebimento.</p>

    <article className="receipt-preview-paper relative mx-auto min-h-[273mm] w-full max-w-[210mm] overflow-hidden border border-slate-300 bg-white px-6 py-7 text-slate-900 shadow-xl sm:px-10 sm:py-9 print:min-h-[273mm] print:max-w-none print:break-inside-avoid print:border-0 print:px-0 print:py-0 print:shadow-none" id="professional-service-receipt-preview">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 grid place-items-center overflow-hidden">
        <span className="-rotate-[31deg] whitespace-nowrap text-[clamp(1.75rem,5vw,3.5rem)] font-black tracking-[0.06em] text-rose-700/[0.07]">PRÉVIA — NÃO EMITIDO</span>
      </div>
      <div className="relative z-10 flex min-h-[245mm] flex-col print:min-h-[249mm]">
        <header className="flex flex-col gap-5 border-b-2 border-emerald-900 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-800">Recibo de prestação de serviços</p><h1 className="mt-2 text-3xl font-black text-slate-950">Prévia do recibo</h1><p className="mt-2 inline-flex rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-rose-800">Prévia — não emitido</p></div>
          <dl className="min-w-44 text-left sm:text-right"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Numeração</dt><dd className="mt-1 text-lg font-black text-slate-950">{preview.documentNumber}</dd></dl>
        </header>

        {preview.missingData.length ? <section className="mt-5 border border-amber-400 bg-amber-50 p-3" aria-labelledby="missing-preview-data"><h2 className="text-xs font-black uppercase tracking-wide text-amber-950" id="missing-preview-data">Dados obrigatórios ausentes no cadastro</h2><p className="mt-1 text-sm font-semibold text-amber-900">{preview.missingData.join(" · ")}. A ausência foi mantida nesta prévia e nenhum dado foi inventado.</p></section> : null}

        <section className="mt-7 grid gap-5 sm:grid-cols-2">
          <div><h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Emissora</h2><p className="mt-2 text-lg font-black">{preview.issuer.name ? presentationTitleCase(preview.issuer.name) : <Missing>Dado ausente</Missing>}</p><p className="mt-1 text-sm">{preview.issuer.documentLabel}: {preview.issuer.document ?? <Missing>Dado ausente</Missing>}</p><p className="mt-1 text-sm leading-6">{preview.issuer.address ? presentationTitleCase(preview.issuer.address) : <Missing>Endereço ausente ou incompleto</Missing>}</p>{preview.issuer.registrations.map((registration) => <p className="mt-1 text-sm font-semibold" key={registration.council}>{professionalRegistrationLabel(registration)}</p>)}</div>
          <div><h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Cliente</h2><p className="mt-2 text-lg font-black">{presentationTitleCase(preview.customer.fullName)}</p><p className="mt-1 text-sm">Cadastro: {preview.customer.clinicalCode}</p><p className="mt-1 text-sm">CPF: {preview.customer.cpf ?? <Missing>Dado ausente</Missing>}</p></div>
        </section>

        <section className="mt-8 border-y border-slate-300 py-6">
          <p className="text-base leading-8">Recebi de <strong>{presentationTitleCase(preview.customer.fullName)}</strong> a importância de <strong>{preview.amount ? currency(preview.amount) : "valor ausente"}</strong>{preview.amount ? <> (<span className="font-semibold">{brlAmountInWords(preview.amount)}</span>)</> : null}, referente aos serviços discriminados abaixo.</p>
          <div className="mt-5 overflow-hidden border border-slate-300"><table className="w-full border-collapse text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 font-black">Serviço</th><th className="px-3 py-2 font-black">Data</th><th className="px-3 py-2 font-black">Profissional</th></tr></thead><tbody>{preview.services.length ? preview.services.map((service, index) => <tr className="border-t border-slate-200" key={`${service.description}-${index}`}><td className="px-3 py-3"><p className="font-bold">{service.description}</p>{service.performedActivity && service.performedActivity !== service.description ? <p className="mt-1 text-xs text-slate-600">{service.performedActivity}</p> : null}</td><td className="px-3 py-3">{date(service.serviceDate)}</td><td className="px-3 py-3">{service.executorName ? presentationTitleCase(service.executorName) : <Missing>Dado ausente</Missing>}</td></tr>) : <tr><td className="border-t border-slate-200 px-3 py-3" colSpan={3}><Missing>Serviço ausente</Missing></td></tr>}</tbody></table></div>
        </section>

        <section className="mt-6 grid gap-4 rounded-lg bg-slate-100 p-4 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-slate-500">Valor recebido</p><p className="mt-1 font-black">{preview.amount ? currency(preview.amount) : <Missing>Dado ausente</Missing>}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Forma de pagamento</p><p className="mt-1 font-black">{preview.payment.method ?? <Missing>Dado ausente</Missing>}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Data do pagamento</p><p className="mt-1 font-black">{preview.payment.recordedAt ? date(preview.payment.recordedAt, true) : <Missing>Dado ausente</Missing>}</p></div>{preview.payment.transactionReference ? <div className="sm:col-span-3"><p className="text-xs font-bold uppercase text-slate-500">Referência da transação</p><p className="mt-1 font-semibold">{preview.payment.transactionReference}</p></div> : null}</section>

        <section className="mt-auto pt-12 text-center"><div className="mx-auto max-w-sm border-t border-slate-800 pt-2"><p className="font-bold">{preview.issuer.name ? presentationTitleCase(preview.issuer.name) : "Emissora não identificada"}</p><p className="text-xs text-slate-500">Assinatura da emissora</p></div></section>
        <footer className="mt-8 whitespace-nowrap border-t border-slate-300 pt-3 text-center text-[9px] font-black uppercase tracking-[0.08em] text-rose-800">PRÉVIA — NÃO EMITIDO • SEM VALIDADE • NUMERAÇÃO NÃO CONSUMIDA</footer>
      </div>
    </article>
  </div>;
}

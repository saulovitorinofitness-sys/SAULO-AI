"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ManagementReceiptDocument, ManagementDocumentLineItem } from "@/features/financial/management-documents/repository";
import { employmentTypeLabel, salaryLineDescription } from "@/features/financial/payroll/salary-document-presentation";

const competenceDate = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const paymentDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const methodLabels = { CASH: "Dinheiro", PIX: "PIX", BANK_TRANSFER: "Transferência bancária", BANK_DEPOSIT: "Depósito bancário" } as const;
const stateLabels = {
  DEMONSTRATIVE_AVAILABLE: "Pagamento não confirmado",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  VOIDED: "CANCELADO · SEM VALIDADE",
  LEGACY_UNCONFIRMED: "Legado · pagamento não confirmado",
  CASH_AWAITING_SIGNATURE: "Aguardando assinatura manual",
  BANK_PROVEN: "Pagamento comprovado",
  SIGNED: "Assinatura registrada",
} as const;

function money(value: string) { return currency.format(Number(value)); }

const lowercaseWords = new Set(["da", "das", "de", "do", "dos", "e"]);
function presentationName(value: string): string {
  return value.toLocaleLowerCase("pt-BR").split(/(\s+|[·,/\-])/u).map((part, index) => {
    if (!part.trim() || /^[·,/\-]$/u.test(part)) return part;
    const upper = part.toLocaleUpperCase("pt-BR");
    if (["CPF", "CNPJ", "CEP", "UF", "PIX", "RG", "PIS", "NIS"].includes(upper) || (/^[A-Z]{2}$/u.test(part) && part === upper)) return upper;
    if (index > 0 && lowercaseWords.has(part)) return part;
    return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1);
  }).join("");
}

function comparableName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase()
    .replace(/\b(ltda|limitada|me|eireli|sa)\b/gu, "").replace(/[^a-z0-9]/gu, "");
}

function repeatedName(left: string | null, right: string): boolean {
  return Boolean(left && comparableName(left) === comparableName(right));
}

function FinancialRows({ items }: { readonly items: readonly ManagementDocumentLineItem[] }) {
  return <>{items.map((item, index) => {
    const deduction = item.type === "DEDUCTION" || item.type === "ADJUSTMENT_DEBIT";
    return <tr className="border-b border-slate-200 last:border-b-0" key={`${item.code}-${index}`}>
      <td className="px-2.5 py-1.5 font-medium text-slate-800">{salaryLineDescription(item)}</td>
      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{deduction ? "—" : money(item.amount)}</td>
      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{deduction ? money(item.amount) : "—"}</td>
    </tr>;
  })}</>;
}

function FinancialGroup({ label, items, showLabel = true }: {
  readonly label: string;
  readonly items: readonly ManagementDocumentLineItem[];
  readonly showLabel?: boolean;
}) {
  if (!items.length) return null;
  return <tbody>
    {showLabel ? <tr><th className="border-y border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-500" colSpan={3} scope="rowgroup">{label}</th></tr> : null}
    <FinancialRows items={items} />
  </tbody>;
}

export function PayrollReceiptDocument({
  autoPrint = false,
  receipt,
}: {
  readonly autoPrint?: boolean;
  readonly receipt: ManagementReceiptDocument;
}) {
  const [reversalOpen, setReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalState, setReversalState] = useState<"idle" | "submitting" | "error">("idle");
  const [reversalMessage, setReversalMessage] = useState("");
  const [reversalKey] = useState(() => crypto.randomUUID());
  const confirmed = receipt.documentKind === "SALARY_RECEIPT";
  const voided = receipt.documentState === "VOIDED";
  const legacy = receipt.documentKind === "LEGACY_DEMONSTRATIVE";
  const title = confirmed ? "Recibo de pagamento salarial" : legacy ? "Demonstrativo salarial legado" : "Demonstrativo salarial";
  const earnings = receipt.lineItems.filter((item) => item.type === "EARNING");
  const benefits = receipt.lineItems.filter((item) => item.type === "BENEFIT");
  const deductions = receipt.lineItems.filter((item) => item.type === "DEDUCTION");
  const adjustments = receipt.lineItems.filter((item) => item.type === "ADJUSTMENT_CREDIT" || item.type === "ADJUSTMENT_DEBIT");
  const hasBenefits = benefits.length > 0 || Number(receipt.totals.benefits) !== 0;
  const employeeName = presentationName(confirmed ? receipt.employee.fullName : receipt.employeeName);
  const payerName = presentationName(confirmed ? (receipt.employer.tradeName || receipt.employer.legalName) : receipt.businessUnitName);
  const showTradeName = confirmed && receipt.employer.tradeName && !repeatedName(receipt.employer.tradeName, receipt.employer.legalName);
  const showUnit = confirmed && !repeatedName(receipt.employer.unitName, payerName);
  const signatureState = receipt.documentState === "SIGNED"
    ? "Assinatura registrada"
    : receipt.documentState === "CASH_AWAITING_SIGNATURE"
      ? "Aguardando assinatura manual"
      : "Assinatura não registrada";

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  async function reversePayment() {
    if (!confirmed || voided || reversalReason.trim().length < 10 || reversalState === "submitting") return;
    setReversalState("submitting");
    setReversalMessage("");
    const response = await fetch(`/api/gestao/folha-pagamento/recibos-salariais/${encodeURIComponent(receipt.id)}`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessUnitId: receipt.businessUnitId, idempotencyKey: reversalKey, reason: reversalReason.trim() }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setReversalState("error");
      setReversalMessage(payload?.message ?? "Não foi possível concluir o estorno.");
      return;
    }
    window.location.reload();
  }

  return <div className="mx-auto max-w-5xl space-y-4" id="management-payroll-receipt">
    <style>{`@media print {
      body:has(#management-payroll-receipt) header,
      body:has(#management-payroll-receipt) aside,
      body:has(#management-payroll-receipt) nav,
      body:has(#management-payroll-receipt) button,
      body:has(#management-payroll-receipt) .receipt-controls { display: none !important; }
      body:has(#management-payroll-receipt),
      body:has(#management-payroll-receipt) div:has(> aside) { display: block !important; min-height: 0 !important; background: white !important; }
      body:has(#management-payroll-receipt) main { display: block !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      #management-payroll-receipt { display: block !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
      #management-payroll-receipt .receipt-paper { width: 100% !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; font-size: 9.5pt !important; line-height: 1.25 !important; color: #0f172a !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      #management-payroll-receipt .document-heading { padding-bottom: 2.5mm !important; gap: 4mm !important; }
      #management-payroll-receipt .document-identification { padding: 2.5mm 0 !important; gap: 3mm !important; }
      #management-payroll-receipt .doc-section { margin-top: 3mm !important; }
      #management-payroll-receipt .doc-section-title { padding-bottom: 1mm !important; }
      #management-payroll-receipt .compact-grid { margin-top: 2mm !important; column-gap: 5mm !important; row-gap: 1mm !important; }
      #management-payroll-receipt .demonstrative-notice { margin-top: 2.5mm !important; padding: 2mm 3mm !important; }
      #management-payroll-receipt .financial-table { margin-top: 1.5mm !important; }
      #management-payroll-receipt .financial-table th,
      #management-payroll-receipt .financial-table td { padding-top: 1.25mm !important; padding-bottom: 1.25mm !important; }
      #management-payroll-receipt .totals-strip { margin-top: 0 !important; padding: 2mm 3mm !important; gap: 3mm !important; }
      #management-payroll-receipt .payment-line { margin-top: 2.5mm !important; padding: 2mm 0 !important; gap: 2mm 5mm !important; }
      #management-payroll-receipt .receipt-closing { margin-top: 2.5mm !important; }
      #management-payroll-receipt .receipt-declaration { padding-top: 2mm !important; }
      #management-payroll-receipt .signature-space { height: 13mm !important; margin-top: 2mm !important; }
      #management-payroll-receipt .signature-details { margin-top: 1.5mm !important; gap: 1mm 5mm !important; }
      #management-payroll-receipt .document-footer { margin-top: 2mm !important; padding-top: 1.5mm !important; }
      #management-payroll-receipt .financial-block,
      #management-payroll-receipt .receipt-closing,
      #management-payroll-receipt .signature-block { break-inside: avoid !important; page-break-inside: avoid !important; }
      @page { size: A4 portrait; margin: 9mm; }
    }`}</style>

    <div className="receipt-controls flex flex-wrap items-center justify-between gap-3">
      <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700" href="/gestao/documentos">Voltar a Documentos da Gestão</Link>
      <div className="flex flex-wrap gap-2">
        {confirmed && !voided ? <button className="min-h-11 rounded-lg border border-rose-700 px-4 text-sm font-bold text-rose-800" onClick={() => setReversalOpen(true)} type="button">Estornar pagamento e cancelar recibo</button> : null}
        <button className="min-h-11 rounded-lg bg-emerald-800 px-5 text-sm font-bold text-white" onClick={() => window.print()} type="button">Imprimir</button>
        <button className="min-h-11 rounded-lg border border-emerald-800 bg-white px-5 text-sm font-bold text-emerald-900" onClick={() => window.print()} type="button">Salvar em PDF</button>
      </div>
    </div>

    {reversalOpen && confirmed && !voided ? <section className="receipt-controls rounded-xl border border-rose-200 bg-rose-50 p-4"><h2 className="font-black text-rose-950">Estornar pagamento e cancelar recibo</h2><p className="mt-1 text-sm text-rose-900">O histórico será preservado, o efeito de {money(receipt.payment.amount)} será retirado do saldo e a folha continuará fechada.</p><label className="mt-3 grid gap-1 text-sm font-bold text-rose-950">Motivo obrigatório<textarea className="min-h-24 rounded-lg border border-rose-300 bg-white p-3" maxLength={500} minLength={10} onChange={(event) => setReversalReason(event.target.value)} placeholder="Descreva por que este pagamento deve ser estornado" value={reversalReason} /></label>{reversalReason.trim().length < 10 ? <p className="mt-1 text-xs font-semibold text-rose-800">Informe pelo menos 10 caracteres.</p> : null}{reversalMessage ? <p className="mt-2 text-sm font-bold text-rose-800" role="alert">{reversalMessage}</p> : null}<div className="mt-3 flex justify-end gap-2"><button className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold" disabled={reversalState === "submitting"} onClick={() => setReversalOpen(false)} type="button">Voltar sem estornar</button><button className="min-h-10 rounded-lg bg-rose-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={reversalReason.trim().length < 10 || reversalState === "submitting"} onClick={() => void reversePayment()} type="button">Confirmar estorno auditável</button></div></section> : null}

    <article aria-label={`${title} ${receipt.documentNumber}, versão ${receipt.version}`} className="receipt-paper relative overflow-hidden bg-white px-5 py-6 text-[0.8rem] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 sm:px-8">
      {voided ? <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center"><span className="-rotate-12 border-4 border-rose-700 px-8 py-3 text-3xl font-black tracking-widest text-rose-700/35">CANCELADO</span></div> : null}
      <div className="document-heading flex items-start justify-between gap-5 border-b-2 border-emerald-800 pb-3">
        <div><p className="text-lg font-black tracking-tight text-slate-950">{payerName}</p><h1 className="mt-0.5 text-base font-black text-emerald-900">{title}</h1></div>
        <span className="rounded-full border border-slate-400 px-2.5 py-1 text-right text-[0.66rem] font-bold uppercase tracking-wide text-slate-700">{stateLabels[receipt.documentState]}</span>
      </div>

      <dl className="document-identification grid grid-cols-2 gap-x-4 gap-y-1 border-b border-slate-200 py-3 text-xs sm:grid-cols-4">
        <div><dt className="text-slate-500">Número</dt><dd className="font-bold">{receipt.documentNumber}</dd></div>
        <div><dt className="text-slate-500">Versão</dt><dd className="font-bold">{receipt.version}</dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-500">Competência</dt><dd className="font-bold">{presentationName(competenceDate.format(receipt.competence))}</dd></div>
      </dl>

      {!confirmed ? <p className="demonstrative-notice mt-3 border-l-4 border-amber-500 px-3 py-2 font-semibold text-slate-800">Este documento é apenas um demonstrativo salarial e não comprova o recebimento ou a quitação do pagamento.</p> : null}

      <section className="doc-section mt-4 grid break-inside-avoid gap-5 sm:grid-cols-2">
        <div>
          <h2 className="doc-section-title border-b border-slate-300 pb-1 text-[0.7rem] font-black uppercase tracking-wider text-emerald-900">Empregador / pagador</h2>
          {confirmed ? <dl className="compact-grid mt-2 grid gap-1.5">
            <div><dt className="text-[0.7rem] text-slate-500">Razão social</dt><dd className="font-bold">{presentationName(receipt.employer.legalName)}</dd></div>
            {showTradeName ? <div><dt className="text-[0.7rem] text-slate-500">Nome fantasia</dt><dd className="font-bold">{presentationName(receipt.employer.tradeName!)}</dd></div> : null}
            <div><dt className="text-[0.7rem] text-slate-500">{receipt.employer.legalTaxIdType}</dt><dd className="font-bold">{receipt.employer.maskedLegalTaxId}</dd></div>
            <div><dt className="text-[0.7rem] text-slate-500">Endereço</dt><dd className="font-semibold">{presentationName(receipt.employer.address)}</dd></div>
            {showUnit ? <div><dt className="text-[0.7rem] text-slate-500">Unidade responsável</dt><dd className="font-semibold">{presentationName(receipt.employer.unitName)}</dd></div> : null}
          </dl> : <div className="compact-grid mt-2"><p className="font-bold">{receipt.businessUnitName}</p><p className="mt-1 text-[0.7rem] font-semibold text-amber-800">Identificação legal incompleta no cadastro da unidade.</p></div>}
        </div>
        <div>
          <h2 className="doc-section-title border-b border-slate-300 pb-1 text-[0.7rem] font-black uppercase tracking-wider text-emerald-900">Funcionário</h2>
          <dl className="compact-grid mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="col-span-2"><dt className="text-[0.7rem] text-slate-500">Nome</dt><dd className="font-bold">{employeeName}</dd></div>
            {confirmed ? <><div><dt className="text-[0.7rem] text-slate-500">CPF</dt><dd className="font-bold">{receipt.employee.maskedCpf ?? "Não informado"}</dd></div><div><dt className="text-[0.7rem] text-slate-500">RG</dt><dd className="font-bold">{receipt.employee.maskedIdentityDocument ?? "Não informado"}</dd></div><div><dt className="text-[0.7rem] text-slate-500">PIS/NIS</dt><dd className="font-bold">{receipt.employee.maskedSocialSecurityNumber ?? "Não informado"}</dd></div></> : null}
            <div><dt className="text-[0.7rem] text-slate-500">Matrícula</dt><dd className="font-bold">{receipt.employmentCode}</dd></div>
            <div><dt className="text-[0.7rem] text-slate-500">Cargo</dt><dd className="font-bold">{receipt.jobRole}</dd></div>
            <div><dt className="text-[0.7rem] text-slate-500">Vínculo</dt><dd className="font-bold">{employmentTypeLabel(receipt.employmentType)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="financial-block doc-section mt-4">
        <h2 className="doc-section-title border-b border-slate-300 pb-1 text-[0.7rem] font-black uppercase tracking-wider text-emerald-900">Discriminação financeira</h2>
        <table className="financial-table mt-2 w-full border-collapse text-left" aria-label="Discriminação de proventos e descontos">
          <thead><tr className="border-y border-slate-300 text-[0.66rem] uppercase tracking-wide text-slate-600"><th className="px-2.5 py-1.5">Descrição</th><th className="w-32 px-2.5 py-1.5 text-right">Proventos</th><th className="w-32 px-2.5 py-1.5 text-right">Descontos</th></tr></thead>
          <FinancialGroup items={earnings} label="Proventos" showLabel={earnings.length > 1} />
          <FinancialGroup items={benefits} label="Benefícios" showLabel={false} />
          <FinancialGroup items={deductions} label="Descontos" showLabel={deductions.length > 1} />
          <FinancialGroup items={adjustments} label="Ajustes" />
          {!receipt.lineItems.length ? <tbody><tr><td className="px-2.5 py-2 text-center text-slate-500" colSpan={3}>Não há verbas discriminadas neste documento.</td></tr></tbody> : null}
        </table>
        <div className={`totals-strip grid gap-3 border-y border-slate-300 bg-slate-50 px-3 py-2 ${hasBenefits ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          <div><p className="text-[0.68rem] text-slate-500">Total de proventos</p><p className="font-black tabular-nums">{money(receipt.totals.gross)}</p></div>
          {hasBenefits ? <div><p className="text-[0.68rem] text-slate-500">Total de benefícios</p><p className="font-black tabular-nums">{money(receipt.totals.benefits)}</p></div> : null}
          <div><p className="text-[0.68rem] text-slate-500">Total de descontos</p><p className="font-black tabular-nums">{money(receipt.totals.deductions)}</p></div>
          <div className="text-right"><p className="text-[0.68rem] font-semibold text-emerald-900">{confirmed ? "Líquido" : "Líquido demonstrado"}</p><p className="text-base font-black tabular-nums text-emerald-900">{money(receipt.totals.net)}</p></div>
        </div>
      </section>

      {confirmed ? <div className="payment-line grid grid-cols-3 gap-4 border-b border-slate-300 py-3 text-xs">
        <p><span className="block text-slate-500">Forma de pagamento</span><strong className="mt-0.5 block">{methodLabels[receipt.payment.method]}</strong></p>
        <p><span className="block text-slate-500">Data</span><strong className="mt-0.5 block">{paymentDate.format(new Date(`${receipt.payment.paidAt}T00:00:00.000Z`))}</strong></p>
        <p><span className="block text-slate-500">Valor</span><strong className="mt-0.5 block">{money(receipt.payment.amount)}</strong></p>
        {receipt.payment.bankReference ? <p><span className="text-slate-500">Referência:</span> <strong>{receipt.payment.bankReference}</strong></p> : null}
        {receipt.payment.proofUrl ? <p><strong>Comprovante bancário disponível</strong></p> : null}
      </div> : <div className="payment-line border-b border-slate-300 py-2 text-xs font-semibold text-slate-700">{legacy ? "Demonstrativo legado · pagamento não confirmado" : "Pagamento não confirmado"}</div>}

      {voided && confirmed && receipt.voiding ? <section className="relative z-30 mt-3 border-2 border-rose-700 bg-white p-3 text-rose-950"><h2 className="font-black">RECIBO CANCELADO — SEM VALIDADE</h2><p className="mt-1"><strong>Motivo:</strong> {receipt.voiding.reason}</p><p><strong>Cancelado em:</strong> {receipt.voiding.at.toLocaleString("pt-BR")} · <strong>Responsável:</strong> {receipt.voiding.by}</p></section> : null}

      {confirmed ? <section className="receipt-closing break-inside-avoid">
        <div className="receipt-declaration pt-3">
          <h2 className="text-[0.7rem] font-black uppercase tracking-wider text-emerald-900">Declaração de recebimento</h2>
          <p className="mt-1.5 text-justify">Declaro ter recebido de <strong>{receipt.employer.legalName}</strong>, inscrita no {receipt.employer.legalTaxIdType} nº <strong>{receipt.employer.maskedLegalTaxId}</strong>, o valor líquido de <strong>{money(receipt.totals.net)}</strong>, referente à competência indicada neste recibo.</p>
        </div>
        <div className="signature-block break-inside-avoid">
          <div className="signature-space mt-3 h-12 border-b border-slate-700" />
          <p className="mt-1 text-center font-bold">Assinatura do funcionário</p>
          <div className="signature-details mt-2 grid gap-x-5 gap-y-1 text-[0.7rem] sm:grid-cols-2"><p><span className="text-slate-500">Nome:</span> <strong>{receipt.employee.fullName}</strong></p><p><span className="text-slate-500">CPF:</span> <strong>{receipt.employee.maskedCpf ?? "Não informado"}</strong></p><p><span className="text-slate-500">Local e data:</span> ______________________________</p><p><span className="text-slate-500">Situação:</span> <strong>{signatureState}</strong></p></div>
          {receipt.payment.method === "CASH" ? <p className="mt-1.5 text-[0.7rem] font-semibold">Pagamento em dinheiro: assinatura manual obrigatória.</p> : null}
        </div>
        <footer className="document-footer mt-3 border-t border-slate-300 pt-2 text-[0.66rem] text-slate-500">Autenticidade: confira o documento nº {receipt.documentNumber}, versão {receipt.version}, no sistema. Este módulo não substitui obrigações trabalhistas ou contábeis.</footer>
      </section> : <footer className="document-footer mt-3 break-inside-avoid border-t border-slate-300 pt-2 text-[0.66rem] text-slate-500">Documento nº {receipt.documentNumber} · versão {receipt.version} · demonstrativo sem valor de quitação. Este módulo não substitui obrigações trabalhistas ou contábeis.</footer>}
    </article>
  </div>;
}

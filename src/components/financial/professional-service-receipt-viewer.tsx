"use client";

import { ArrowLeft, Download, Printer, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge, Button, Card, PageState } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import { ProfessionalReceiptManagementAction } from "./professional-receipt-management-action";

interface ReceiptDetails {
  readonly id: string;
  readonly paymentId: string;
  readonly legalProviderKey: "ACADEMIA_SAULO_FITNESS" | "SAULO_XAVIER_VITORINO" | "MARIA_DE_LOURDES_GOMES";
  readonly status: "ISSUED" | "CANCELLED" | "REFUNDED";
  readonly series: string;
  readonly sequence: number;
  readonly receivedAmount: string;
  readonly remainingBalance: string;
  readonly partialPayment: boolean;
  readonly snapshot: { readonly schemaVersion: number; readonly payloadSha256: string; readonly createdAt: string };
  readonly events: readonly { readonly type: string; readonly reason: string | null; readonly occurredAt: string }[];
  readonly managementAction: "CANCEL_RECEIPT" | null;
}

const providerNames = {
  ACADEMIA_SAULO_FITNESS: "Academia Saulo Fitness",
  SAULO_XAVIER_VITORINO: "Saulo Xavier Vitorino",
  MARIA_DE_LOURDES_GOMES: "Maria de Lourdes Gomes",
} as const;

const eventNames: Record<string, string> = {
  DRAFT_CREATED: "Rascunho criado",
  ISSUED: "Recibo emitido",
  CORRECTION_ISSUED: "Correção emitida",
  CANCELLED: "Recibo cancelado",
  REFUNDED: "Pagamento estornado",
};

function currency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function ProfessionalServiceReceiptViewer({
  autoPrint = false,
  receiptId,
}: {
  readonly autoPrint?: boolean;
  readonly receiptId: string;
}) {
  const [receipt, setReceipt] = useState<ReceiptDetails>();
  const [error, setError] = useState<string>();
  const autoPrintRequested = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/financial/professional-service-receipts/receipts/${encodeURIComponent(receiptId)}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: developmentUserRequestHeaders(),
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as { receipt?: ReceiptDetails; message?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.message ?? "Recibo não encontrado.");
      setReceipt(payload.receipt);
    }).catch((requestError: unknown) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o recibo.");
    });
    return () => controller.abort();
  }, [receiptId]);

  useEffect(() => {
    if (!autoPrint || !receipt || autoPrintRequested.current) return;
    autoPrintRequested.current = true;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, receipt]);

  if (error) return <div className="pt-4"><PageState action={<Link className="font-black text-emerald-700 hover:underline" href="/gestao/financeiro/recibos-servicos">Voltar aos recibos</Link>} description={error} title="Recibo indisponível" tone="danger" /></div>;
  if (!receipt) return <div aria-busy="true" className="grid min-h-64 place-items-center text-sm font-bold text-slate-500">Carregando recibo…</div>;

  const statusTone = receipt.status === "ISSUED" ? "success" : receipt.status === "CANCELLED" ? "danger" : "neutral";
  return <div className="space-y-5 pt-4 print:pt-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <Link className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:underline" href="/gestao/financeiro/recibos-servicos"><ArrowLeft aria-hidden="true" className="size-4" />Voltar aos recibos</Link>
      <div className="flex flex-wrap gap-2">{receipt.managementAction ? <ProfessionalReceiptManagementAction action={receipt.managementAction} amount={currency(receipt.receivedAmount)} chargeId={receipt.id} onComplete={() => window.location.reload()} receiptId={receipt.id} /> : null}<Button onClick={() => window.print()} variant="outline"><Printer aria-hidden="true" className="size-4" />Imprimir</Button><Button onClick={() => window.print()}><Download aria-hidden="true" className="size-4" />Salvar em PDF</Button></div>
    </div>
    <Card className="mx-auto max-w-4xl overflow-hidden bg-white print:border-0 print:shadow-none" id="professional-service-receipt-preview">
      <header className="flex flex-col gap-4 border-b border-emerald-800 bg-[#173f35] px-6 py-6 text-white sm:flex-row sm:items-start sm:justify-between print:bg-white print:text-slate-950">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white/10"><ReceiptText aria-hidden="true" className="size-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100 print:text-slate-500">Recibo profissional</p><h1 className="mt-1 text-2xl font-black">{receipt.series}-{String(receipt.sequence).padStart(6, "0")}</h1></div></div>
        <Badge tone={statusTone}>{receipt.status === "ISSUED" ? "Emitido" : receipt.status === "CANCELLED" ? "Cancelado" : "Estornado"}</Badge>
      </header>
      <div className="grid gap-6 p-6 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Prestador legal</p><p className="mt-1 text-base font-black text-slate-950">{providerNames[receipt.legalProviderKey]}</p></div><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Emissão</p><p className="mt-1 font-bold text-slate-800">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(receipt.snapshot.createdAt))}</p></div></section>
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3"><div><p className="text-xs font-bold text-slate-500">Valor recebido</p><p className="mt-1 text-xl font-black text-slate-950">{currency(receipt.receivedAmount)}</p></div><div><p className="text-xs font-bold text-slate-500">Saldo restante</p><p className="mt-1 text-xl font-black text-slate-950">{currency(receipt.remainingBalance)}</p></div><div><p className="text-xs font-bold text-slate-500">Pagamento</p><p className="mt-1 font-black text-slate-950">{receipt.partialPayment ? "Parcial" : "Total"}</p></div></section>
        <section><h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Histórico do documento</h2><ol className="mt-3 grid gap-3">{receipt.events.map((event, index) => <li className="flex gap-3" key={`${event.type}-${event.occurredAt}`}><span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">{index + 1}</span><div><p className="font-black text-slate-900">{eventNames[event.type] ?? event.type}</p><p className="text-xs text-slate-500">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.occurredAt))}</p>{event.reason ? <p className="mt-1 text-sm text-slate-600">{event.reason}</p> : null}</div></li>)}</ol></section>
        <footer className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500"><p>Documento protegido por snapshot imutável · versão {receipt.snapshot.schemaVersion}</p><p className="mt-1 break-all">Integridade: {receipt.snapshot.payloadSha256}</p></footer>
      </div>
    </Card>
  </div>;
}

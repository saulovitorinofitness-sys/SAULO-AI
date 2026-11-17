"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button, Card, FormField, Input, PageState } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type { RegularizationOverview } from "@/features/financial/service-receipts";
import { presentationTitleCase } from "@/features/financial/service-receipts/preview-presentation";
import { ProfessionalReceiptManagementAction } from "./professional-receipt-management-action";

const API_ROOT = "/api/financial/professional-service-receipts";

function currency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function maskCpf(value: string) {
  const digits = value.replace(/\D/gu, "").slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/u, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/u, "$1.$2.$3").replace(/(\d{3})(\d{1,2})$/u, "$1-$2");
}

const paymentMethodNames: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BANK_TRANSFER: "Transferência bancária",
  BANK_DEPOSIT: "Depósito bancário",
  BOLETO: "Boleto",
  OTHER: "Outro",
};

function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value))
    : null;
}

function ReadOnlyValue({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-900">{children}</dd></div>;
}

function Identifier({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all font-mono text-xs font-bold text-slate-800">{value ?? "Não persistido"}</dd></div>;
}

function CancelledReceiptDetails({ overview }: { overview: RegularizationOverview }) {
  const cancellation = overview.cancellation;
  const missingAudit = [
    !cancellation?.reason ? "motivo" : null,
    !cancellation?.occurredAt ? "data e horário" : null,
    !cancellation?.actor ? "usuário responsável" : null,
  ].filter((value): value is string => Boolean(value));

  return <div className="grid gap-5" data-cancelled-receipt-details>
    <Card className="border-red-200 bg-red-50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-red-700">Detalhe somente leitura</p><h2 className="mt-1 text-2xl font-black text-slate-950">Recebimento cancelado</h2><p className="mt-2 text-sm leading-6 text-slate-700">Consulte abaixo os dados financeiros preservados e a auditoria do cancelamento.</p></div><span className="w-fit rounded-full bg-red-700 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Cancelado</span></div></Card>

    {missingAudit.length ? <Card className="border-amber-300 bg-amber-50 p-4"><p className="font-black text-amber-950">Auditoria incompleta no registro existente</p><p className="mt-1 text-sm text-amber-900">Não foi persistido: {missingAudit.join(", ")}. Nenhum dado foi inferido ou inventado.</p></Card> : null}

    <Card className="p-5"><h2 className="text-lg font-black text-slate-950">Dados do recebimento</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><ReadOnlyValue label="Cliente">{presentationTitleCase(overview.customer.fullName)} <span className="block text-xs font-semibold text-slate-500">{overview.customer.clinicalCode}</span></ReadOnlyValue><ReadOnlyValue label="Prestador / emissor">{presentationTitleCase(overview.provider.name)}</ReadOnlyValue><ReadOnlyValue label="Situação"><span className="text-red-700">Cancelado</span></ReadOnlyValue><ReadOnlyValue label="Valor original">{currency(overview.charge.amountDue)}</ReadOnlyValue><ReadOnlyValue label="Valor anteriormente recebido">{currency(overview.payment?.receivedAmount ?? overview.charge.receivedAmount)}</ReadOnlyValue><ReadOnlyValue label="Forma e data do pagamento">{overview.payment ? <>{paymentMethodNames[overview.payment.method] ?? overview.payment.method}<span className="block text-xs font-semibold text-slate-500">{dateTime(overview.payment.recordedAt)}</span></> : <span className="text-amber-800">Pagamento não persistido</span>}</ReadOnlyValue></dl></Card>

    <Card className="p-5"><h2 className="text-lg font-black text-slate-950">Serviço preservado</h2>{overview.services.length ? <ul className="mt-3 grid gap-3">{overview.services.map((service) => <li className="rounded-xl border border-slate-200 p-4" key={service.id}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black text-slate-900">{service.description}</p><p className="mt-1 text-xs font-semibold text-slate-500">Data do serviço: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(service.serviceDate))}</p></div><p className="font-black text-slate-900">{currency(service.grossAmount)}</p></div></li>)}</ul> : <p className="mt-3 text-sm font-bold text-amber-800">Serviço não persistido.</p>}</Card>

    <Card className="border-slate-300 p-5"><h2 className="text-lg font-black text-slate-950">Auditoria do cancelamento</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><ReadOnlyValue label="Motivo">{cancellation?.reason || <span className="text-amber-800">Não persistido</span>}</ReadOnlyValue><ReadOnlyValue label="Data e horário">{dateTime(cancellation?.occurredAt ?? null) ?? <span className="text-amber-800">Não persistido</span>}</ReadOnlyValue><ReadOnlyValue label="Usuário responsável">{cancellation?.actor ? <>{presentationTitleCase(cancellation.actor.fullName)}<span className="block break-all font-mono text-xs font-semibold text-slate-500">{cancellation.actor.id}</span></> : <span className="text-amber-800">Não persistido</span>}</ReadOnlyValue><ReadOnlyValue label="Evento de auditoria">{cancellation?.auditEventId ? <span className="break-all font-mono text-xs">{cancellation.auditEventId}</span> : <span className="text-amber-800">Não persistido</span>}</ReadOnlyValue></dl></Card>

    <Card className="p-5"><h2 className="text-lg font-black text-slate-950">Registros relacionados</h2><dl className="mt-4 grid gap-3 md:grid-cols-2"><Identifier label="Cobrança" value={overview.charge.id} /><Identifier label="Pagamento" value={overview.payment?.id ?? null} /><Identifier label="Lançamento financeiro" value={overview.charge.financialEntryId} /><Identifier label="Liquidação financeira" value={overview.payment?.financialSettlementId ?? null} /></dl></Card>

    <Card className="border-sky-200 bg-sky-50 p-5"><p className="font-black text-sky-950"><ShieldCheck aria-hidden="true" className="mr-2 inline size-5" />Histórico preservado</p><p className="mt-2 text-sm leading-6 text-sky-900">A cobrança, o pagamento, a liquidação, as alocações e o lançamento financeiro permanecem preservados para auditoria, mas não compõem mais os valores recebidos.</p></Card>

    <Link className="inline-flex min-h-11 w-fit items-center font-black text-emerald-700 hover:underline" href="/gestao/financeiro/recibos-servicos">Voltar à listagem de recibos</Link>
  </div>;
}

async function payload(response: Response) {
  const body = await response.json() as { regularization?: RegularizationOverview; receiptId?: string; message?: string };
  if (!response.ok) throw new Error(body.message ?? "Não foi possível concluir a regularização.");
  return body;
}

export function ProfessionalReceiptRegularization({ chargeId }: { chargeId: string }) {
  const endpoint = `${API_ROOT}/charges/${encodeURIComponent(chargeId)}/regularization`;
  const [overview, setOverview] = useState<RegularizationOverview>();
  const [cpf, setCpf] = useState("");
  const [series, setSeries] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", headers: developmentUserRequestHeaders() });
      const body = await payload(response);
      if (body.regularization) setOverview(body.regularization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o recebimento.");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, {
      cache: "no-store",
      credentials: "same-origin",
      headers: developmentUserRequestHeaders(),
      signal: controller.signal,
    }).then(payload).then((body) => {
      if (body.regularization) setOverview(body.regularization);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o recebimento.");
    });
    return () => controller.abort();
  }, [endpoint]);

  async function correct(event: FormEvent, action: "UPDATE_CUSTOMER_CPF" | "CONFIGURE_SERIES") {
    event.preventDefault();
    setBusy(action); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify(action === "UPDATE_CUSTOMER_CPF" ? { action, cpf } : { action, series }),
      });
      const body = await payload(response);
      if (body.regularization) setOverview(body.regularization);
      if (action === "UPDATE_CUSTOMER_CPF") setCpf(""); else setSeries("");
      setMessage(action === "UPDATE_CUSTOMER_CPF" ? "CPF atualizado no cadastro canônico do cliente." : "Série configurada para a emissora.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a correção.");
    } finally { setBusy(undefined); }
  }

  async function retry() {
    setBusy("RETRY"); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: developmentUserRequestHeaders() });
      const body = await payload(response);
      if (!body.receiptId) throw new Error("O servidor não retornou o recibo emitido.");
      window.location.assign(`/gestao/financeiro/recibos-servicos/${encodeURIComponent(body.receiptId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível tentar a emissão novamente.");
      await load();
    } finally { setBusy(undefined); }
  }

  if (!overview && error) return <PageState action={<Button onClick={() => void load()} variant="outline">Tentar novamente</Button>} description={error} title="Recebimento indisponível" tone="danger" />;
  if (!overview) return <div aria-busy="true" className="grid min-h-64 place-items-center text-sm font-bold text-slate-500">Carregando recebimento…</div>;
  if (overview.receiptId) return <PageState action={<Link className="font-black text-emerald-700 hover:underline" href={`/gestao/financeiro/recibos-servicos/${overview.receiptId}`}>Abrir recibo</Link>} description="Esta cobrança já possui recibo. Nenhuma nova cobrança, pagamento ou emissão foi criada." title="Recebimento já regularizado" />;
  if (overview.charge.status === "CANCELLED") return <CancelledReceiptDetails overview={overview} />;

  return <div className="grid gap-5">
    <div aria-live="polite">{message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{message}</p> : null}{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900" role="alert">{error}</p> : null}</div>
    <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Cobrança existente</p><h2 className="mt-1 text-xl font-black text-slate-950">{overview.customer.fullName}</h2><p className="mt-1 text-sm text-slate-500">{overview.customer.clinicalCode} · {overview.provider.name}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{overview.charge.status === "PAID" ? "Paga" : overview.charge.status}</span></div><dl className="mt-5 grid gap-3 sm:grid-cols-3"><div><dt className="text-xs font-bold text-slate-500">Valor</dt><dd className="mt-1 font-black text-slate-950">{currency(overview.charge.amountDue)}</dd></div><div><dt className="text-xs font-bold text-slate-500">Recebido</dt><dd className="mt-1 font-black text-emerald-700">{currency(overview.charge.receivedAmount)}</dd></div><div><dt className="text-xs font-bold text-slate-500">Pagamento usado</dt><dd className="mt-1 font-black text-slate-950">{overview.payment ? currency(overview.payment.receivedAmount) : "Indisponível"}</dd></div></dl><p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900"><ShieldCheck aria-hidden="true" className="mr-2 inline size-4" />Esta tela reutiliza a mesma cobrança, o mesmo pagamento e o mesmo lançamento financeiro.</p></Card>
    {overview.payment ? <Card className="flex flex-col gap-4 border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-emerald-950">Prévia sem emissão</h2><p className="mt-1 text-sm text-emerald-900">Confira e imprima os dados existentes sem criar recibo nem consumir numeração.</p></div><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-black text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" href={`/gestao/financeiro/recibos-servicos/pendencias/${overview.charge.id}/previa`}><Eye aria-hidden="true" className="size-4" />Visualizar prévia do recibo</Link></Card> : null}
    <section aria-labelledby="pending-title"><div className="flex items-center gap-2"><AlertTriangle aria-hidden="true" className="size-5 text-amber-700" /><h2 className="text-lg font-black text-slate-950" id="pending-title">Pendências para emissão</h2></div>{overview.issues.length ? <ul className="mt-3 grid gap-3">{overview.issues.map((issue) => <li className="rounded-xl border border-amber-200 bg-amber-50 p-4" key={issue.code}><p className="font-black text-amber-950">{issue.message}</p><p className="mt-1 text-sm text-amber-900">{issue.correction}</p></li>)}</ul> : <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"><CheckCircle2 aria-hidden="true" className="mr-2 inline size-4" />Todas as pendências foram corrigidas. A emissão ainda não ocorreu.</p>}</section>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5"><h2 className="font-black text-slate-950">1. CPF do cliente</h2><p className="mt-1 text-sm text-slate-600">O valor será salvo no cadastro canônico ligado ao mesmo MasterRecord.</p>{overview.customer.cpfConfigured ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">CPF válido já cadastrado.</p> : <form className="mt-4 grid gap-3" onSubmit={(event) => void correct(event, "UPDATE_CUSTOMER_CPF")}><FormField help="O sistema valida, mas não sugere nem preenche o CPF." id="regularization-cpf" label="CPF"><Input autoComplete="off" id="regularization-cpf" inputMode="numeric" onChange={(event) => setCpf(maskCpf(event.target.value))} placeholder="000.000.000-00" required value={cpf} /></FormField><Button disabled={busy !== undefined} loading={busy === "UPDATE_CUSTOMER_CPF"} type="submit">Salvar no cadastro do cliente</Button></form>}</Card>
      <Card className="p-5"><h2 className="font-black text-slate-950">2. Série da emissora</h2><p className="mt-1 text-sm text-slate-600">A série pertence a {overview.provider.name} e não é preenchida automaticamente.</p>{overview.provider.series ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Série configurada: {overview.provider.series}</p> : <form className="mt-4 grid gap-3" onSubmit={(event) => void correct(event, "CONFIGURE_SERIES")}><FormField help="Use a identificação definida pela sua operação." id="regularization-series" label="Série"><Input autoComplete="off" id="regularization-series" maxLength={40} onChange={(event) => setSeries(event.target.value.toUpperCase())} required value={series} /></FormField><Button disabled={busy !== undefined} loading={busy === "CONFIGURE_SERIES"} type="submit">Salvar série da emissora</Button></form>}<Link className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-emerald-700 hover:underline" href="/gestao/financeiro/recibos-servicos/configuracao-emissores">Abrir configuração completa dos emissores<ExternalLink aria-hidden="true" className="size-4" /></Link></Card>
    </div>
    <Card className="flex flex-col gap-4 border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-emerald-950">3. Tentar emitir novamente</h2><p className="mt-1 text-sm text-emerald-900">Só fica disponível após todas as correções. Cliques repetidos retornam o mesmo recibo.</p></div><Button disabled={!overview.eligible || busy !== undefined} loading={busy === "RETRY"} onClick={() => void retry()}><RefreshCw aria-hidden="true" className="size-4" />Tentar emitir o mesmo recebimento</Button></Card>
    {overview.managementAction ? <Card className="flex flex-col gap-4 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-950">Corrigir este registro</h2><p className="mt-1 text-sm text-slate-600">A ação exige confirmação e não emitirá recibo.</p></div><ProfessionalReceiptManagementAction action={overview.managementAction} amount={currency(overview.managementAction === "DELETE_DRAFT" ? overview.charge.amountDue : overview.charge.receivedAmount)} chargeId={overview.charge.id} /></Card> : null}
  </div>;
}

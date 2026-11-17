"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FileUp, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { developmentUserRequestHeaders } from "@/features/development-session/request";
import { salaryLineDescription } from "@/features/financial/payroll/salary-document-presentation";

type PaymentMethod = "CASH" | "PIX" | "BANK_TRANSFER" | "BANK_DEPOSIT";
type Candidate = {
  employer: {
    unitName: string;
    legalName: string | null;
    tradeName: string | null;
    legalTaxIdType: "CPF" | "CNPJ" | null;
    maskedLegalTaxId: string | null;
    address: string | null;
  };
  employee: {
    fullName: string;
    maskedCpf: string | null;
    employmentCode: string;
    employmentType: string;
    jobRole: string;
  };
  statement: {
    id: string;
    competence: string;
    calculationVersion: number;
    status: string;
    lineItems: readonly {
      code: string;
      description: string;
      type: "EARNING" | "BENEFIT" | "DEDUCTION";
      origin: string;
      amount: string;
    }[];
    adjustments: readonly {
      id: string;
      description: string;
      type: "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT";
      amount: string;
    }[];
    totals: {
      gross: string;
      benefits: string;
      deductions: string;
      adjustments: string;
      net: string;
    };
  };
  settlement: {
    id: string;
    financialAccountId: string;
    paymentMethodId: string;
    paidAt: string;
    method: PaymentMethod;
    amount: string;
    accountName: string;
  } | null;
  accounts: readonly { id: string; name: string; type: "CASH" | "BANK" | "DIGITAL_WALLET" | "OTHER" }[];
  paymentMethods: readonly { id: string; name: string; type: PaymentMethod }[];
  existingReceipt: { id: string; number: string; version: number } | null;
  pendingRequirements: readonly string[];
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const competence = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

const methodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  BANK_TRANSFER: "Transferência bancária",
  BANK_DEPOSIT: "Depósito",
};

const pendingLabels: Record<string, string> = {
  ALREADY_CONFIRMED: "Este demonstrativo já possui recibo salarial confirmado.",
  EMPLOYER_LEGAL_IDENTITY_MISSING: "Complete a identificação legal e o endereço da unidade.",
  EMPLOYER_TAX_ID_INVALID: "O CPF ou CNPJ cadastrado para a unidade é inválido.",
  EMPLOYEE_IDENTIFICATION_MISSING: "Confira nome, matrícula, vínculo e cargo do funcionário.",
  EMPLOYEE_CPF_INVALID: "O CPF cadastrado para o funcionário é inválido; remova-o ou corrija-o.",
  RELATION_MISMATCH: "Os vínculos entre unidade, funcionário, folha e pagamento estão inconsistentes.",
  STATEMENT_NOT_CLOSED: "O demonstrativo e a competência precisam estar fechados.",
  PAYMENT_NOT_FULLY_SETTLED: "O lançamento financeiro precisa ter uma única liquidação integral.",
  PAYMENT_AMOUNT_MISMATCH: "O valor liquidado deve corresponder exatamente ao líquido congelado.",
  PAYMENT_METHOD_UNSUPPORTED: "A conta ou forma da liquidação não é compatível com o recibo salarial.",
};

function money(value: string) {
  return currency.format(Number(value));
}

function messageFromPayload(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

function ItemTable({ title, items }: {
  readonly title: string;
  readonly items: readonly { code: string; description: string; type: "EARNING" | "BENEFIT" | "DEDUCTION" | "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT"; amount: string }[];
}) {
  if (!items.length) return null;
  return <section>
    <h3 className="text-xs font-black uppercase tracking-[0.12em] text-emerald-900">{title}</h3>
    <div className="mt-2 rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Descrição</th><th className="w-32 px-4 py-2.5 text-right">Valor</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map((item, index) => <tr key={`${title}-${item.code}-${index}`}><td className="break-words px-4 py-3 font-semibold text-slate-800">{salaryLineDescription(item)}</td><td className="px-4 py-3 text-right font-black tabular-nums text-slate-950">{money(item.amount)}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function SalaryPaymentConfirmation({
  businessUnitId,
  payrollStatementId,
  onClose,
}: {
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ businessUnitId, payrollStatementId });
    void fetch(`/api/gestao/folha-pagamento/recibos-salariais?${query}`, {
      cache: "no-store",
      headers: developmentUserRequestHeaders(),
      signal: controller.signal,
    }).then(async (response) => {
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFromPayload(payload, "Não foi possível validar o demonstrativo."));
      if (!payload || typeof payload !== "object" || !("candidate" in payload)) {
        throw new Error("A validação não retornou os dados esperados.");
      }
      const next = payload.candidate as Candidate;
      setCandidate(next);
      if (next.settlement) {
        setMethod(next.settlement.method);
        setPaymentMethodId(next.settlement.paymentMethodId);
        setFinancialAccountId(next.settlement.financialAccountId);
        setPaidAt(next.settlement.paidAt);
      } else {
        const preferredMethod = next.paymentMethods.find((item) => item.type === "PIX") ?? next.paymentMethods[0];
        if (preferredMethod) {
          setMethod(preferredMethod.type);
          setPaymentMethodId(preferredMethod.id);
        }
      }
      setState("ready");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível validar o demonstrativo.");
    });
    return () => controller.abort();
  }, [businessUnitId, payrollStatementId]);

  const bankPayment = method !== "CASH";
  const pending = candidate?.pendingRequirements ?? [];
  const compatibleAccounts = candidate?.accounts.filter((account) => method === "CASH"
    ? account.type === "CASH"
    : method === "BANK_DEPOSIT" ? account.type === "BANK" : account.type === "BANK" || account.type === "DIGITAL_WALLET") ?? [];
  const selectedAccountCompatible = compatibleAccounts.some((account) => account.id === financialAccountId);
  const canSubmit = state === "ready" && candidate !== null && pending.length === 0
    && paymentMethodId !== "" && paidAt !== "" && selectedAccountCompatible && confirmed;
  const grouped = useMemo(() => {
    const lines = candidate?.statement.lineItems ?? [];
    const adjustments = candidate?.statement.adjustments.map((item) => ({
      code: item.id, description: item.description, type: item.type, amount: item.amount,
    })) ?? [];
    return {
      earnings: lines.filter((item) => item.type === "EARNING"),
      benefits: lines.filter((item) => item.type === "BENEFIT"),
      deductions: lines.filter((item) => item.type === "DEDUCTION"),
      adjustments,
    };
  }, [candidate]);

  function selectProof(file: File | null) {
    setMessage("");
    if (!file) { setProof(null); return; }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setProof(null);
      setMessage("Selecione um comprovante PDF, JPG ou PNG.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setProof(null);
      setMessage("O comprovante deve ter no máximo 10 MB.");
      return;
    }
    setProof(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate || !canSubmit) return;
    setState("submitting");
    setMessage("");
    const form = new FormData();
    form.set("payload", JSON.stringify({
      businessUnitId,
      payrollStatementId,
      financialAccountId,
      paymentMethodId,
      idempotencyKey,
      paidAt,
      method,
      paidAmount: candidate.statement.totals.net,
      bankReference: reference.trim() || null,
    }));
    if (proof) form.set("proof", proof);
    try {
      const response = await fetch("/api/gestao/folha-pagamento/recibos-salariais", {
        method: "POST",
        headers: developmentUserRequestHeaders(),
        body: form,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFromPayload(payload, "Não foi possível emitir o recibo."));
      if (!payload || typeof payload !== "object" || !("receiptId" in payload) || typeof payload.receiptId !== "string") {
        throw new Error("O servidor não retornou o identificador do recibo emitido.");
      }
      window.location.assign(`/gestao/documentos/recibos-pagamento/${encodeURIComponent(payload.receiptId)}`);
    } catch (error) {
      setState("ready");
      setMessage(error instanceof Error ? error.message : "Não foi possível emitir o recibo.");
    }
  }

  return <div aria-labelledby="salary-confirmation-title" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog">
    <div className="mx-auto max-w-5xl rounded-2xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white p-5">
        <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Confirmação integral</p><h2 className="mt-1 text-xl font-black text-slate-950" id="salary-confirmation-title">Confirmar pagamento e emitir recibo</h2><p className="mt-1 text-sm text-slate-600">Confira os dados congelados antes de confirmar. Esta ação não permite pagamento parcial.</p></div>
        <Button aria-label="Fechar confirmação" disabled={state === "submitting"} onClick={onClose} size="icon" type="button" variant="ghost"><X aria-hidden="true" className="size-5" /></Button>
      </header>

      {state === "loading" ? <p aria-live="polite" className="p-8 text-center font-bold text-slate-600">Validando requisitos no servidor...</p> : null}
      {state === "error" && !candidate ? <div className="p-6"><p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{message}</p></div> : null}
      {candidate ? <form className="space-y-7 p-5 sm:p-7" onSubmit={submit}>
        <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
          <div><h3 className="font-black text-slate-950">Pagador</h3><p className="mt-2 text-sm font-semibold">{candidate.employer.legalName ?? "Identificação legal não cadastrada"}</p><p className="text-sm text-slate-600">{candidate.employer.unitName}{candidate.employer.tradeName ? ` · ${candidate.employer.tradeName}` : ""}</p><p className="mt-1 text-sm text-slate-600">{candidate.employer.legalTaxIdType ?? "Documento"}: {candidate.employer.maskedLegalTaxId ?? "não cadastrado"}</p><p className="mt-1 text-sm text-slate-600">{candidate.employer.address ?? "Endereço legal não cadastrado"}</p></div>
          <div><h3 className="font-black text-slate-950">Funcionário</h3><p className="mt-2 text-sm font-semibold">{candidate.employee.fullName}</p><p className="text-sm text-slate-600">CPF {candidate.employee.maskedCpf ?? "Não informado"}</p><p className="text-sm text-slate-600">Matrícula {candidate.employee.employmentCode} · {candidate.employee.jobRole}</p><p className="text-sm text-slate-600">Vínculo: {candidate.employee.employmentType === "EMPLOYEE" ? "Empregado" : candidate.employee.employmentType}</p></div>
          <div><h3 className="font-black text-slate-950">Competência</h3><p className="mt-1 text-sm capitalize text-slate-700">{competence.format(new Date(`${candidate.statement.competence}T00:00:00.000Z`))}</p></div>
          <div><h3 className="font-black text-slate-950">Versão do cálculo</h3><p className="mt-1 text-sm text-slate-700">{candidate.statement.calculationVersion}</p></div>
        </section>

        {pending.length ? <section aria-live="polite" className="rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-center gap-2 font-black text-amber-950"><AlertTriangle aria-hidden="true" className="size-5" />Pendências que impedem a emissão</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{pending.map((code) => <li key={code}>{pendingLabels[code] ?? "Existe uma pendência que deve ser corrigida antes da emissão."}</li>)}</ul>{candidate.existingReceipt ? <a className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-amber-700 px-3 text-sm font-bold text-amber-900" href={`/gestao/documentos/recibos-pagamento/${candidate.existingReceipt.id}`}>Abrir recibo {candidate.existingReceipt.number} · versão {candidate.existingReceipt.version}</a> : null}</section> : null}

        <div className="grid gap-6 lg:grid-cols-2"><ItemTable items={grouped.earnings} title="Proventos" /><ItemTable items={grouped.benefits} title="Benefícios" /><ItemTable items={grouped.deductions} title="Descontos" /><ItemTable items={grouped.adjustments} title="Ajustes" /></div>

        <section className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4"><div><p className="text-xs font-bold uppercase text-slate-500">Bruto</p><p className="mt-1 font-black">{money(candidate.statement.totals.gross)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Benefícios</p><p className="mt-1 font-black">{money(candidate.statement.totals.benefits)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Descontos</p><p className="mt-1 font-black text-rose-700">{money(candidate.statement.totals.deductions)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Líquido exato a pagar</p><p className="mt-1 text-lg font-black text-emerald-800">{money(candidate.statement.totals.net)}</p></div></section>

        <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2" disabled={pending.length > 0 || state === "submitting"}>
          <legend className="px-2 text-sm font-black text-slate-950">Dados do pagamento</legend>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Forma de pagamento<select className={inputClass} onChange={(event) => { const option = candidate.paymentMethods.find((item) => item.id === event.target.value); if (!option) return; setPaymentMethodId(option.id); setMethod(option.type); setFinancialAccountId(""); setProof(null); setReference(""); setConfirmed(false); }} required value={paymentMethodId}><option value="">Selecione a forma</option>{candidate.paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name || methodLabels[item.type]}</option>)}</select>{!paymentMethodId ? <span className="text-xs font-semibold text-rose-700">Selecione a forma de pagamento.</span> : null}</label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Data do pagamento<input className={inputClass} onChange={(event) => { setPaidAt(event.target.value); setConfirmed(false); }} required type="date" value={paidAt} /></label>
          {!paidAt ? <p className="text-xs font-semibold text-rose-700 md:col-start-2">Informe a data do pagamento.</p> : null}
          <label className="grid gap-2 text-sm font-bold text-slate-700">Valor integral<input className={inputClass} readOnly value={money(candidate.statement.totals.net)} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Conta financeira<select className={inputClass} onChange={(event) => { setFinancialAccountId(event.target.value); setConfirmed(false); }} required value={financialAccountId}><option value="">Selecione a conta compatível</option>{compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{!financialAccountId ? <span className="text-xs font-semibold text-rose-700">Selecione a conta que receberá a liquidação.</span> : !selectedAccountCompatible ? <span className="text-xs font-semibold text-rose-700">A conta selecionada não é compatível com esta forma.</span> : null}</label>
          {candidate.settlement ? <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900 md:col-span-2">Liquidação já vinculada: {candidate.settlement.accountName} · {money(candidate.settlement.amount)}. A confirmação idempotente não criará outra.</p> : null}
          {bankPayment ? <>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Referência da transação (opcional)<input autoComplete="off" className={inputClass} maxLength={180} onChange={(event) => { setReference(event.target.value); setConfirmed(false); }} placeholder="Ex.: identificador do PIX" value={reference} /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Comprovante privado (opcional)<input accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className={`${inputClass} py-2`} onChange={(event) => { selectProof(event.target.files?.[0] ?? null); setConfirmed(false); }} type="file" /><span className="text-xs font-normal text-slate-500">PDF, JPG ou PNG · máximo 10 MB · acesso somente pela rota privada</span></label>
          </> : <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900 md:col-span-2">Após a emissão, o recibo ficará aguardando assinatura manual do funcionário.</p>}
        </fieldset>

        {message ? <p aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{message}</p> : null}
        <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><input checked={confirmed} className="mt-1 size-4" disabled={pending.length > 0 || state === "submitting"} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span><strong>Confirmo conscientemente</strong> que os dados acima correspondem ao pagamento integral do líquido congelado e que a emissão criará um recibo imutável.</span></label>
        <div className="flex flex-wrap justify-end gap-3"><Button disabled={state === "submitting"} onClick={onClose} type="button" variant="outline">Cancelar</Button><Button disabled={!canSubmit} loading={state === "submitting"} type="submit"><ShieldCheck aria-hidden="true" className="size-4" />Confirmar pagamento e emitir recibo</Button></div>
        {canSubmit ? <p className="flex items-center justify-end gap-2 text-xs font-bold text-emerald-800"><CheckCircle2 aria-hidden="true" className="size-4" />Requisitos conferidos. O envio ocorrerá somente pelo botão acima.</p> : <p className="flex items-center justify-end gap-2 text-xs text-slate-500"><FileUp aria-hidden="true" className="size-4" />Preencha e confira todos os requisitos antes de emitir.</p>}
      </form> : null}
    </div>
  </div>;
}

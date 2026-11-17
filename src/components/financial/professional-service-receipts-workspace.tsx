"use client";

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Plus,
  ReceiptText,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  PageHeading,
  PageState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRegion,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { ProfessionalReceiptManagementAction } from "./professional-receipt-management-action";

type ProviderKey = "ACADEMIA_SAULO_FITNESS" | "SAULO_XAVIER_VITORINO" | "MARIA_DE_LOURDES_GOMES";
type ReceiptStatus = "DRAFT" | "PARTIALLY_PAID" | "PAID" | "ISSUED" | "CANCELLED" | "REFUNDED";
type FlowStep = "FORM" | "CONFIRM" | "RESULT";

interface PatientOption {
  readonly patient: { readonly id: string; readonly fullName: string; readonly cpf?: string };
  readonly code: string;
  readonly masterRecordId: string;
}

interface ReceiptListItem {
  readonly id: string;
  readonly receiptId: string | null;
  readonly customerName: string;
  readonly customerCode: string;
  readonly providerKey: ProviderKey;
  readonly amount: string;
  readonly receivedAmount: string;
  readonly status: ReceiptStatus;
  readonly createdAt: string;
  readonly series: string | null;
  readonly sequence: number | null;
  readonly paymentCount: number;
  readonly managementAction: "DELETE_DRAFT" | "CANCEL_PAYMENT" | "CANCEL_RECEIPT" | null;
}

interface ReceiptListResponse {
  readonly items: readonly ReceiptListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly indicators: {
    readonly receivedAmount: string;
    readonly pending: number;
    readonly partial: number;
    readonly cancelled: number;
    readonly refunded: number;
  };
}

interface FormState {
  customerId: string;
  serviceKind: string;
  description: string;
  providerKey: ProviderKey;
  executorUserId: string;
  grossAmount: string;
  discount: string;
  surcharge: string;
  receivedAmount: string;
  method: "PIX" | "CASH" | "CARD" | "BANK_TRANSFER";
  transactionReference: string;
}

const API_ROOT = "/api/financial/professional-service-receipts";
const initialForm: FormState = {
  customerId: "",
  serviceKind: "PERSONAL_TRAINING",
  description: "",
  providerKey: "SAULO_XAVIER_VITORINO",
  executorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  grossAmount: "R$ 0,00",
  discount: "R$ 0,00",
  surcharge: "R$ 0,00",
  receivedAmount: "R$ 0,00",
  method: "PIX",
  transactionReference: "",
};

const providers: readonly [ProviderKey, string][] = [
  ["ACADEMIA_SAULO_FITNESS", "Academia Saulo Fitness"],
  ["SAULO_XAVIER_VITORINO", "Saulo Xavier Vitorino"],
  ["MARIA_DE_LOURDES_GOMES", "Maria de Lourdes Gomes"],
];

const services = [
  ["ACADEMY_MEMBERSHIP", "Mensalidade da academia"],
  ["ACADEMY_SERVICE", "Serviço da academia"],
  ["NUTRITION_CONSULTATION", "Consulta de Nutrição"],
  ["NUTRITION_FOLLOW_UP", "Acompanhamento nutricional"],
  ["NUTRITION_STRATEGY", "Estratégia nutricional"],
  ["NUTRITION_PLAN", "Plano alimentar"],
  ["PERSONAL_TRAINING", "Personal training"],
  ["STRENGTH_TRAINING_PLAN", "Plano de musculação"],
  ["RUNNING_PLAN", "Plano de corrida"],
  ["CYCLING_PLAN", "Plano de ciclismo"],
  ["POSTURAL_ASSESSMENT", "Avaliação postural"],
  ["PHYSICAL_FOLLOW_UP", "Acompanhamento físico"],
] as const;

const statusStyle: Record<ReceiptStatus, { label: string; tone: "neutral" | "warning" | "success" | "info" | "danger" }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  PARTIALLY_PAID: { label: "Parcial", tone: "warning" },
  PAID: { label: "Pago", tone: "success" },
  ISSUED: { label: "Emitido", tone: "info" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
  REFUNDED: { label: "Estornado", tone: "neutral" },
};

function cents(value: string) {
  const digits = value.replace(/\D/gu, "");
  return digits ? Number(digits) : 0;
}

function decimal(value: number) {
  return (Math.max(0, value) / 100).toFixed(2);
}

function currency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function moneyInput(value: string) {
  return currency(decimal(cents(value)));
}

function providerLabel(key: ProviderKey) {
  return providers.find(([value]) => value === key)?.[1] ?? key;
}

function serviceLabel(kind: string) {
  return services.find(([value]) => value === kind)?.[1] ?? kind;
}

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const config = statusStyle[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

async function responsePayload(response: Response) {
  const payload = await response.json() as { message?: string; code?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(payload.message ?? "Não foi possível concluir a operação.");
  return payload;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0"><dt className="text-sm text-slate-500">{label}</dt><dd className={`text-right text-sm ${strong ? "font-black text-slate-950" : "font-bold text-slate-700"}`}>{value}</dd></div>;
}

export function ProfessionalServiceReceiptsWorkspace({ financialSettlementId }: { financialSettlementId?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("FORM");
  const [form, setForm] = useState<FormState>(initialForm);
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<readonly PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingIssues, setPendingIssues] = useState<readonly string[]>([]);
  const [receipts, setReceipts] = useState<readonly ReceiptListItem[]>([]);
  const [indicators, setIndicators] = useState<ReceiptListResponse["indicators"]>({ receivedAmount: "0.00", pending: 0, partial: 0, cancelled: 0, refunded: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [createdReceiptId, setCreatedReceiptId] = useState<string>();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderKey | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "ALL">("ALL");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const selectedPatient = patients.find((entry) => entry.patient.id === form.customerId);
  const totalCents = Math.max(0, cents(form.grossAmount) - cents(form.discount) + cents(form.surcharge));
  const receivedCents = Math.min(cents(form.receivedAmount), totalCents);
  const remainingCents = Math.max(0, totalCents - receivedCents);
  const isNutrition = form.serviceKind.startsWith("NUTRITION");
  const executorCouncil = isNutrition ? "CRN" : "CREF";

  useEffect(() => {
    if (!dialogOpen) return;
    closeRef.current?.focus();
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingPatients(true);
      try {
        const params = new URLSearchParams({ page: "1", status: "ACTIVE" });
        if (patientQuery.trim()) params.set("query", patientQuery.trim());
        const response = await fetch(`/api/patients?${params}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: developmentUserRequestHeaders(),
          signal: controller.signal,
        });
        const payload = await response.json() as { patients?: readonly PatientOption[]; message?: string };
        if (!response.ok) throw new Error(payload.message);
        setPatients(payload.patients ?? []);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Não foi possível consultar os clientes.");
      } finally {
        if (!controller.signal.aborted) setLoadingPatients(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [dialogOpen, patientQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingList(true);
      setListError(undefined);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (search.trim()) params.set("query", search.trim());
        if (periodStart) params.set("from", periodStart);
        if (periodEnd) params.set("to", periodEnd);
        if (providerFilter !== "ALL") params.set("provider", providerFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        const response = await fetch(`${API_ROOT}/receipts?${params}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: developmentUserRequestHeaders(),
          signal: controller.signal,
        });
        const payload = await response.json() as ReceiptListResponse & { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Não foi possível consultar os recibos.");
        setReceipts(payload.items);
        setIndicators(payload.indicators);
        setTotalPages(payload.totalPages);
        setTotalReceipts(payload.total);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setListError(requestError instanceof Error ? requestError.message : "Não foi possível consultar os recibos.");
      } finally {
        if (!controller.signal.aborted) setLoadingList(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, periodEnd, periodStart, providerFilter, reloadKey, search, statusFilter]);
  const indicatorCards: readonly {
    label: string;
    value: string;
    icon: LucideIcon;
    colors: string;
  }[] = [
    { label: "Recebidos", value: currency(indicators.receivedAmount), icon: CircleDollarSign, colors: "text-emerald-700 bg-emerald-50" },
    { label: "Pendentes", value: String(indicators.pending), icon: AlertCircle, colors: "text-amber-700 bg-amber-50" },
    { label: "Parciais", value: String(indicators.partial), icon: Banknote, colors: "text-sky-700 bg-sky-50" },
    { label: "Cancelados", value: String(indicators.cancelled), icon: X, colors: "text-rose-700 bg-rose-50" },
    { label: "Estornados", value: String(indicators.refunded), icon: ReceiptText, colors: "text-slate-700 bg-slate-100" },
  ];

  function openFlow() {
    setForm(initialForm);
    setPatientQuery("");
    setError(undefined);
    setPendingIssues([]);
    setCreatedReceiptId(undefined);
    setStep("FORM");
    setDialogOpen(true);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeProvider(providerKey: ProviderKey) {
    setForm((current) => ({
      ...current,
      providerKey,
      executorUserId: providerKey === "ACADEMIA_SAULO_FITNESS"
        ? ""
        : providerKey === "SAULO_XAVIER_VITORINO"
          ? BUILT_IN_IDS.users.sauloXavierVitorino
          : BUILT_IN_IDS.users.mariaDeLourdesGomes,
    }));
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const issues: string[] = [];
    if (!selectedPatient) issues.push("Selecione um cliente do cadastro existente.");
    if (!form.executorUserId) issues.push("Informe quem realizou o serviço.");
    if (totalCents <= 0) issues.push("Informe um valor total maior que zero.");
    if (cents(form.receivedAmount) > totalCents) issues.push("O valor recebido não pode superar o total.");
    if (isNutrition && form.executorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
      issues.push("Serviços de Nutrição exigem Saulo como executor responsável.");
    }
    setPendingIssues(issues);
    if (issues.length === 0) setStep("CONFIRM");
  }

  async function issueReceipt() {
    if (!selectedPatient) return;
    setLoading(true);
    setError(undefined);
    setPendingIssues([]);
    try {
      const serviceReferenceId = crypto.randomUUID();
      const primaryDescription = serviceLabel(form.serviceKind);
      const itemDescription = form.description.trim()
        ? `${primaryDescription} — ${form.description.trim()}`
        : primaryDescription;
      const commonItem = {
        serviceReferenceId,
        kind: form.serviceKind,
        soldByProviderKey: form.providerKey,
        legalProviderKey: form.providerKey,
        ...(isNutrition ? { commercialUnit: { unit: "CLINICA_SV", commercialName: "Clínica SV", legalProviderKey: "ACADEMIA_SAULO_FITNESS" } } : {}),
        executors: [{
          userId: form.executorUserId,
          professionalRegistration: executorCouncil,
          professionalRegistrationStatus: "ACTIVE",
          performedActivity: primaryDescription,
        }],
        grossAmount: decimal(cents(form.grossAmount)),
      };
      const totals = {
        subtotal: decimal(cents(form.grossAmount)),
        discount: decimal(cents(form.discount)),
        surcharge: decimal(cents(form.surcharge)),
        amountDue: decimal(totalCents),
      };
      const chargeResponse = await fetch(`${API_ROOT}/charges`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify({
          providerKey: form.providerKey,
          masterRecordId: selectedPatient.masterRecordId,
          totals,
          items: [{ ...commonItem, description: itemDescription, serviceDate: new Date().toISOString().slice(0, 10) }],
        }),
      });
      const chargePayload = await responsePayload(chargeResponse) as { charge: { id: string; items: readonly { id: string }[] } };

      if (receivedCents === 0) {
        setPendingIssues(["Nenhum pagamento foi registrado. A cobrança foi salva como pendente e ainda não pode gerar recibo."]);
        setReloadKey((current) => current + 1);
        setStep("RESULT");
        return;
      }

      const paymentResponse = await fetch(`${API_ROOT}/charges/${chargePayload.charge.id}/payments`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify({
          providerKey: form.providerKey,
          financialSettlementId: financialSettlementId || undefined,
          method: form.method,
          receivedAmount: decimal(receivedCents),
          transactionReference: form.transactionReference.trim() || undefined,
          allocations: [{ chargeItemId: chargePayload.charge.items[0]?.id, amount: decimal(receivedCents) }],
          idempotencyKey: `ui-payment-${chargePayload.charge.id}`,
        }),
      });
      const paymentPayload = await responsePayload(paymentResponse) as { payment: { id: string } };

      const candidate = {
        legalProvider: form.providerKey === "ACADEMIA_SAULO_FITNESS"
          ? { key: form.providerKey, providerType: "LEGAL_ENTITY" }
          : { key: form.providerKey, providerType: "INDIVIDUAL", fullName: providerLabel(form.providerKey) },
        customerMasterRecordId: selectedPatient.masterRecordId,
        items: [commonItem],
        totals,
        payment: {
          method: form.method,
          receivedByProviderKey: form.providerKey,
          receivedAmount: decimal(receivedCents),
          previouslyReceivedAmount: "0.00",
          transactionReference: form.transactionReference.trim() || undefined,
          allocations: [{ serviceReferenceId, amount: decimal(receivedCents) }],
        },
        numbering: { series: form.providerKey === "ACADEMIA_SAULO_FITNESS" ? "ASF" : form.providerKey === "SAULO_XAVIER_VITORINO" ? "SV" : "MLG", sequence: 1 },
        signature: { mode: "MANUAL", signingProviderKey: form.providerKey, includeManualSignatureSpace: true },
        privacy: { customerCpfOnDocument: "MASKED" },
      };
      const validationContext = {
        customerIdentity: { masterRecordId: selectedPatient.masterRecordId, cpf: selectedPatient.patient.cpf },
        numbering: { seriesProviderKey: form.providerKey, sequencePreviouslyUsed: false },
      };
      const assessmentResponse = await fetch(`${API_ROOT}/charges/${chargePayload.charge.id}/issuance-candidate`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify({ candidate, validationContext }),
      });
      const assessmentPayload = await responsePayload(assessmentResponse) as { candidate: { eligible: boolean; issues: readonly { message: string }[] } };
      if (!assessmentPayload.candidate.eligible) {
        setPendingIssues(assessmentPayload.candidate.issues.map((issue) => issue.message));
        setStep("RESULT");
        return;
      }

      const receiptResponse = await fetch(`${API_ROOT}/receipts`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify({ candidate, validationContext, paymentId: paymentPayload.payment.id, idempotencyKey: `ui-receipt-${paymentPayload.payment.id}` }),
      });
      const receiptPayload = await responsePayload(receiptResponse) as { receipt: { id: string } };
      setCreatedReceiptId(receiptPayload.receipt.id);
      setReloadKey((current) => current + 1);
      setStep("RESULT");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível emitir o recibo.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-5 pt-3 sm:pt-4">
    <PageHeading
      action={<Button onClick={openFlow}><Plus aria-hidden="true" className="size-4" />Novo recebimento</Button>}
      backHref="/gestao/financeiro"
      description="Registre pagamentos de serviços e acompanhe a emissão dos recibos profissionais."
      eyebrow="Gestão · Financeiro"
      title="Recibos de Serviços"
    />

    <section aria-label="Indicadores dos recibos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {indicatorCards.map(({ label, value, icon: Icon, colors }) => <Card className="flex items-center gap-3 p-4" key={label}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors}`}><Icon aria-hidden="true" className="size-5" /></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-0.5 text-xl font-black text-slate-950">{value}</p></div></Card>)}
    </section>

    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FormField className="xl:col-span-2" id="receipt-search" label="Buscar cliente"><div className="relative mt-1.5"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" id="receipt-search" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome do cliente" value={search} /></div></FormField>
        <FormField id="period-start" label="De"><Input className="mt-1.5" id="period-start" onChange={(event) => { setPeriodStart(event.target.value); setPage(1); }} type="date" value={periodStart} /></FormField>
        <FormField id="period-end" label="Até"><Input className="mt-1.5" id="period-end" onChange={(event) => { setPeriodEnd(event.target.value); setPage(1); }} type="date" value={periodEnd} /></FormField>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1">
          <FormField id="provider-filter" label="Prestador"><Select className="mt-1.5" id="provider-filter" onChange={(event) => { setProviderFilter(event.target.value as ProviderKey | "ALL"); setPage(1); }} value={providerFilter}><option value="ALL">Todos</option>{providers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></FormField>
          <FormField id="status-filter" label="Situação"><Select className="mt-1.5" id="status-filter" onChange={(event) => { setStatusFilter(event.target.value as ReceiptStatus | "ALL"); setPage(1); }} value={statusFilter}><option value="ALL">Todas</option>{Object.entries(statusStyle).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}</Select></FormField>
        </div>
      </div>
    </Card>

    {listError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">{listError}</p> : null}
    {loadingList ? <div aria-busy="true" className="grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-500">Carregando recibos…</div> : receipts.length === 0 ? <PageState action={<Button onClick={openFlow} variant="outline">Registrar primeiro recebimento</Button>} description="Os recibos emitidos pelo novo fluxo aparecerão aqui. Nenhum dado demonstrativo é exibido." title="Nenhum recibo encontrado" /> : <><TableRegion label="Lista de recibos de serviços"><Table><TableHead><tr><TableHeaderCell>Cliente</TableHeaderCell><TableHeaderCell>Prestador</TableHeaderCell><TableHeaderCell>Data</TableHeaderCell><TableHeaderCell className="text-right">Total</TableHeaderCell><TableHeaderCell className="text-right">Recebido</TableHeaderCell><TableHeaderCell>Situação</TableHeaderCell><TableHeaderCell className="text-right">Ação</TableHeaderCell></tr></TableHead><TableBody>{receipts.map((receipt) => <tr key={receipt.id}><TableCell><p className="font-black text-slate-900">{receipt.customerName}</p><p className="mt-0.5 text-xs text-slate-500">{receipt.customerCode}</p></TableCell><TableCell>{providerLabel(receipt.providerKey)}</TableCell><TableCell>{new Intl.DateTimeFormat("pt-BR").format(new Date(receipt.createdAt))}</TableCell><TableCell className="text-right font-bold">{currency(receipt.amount)}</TableCell><TableCell className="text-right font-bold">{currency(receipt.receivedAmount)}</TableCell><TableCell><StatusBadge status={receipt.status} /></TableCell><TableCell><div className="flex flex-wrap justify-end gap-2">{receipt.receiptId ? <><Link className="inline-flex min-h-9 items-center font-black text-emerald-700 hover:underline" href={`/gestao/financeiro/recibos-servicos/${receipt.receiptId}`}>Visualizar</Link><Link className="inline-flex min-h-9 items-center font-black text-emerald-700 hover:underline" href={`/gestao/financeiro/recibos-servicos/${receipt.receiptId}?print=1&intent=PRINT`}>Imprimir</Link><Link className="inline-flex min-h-9 items-center font-black text-emerald-700 hover:underline" href={`/gestao/financeiro/recibos-servicos/${receipt.receiptId}?print=1&intent=SAVE_PDF`}>Salvar em PDF</Link></> : <><Link aria-label={`Abrir detalhes e pendências do recebimento de ${receipt.customerName}`} className="inline-flex min-h-9 items-center font-black text-amber-800 hover:underline" href={`/gestao/financeiro/recibos-servicos/pendencias/${receipt.id}`}>{receipt.status === "CANCELLED" ? "Ver detalhes" : "Com pendências"}</Link>{receipt.status !== "CANCELLED" && receipt.paymentCount > 0 ? <Link aria-label={`Visualizar prévia do recibo do recebimento de ${receipt.customerName}`} className="inline-flex min-h-9 items-center font-black text-emerald-700 hover:underline" href={`/gestao/financeiro/recibos-servicos/pendencias/${receipt.id}/previa`}>Visualizar prévia do recibo</Link> : null}</>}{receipt.managementAction ? <ProfessionalReceiptManagementAction action={receipt.managementAction} amount={currency(receipt.receivedAmount === "0.00" ? receipt.amount : receipt.receivedAmount)} chargeId={receipt.id} onComplete={() => setReloadKey((current) => current + 1)} receiptId={receipt.receiptId} /> : null}</div></TableCell></tr>)}</TableBody></Table></TableRegion><div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-slate-600">{totalReceipts} registro{totalReceipts === 1 ? "" : "s"} · Página {page} de {totalPages}</p><div className="flex gap-2"><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} size="small" variant="outline">Anterior</Button><Button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} size="small" variant="outline">Próxima</Button></div></div></>}

    <div className="flex flex-wrap gap-2" aria-label="Legenda de situações">{(Object.keys(statusStyle) as ReceiptStatus[]).map((status) => <StatusBadge key={status} status={status} />)}</div>

    {dialogOpen ? <div aria-labelledby="receipt-flow-title" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog"><div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Novo fluxo profissional</p><h2 className="mt-1 text-xl font-black text-slate-950" id="receipt-flow-title">{step === "FORM" ? "Novo recebimento" : step === "CONFIRM" ? "Confirme antes de emitir" : createdReceiptId ? "Recibo emitido" : "Recebimento registrado"}</h2></div><button aria-label="Fechar" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => setDialogOpen(false)} ref={closeRef} type="button"><X aria-hidden="true" className="size-5" /></button></header>
      <div className="px-5 py-5 sm:px-6">
        <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Etapas"><li className={`rounded-lg px-3 py-2 text-xs font-black ${step === "FORM" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}>1. Dados</li><li className={`rounded-lg px-3 py-2 text-xs font-black ${step === "CONFIRM" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>2. Confirmação</li><li className={`rounded-lg px-3 py-2 text-xs font-black ${step === "RESULT" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>3. Emissão</li></ol>

        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">{error}</p> : null}
        {pendingIssues.length > 0 ? <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="pending-title"><h3 className="flex items-center gap-2 font-black text-amber-950" id="pending-title"><AlertCircle aria-hidden="true" className="size-4" />Pendências para emissão</h3><ul className="mt-2 grid gap-1.5 text-sm text-amber-900">{pendingIssues.map((issue) => <li className="flex gap-2" key={issue}><span aria-hidden="true">•</span>{issue}</li>)}</ul></section> : null}

        {step === "FORM" ? <form className="grid gap-5" onSubmit={review}>
          <section><h3 className="text-sm font-black text-slate-950">Cliente e serviço</h3><div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField id="patient-query" label="Buscar cliente" required><Input className="mt-1.5" id="patient-query" onChange={(event) => setPatientQuery(event.target.value)} placeholder="Nome, CPF, telefone ou código" value={patientQuery} /></FormField>
            <FormField help={loadingPatients ? "Consultando cadastros…" : patients.length === 0 ? "Nenhum cliente encontrado." : undefined} id="patient" label="Cliente cadastrado" required><Select className="mt-1.5" id="patient" onChange={(event) => update("customerId", event.target.value)} value={form.customerId}><option value="">Selecione</option>{patients.map((entry) => <option key={entry.patient.id} value={entry.patient.id}>{entry.patient.fullName} · {entry.code}</option>)}</Select></FormField>
            <FormField id="service" label="Serviço" required><Select className="mt-1.5" id="service" onChange={(event) => update("serviceKind", event.target.value)} value={form.serviceKind}>{services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField>
            <FormField id="description" label="Detalhes adicionais"><Input autoComplete="off" autoCorrect="off" className="mt-1.5" id="description" onChange={(event) => update("description", event.target.value)} placeholder="Ex.: acompanhamento referente a setembro de 2026" spellCheck={false} value={form.description} /></FormField>
          </div></section>
          <section className="border-t border-slate-200 pt-5"><h3 className="text-sm font-black text-slate-950">Responsabilidade profissional</h3><div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField help="Será o emissor identificado no recibo." id="provider" label="Quem recebeu o pagamento?" required><Select className="mt-1.5" id="provider" onChange={(event) => changeProvider(event.target.value as ProviderKey)} value={form.providerKey}>{providers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></FormField>
            <FormField help="Profissional que executou o atendimento." id="executor" label="Quem realizou o serviço?" required><Select className="mt-1.5" id="executor" onChange={(event) => update("executorUserId", event.target.value)} value={form.executorUserId}><option value="">Selecione o profissional</option><option value={BUILT_IN_IDS.users.sauloXavierVitorino}>Saulo Xavier Vitorino</option><option value={BUILT_IN_IDS.users.mariaDeLourdesGomes}>Maria de Lourdes Gomes</option></Select></FormField>
          </div></section>
          <section className="border-t border-slate-200 pt-5"><h3 className="text-sm font-black text-slate-950">Valores e pagamento</h3><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="gross" label="Valor total cobrado" required><Input className="mt-1.5" id="gross" inputMode="numeric" onChange={(event) => update("grossAmount", moneyInput(event.target.value))} value={form.grossAmount} /></FormField>
            <FormField id="discount" label="Desconto"><Input className="mt-1.5" id="discount" inputMode="numeric" onChange={(event) => update("discount", moneyInput(event.target.value))} value={form.discount} /></FormField>
            <FormField id="surcharge" label="Acréscimo"><Input className="mt-1.5" id="surcharge" inputMode="numeric" onChange={(event) => update("surcharge", moneyInput(event.target.value))} value={form.surcharge} /></FormField>
            <FormField id="method" label="Forma de pagamento" required><Select className="mt-1.5" id="method" onChange={(event) => update("method", event.target.value as FormState["method"])} value={form.method}><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="CARD">Cartão</option><option value="BANK_TRANSFER">Transferência bancária</option></Select></FormField>
            <FormField help="Pode ser zero para salvar como pendente ou menor que o total para pagamento parcial." id="received" label="Valor pago agora" required><Input aria-invalid={cents(form.receivedAmount) > totalCents || undefined} className="mt-1.5" id="received" inputMode="numeric" onChange={(event) => update("receivedAmount", moneyInput(event.target.value))} value={form.receivedAmount} /></FormField>
            <FormField className="sm:col-span-2" id="transaction-reference" label="Referência da transação"><Input className="mt-1.5" id="transaction-reference" onChange={(event) => update("transactionReference", event.target.value)} placeholder="Opcional para identificação bancária" value={form.transactionReference} /></FormField>
          </div><Card className="mt-4 p-4" variant={remainingCents > 0 ? "warning" : "success"}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs font-bold text-slate-600">Total final</p><p className="mt-1 text-lg font-black text-slate-950">{currency(decimal(totalCents))}</p></div><div><p className="text-xs font-bold text-slate-600">Pago agora</p><p className="mt-1 text-lg font-black text-slate-950">{currency(decimal(receivedCents))}</p></div><div><p className="text-xs font-bold text-slate-600">Falta pagar</p><p className="mt-1 text-lg font-black text-slate-950">{currency(decimal(remainingCents))}</p></div></div><p className={`mt-3 border-t pt-3 text-sm font-black ${remainingCents > 0 ? "border-amber-200 text-amber-900" : "border-emerald-200 text-emerald-900"}`}>{remainingCents > 0 ? "Pagamento parcial" : "Pagamento integral"}</p></Card></section>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><Button onClick={() => setDialogOpen(false)} type="button" variant="ghost">Cancelar</Button><Button type="submit">Revisar recebimento<ChevronRight aria-hidden="true" className="size-4" /></Button></div>
        </form> : null}

        {step === "CONFIRM" && selectedPatient ? <div className="grid gap-5 lg:grid-cols-[1fr_18rem]"><section><h3 className="text-lg font-black text-slate-950">Resumo completo</h3><dl className="mt-3"><SummaryRow label="Cliente" value={selectedPatient.patient.fullName} strong /><SummaryRow label="Cadastro" value={selectedPatient.code} /><SummaryRow label="Serviço" value={serviceLabel(form.serviceKind)} />{form.description.trim() ? <SummaryRow label="Detalhes adicionais" value={form.description.trim()} /> : null}<SummaryRow label="Quem recebeu" value={providerLabel(form.providerKey)} /><SummaryRow label="Quem realizou" value={form.executorUserId === BUILT_IN_IDS.users.sauloXavierVitorino ? "Saulo Xavier Vitorino" : "Maria de Lourdes Gomes"} /><SummaryRow label="Forma de pagamento" value={{ PIX: "PIX", CASH: "Dinheiro", CARD: "Cartão", BANK_TRANSFER: "Transferência bancária" }[form.method]} /></dl></section><Card className="h-fit p-4" variant="muted"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Conferência financeira</p><dl className="mt-2"><SummaryRow label="Valor total cobrado" value={currency(decimal(cents(form.grossAmount)))} /><SummaryRow label="Desconto" value={currency(decimal(cents(form.discount)))} /><SummaryRow label="Acréscimo" value={currency(decimal(cents(form.surcharge)))} /><SummaryRow label="Total final" value={currency(decimal(totalCents))} strong /><SummaryRow label="Pago agora" value={currency(decimal(receivedCents))} strong /><SummaryRow label="Falta pagar" value={currency(decimal(remainingCents))} strong /></dl></Card><div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 lg:col-span-2 sm:flex-row sm:justify-end"><Button disabled={loading} onClick={() => setStep("FORM")} type="button" variant="ghost">Voltar e editar</Button><Button loading={loading} onClick={() => void issueReceipt()} type="button"><FileCheck2 aria-hidden="true" className="size-4" />{receivedCents === 0 ? "Salvar como pendente" : "Confirmar e emitir"}</Button></div></div> : null}

        {step === "RESULT" ? <div className="py-5 text-center"><span className={`mx-auto grid size-14 place-items-center rounded-full ${createdReceiptId ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{createdReceiptId ? <CheckCircle2 aria-hidden="true" className="size-7" /> : <AlertCircle aria-hidden="true" className="size-7" />}</span><h3 className="mt-4 text-xl font-black text-slate-950">{createdReceiptId ? "Recibo emitido com sucesso" : "Emissão aguardando regularização"}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{createdReceiptId ? "O documento foi registrado e está disponível para visualização, impressão e salvamento em PDF." : "O recebimento permanece visível com suas pendências. Nenhum recibo foi emitido enquanto os requisitos não foram atendidos."}</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">{createdReceiptId ? <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white" href={`/gestao/financeiro/recibos-servicos/${createdReceiptId}`}>Visualizar recibo</Link> : <Button onClick={() => setStep("FORM")} variant="outline">Revisar dados</Button>}<Button onClick={() => setDialogOpen(false)} variant="ghost">Fechar</Button></div></div> : null}
      </div>
    </div></div> : null}
  </div>;
}

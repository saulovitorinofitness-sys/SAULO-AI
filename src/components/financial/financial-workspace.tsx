"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronDown,
  CircleDollarSign,
  FileChartColumn,
  Pencil,
  Plus,
  ReceiptText,
  TriangleAlert,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type FormEvent,
  type InputHTMLAttributes,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Badge,
  Button,
  ButtonLink,
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
  Textarea,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import {
  accountsPayableStatus,
  accountsReceivableStatus,
  buildAccountsPayableAgenda,
  buildAccountsReceivableAgenda,
} from "@/features/financial/agenda";
import type {
  FinancialCatalog,
  FinancialCatalogItem,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialEntryView,
  FinancialManagementNature,
  FinancialSummary,
} from "@/features/financial/contracts";
import { ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE } from "@/features/financial/contracts";
import type { FinancialManagementView } from "@/features/financial/academy-management";
import { AcademyManagementPanel } from "./academy-management-panel";
import { NextFitDreImportDialog } from "./nextfit-dre-import-dialog";
import { NextFitReceiptsImportDialog } from "./nextfit-receipts-import-dialog";

export interface FinancialWorkspaceFilters {
  readonly unit: "ALL" | "ACADEMIA" | "CLINICA" | "PERSONAL";
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly type?: FinancialEntryType;
  readonly status?: FinancialEntryStatus;
  readonly categoryId?: string;
}

interface EntryFormState {
  unitId: string;
  type: FinancialEntryType;
  managementNature: FinancialManagementNature;
  categoryId: string;
  costCenterId: string;
  description: string;
  observation: string;
  competence: string;
  dueDate: string;
  amount: string;
  financialAccountId: string;
  paymentMethodId: string;
}

interface EntrySettlementFormState {
  settlementDate: string;
  amount: string;
  financialAccountId: string;
  paymentMethodId: string;
  observation: string;
}

const ACADEMY_EXPENSE_CATEGORY_ORDER = [
  "ACADEMIA_PESSOAL",
  "ACADEMIA_ESTRUTURA_OPERACAO",
  "ACADEMIA_COMPRAS_INVESTIMENTOS",
  "ACADEMIA_ADMINISTRATIVO",
  "ACADEMIA_MARKETING_VENDAS",
  "ACADEMIA_TRIBUTOS_ENCARGOS",
  "ACADEMIA_OUTROS",
] as const;

const academyExpenseCategoryRank = new Map(
  ACADEMY_EXPENSE_CATEGORY_ORDER.map((code, index) => [code, index]),
);

const ACADEMY_RECEIPT_ACCOUNT_BY_PAYMENT_TYPE = {
  PIX: "NUBANK",
  BANK_TRANSFER: "NUBANK",
  DEBIT_CARD: "SUMUP",
  CREDIT_CARD: "SUMUP",
  CASH: "CAIXA_FISICO",
} as const;

export function academyReceiptAccountCode(method: FinancialCatalogItem) {
  return method.paymentMethodType
    ? ACADEMY_RECEIPT_ACCOUNT_BY_PAYMENT_TYPE[
        method.paymentMethodType as keyof typeof ACADEMY_RECEIPT_ACCOUNT_BY_PAYMENT_TYPE
      ]
    : undefined;
}

export function isEntryCategoryAvailable(
  category: FinancialCatalogItem,
  input: {
    readonly businessUnitId: string;
    readonly entryType: FinancialEntryType;
    readonly isAcademy: boolean;
  },
) {
  if (
    category.status !== "ACTIVE" ||
    category.entryType !== input.entryType ||
    category.code === ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE
  ) {
    return false;
  }
  if (input.isAcademy) {
    return category.businessUnitId === input.businessUnitId;
  }
  return (
    !category.businessUnitId ||
    category.businessUnitId === input.businessUnitId
  );
}

export function sortEntryCategories(
  categories: readonly FinancialCatalogItem[],
  isAcademy: boolean,
) {
  if (!isAcademy) return [...categories];
  return [...categories].sort((left, right) => {
    const leftRank = academyExpenseCategoryRank.get(
      left.code as (typeof ACADEMY_EXPENSE_CATEGORY_ORDER)[number],
    );
    const rightRank = academyExpenseCategoryRank.get(
      right.code as (typeof ACADEMY_EXPENSE_CATEGORY_ORDER)[number],
    );
    if (leftRank !== undefined || rightRank !== undefined) {
      return (leftRank ?? Number.MAX_SAFE_INTEGER) -
        (rightRank ?? Number.MAX_SAFE_INTEGER);
    }
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export function isFinancialAccountAvailable(
  account: FinancialCatalogItem,
  businessUnitId: string,
  businessUnitCode?: string,
) {
  return account.status === "ACTIVE" &&
    (account.businessUnitId === businessUnitId || businessUnitCode === "PERSONAL");
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const currencyInputFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatCurrencyInput(value: string) {
  if (!value) return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyInputFormatter.format(amount) : "";
}

export function currencyDigitsToCanonical(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${integer}.${padded.slice(-2)}`;
}

export function parseCurrencyInput(value: string) {
  const normalized = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!normalized) return "";
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : /^\d+$/.test(normalized)
      ? normalized
      : /^\d{1,3}(\.\d{3})+$/.test(normalized)
        ? normalized.replace(/\./g, "")
        : normalized;
  const amount = Number(decimal);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : "";
}

interface CurrencyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "onChange" | "type" | "value"
  > {
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly value?: string;
}

function CurrencyInput({
  defaultValue = "",
  name,
  onValueChange,
  value,
  ...props
}: CurrencyInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const canonicalValue = value ?? internalValue;

  function updateValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = parseCurrencyInput(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    updateValue(pasted);
  }

  return (
    <>
      <Input
        {...props}
        inputMode="numeric"
        onChange={(event) =>
          updateValue(currencyDigitsToCanonical(event.target.value))
        }
        onPaste={handlePaste}
        type="text"
        value={formatCurrencyInput(canonicalValue)}
      />
      {name ? <input name={name} type="hidden" value={canonicalValue} /> : null}
    </>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatMoney(value: string) {
  return currencyFormatter.format(Number(value));
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00-03:00`));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function statusPresentation(entry: FinancialEntryView) {
  if (entry.status === "CANCELLED") {
    return { label: "Cancelado", tone: "neutral" as const };
  }
  if (entry.status === "SETTLED") {
    return {
      label: entry.type === "REVENUE" ? "Recebido" : "Pago",
      tone: "success" as const,
    };
  }
  if (entry.status === "PARTIALLY_SETTLED") {
    return { label: "Parcial", tone: "info" as const };
  }
  if (entry.dueDate < today()) {
    return { label: "Vencido", tone: "danger" as const };
  }
  return { label: "Em aberto", tone: "warning" as const };
}

function summaryCards(summary: FinancialSummary, showOwnerWithdrawal: boolean) {
  const cards = [
    {
      label: "Receitas recebidas",
      value: summary.totalReceived,
      icon: ArrowDownLeft,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Despesas pagas",
      value: summary.totalPaid,
      icon: ArrowUpRight,
      tone: "text-rose-700 bg-rose-50",
    },
    {
      label: "Saldo realizado",
      value: summary.realizedBalance,
      icon: WalletCards,
      tone: "text-slate-800 bg-slate-100",
    },
    {
      label: "A receber",
      value: summary.totalReceivable,
      icon: CircleDollarSign,
      tone: "text-sky-700 bg-sky-50",
    },
    {
      label: "A pagar",
      value: summary.totalPayable,
      icon: ReceiptText,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      label: "Vencidos",
      value: summary.overdueTotal,
      icon: TriangleAlert,
      tone: "text-orange-700 bg-orange-50",
    },
  ];
  if (showOwnerWithdrawal) {
    cards.splice(2, 0, {
      label: "Retiradas pagas",
      value: summary.ownerWithdrawalPaid,
      icon: Banknote,
      tone: "text-violet-700 bg-violet-50",
    });
  }
  return cards;
}

const ACADEMY_ACCOUNT_BALANCE_LABELS = [
  { code: "NUBANK", label: "Nubank" },
  { code: "SUMUP", label: "SumUp" },
  { code: "CAIXA_FISICO", label: "Caixa físico" },
] as const;

export function academyAccountBalanceCards(summary: FinancialSummary) {
  return ACADEMY_ACCOUNT_BALANCE_LABELS.map((account) => ({
    ...account,
    balance:
      summary.accountBalances.find(
        (balance) => balance.financialAccount.code === account.code,
      )?.realizedBalance ?? "0.00",
  }));
}

function viewHref(
  unit: FinancialWorkspaceFilters["unit"],
  filters: FinancialWorkspaceFilters,
) {
  const params = new URLSearchParams({
    unit,
    from: filters.periodStart,
    to: filters.periodEnd,
  });
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("category", filters.categoryId);
  return `/gestao/financeiro?${params.toString()}`;
}

function defaultEntryForm(
  catalog: FinancialCatalog,
  filters: FinancialWorkspaceFilters,
): EntryFormState {
  const selectedUnit =
    catalog.businessUnits.find((unit) => unit.code === filters.unit) ??
    catalog.businessUnits.find((unit) => unit.status === "ACTIVE");
  return {
    unitId: selectedUnit?.id ?? "",
    type: selectedUnit?.code === "ACADEMIA" ? "EXPENSE" : "REVENUE",
    managementNature: "REALIZED",
    categoryId: "",
    costCenterId: "",
    description: "",
    observation: "",
    competence: filters.periodStart.slice(0, 8) + "01",
    dueDate: today(),
    amount: "",
    financialAccountId: "",
    paymentMethodId: "",
  };
}

function entryFormFrom(entry: FinancialEntryView): EntryFormState {
  return {
    unitId: entry.businessUnit.id,
    type: entry.type,
    managementNature: entry.managementNature,
    categoryId: entry.financialCategory.id,
    costCenterId: entry.costCenter?.id ?? "",
    description: entry.description,
    observation: entry.observation ?? "",
    competence: entry.competence,
    dueDate: entry.dueDate,
    amount: entry.amount,
    financialAccountId: entry.financialAccount?.id ?? "",
    paymentMethodId: entry.paymentMethod?.id ?? "",
  };
}

function defaultEntrySettlementForm(
  entry?: Pick<
    EntryFormState,
    "amount" | "financialAccountId" | "paymentMethodId"
  >,
): EntrySettlementFormState {
  if (entry) return inheritedSettlementValues(entry, today());
  return {
    settlementDate: today(),
    amount: "",
    financialAccountId: "",
    paymentMethodId: "",
    observation: "",
  };
}

export function inheritedSettlementValues(
  input: Pick<
    EntryFormState,
    "amount" | "financialAccountId" | "paymentMethodId"
  >,
  settlementDate: string,
): EntrySettlementFormState {
  return {
    settlementDate,
    amount: input.amount,
    financialAccountId: input.financialAccountId,
    paymentMethodId: input.paymentMethodId,
    observation: "",
  };
}

export function paymentFieldVisibility(
  input: Pick<EntryFormState, "financialAccountId" | "paymentMethodId">,
  editAll: boolean,
) {
  return {
    settlementDate: editAll,
    amount: editAll,
    financialAccount: editAll || !input.financialAccountId,
    paymentMethod: editAll || !input.paymentMethodId,
    observation: editAll,
  };
}

function DialogShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby="financial-dialog-title"
        aria-modal="true"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="financial-dialog-title">
              {title}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function FinancialWorkspace({
  catalog,
  currentDate,
  entries,
  filters,
  managementView,
  payablesEntries,
  receivablesEntries,
  summary,
}: {
  readonly catalog: FinancialCatalog;
  readonly currentDate: string;
  readonly entries: readonly FinancialEntryView[];
  readonly filters: FinancialWorkspaceFilters;
  readonly managementView?: FinancialManagementView;
  readonly payablesEntries: readonly FinancialEntryView[];
  readonly receivablesEntries: readonly FinancialEntryView[];
  readonly summary: FinancialSummary;
}) {
  const router = useRouter();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntryView>();
  const [entryForm, setEntryForm] = useState<EntryFormState>(() =>
    defaultEntryForm(catalog, filters),
  );
  const [entrySettlementOpen, setEntrySettlementOpen] = useState(false);
  const [entrySettlementEditing, setEntrySettlementEditing] = useState(false);
  const [entrySettlementForm, setEntrySettlementForm] =
    useState<EntrySettlementFormState>(() => defaultEntrySettlementForm());
  const [entrySettlementIdempotencyKey, setEntrySettlementIdempotencyKey] =
    useState("");
  const [settlementEntry, setSettlementEntry] = useState<FinancialEntryView>();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptMethodId, setReceiptMethodId] = useState("");
  const [saving, setSaving] = useState(false);
  const savingEntryRef = useRef(false);
  const nextFitImportMenuRef = useRef<HTMLDetailsElement>(null);
  const [dreImportOpen, setDreImportOpen] = useState(false);
  const [receiptsImportOpen, setReceiptsImportOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const accountsPayableAgenda = useMemo(
    () => buildAccountsPayableAgenda(payablesEntries, currentDate),
    [currentDate, payablesEntries],
  );
  const accountsReceivableAgenda = useMemo(
    () => buildAccountsReceivableAgenda(receivablesEntries, currentDate),
    [currentDate, receivablesEntries],
  );

  const selectedEntryUnit = catalog.businessUnits.find(
    (unit) => unit.id === entryForm.unitId,
  );
  const academyOwnerWithdrawalCategory = catalog.categories.find(
    (category) =>
      category.code === ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE &&
      category.businessUnitId === entryForm.unitId &&
      category.status === "ACTIVE",
  );
  const isAcademyEntry = selectedEntryUnit?.code === "ACADEMIA";
  const isOwnerWithdrawal =
    isAcademyEntry &&
    entryForm.categoryId === academyOwnerWithdrawalCategory?.id;

  const activeCategories = useMemo(
    () =>
      sortEntryCategories(catalog.categories.filter(
        (category) =>
          isEntryCategoryAvailable(category, {
            businessUnitId: entryForm.unitId,
            entryType: entryForm.type,
            isAcademy: isAcademyEntry,
          }),
      ), isAcademyEntry),
    [catalog.categories, entryForm.type, entryForm.unitId, isAcademyEntry],
  );
  const activeAccounts = catalog.financialAccounts.filter(
    (account) =>
      isFinancialAccountAvailable(account, entryForm.unitId, selectedEntryUnit?.code),
  );
  const activePaymentMethods = catalog.paymentMethods.filter(
    (method) => method.status === "ACTIVE",
  );
  const settlementAccounts = settlementEntry
    ? catalog.financialAccounts.filter((account) =>
        isFinancialAccountAvailable(
          account,
          settlementEntry.businessUnit.id,
          settlementEntry.businessUnit.code,
        ),
      )
    : [];
  const academyUnit = catalog.businessUnits.find(
    (unit) => unit.code === "ACADEMIA" && unit.status === "ACTIVE",
  );
  const academyReceiptMethods = activePaymentMethods.filter((method) =>
    Boolean(academyReceiptAccountCode(method)),
  );
  const receiptMethod = academyReceiptMethods.find(
    (method) => method.id === receiptMethodId,
  );
  const receiptAccount = catalog.financialAccounts.find(
    (account) =>
      account.businessUnitId === academyUnit?.id &&
      account.status === "ACTIVE" &&
      account.code === (receiptMethod ? academyReceiptAccountCode(receiptMethod) : undefined),
  );
  const catalogReady =
    catalog.businessUnits.some((unit) => unit.status === "ACTIVE") &&
    catalog.categories.some((category) => category.status === "ACTIVE");
  const paymentFields = paymentFieldVisibility(
    entryForm,
    entrySettlementEditing,
  );
  const hasCompletePlannedPayment = Boolean(
    entryForm.financialAccountId && entryForm.paymentMethodId,
  );

  function openCreate() {
    setEditingEntry(undefined);
    setEntryForm(defaultEntryForm(catalog, filters));
    setEntrySettlementOpen(false);
    setEntrySettlementEditing(false);
    setEntrySettlementForm(defaultEntrySettlementForm());
    setEntrySettlementIdempotencyKey(crypto.randomUUID());
    setError(undefined);
    setEntryDialogOpen(true);
  }

  function openEdit(entry: FinancialEntryView) {
    setEditingEntry(entry);
    setEntryForm(entryFormFrom(entry));
    setEntrySettlementOpen(false);
    setEntrySettlementEditing(false);
    setEntrySettlementForm(defaultEntrySettlementForm());
    setError(undefined);
    setEntryDialogOpen(true);
  }

  function openEntrySettlement(editAll: boolean) {
    setEntrySettlementForm(defaultEntrySettlementForm(entryForm));
    setEntrySettlementEditing(editAll);
    setEntrySettlementOpen(true);
  }

  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
        ...init.headers,
      },
    });
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingEntryRef.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLElement
      | null;
    const createAndSettle =
      !editingEntry && submitter?.dataset.saveMode === "settle";
    const inheritedSettlement = defaultEntrySettlementForm(entryForm);
    const settlement = entrySettlementEditing
      ? entrySettlementForm
      : {
          ...inheritedSettlement,
          financialAccountId:
            inheritedSettlement.financialAccountId ||
            entrySettlementForm.financialAccountId,
          paymentMethodId:
            inheritedSettlement.paymentMethodId ||
            entrySettlementForm.paymentMethodId,
        };
    savingEntryRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await request(
        editingEntry
          ? `/api/financial/entries/${editingEntry.id}`
          : "/api/financial/entries",
        {
          method: editingEntry ? "PATCH" : "POST",
          body: JSON.stringify({
            type: entryForm.type,
            managementNature: entryForm.managementNature,
            competence: entryForm.competence,
            dueDate: entryForm.dueDate,
            amount: entryForm.amount,
            description: entryForm.description,
            observation:
              entryForm.observation || (editingEntry ? null : undefined),
            businessUnitId: entryForm.unitId,
            financialCategoryId: entryForm.categoryId,
            costCenterId:
              entryForm.costCenterId || (editingEntry ? null : undefined),
            financialAccountId:
              entryForm.financialAccountId ||
              (editingEntry ? null : undefined),
            paymentMethodId:
              entryForm.paymentMethodId || (editingEntry ? null : undefined),
            ...(createAndSettle
              ? {
                  settlement: {
                    amount: settlement.amount,
                    settlementDate: settlement.settlementDate,
                    financialAccountId: settlement.financialAccountId,
                    paymentMethodId: settlement.paymentMethodId,
                    observation: settlement.observation || undefined,
                    idempotencyKey: entrySettlementIdempotencyKey,
                  },
                }
              : {}),
          }),
        },
      );
      setEntryDialogOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      savingEntryRef.current = false;
      setSaving(false);
    }
  }

  async function cancelEntry(entry: FinancialEntryView) {
    if (!window.confirm(`Cancelar o lançamento “${entry.description}”?`)) return;
    setSaving(true);
    setError(undefined);
    try {
      await request(`/api/financial/entries/${entry.id}/cancel`, { method: "POST" });
      router.refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settlementEntry) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    try {
      await request(`/api/financial/entries/${settlementEntry.id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          amount: data.get("amount"),
          settlementDate: data.get("settlementDate"),
          financialAccountId: data.get("financialAccountId"),
          paymentMethodId: data.get("paymentMethodId"),
          observation: data.get("observation") || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setSettlementEntry(undefined);
      router.refresh();
    } catch (settlementError) {
      setError(
        settlementError instanceof Error
          ? settlementError.message
          : "Não foi possível registrar a liquidação.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAcademyReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiptAccount || !receiptMethod) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    try {
      await request("/api/financial/academy-receipts", {
        method: "POST",
        body: JSON.stringify({
          receiptDate: data.get("receiptDate"),
          amount: data.get("amount"),
          description: data.get("description"),
          reference: data.get("reference") || undefined,
          financialAccountId: receiptAccount.id,
          paymentMethodId: receiptMethod.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setReceiptDialogOpen(false);
      setReceiptMethodId("");
      router.refresh();
    } catch (receiptError) {
      setError(
        receiptError instanceof Error
          ? receiptError.message
          : "Não foi possível registrar o recebimento.",
      );
    } finally {
      setSaving(false);
    }
  }

  function accountsPayableRow(entry: FinancialEntryView) {
    const status = accountsPayableStatus(entry, currentDate);
    return (
      <tr key={entry.id}>
        <TableCell className="whitespace-nowrap font-semibold">{formatDate(entry.dueDate)}</TableCell>
        <TableCell className="min-w-52 font-black text-slate-900">{entry.description}</TableCell>
        <TableCell className="min-w-40">{entry.financialCategory.name}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{formatMoney(entry.amount)}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{formatMoney(entry.settledAmount)}</TableCell>
        <TableCell className="whitespace-nowrap text-right font-black">{formatMoney(entry.remainingAmount)}</TableCell>
        <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
        <TableCell className="text-right">
          <button
            className="rounded-lg px-2.5 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50"
            onClick={() => {
              setError(undefined);
              setSettlementEntry(entry);
            }}
            type="button"
          >
            Pagar
          </button>
        </TableCell>
      </tr>
    );
  }

  function accountsPayableTable(
    payableEntries: readonly FinancialEntryView[],
    label: string,
  ) {
    return (
      <TableRegion label={label}>
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Vencimento</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell>Categoria</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor original</TableHeaderCell>
              <TableHeaderCell className="text-right">Pago</TableHeaderCell>
              <TableHeaderCell className="text-right">Saldo a pagar</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell className="text-right">Ação</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>{payableEntries.map(accountsPayableRow)}</TableBody>
        </Table>
      </TableRegion>
    );
  }

  function accountsReceivableRow(entry: FinancialEntryView) {
    const status = accountsReceivableStatus(entry, currentDate);
    return (
      <tr key={entry.id}>
        <TableCell className="whitespace-nowrap font-semibold">{formatDate(entry.dueDate)}</TableCell>
        <TableCell className="min-w-52 font-black text-slate-900">{entry.description}</TableCell>
        <TableCell className="whitespace-nowrap">{entry.businessUnit.name}</TableCell>
        <TableCell className="min-w-40">{entry.financialCategory.name}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{formatMoney(entry.amount)}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{formatMoney(entry.settledAmount)}</TableCell>
        <TableCell className="whitespace-nowrap text-right font-black">{formatMoney(entry.remainingAmount)}</TableCell>
        <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
        <TableCell className="text-right">
          <button
            className="rounded-lg px-2.5 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50"
            onClick={() => {
              setError(undefined);
              setSettlementEntry(entry);
            }}
            type="button"
          >
            Receber
          </button>
        </TableCell>
      </tr>
    );
  }

  function accountsReceivableTable(
    receivableEntries: readonly FinancialEntryView[],
    label: string,
  ) {
    return (
      <TableRegion label={label}>
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Vencimento</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell>Unidade</TableHeaderCell>
              <TableHeaderCell>Categoria</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor original</TableHeaderCell>
              <TableHeaderCell className="text-right">Recebido</TableHeaderCell>
              <TableHeaderCell className="text-right">Saldo a receber</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell className="text-right">Ação</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>{receivableEntries.map(accountsReceivableRow)}</TableBody>
        </Table>
      </TableRegion>
    );
  }

  return (
    <div className="space-y-6 pt-3 sm:pt-4">
      <PageHeading
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {filters.unit === "ACADEMIA" ? (
              <Button onClick={() => { setError(undefined); setReceiptMethodId(""); setReceiptDialogOpen(true); }}>
                <ArrowDownLeft aria-hidden="true" className="size-4" />
                Registrar entrada real
              </Button>
            ) : null}
            <ButtonLink href={`/gestao/financeiro/relatorio?unit=${filters.unit}`} variant="outline">
              <FileChartColumn aria-hidden="true" className="size-4" />
              Relatório Executivo
            </ButtonLink>
            <ButtonLink href="/gestao/financeiro/recibos-servicos" variant="outline">
              <ReceiptText aria-hidden="true" className="size-4" />
              Recibos de Serviços
            </ButtonLink>
            <details className="relative" ref={nextFitImportMenuRef}>
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    Importar NextFit
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">
                    <button
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      onClick={() => {
                        nextFitImportMenuRef.current?.removeAttribute("open");
                        setSuccess(undefined);
                        setDreImportOpen(true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span className="block font-black text-slate-900">DRE Gerencial</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Fotografia gerencial por competência</span>
                    </button>
                    <button
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      onClick={() => {
                        nextFitImportMenuRef.current?.removeAttribute("open");
                        setSuccess(undefined);
                        setReceiptsImportOpen(true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span className="block font-black text-slate-900">Recebimentos</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Entradas realizadas no Fluxo de Caixa</span>
                    </button>
                  </div>
            </details>
            <ButtonLink href="/gestao/financeiro/cadastros" variant="outline">
              Cadastros
            </ButtonLink>
            <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Novo lançamento
            </Button>
          </div>
        }
        description="Controle financeiro da Academia Saulo Fitness, Clínica SV e Personal."
        eyebrow="Centro de Gestão SV"
        title="Financeiro"
      />

      <nav aria-label="Selecionar unidade" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {([
          ["ALL", "Consolidado"],
          ["ACADEMIA", "Academia"],
          ["CLINICA", "Clínica"],
          ["PERSONAL", "Personal"],
        ] as const).map(([value, label]) => (
          <Link
            aria-current={filters.unit === value ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-black transition ${
              filters.unit === value
                ? "bg-[#12664f] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            href={viewHref(value, filters)}
            key={value}
          >
            {label}
          </Link>
        ))}
      </nav>

      {filters.unit === "ACADEMIA" && managementView ? (
        <AcademyManagementPanel
          onViewFullDre={() => setDreImportOpen(true)}
          view={managementView}
        />
      ) : null}

      {filters.unit === "ACADEMIA" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Operacional · SAULO-AI
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-950">
            As seções a seguir usam entradas reais, despesas e retiradas registradas no SAULO-AI. O Painel Gerencial acima permanece uma fotografia independente da DRE NextFit.
          </p>
        </div>
      ) : null}

      {!catalogReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="status">
          <p className="font-black">Cadastros financeiros básicos ainda não configurados</p>
          <p className="mt-1 leading-6">
            Não existem categorias financeiras no banco. A consulta está disponível, mas novos lançamentos permanecerão bloqueados até o cadastro institucional ser aprovado.
          </p>
        </div>
      ) : null}

      {error && !entryDialogOpen && !receiptDialogOpen && !settlementEntry ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
          {success}
        </p>
      ) : null}

      <section aria-labelledby="month-summary-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Resumo do período</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="month-summary-title">
              Visão financeira
            </h2>
          </div>
          <p className="hidden text-xs font-semibold text-slate-500 sm:block">
            {formatDate(filters.periodStart)} a {formatDate(filters.periodEnd)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {summaryCards(summary, filters.unit === "ACADEMIA").map((card) => {
            const Icon = card.icon;
            return (
              <Card className="p-4" key={card.label}>
                <div className={`grid size-9 place-items-center rounded-xl ${card.tone}`}>
                  <Icon aria-hidden="true" className="size-[18px]" />
                </div>
                <p className="mt-4 text-xs font-bold text-slate-500">{card.label}</p>
                <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                  {formatMoney(card.value)}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Movimentação realizada</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Fluxo de Caixa</h2>
            <p className="mt-1 text-sm text-slate-600">Entradas e saídas derivadas das liquidações reais.</p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" method="get">
            <input name="unit" type="hidden" value={filters.unit} />
            <Input aria-label="Início do período" defaultValue={filters.periodStart} name="from" type="date" />
            <Input aria-label="Fim do período" defaultValue={filters.periodEnd} name="to" type="date" />
            <Button type="submit" variant="outline">Aplicar</Button>
          </form>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-700">Entradas realizadas</p>
            <p className="mt-2 text-2xl font-black text-emerald-950">{formatMoney(summary.totalReceived)}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4">
            <p className="text-xs font-bold text-rose-700">Saídas realizadas</p>
            <p className="mt-2 text-2xl font-black text-rose-950">{formatMoney(summary.totalPaid)}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-xs font-bold text-slate-600">Saldo</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{formatMoney(summary.realizedBalance)}</p>
          </div>
          {filters.unit === "ACADEMIA" ? (
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-xs font-bold text-violet-700">Retiradas do proprietário</p>
              <p className="mt-2 text-2xl font-black text-violet-950">{formatMoney(summary.ownerWithdrawalPaid)}</p>
              <p className="mt-1 text-xs font-semibold text-violet-700">Saída de caixa não operacional</p>
            </div>
          ) : null}
        </div>
        {filters.unit === "ACADEMIA" ? (
          <section aria-labelledby="account-balances-title" className="mt-5 border-t border-slate-200 pt-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Saldos por conta</p>
              <h3 className="mt-1 text-base font-black text-slate-950" id="account-balances-title">Saldo realizado no SAULO-AI</h3>
              <p className="mt-1 text-xs text-slate-500">Calculado somente pelas liquidações registradas ou importadas; não representa conciliação com o saldo oficial dos bancos.</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {academyAccountBalanceCards(summary).map((account) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4" key={account.code}>
                  <p className="text-sm font-black text-slate-900">{account.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Saldo realizado</p>
                  <p className="mt-2 text-xl font-black tabular-nums text-slate-950">{formatMoney(account.balance)}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-950">Total disponível</p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">Soma das três contas</p>
                <p className="mt-2 text-xl font-black tabular-nums text-emerald-950">{formatMoney(summary.totalAvailable)}</p>
              </div>
            </div>
          </section>
        ) : null}
      </Card>

      {filters.unit === "ACADEMIA" ? (
        <section aria-labelledby="accounts-payable-title">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Agenda financeira</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="accounts-payable-title">Contas a Pagar</h2>
            <p className="mt-1 text-sm text-slate-600">Despesas operacionais ainda não totalmente liquidadas, ordenadas pelo vencimento.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Vencidas", value: accountsPayableAgenda.totals.overdue, tone: "border-rose-200 bg-rose-50 text-rose-950" },
              { label: "Vencem hoje", value: accountsPayableAgenda.totals.today, tone: "border-amber-200 bg-amber-50 text-amber-950" },
              { label: "Próximos 7 dias", value: accountsPayableAgenda.totals.next7Days, tone: "border-sky-200 bg-sky-50 text-sky-950" },
              { label: "Próximos 30 dias", value: accountsPayableAgenda.totals.next30Days, tone: "border-slate-200 bg-slate-50 text-slate-950" },
            ].map((item) => (
              <div className={`rounded-2xl border p-4 ${item.tone}`} key={item.label}>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="mt-2 text-xl font-black tabular-nums">{formatMoney(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            {accountsPayableAgenda.pending.length ? (
              <div className="space-y-3">
                {accountsPayableTable(
                  accountsPayableAgenda.pending.slice(0, 6),
                  "Próximas contas a pagar",
                )}
                {accountsPayableAgenda.pending.length > 6 ? (
                  <details className="rounded-xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-black text-emerald-800">
                      Ver mais {accountsPayableAgenda.pending.length - 6} pendência(s)
                    </summary>
                    <div className="mt-3">
                      {accountsPayableTable(
                        accountsPayableAgenda.pending.slice(6),
                        "Demais contas a pagar",
                      )}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                <p className="text-sm font-black text-slate-900">Nenhuma conta operacional pendente</p>
                <p className="mt-1 text-xs text-slate-500">Lançamentos pagos e retiradas do proprietário não aparecem nesta agenda.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="accounts-receivable-title">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Agenda financeira</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="accounts-receivable-title">Contas a Receber</h2>
          <p className="mt-1 text-sm text-slate-600">Receitas do controle financeiro ainda não totalmente liquidadas, ordenadas pelo vencimento.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Vencidas", bucket: accountsReceivableAgenda.buckets.overdue, tone: "border-rose-200 bg-rose-50 text-rose-950" },
            { label: "Vencem hoje", bucket: accountsReceivableAgenda.buckets.today, tone: "border-amber-200 bg-amber-50 text-amber-950" },
            { label: "Próximos 7 dias", bucket: accountsReceivableAgenda.buckets.next7Days, tone: "border-sky-200 bg-sky-50 text-sky-950" },
            { label: "Próximos 30 dias", bucket: accountsReceivableAgenda.buckets.next30Days, tone: "border-slate-200 bg-slate-50 text-slate-950" },
          ].map((item) => (
            <div className={`rounded-2xl border p-4 ${item.tone}`} key={item.label}>
              <p className="text-xs font-bold">{item.label}</p>
              <p className="mt-1 text-xs font-semibold">{item.bucket.count} pendência(s)</p>
              <p className="mt-2 text-xl font-black tabular-nums">{formatMoney(item.bucket.amount)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          {accountsReceivableAgenda.pending.length ? (
            <div className="space-y-3">
              {accountsReceivableTable(
                accountsReceivableAgenda.pending.slice(0, 6),
                "Próximas contas a receber",
              )}
              {accountsReceivableAgenda.pending.length > 6 ? (
                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-black text-emerald-800">
                    Ver mais {accountsReceivableAgenda.pending.length - 6} pendência(s)
                  </summary>
                  <div className="mt-3">
                    {accountsReceivableTable(
                      accountsReceivableAgenda.pending.slice(6),
                      "Demais contas a receber",
                    )}
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
              <p className="text-sm font-black text-slate-900">Nenhuma receita pendente</p>
              <p className="mt-1 text-xs text-slate-500">
                {filters.unit === "ACADEMIA"
                  ? "Recebimentos da Academia vêm do NEXTFIT_RECEIPTS e já entram realizados, sem gerar contas a receber manuais."
                  : "Receitas totalmente recebidas não aparecem nesta agenda."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="entries-title">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Operação diária</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="entries-title">Lançamentos</h2>
          </div>
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <input name="unit" type="hidden" value={filters.unit} />
            <input name="from" type="hidden" value={filters.periodStart} />
            <input name="to" type="hidden" value={filters.periodEnd} />
            <Select aria-label="Tipo" defaultValue={filters.type ?? ""} name="type">
              <option value="">Receitas e despesas</option>
              <option value="REVENUE">Receita</option>
              <option value="EXPENSE">Despesa</option>
            </Select>
            <Select aria-label="Categoria" defaultValue={filters.categoryId ?? ""} name="category">
              <option value="">Todas as categorias</option>
              {catalog.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            <Select aria-label="Situação" defaultValue={filters.status ?? ""} name="status">
              <option value="">Todas as situações</option>
              <option value="PENDING">Em aberto</option>
              <option value="PARTIALLY_SETTLED">Parcial</option>
              <option value="SETTLED">Pago/Recebido</option>
              <option value="CANCELLED">Cancelado</option>
            </Select>
            <Button type="submit" variant="outline">Filtrar</Button>
          </form>
        </div>

        {entries.length === 0 ? (
          <PageState
            action={<Button onClick={openCreate} variant="outline">Novo lançamento</Button>}
            description="Nenhum lançamento corresponde aos filtros selecionados."
            title="Nenhum lançamento no período"
          />
        ) : (
          <TableRegion label="Lançamentos financeiros">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Vencimento</TableHeaderCell>
                  <TableHeaderCell>Descrição</TableHeaderCell>
                  <TableHeaderCell>Unidade</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell className="text-right">Valor</TableHeaderCell>
                  <TableHeaderCell className="text-right">Pago/Recebido</TableHeaderCell>
                  <TableHeaderCell className="text-right">Saldo</TableHeaderCell>
                  <TableHeaderCell>Situação</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {entries.map((entry) => {
                  const status = statusPresentation(entry);
                  const ownerWithdrawal =
                    entry.financialCategory.code ===
                    ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE;
                  const canSettle =
                    entry.managementNature === "REALIZED" &&
                    (entry.businessUnit.code === "CLINICA" ||
                      entry.businessUnit.code === "PERSONAL" ||
                      (entry.businessUnit.code === "ACADEMIA" &&
                        entry.type === "EXPENSE" &&
                        entry.sourceSystem === "GESTAO_SV" &&
                        entry.origin === "MANUAL")) &&
                    entry.status !== "CANCELLED" &&
                    entry.status !== "SETTLED";
                  const canCancel = entry.status === "PENDING" && entry.settlements.length === 0;
                  return (
                    <tr key={entry.id}>
                      <TableCell className="whitespace-nowrap font-semibold">{formatDate(entry.dueDate)}</TableCell>
                      <TableCell className="min-w-56">
                        <p className="font-black text-slate-900">{entry.description}</p>
                        {entry.observation ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{entry.observation}</p> : null}
                      </TableCell>
                      <TableCell>
                        <p>{entry.businessUnit.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.managementNature === "PLANNED"
                            ? "Planejado"
                            : entry.managementNature === "FORECAST"
                              ? "Previsto"
                              : "Realizado"}
                          {" · "}
                          {entry.sourceSystem === "NEXTFIT"
                            ? "NextFit"
                            : entry.sourceSystem === "CLINICA_SV"
                              ? "Clínica SV"
                              : "Gestão SV"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{entry.financialCategory.name}</p>
                        {ownerWithdrawal ? (
                          <p className="mt-1 text-xs font-bold text-violet-700">
                            Saída de caixa não operacional
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge tone={entry.type === "REVENUE" ? "success" : ownerWithdrawal ? "info" : "danger"}>
                          {entry.type === "REVENUE"
                            ? "Receita"
                            : ownerWithdrawal
                              ? "Retirada"
                              : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-bold">{formatMoney(entry.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{formatMoney(entry.settledAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-black">{formatMoney(entry.remainingAmount)}</TableCell>
                      <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex min-w-max justify-end gap-1">
                          {entry.sourceType !== "ACADEMIA_RECEBIMENTO_REAL" ? (
                            <button aria-label={`Editar ${entry.description}`} className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => openEdit(entry)} type="button">
                              <Pencil aria-hidden="true" className="size-4" />
                            </button>
                          ) : null}
                          {canSettle ? (
                            <button className="rounded-lg px-2.5 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50" onClick={() => { setError(undefined); setSettlementEntry(entry); }} type="button">
                              {entry.type === "REVENUE" ? "Receber" : "Pagar"}
                            </button>
                          ) : null}
                          {canCancel ? (
                            <button className="rounded-lg px-2.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-50" disabled={saving} onClick={() => cancelEntry(entry)} type="button">Cancelar</button>
                          ) : null}
                        </div>
                      </TableCell>
                    </tr>
                  );
                })}
              </TableBody>
            </Table>
          </TableRegion>
        )}
      </section>

      {entryDialogOpen ? (
        <DialogShell eyebrow="Financeiro" onClose={() => !saving && setEntryDialogOpen(false)} title={editingEntry ? "Editar lançamento" : "Novo lançamento"}>
          <form className="space-y-5 p-5 sm:p-6" onSubmit={saveEntry}>
            {!catalogReady ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
                Cadastre ao menos uma categoria financeira antes de salvar lançamentos.
              </p>
            ) : null}
            {isAcademyEntry ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950" role="status">
                <p className="font-black">Operacional SAULO-AI</p>
                <p className="mt-1 leading-6">
                  Registre despesas, retiradas e receitas próprias da Clínica SV ou Personal. Os recebimentos da Academia continuam sendo importados da fonte oficial NextFit, evitando lançamentos duplicados.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="entry-unit" label="Unidade" required>
                <Select className="mt-1.5" id="entry-unit" onChange={(event) => { const unitId = event.target.value; const unit = catalog.businessUnits.find((item) => item.id === unitId); setEntryForm((current) => ({ ...current, unitId, type: unit?.code === "ACADEMIA" ? "EXPENSE" : current.type, managementNature: "REALIZED", categoryId: "", costCenterId: "", financialAccountId: "" })); setEntrySettlementForm((current) => ({ ...current, financialAccountId: "" })); }} required value={entryForm.unitId}>
                  <option value="">Selecione</option>
                  {catalog.businessUnits.filter((unit) => unit.status === "ACTIVE").map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </Select>
              </FormField>
              <FormField id="entry-type" label="Tipo" required>
                {isAcademyEntry ? (
                  <Select
                    className="mt-1.5"
                    id="entry-type"
                    onChange={(event) =>
                      setEntryForm((current) => ({
                        ...current,
                        type: "EXPENSE",
                        categoryId:
                          event.target.value === "OWNER_WITHDRAWAL"
                            ? academyOwnerWithdrawalCategory?.id ?? ""
                            : "",
                      }))
                    }
                    value={isOwnerWithdrawal ? "OWNER_WITHDRAWAL" : "EXPENSE"}
                  >
                    <option value="EXPENSE">Despesa</option>
                    <option
                      disabled={!academyOwnerWithdrawalCategory}
                      value="OWNER_WITHDRAWAL"
                    >
                      Retirada do proprietário
                    </option>
                  </Select>
                ) : (
                  <Select className="mt-1.5" id="entry-type" onChange={(event) => setEntryForm((current) => ({ ...current, type: event.target.value as FinancialEntryType, categoryId: "" }))} value={entryForm.type}>
                    <option value="REVENUE">Receita</option>
                    <option value="EXPENSE">Despesa</option>
                  </Select>
                )}
              </FormField>
              <FormField id="entry-nature" label="Natureza gerencial" required>
                {isAcademyEntry ? (
                  <Input className="mt-1.5" id="entry-nature" readOnly value="Realizado" />
                ) : (
                  <Select className="mt-1.5" id="entry-nature" onChange={(event) => setEntryForm((current) => ({ ...current, managementNature: event.target.value as FinancialManagementNature }))} value={entryForm.managementNature}>
                    <option value="PLANNED">Planejado</option>
                    <option value="FORECAST">Previsto</option>
                    <option value="REALIZED">Realizado</option>
                  </Select>
                )}
              </FormField>
              {isOwnerWithdrawal ? (
                <FormField id="entry-category" label="Classificação institucional">
                  <Input className="mt-1.5" id="entry-category" readOnly value="Retirada do proprietário — não operacional" />
                </FormField>
              ) : (
                <FormField id="entry-category" label="Categoria" required>
                  <Select className="mt-1.5" id="entry-category" onChange={(event) => setEntryForm((current) => ({ ...current, categoryId: event.target.value }))} required value={entryForm.categoryId}>
                    <option value="">Selecione</option>
                    {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </Select>
                </FormField>
              )}
              <FormField className="sm:col-span-2" id="entry-description" label="Descrição" required>
                <Input className="mt-1.5" id="entry-description" maxLength={300} onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))} required value={entryForm.description} />
              </FormField>
              <FormField className="sm:col-span-2" id="entry-observation" label="Observação">
                <Textarea id="entry-observation" maxLength={4000} onChange={(event) => setEntryForm((current) => ({ ...current, observation: event.target.value }))} value={entryForm.observation} />
              </FormField>
              <FormField id="entry-competence" label="Competência" required>
                <Input className="mt-1.5" id="entry-competence" onChange={(event) => setEntryForm((current) => ({ ...current, competence: event.target.value }))} required type="date" value={entryForm.competence} />
              </FormField>
              <FormField id="entry-due-date" label="Vencimento" required>
                <Input className="mt-1.5" id="entry-due-date" onChange={(event) => setEntryForm((current) => ({ ...current, dueDate: event.target.value }))} required type="date" value={entryForm.dueDate} />
              </FormField>
              <FormField id="entry-amount" label="Valor" required>
                <CurrencyInput className="mt-1.5" id="entry-amount" min="0.01" onValueChange={(amount) => setEntryForm((current) => ({ ...current, amount }))} required value={entryForm.amount} />
              </FormField>
              <div />
              <FormField
                id="entry-account"
                label="Conta financeira prevista"
              >
                <Select className="mt-1.5" id="entry-account" onChange={(event) => setEntryForm((current) => ({ ...current, financialAccountId: event.target.value }))} value={entryForm.financialAccountId}>
                  <option value="">
                    {isAcademyEntry
                      ? "Definir ao pagar"
                      : "Definir na liquidação"}
                  </option>
                  {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </Select>
              </FormField>
              <FormField
                id="entry-payment-method"
                label="Forma de pagamento prevista"
              >
                <Select className="mt-1.5" id="entry-payment-method" onChange={(event) => setEntryForm((current) => ({ ...current, paymentMethodId: event.target.value }))} value={entryForm.paymentMethodId}>
                  <option value="">
                    {isAcademyEntry
                      ? "Definir ao pagar"
                      : "Definir na liquidação"}
                  </option>
                  {activePaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </Select>
              </FormField>
              <p className="text-xs font-semibold leading-5 text-slate-500 sm:col-span-2">
                Conta e forma previstas não movimentam caixa por si só; ao pagar agora, serão usadas automaticamente na liquidação.
              </p>
            </div>
            {!editingEntry && entrySettlementOpen ? (
              <section aria-labelledby="entry-settlement-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
                <div>
                  <h3 className="font-black text-emerald-950" id="entry-settlement-title">{entrySettlementEditing ? "Alterar dados do pagamento" : "Complete os dados do pagamento"}</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">{entrySettlementEditing ? "Ajuste somente o que for diferente dos dados previstos no lançamento." : "Valor, data e dados já informados serão herdados automaticamente."}</p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {paymentFields.settlementDate ? <FormField id="entry-settlement-date" label="Data do pagamento" required><Input className="mt-1.5" id="entry-settlement-date" onChange={(event) => setEntrySettlementForm((current) => ({ ...current, settlementDate: event.target.value }))} required type="date" value={entrySettlementForm.settlementDate} /></FormField> : null}
                  {paymentFields.amount ? <FormField id="entry-settlement-amount" label="Valor pago" required><CurrencyInput className="mt-1.5" id="entry-settlement-amount" max={entryForm.amount || undefined} min="0.01" onValueChange={(amount) => setEntrySettlementForm((current) => ({ ...current, amount }))} required value={entrySettlementForm.amount} /></FormField> : null}
                  {paymentFields.financialAccount ? <FormField id="entry-settlement-account" label="Conta utilizada no pagamento" required><Select className="mt-1.5" id="entry-settlement-account" onChange={(event) => setEntrySettlementForm((current) => ({ ...current, financialAccountId: event.target.value }))} required value={entrySettlementForm.financialAccountId}><option value="">Selecione</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></FormField> : null}
                  {paymentFields.paymentMethod ? <FormField id="entry-settlement-method" label="Forma de pagamento" required><Select className="mt-1.5" id="entry-settlement-method" onChange={(event) => setEntrySettlementForm((current) => ({ ...current, paymentMethodId: event.target.value }))} required value={entrySettlementForm.paymentMethodId}><option value="">Selecione</option>{activePaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></FormField> : null}
                  {paymentFields.observation ? <FormField className="sm:col-span-2" id="entry-settlement-observation" label="Observação do pagamento"><Textarea id="entry-settlement-observation" maxLength={4000} onChange={(event) => setEntrySettlementForm((current) => ({ ...current, observation: event.target.value }))} value={entrySettlementForm.observation} /></FormField> : null}
                </div>
              </section>
            ) : null}
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button disabled={saving} onClick={() => setEntryDialogOpen(false)} type="button" variant="outline">Voltar</Button>
              {editingEntry ? (
                <Button disabled={saving || !catalogReady || (!isOwnerWithdrawal && activeCategories.length === 0)} loading={saving} type="submit">Salvar lançamento</Button>
              ) : (
                <>
                  <Button data-save-mode="open" disabled={saving || !catalogReady || (!isOwnerWithdrawal && activeCategories.length === 0)} formNoValidate={entrySettlementOpen} loading={saving && !entrySettlementOpen} type="submit" variant="outline">Salvar em aberto</Button>
                  <button className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" disabled={saving} onClick={() => openEntrySettlement(true)} type="button">Alterar dados do pagamento</button>
                  {entrySettlementOpen ? (
                    <Button data-save-mode="settle" disabled={saving || !catalogReady || entryForm.managementNature !== "REALIZED" || activeAccounts.length === 0 || activePaymentMethods.length === 0 || (!isOwnerWithdrawal && activeCategories.length === 0)} loading={saving} type="submit"><Banknote aria-hidden="true" className="size-4" />Salvar e pagar agora</Button>
                  ) : hasCompletePlannedPayment ? (
                    <Button data-save-mode="settle" disabled={saving || !catalogReady || entryForm.managementNature !== "REALIZED" || (!isOwnerWithdrawal && activeCategories.length === 0)} loading={saving} type="submit"><Banknote aria-hidden="true" className="size-4" />Salvar e pagar agora</Button>
                  ) : (
                    <Button disabled={saving || !catalogReady || entryForm.managementNature !== "REALIZED" || (!isOwnerWithdrawal && activeCategories.length === 0)} onClick={() => openEntrySettlement(false)} type="button"><Banknote aria-hidden="true" className="size-4" />Salvar e pagar agora</Button>
                  )}
                </>
              )}
            </div>
          </form>
        </DialogShell>
      ) : null}

      <NextFitDreImportDialog
        onClose={() => setDreImportOpen(false)}
        open={dreImportOpen}
      />

      <NextFitReceiptsImportDialog
        onClose={() => setReceiptsImportOpen(false)}
        onConfirmed={() => {
          setReceiptsImportOpen(false);
          setSuccess("Recebimentos importados com sucesso.");
          router.refresh();
        }}
        open={receiptsImportOpen}
      />

      {receiptDialogOpen ? (
        <DialogShell eyebrow="Fluxo de Caixa" onClose={() => !saving && setReceiptDialogOpen(false)} title="Registrar entrada real da Academia">
          <form className="space-y-5 p-5 sm:p-6" onSubmit={saveAcademyReceipt}>
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950" role="status">
              Este recebimento movimenta somente o financeiro operacional. A DRE NextFit permanece inalterada.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="receipt-date" label="Data do recebimento" required><Input className="mt-1.5" defaultValue={today()} id="receipt-date" name="receiptDate" required type="date" /></FormField>
              <FormField id="receipt-amount" label="Valor recebido" required><CurrencyInput className="mt-1.5" id="receipt-amount" min="0.01" name="amount" required /></FormField>
              <FormField id="receipt-method" label="Forma de recebimento" required><Select className="mt-1.5" id="receipt-method" name="paymentMethodId" onChange={(event) => setReceiptMethodId(event.target.value)} required value={receiptMethodId}><option value="">Selecione</option>{academyReceiptMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></FormField>
              <FormField id="receipt-account" label="Conta financeira de destino" required><Input className="mt-1.5" id="receipt-account" readOnly value={receiptAccount?.name ?? "Definida pela forma de recebimento"} /></FormField>
              <FormField className="sm:col-span-2" id="receipt-description" label="Descrição" required><Input className="mt-1.5" id="receipt-description" maxLength={300} name="description" placeholder="Ex.: Recebimentos da Academia — 13/08/2026" required /></FormField>
              <FormField className="sm:col-span-2" id="receipt-reference" label="Referência/observação"><Textarea id="receipt-reference" maxLength={4000} name="reference" /></FormField>
            </div>
            {receiptMethod && !receiptAccount ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">A conta institucional correspondente não está ativa. Revise os Cadastros financeiros.</p> : null}
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button disabled={saving} onClick={() => setReceiptDialogOpen(false)} type="button" variant="outline">Voltar</Button>
              <Button disabled={saving || !receiptAccount || !receiptMethod} loading={saving} type="submit">Confirmar entrada realizada</Button>
            </div>
          </form>
        </DialogShell>
      ) : null}

      {settlementEntry ? (
        <DialogShell eyebrow={settlementEntry.type === "REVENUE" ? "Recebimento" : "Pagamento"} onClose={() => !saving && setSettlementEntry(undefined)} title={settlementEntry.type === "REVENUE" ? "Registrar recebimento" : "Registrar pagamento"}>
          <form className="space-y-5 p-5 sm:p-6" onSubmit={saveSettlement}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Valor original</p><p className="mt-1 font-black text-slate-950">{formatMoney(settlementEntry.amount)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Já liquidado</p><p className="mt-1 font-black text-slate-950">{formatMoney(settlementEntry.settledAmount)}</p></div>
              <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Saldo restante</p><p className="mt-1 font-black text-emerald-950">{formatMoney(settlementEntry.remainingAmount)}</p></div>
            </div>
            {settlementAccounts.length === 0 || activePaymentMethods.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">Cadastre uma conta financeira e uma forma de pagamento antes de liquidar.</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="settlement-amount" label="Valor" required><CurrencyInput className="mt-1.5" defaultValue={settlementEntry.remainingAmount} id="settlement-amount" max={settlementEntry.remainingAmount} min="0.01" name="amount" required /></FormField>
              <FormField id="settlement-date" label="Data" required><Input className="mt-1.5" defaultValue={today()} id="settlement-date" name="settlementDate" required type="date" /></FormField>
              <FormField id="settlement-account" label={settlementEntry.type === "REVENUE" ? "Conta utilizada no recebimento" : "Conta utilizada no pagamento"} required><Select className="mt-1.5" id="settlement-account" name="financialAccountId" required><option value="">Selecione</option>{settlementAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></FormField>
              <FormField id="settlement-method" label="Forma de pagamento" required><Select className="mt-1.5" id="settlement-method" name="paymentMethodId" required><option value="">Selecione</option>{activePaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></FormField>
              <FormField className="sm:col-span-2" id="settlement-observation" label="Observação"><Textarea id="settlement-observation" maxLength={4000} name="observation" /></FormField>
            </div>
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button disabled={saving} onClick={() => setSettlementEntry(undefined)} type="button" variant="outline">Voltar</Button>
              <Button disabled={saving || activePaymentMethods.length === 0 || settlementAccounts.length === 0} loading={saving} type="submit"><Banknote aria-hidden="true" className="size-4" />Confirmar</Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </div>
  );
}

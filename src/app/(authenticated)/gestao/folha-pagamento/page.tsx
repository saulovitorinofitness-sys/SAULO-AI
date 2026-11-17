"use client";

import {
  Building2,
  Calculator,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  LoaderCircle,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { SalaryPaymentConfirmation } from "@/components/financial/salary-payment-confirmation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeading,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";

interface BusinessUnitOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: string;
}

interface JobRoleOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
}

interface EmployeeOption {
  readonly id: string;
  readonly fullName: string;
  readonly status: string;
  readonly personalData?: {
    readonly hasCpf: boolean;
    readonly birthDate: string | null;
    readonly hasIdentityDocument: boolean;
    readonly identityIssuer: string | null;
    readonly identityState: string | null;
    readonly hasSocialSecurityNumber: boolean;
    readonly phone: string | null;
    readonly email: string | null;
    readonly postalCode: string | null;
    readonly addressStreet: string | null;
    readonly addressNumber: string | null;
    readonly addressComplement: string | null;
    readonly addressNeighborhood: string | null;
    readonly addressCity: string | null;
    readonly addressState: string | null;
    readonly paymentMethod: string | null;
    readonly hasPaymentDetails: boolean;
  };
  readonly employments: readonly {
    readonly id: string;
    readonly code: string;
    readonly status: string;
    readonly workSchedule: "FULL_TIME" | "PART_TIME" | "HOURLY" | "CUSTOM";
    readonly weeklyWorkingHours: string | null;
    readonly compensations: readonly {
      readonly id: string;
      readonly amount: string;
      readonly unit: "MONTHLY" | "HOURLY" | "PER_SERVICE";
      readonly effectiveFrom: string;
      readonly effectiveTo: string | null;
    }[];
    readonly updatedAt: string;
    readonly jobRole: { readonly id: string; readonly name: string };
  }[];
}

interface PayrollPeriodOption {
  readonly id: string;
  readonly businessUnitId: string;
  readonly competence: string;
  readonly status: string;
}

interface ServiceReceiptOption {
  readonly id: string;
  readonly receiptNumber: string;
}

interface PayrollStatementSummary {
  readonly id: string;
  readonly businessUnitId: string;
  readonly payrollPeriodId: string;
  readonly competence: string;
  readonly status: string;
  readonly calculationVersion: number;
  readonly employee: { readonly id: string; readonly fullName: string };
  readonly employment: { readonly id: string; readonly code: string; readonly jobRole: string };
  readonly totals: {
    readonly gross: string;
    readonly benefits: string;
    readonly deductions: string;
    readonly adjustments: string;
    readonly net: string;
  };
  readonly updatedAt: string;
}

interface PayrollReceiptSummary {
  readonly id: string;
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly receiptNumber: string;
  readonly version: number;
  readonly status: string;
  readonly issuedAt: string | null;
  readonly voidedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface StatementAdjustment {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly amount: string;
  readonly reason: string;
  readonly sourcePayrollStatementId: string;
  readonly appliedPayrollStatementId: string | null;
  readonly createdAt: string;
  readonly appliedAt: string | null;
  readonly cancelledAt: string | null;
}

interface StatementDetails {
  readonly id: string;
  readonly businessUnitId: string;
  readonly competence: string;
  readonly status: string;
  readonly calculationVersion: number;
  readonly employee: { readonly id: string; readonly fullName: string };
  readonly employment: { readonly id: string; readonly code: string; readonly jobRole: string };
  readonly items: readonly {
    readonly code: string;
    readonly description: string;
    readonly type: string;
    readonly origin: string;
    readonly quantity: string | null;
    readonly unitAmount: string | null;
    readonly amount: string;
    readonly affectsNet: boolean;
  }[];
  readonly totals: PayrollStatementSummary["totals"];
  readonly adjustments: {
    readonly source: readonly StatementAdjustment[];
    readonly applied: readonly StatementAdjustment[];
  };
  readonly receipts: readonly PayrollReceiptSummary[];
}

type LoadState = "idle" | "loading" | "success" | "error";
type ActionState = "idle" | "submitting" | "success" | "error";
type MonthlyAction = "prepare" | "calculate" | "close";
type UnitLoadState = "loading" | "success" | "empty" | "forbidden" | "error";
type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];
interface JsonObject { readonly [key: string]: JsonValue }

type PayrollAction =
  | "create-job-role"
  | "register-employee"
  | "update-employee-personal-data"
  | "terminate-employment"
  | "delete-employee"
  | "create-employment"
  | "update-employment"
  | "add-compensation"
  | "open-period"
  | "create-statement"
  | "add-line-item"
  | "create-adjustment"
  | "apply-adjustment"
  | "calculate-statement"
  | "calculate-period"
  | "close-period"
  | "issue-service-receipt";

const operations: readonly { value: PayrollAction; label: string; group: string }[] = [
  { value: "create-job-role", label: "Cadastrar cargo ou função", group: "Pessoas" },
  { value: "register-employee", label: "Cadastrar funcionário e vínculo", group: "Pessoas" },
  { value: "update-employee-personal-data", label: "Dados pessoais do funcionário", group: "Pessoas" },
  { value: "terminate-employment", label: "Encerrar vínculo de funcionário", group: "Pessoas" },
  { value: "delete-employee", label: "Excluir cadastro de teste/erro", group: "Pessoas" },
  { value: "create-employment", label: "Criar vínculo para funcionário existente", group: "Pessoas" },
  { value: "update-employment", label: "Atualizar vínculo existente", group: "Pessoas" },
  { value: "add-compensation", label: "Registrar nova remuneração", group: "Pessoas" },
  { value: "open-period", label: "Abrir competência mensal", group: "Folha" },
  { value: "create-statement", label: "Criar demonstrativo", group: "Folha" },
  { value: "add-line-item", label: "Adicionar provento, benefício, abono ou desconto", group: "Folha" },
  { value: "create-adjustment", label: "Criar ajuste auditável", group: "Ajustes" },
  { value: "apply-adjustment", label: "Aplicar ajuste em demonstrativo", group: "Ajustes" },
  { value: "calculate-statement", label: "Calcular demonstrativo", group: "Processamento" },
  { value: "calculate-period", label: "Calcular competência", group: "Processamento" },
  { value: "close-period", label: "Fechar competência", group: "Processamento" },
  { value: "issue-service-receipt", label: "Emitir recibo de serviço prestado", group: "Recibos" },
];

const inputClasses = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const confirmationActions = new Set<PayrollAction>([
  "terminate-employment",
  "delete-employee",
  "calculate-statement",
  "calculate-period",
  "close-period",
  "issue-service-receipt",
]);

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? currency.format(parsed) : value;
}

function monthLabel(value: string) {
  const parsed = new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? monthFormatter.format(parsed) : value;
}

function statusLabel(status: string) {
  const labels: Readonly<Record<string, string>> = {
    DRAFT: "Em elaboração",
    OPEN: "Aberta",
    CALCULATED: "Calculada",
    CLOSED: "Fechada",
    VOIDED: "Cancelada",
    ISSUED: "Emitido",
    PENDING: "Pendente",
    APPLIED: "Aplicado",
  };
  return labels[status] ?? status;
}

function statusClasses(status: string) {
  if (status === "CLOSED" || status === "ISSUED" || status === "APPLIED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "CALCULATED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "VOIDED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function itemTypeLabel(type: string) {
  if (type === "EARNING") return "Provento";
  if (type === "BENEFIT") return "Benefício";
  if (type === "DEDUCTION") return "Desconto";
  return type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusinessUnitOption(value: unknown): value is BusinessUnitOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.code === "string"
    && typeof value.status === "string";
}

function isJobRoleOption(value: unknown): value is JobRoleOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.code === "string"
    && typeof value.name === "string"
    && typeof value.status === "string";
}

function isEmployeeOption(value: unknown): value is EmployeeOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.fullName === "string"
    && typeof value.status === "string"
    && Array.isArray(value.employments)
    && value.employments.every((employment) => (
      isRecord(employment)
      && typeof employment.id === "string"
      && typeof employment.code === "string"
      && typeof employment.status === "string"
      && typeof employment.workSchedule === "string"
      && (employment.weeklyWorkingHours === null || typeof employment.weeklyWorkingHours === "string")
      && Array.isArray(employment.compensations)
      && typeof employment.updatedAt === "string"
      && isRecord(employment.jobRole)
      && typeof employment.jobRole.name === "string"
    ));
}

function isPayrollPeriodOption(value: unknown): value is PayrollPeriodOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.businessUnitId === "string"
    && typeof value.competence === "string"
    && typeof value.status === "string";
}

function isServiceReceiptOption(value: unknown): value is ServiceReceiptOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.receiptNumber === "string";
}

function nextServiceReceiptNumber(receipts: readonly ServiceReceiptOption[]) {
  const largestNumber = receipts.reduce((largest, receipt) => {
    const match = /^SERV-(\d+)$/i.exec(receipt.receiptNumber.trim());
    if (!match) return largest;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(largest, value) : largest;
  }, 0);
  return `SERV-${String(largestNumber + 1).padStart(4, "0")}`;
}

function nextEmploymentCode(employees: readonly EmployeeOption[]) {
  const largestNumber = employees
    .flatMap((employee) => employee.employments)
    .reduce((largest, employment) => {
      const match = /^MAT-(\d+)$/i.exec(employment.code.trim());
      if (!match) return largest;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(largest, value) : largest;
    }, 0);
  return `MAT-${String(largestNumber + 1).padStart(3, "0")}`;
}

async function responsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function payloadMessage(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.message === "string" ? payload.message : fallback;
}

function nestedId(payload: unknown, key: string) {
  if (!isRecord(payload) || !isRecord(payload[key])) return null;
  const id = payload[key].id;
  return typeof id === "string" ? id : null;
}

function calculationCounts(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.calculation)) return null;
  const { calculated, alreadyCalculated, untouched, pending } = payload.calculation;
  if (![calculated, alreadyCalculated, untouched, pending].every((value) => typeof value === "number")) return null;
  return {
    calculated: calculated as number,
    alreadyCalculated: alreadyCalculated as number,
    untouched: untouched as number,
    pending: pending as number,
  };
}

function closureCounts(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.closure)) return null;
  const { closed, alreadyClosed, pending } = payload.closure;
  if (![closed, alreadyClosed, pending].every((value) => typeof value === "number")) return null;
  return { closed: closed as number, alreadyClosed: alreadyClosed as number, pending: pending as number };
}

function formText(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`Preencha o campo ${name}.`);
  return value.trim();
}

function optionalFormText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function monthDate(value: string) {
  return `${value}-01`;
}

function localDateTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Informe uma data e hora válidas.");
  return parsed.toISOString();
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  placeholder,
  min,
  step,
  readOnly = false,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly min?: string;
  readonly step?: string;
  readonly readOnly?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        className={inputClasses}
        defaultValue={defaultValue}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        step={step}
        type={type}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  children,
  defaultValue,
}: {
  readonly label: string;
  readonly name: string;
  readonly children: ReactNode;
  readonly defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select className={inputClasses} defaultValue={defaultValue} name={name}>
        {children}
      </select>
    </label>
  );
}

function JobRoleField({
  jobRoles,
  loading,
  optional = false,
}: {
  readonly jobRoles: readonly JobRoleOption[];
  readonly loading: boolean;
  readonly optional?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {optional ? "Novo cargo/função (opcional)" : "Cargo/função"}
      <select className={inputClasses} name="jobRoleId" required={!optional}>
        <option value="">
          {loading
            ? "Carregando cargos..."
            : optional
              ? "Manter o cargo atual"
              : "Selecione um cargo"}
        </option>
        {jobRoles
          .filter((role) => role.status === "ACTIVE")
          .map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} · {role.code}
            </option>
          ))}
      </select>
    </label>
  );
}

function normalizedMoneyInput(value: string) {
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return "";
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : "";
}

function CurrencyField({
  label,
  name,
  required = true,
}: {
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState("");
  const normalizedValue = normalizedMoneyInput(displayValue);

  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        autoComplete="off"
        className={inputClasses}
        inputMode="decimal"
        onBlur={() => {
          if (normalizedValue) {
            setDisplayValue(currency.format(Number(normalizedValue)));
          }
        }}
        onChange={(event) => setDisplayValue(event.target.value)}
        onFocus={() => {
          if (normalizedValue) {
            setDisplayValue(normalizedValue.replace(".", ","));
          }
        }}
        placeholder="R$ 0,00"
        required={required}
        type="text"
        value={displayValue}
      />
      <input name={name} type="hidden" value={normalizedValue} />
    </label>
  );
}

function EmployeeField({ employees }: { readonly employees: readonly EmployeeOption[] }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      Funcionário
      <select className={inputClasses} name="employeeId" required>
        <option value="">Selecione um funcionário</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmployeePersonalDataFields({ employees }: { readonly employees: readonly EmployeeOption[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const employee = employees.find((candidate) => candidate.id === employeeId);
  const data = employee?.personalData;

  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
        Funcionário
        <select
          className={inputClasses}
          name="employeeId"
          onChange={(event) => setEmployeeId(event.target.value)}
          required
          value={employeeId}
        >
          <option value="">Selecione um funcionário</option>
          {employees.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.fullName}</option>
          ))}
        </select>
      </label>

      {employee ? (
        <div className="contents" key={employee.id}>
          <div className="md:col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            CPF, RG, PIS e dados bancários ficam protegidos e não aparecem novamente na tela.
            {data?.hasCpf ? " Este funcionário já possui CPF cadastrado; informe-o novamente somente para confirmar ou atualizar os dados." : ""}
          </div>
          <Field defaultValue={employee.fullName} label="Nome completo" name="fullName" />
          <Field label="CPF" name="cpf" placeholder="000.000.000-00" />
          <Field defaultValue={data?.birthDate?.slice(0, 10)} label="Data de nascimento" name="birthDate" type="date" />
          <Field label="RG" name="identityDocument" placeholder={data?.hasIdentityDocument ? "Já cadastrado — preencha para substituir" : "Número do RG"} required={false} />
          <Field defaultValue={data?.identityIssuer ?? undefined} label="Órgão emissor do RG" name="identityIssuer" required={false} />
          <Field defaultValue={data?.identityState ?? undefined} label="UF do RG" name="identityState" placeholder="CE" required={false} />
          <Field label="PIS/PASEP/NIT" name="socialSecurityNumber" placeholder={data?.hasSocialSecurityNumber ? "Já cadastrado — preencha para substituir" : "Número do PIS/PASEP/NIT"} required={false} />
          <Field defaultValue={data?.phone ?? undefined} label="Telefone" name="phone" required={false} />
          <Field defaultValue={data?.email ?? undefined} label="E-mail" name="email" required={false} type="email" />
          <Field defaultValue={data?.postalCode ?? undefined} label="CEP" name="postalCode" placeholder="00000-000" required={false} />
          <Field defaultValue={data?.addressStreet ?? undefined} label="Rua/Avenida" name="addressStreet" required={false} />
          <Field defaultValue={data?.addressNumber ?? undefined} label="Número" name="addressNumber" required={false} />
          <Field defaultValue={data?.addressComplement ?? undefined} label="Complemento" name="addressComplement" required={false} />
          <Field defaultValue={data?.addressNeighborhood ?? undefined} label="Bairro" name="addressNeighborhood" required={false} />
          <Field defaultValue={data?.addressCity ?? undefined} label="Cidade" name="addressCity" required={false} />
          <Field defaultValue={data?.addressState ?? undefined} label="Estado (UF)" name="addressState" placeholder="CE" required={false} />
          <SelectField defaultValue={data?.paymentMethod ?? ""} label="Forma de pagamento" name="paymentMethod">
            <option value="">Não informada</option>
            <option value="PIX">PIX</option>
            <option value="BANK_TRANSFER">Transferência bancária</option>
            <option value="CASH">Dinheiro</option>
            <option value="OTHER">Outra</option>
          </SelectField>
          <Field label="Chave PIX ou dados bancários" name="paymentDetails" placeholder={data?.hasPaymentDetails ? "Já cadastrado — preencha para substituir" : "Informe somente se necessário"} required={false} />
        </div>
      ) : null}
    </>
  );
}

function EmploymentTerminationFields({
  employees,
}: {
  readonly employees: readonly EmployeeOption[];
}) {
  const employments = employees.flatMap((employee) =>
    employee.employments
      .filter((employment) => employment.status === "ACTIVE")
      .map((employment) => ({ employee, employment })),
  );
  const [employmentId, setEmploymentId] = useState("");
  const selected = employments.find((item) => item.employment.id === employmentId);

  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Funcionário e vínculo ativo
        <select
          className={inputClasses}
          name="employmentId"
          onChange={(event) => setEmploymentId(event.target.value)}
          required
          value={employmentId}
        >
          <option value="">Selecione um vínculo</option>
          {employments.map(({ employee, employment }) => (
            <option key={employment.id} value={employment.id}>
              {employee.fullName} · {employment.jobRole.name} · {employment.code}
            </option>
          ))}
        </select>
      </label>
      <Field label="Data de encerramento" name="endedAt" type="date" />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={selected?.employment.updatedAt ?? ""}
      />
    </>
  );
}

function EmploymentScheduleFields() {
  return (
    <>
      <SelectField defaultValue="FULL_TIME" label="Jornada de trabalho" name="workSchedule">
        <option value="FULL_TIME">Integral</option>
        <option value="PART_TIME">Meio expediente</option>
        <option value="HOURLY">Por hora</option>
        <option value="CUSTOM">Personalizada</option>
      </SelectField>
      <Field label="Carga horária semanal (opcional)" min="0.01" name="weeklyWorkingHours" required={false} step="0.01" type="number" />
    </>
  );
}

function EmploymentUpdateFields({
  employees,
  jobRoles,
  jobRolesLoading,
}: {
  readonly employees: readonly EmployeeOption[];
  readonly jobRoles: readonly JobRoleOption[];
  readonly jobRolesLoading: boolean;
}) {
  const employments = employees.flatMap((employee) => employee.employments.map((employment) => ({ employee, employment })));
  const [employmentId, setEmploymentId] = useState("");
  const selected = employments.find((item) => item.employment.id === employmentId);
  const currentCompensation = selected?.employment.compensations[0];
  const [status, setStatus] = useState("ACTIVE");
  const [workSchedule, setWorkSchedule] = useState("FULL_TIME");
  const [weeklyWorkingHours, setWeeklyWorkingHours] = useState("");

  function selectEmployment(nextEmploymentId: string) {
    setEmploymentId(nextEmploymentId);
    const next = employments.find((item) => item.employment.id === nextEmploymentId);
    setStatus(next?.employment.status ?? "ACTIVE");
    setWorkSchedule(next?.employment.workSchedule ?? "FULL_TIME");
    setWeeklyWorkingHours(next?.employment.weeklyWorkingHours ?? "");
  }

  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
        Funcionário e vínculo
        <select className={inputClasses} name="employmentId" onChange={(event) => selectEmployment(event.target.value)} required value={employmentId}>
          <option value="">Selecione um funcionário</option>
          {employments.map(({ employee, employment }) => <option key={employment.id} value={employment.id}>{employee.fullName} · {employment.jobRole.name} · {employment.code}</option>)}
        </select>
      </label>
      <JobRoleField jobRoles={jobRoles} loading={jobRolesLoading} optional />
      <label className="grid gap-2 text-sm font-bold text-slate-700">Situação<select className={inputClasses} name="status" onChange={(event) => setStatus(event.target.value)} required value={status}><option value="ACTIVE">Ativo</option><option value="SUSPENDED">Suspenso</option></select></label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Jornada de trabalho<select className={inputClasses} name="workSchedule" onChange={(event) => setWorkSchedule(event.target.value)} required value={workSchedule}><option value="FULL_TIME">Integral</option><option value="PART_TIME">Meio expediente</option><option value="HOURLY">Por hora</option><option value="CUSTOM">Personalizada</option></select></label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Carga horária semanal (opcional)<input className={inputClasses} max="168" min="0.01" name="weeklyWorkingHours" onChange={(event) => setWeeklyWorkingHours(event.target.value)} step="0.01" type="number" value={weeklyWorkingHours} /></label>
      <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">Remuneração atual<input className={inputClasses} readOnly value={currentCompensation ? money(currentCompensation.amount) : "Não informada"} /></label>
      <input name="expectedUpdatedAt" type="hidden" value={selected?.employment.updatedAt ?? ""} />
    </>
  );
}

function ActiveEmploymentField({
  employees,
  label = "Funcionário e vínculo",
  required = true,
}: {
  readonly employees: readonly EmployeeOption[];
  readonly label?: string;
  readonly required?: boolean;
}) {
  const employments = employees.flatMap((employee) =>
    employee.employments
      .filter((employment) => employment.status === "ACTIVE")
      .map((employment) => ({ employee, employment })),
  );
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select className={inputClasses} name="employmentId" required={required}>
        <option value="">Selecione um funcionário</option>
        {employments.map(({ employee, employment }) => (
          <option key={employment.id} value={employment.id}>
            {employee.fullName} · {employment.jobRole.name} · {employment.code}
          </option>
        ))}
      </select>
    </label>
  );
}

function PayrollPeriodField({
  periods,
  statuses,
}: {
  readonly periods: readonly PayrollPeriodOption[];
  readonly statuses: readonly string[];
}) {
  const availablePeriods = periods.filter((period) => statuses.includes(period.status));
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      Competência da folha
      <select className={inputClasses} name="payrollPeriodId" required>
        <option value="">Selecione uma competência</option>
        {availablePeriods.map((period) => (
          <option key={period.id} value={period.id}>
            {monthLabel(period.competence)} · {statusLabel(period.status)}
          </option>
        ))}
      </select>
    </label>
  );
}

const payrollItemOptions = [
  { code: "SALARY", description: "Salário base", type: "EARNING" },
  { code: "OVERTIME", description: "Horas extras", type: "EARNING" },
  { code: "BONUS", description: "Abono ou bonificação", type: "EARNING" },
  { code: "VACATION", description: "Férias", type: "EARNING" },
  { code: "VACATION_ONE_THIRD", description: "Adicional de 1/3 de férias", type: "EARNING" },
  { code: "THIRTEENTH", description: "13º salário", type: "EARNING" },
  { code: "TRANSPORT_BENEFIT", description: "Vale-transporte", type: "BENEFIT" },
  { code: "FOOD_BENEFIT", description: "Vale-alimentação", type: "BENEFIT" },
  { code: "HEALTH_BENEFIT", description: "Assistência à saúde", type: "BENEFIT" },
  { code: "INSS", description: "Desconto de INSS", type: "DEDUCTION" },
  { code: "IRRF", description: "Desconto de IRRF", type: "DEDUCTION" },
  { code: "TRANSPORT_DEDUCTION", description: "Desconto de vale-transporte", type: "DEDUCTION" },
  { code: "ABSENCE", description: "Faltas ou atrasos", type: "DEDUCTION" },
  { code: "ADVANCE", description: "Adiantamento salarial", type: "DEDUCTION" },
] as const;

function StatementField({
  statements,
}: {
  readonly statements: readonly PayrollStatementSummary[];
}) {
  const availableStatements = statements.filter(
    (statement) => statement.status !== "CLOSED" && statement.status !== "VOIDED",
  );
  return (
    <div className="grid gap-2 text-sm font-bold text-slate-700">
      <span>Demonstrativo do funcionário</span>
      {availableStatements.length ? (
        <div className="grid gap-2">
          {availableStatements.map((statement) => (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 transition hover:border-emerald-400 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50"
              key={statement.id}
            >
              <input
                className="size-4 accent-emerald-700"
                name="payrollStatementId"
                required
                type="radio"
                value={statement.id}
              />
              <span>
                {statement.employee.fullName} · {monthLabel(statement.competence)}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Nenhum demonstrativo em elaboração está disponível na competência consultada.
        </p>
      )}
    </div>
  );
}

function PayrollLineItemFields({
  statements,
}: {
  readonly statements: readonly PayrollStatementSummary[];
}) {
  const [itemCode, setItemCode] = useState("");
  const selectedItem = payrollItemOptions.find((item) => item.code === itemCode);
  return (
    <>
      <StatementField statements={statements} />
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Lançamento
        <select
          className={inputClasses}
          onChange={(event) => setItemCode(event.target.value)}
          required
          value={itemCode}
        >
          <option value="">Selecione o tipo de lançamento</option>
          <optgroup label="Proventos">
            {payrollItemOptions.filter((item) => item.type === "EARNING").map((item) => (
              <option key={item.code} value={item.code}>{item.description}</option>
            ))}
          </optgroup>
          <optgroup label="Benefícios">
            {payrollItemOptions.filter((item) => item.type === "BENEFIT").map((item) => (
              <option key={item.code} value={item.code}>{item.description}</option>
            ))}
          </optgroup>
          <optgroup label="Descontos">
            {payrollItemOptions.filter((item) => item.type === "DEDUCTION").map((item) => (
              <option key={item.code} value={item.code}>{item.description}</option>
            ))}
          </optgroup>
        </select>
      </label>
      <CurrencyField label="Valor" name="amount" />
      <input name="lineType" type="hidden" value={selectedItem?.type ?? ""} />
      <input name="code" type="hidden" value={selectedItem?.code ?? ""} />
      <input name="description" type="hidden" value={selectedItem?.description ?? ""} />
    </>
  );
}

function EmploymentFields({
  includeEmployee = false,
  employmentCode,
  jobRoles,
  jobRolesLoading,
}: {
  readonly includeEmployee?: boolean;
  readonly employmentCode: string;
  readonly jobRoles: readonly JobRoleOption[];
  readonly jobRolesLoading: boolean;
}) {
  return (
    <>
      {includeEmployee ? <Field label="ID do funcionário existente" name="employeeId" placeholder="UUID" /> : null}
      <JobRoleField jobRoles={jobRoles} loading={jobRolesLoading} />
      <Field defaultValue={employmentCode} label="Código do vínculo" name="code" readOnly />
      <SelectField defaultValue="EMPLOYEE" label="Tipo de vínculo" name="employmentType">
        <option value="EMPLOYEE">Empregado</option>
        <option value="AUTONOMOUS">Autônomo</option>
      </SelectField>
      <EmploymentScheduleFields />
      <Field label="Data de início" name="startedAt" type="date" />
    </>
  );
}

function ServiceReceiptFields({ employees, receiptNumber }: { readonly employees: readonly EmployeeOption[]; readonly receiptNumber: string }) {
  return (
    <>
      <SelectField defaultValue="AUTONOMOUS" label="Tipo do prestador" name="providerType"><option value="AUTONOMOUS">Profissional autônomo</option><option value="COMPANY">Empresa</option></SelectField>
      <ActiveEmploymentField employees={employees} label="Prestador vinculado (se houver)" required={false} />
      <Field defaultValue={receiptNumber} label="Número do recibo (automático)" name="receiptNumber" readOnly />
      <Field label="Competência" name="competence" type="month" />
      <Field label="Data do serviço" name="serviceDate" type="date" />
      <Field label="Descrição do serviço" name="serviceDescription" />
      <Field label="Nome do destinatário" name="recipientName" />
      <CurrencyField label="Valor do serviço" name="amount" />
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 md:col-span-2">A data e a hora de emissão serão registradas automaticamente ao confirmar.</div>
    </>
  );
}

function OperationFields({
  action,
  details,
  jobRoles,
  jobRolesLoading,
  employmentCode,
  employees,
  periods,
  serviceReceiptNumber,
  statements,
}: {
  readonly action: PayrollAction;
  readonly details: StatementDetails | null;
  readonly jobRoles: readonly JobRoleOption[];
  readonly jobRolesLoading: boolean;
  readonly employmentCode: string;
  readonly employees: readonly EmployeeOption[];
  readonly periods: readonly PayrollPeriodOption[];
  readonly serviceReceiptNumber: string;
  readonly statements: readonly PayrollStatementSummary[];
}) {
  const statementId = details?.id;

  switch (action) {
    case "create-job-role":
      return <><Field label="Código do cargo" name="code" /><Field label="Nome do cargo/função" name="name" /><Field label="Descrição" name="description" required={false} /></>;
    case "register-employee":
      return <><Field label="Nome completo" name="fullName" /><EmploymentFields employmentCode={employmentCode} jobRoles={jobRoles} jobRolesLoading={jobRolesLoading} /><CurrencyField label="Remuneração inicial (opcional)" name="amount" required={false} /><SelectField defaultValue="MONTHLY" label="Unidade da remuneração" name="compensationUnit"><option value="MONTHLY">Mensal</option><option value="HOURLY">Por hora</option><option value="PER_SERVICE">Por serviço</option></SelectField></>;
    case "update-employee-personal-data":
      return <EmployeePersonalDataFields employees={employees} />;
    case "terminate-employment":
      return <EmploymentTerminationFields employees={employees} />;
    case "delete-employee":
      return <><EmployeeField employees={employees} /><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 md:col-span-2"><strong>Exclusão permanente:</strong> use somente para teste, duplicidade ou cadastro incorreto. Funcionários com folha ou recibo serão bloqueados.</div></>;
    case "create-employment":
      return <EmploymentFields employmentCode={employmentCode} includeEmployee jobRoles={jobRoles} jobRolesLoading={jobRolesLoading} />;
    case "update-employment":
      return <EmploymentUpdateFields employees={employees} jobRoles={jobRoles} jobRolesLoading={jobRolesLoading} />;
    case "add-compensation":
      return <><Field defaultValue={details?.employment.id} label="ID do vínculo" name="employmentId" placeholder="UUID" /><CurrencyField label="Nova remuneração" name="amount" /><SelectField defaultValue="MONTHLY" label="Unidade" name="unit"><option value="MONTHLY">Mensal</option><option value="HOURLY">Por hora</option><option value="PER_SERVICE">Por serviço</option></SelectField><Field label="Início da vigência" name="effectiveFrom" type="date" /><Field label="Fim da vigência (opcional)" name="effectiveTo" required={false} type="date" /><Field label="Motivo da alteração" name="changeReason" /></>;
    case "open-period":
      return <Field label="Competência" name="competence" type="month" />;
    case "create-statement":
      return <><PayrollPeriodField periods={periods} statuses={["OPEN"]} /><ActiveEmploymentField employees={employees} /></>;
    case "add-line-item":
      return <PayrollLineItemFields statements={statements} />;
    case "create-adjustment":
      return <><Field defaultValue={statementId} label="Demonstrativo de origem" name="sourcePayrollStatementId" placeholder="UUID" /><SelectField defaultValue="CREDIT" label="Tipo do ajuste" name="adjustmentType"><option value="CREDIT">Crédito</option><option value="DEBIT">Débito</option></SelectField><Field label="Valor" min="0.01" name="amount" step="0.01" type="number" /><Field label="Motivo auditável" name="reason" /></>;
    case "apply-adjustment":
      return <><Field label="ID do ajuste" name="adjustmentId" placeholder="UUID" /><Field defaultValue={statementId} label="Demonstrativo de destino" name="appliedPayrollStatementId" placeholder="UUID" /></>;
    case "calculate-statement":
      return <Field defaultValue={statementId} label="ID do demonstrativo" name="payrollStatementId" placeholder="UUID" />;
    case "calculate-period":
      return <PayrollPeriodField periods={periods} statuses={["OPEN", "CALCULATED"]} />;
    case "close-period":
      return <PayrollPeriodField periods={periods} statuses={["CALCULATED"]} />;
    case "issue-service-receipt":
      return <ServiceReceiptFields employees={employees} receiptNumber={serviceReceiptNumber} />;
  }
}

function buildActionPayload(action: PayrollAction, businessUnitId: string, form: FormData): JsonObject {
  const base = { action, businessUnitId };
  switch (action) {
    case "create-job-role":
      return { ...base, code: formText(form, "code"), name: formText(form, "name"), description: optionalFormText(form, "description") };
    case "register-employee": {
      const amount = optionalFormText(form, "amount");
      return {
        ...base,
        fullName: formText(form, "fullName"),
        jobRoleId: formText(form, "jobRoleId"),
        code: formText(form, "code"),
        type: formText(form, "employmentType"),
        workSchedule: formText(form, "workSchedule"),
        weeklyWorkingHours: optionalFormText(form, "weeklyWorkingHours"),
        startedAt: formText(form, "startedAt"),
        ...(amount ? {
          compensation: {
            amount,
            unit: formText(form, "compensationUnit"),
            effectiveFrom: formText(form, "startedAt"),
            changeReason: "Remuneração inicial do vínculo",
          },
        } : {}),
      };
    }
    case "update-employee-personal-data":
      return {
        ...base,
        employeeId: formText(form, "employeeId"),
        fullName: formText(form, "fullName"),
        cpf: formText(form, "cpf"),
        birthDate: formText(form, "birthDate"),
        identityDocument: optionalFormText(form, "identityDocument"),
        identityIssuer: optionalFormText(form, "identityIssuer"),
        identityState: optionalFormText(form, "identityState"),
        socialSecurityNumber: optionalFormText(form, "socialSecurityNumber"),
        phone: optionalFormText(form, "phone"),
        email: optionalFormText(form, "email"),
        postalCode: optionalFormText(form, "postalCode"),
        addressStreet: optionalFormText(form, "addressStreet"),
        addressNumber: optionalFormText(form, "addressNumber"),
        addressComplement: optionalFormText(form, "addressComplement"),
        addressNeighborhood: optionalFormText(form, "addressNeighborhood"),
        addressCity: optionalFormText(form, "addressCity"),
        addressState: optionalFormText(form, "addressState"),
        paymentMethod: optionalFormText(form, "paymentMethod"),
        paymentDetails: optionalFormText(form, "paymentDetails"),
      };
    case "terminate-employment":
      return {
        action: "update-employment",
        businessUnitId,
        employmentId: formText(form, "employmentId"),
        expectedUpdatedAt: localDateTime(formText(form, "expectedUpdatedAt")),
        status: "TERMINATED",
        endedAt: formText(form, "endedAt"),
      };
    case "delete-employee":
      return {
        ...base,
        employeeId: formText(form, "employeeId"),
      };
    case "create-employment":
      return { ...base, employeeId: formText(form, "employeeId"), jobRoleId: formText(form, "jobRoleId"), code: formText(form, "code"), type: formText(form, "employmentType"), workSchedule: formText(form, "workSchedule"), weeklyWorkingHours: optionalFormText(form, "weeklyWorkingHours"), startedAt: formText(form, "startedAt") };
    case "update-employment": {
      const jobRoleId = optionalFormText(form, "jobRoleId");
      const startedAt = optionalFormText(form, "startedAt");
      const endedAt = optionalFormText(form, "endedAt");
      return {
        ...base,
        employmentId: formText(form, "employmentId"),
        expectedUpdatedAt: localDateTime(formText(form, "expectedUpdatedAt")),
        status: formText(form, "status"),
        workSchedule: formText(form, "workSchedule"),
        weeklyWorkingHours: optionalFormText(form, "weeklyWorkingHours"),
        ...(jobRoleId ? { jobRoleId } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(endedAt ? { endedAt } : {}),
      };
    }
    case "add-compensation":
      return { ...base, employmentId: formText(form, "employmentId"), amount: formText(form, "amount"), unit: formText(form, "unit"), effectiveFrom: formText(form, "effectiveFrom"), effectiveTo: optionalFormText(form, "effectiveTo"), changeReason: formText(form, "changeReason") };
    case "open-period":
      return { ...base, competence: monthDate(formText(form, "competence")) };
    case "create-statement":
      return { ...base, payrollPeriodId: formText(form, "payrollPeriodId"), employmentId: formText(form, "employmentId"), compensationId: optionalFormText(form, "compensationId") };
    case "add-line-item":
      return { ...base, payrollStatementId: formText(form, "payrollStatementId"), type: formText(form, "lineType"), code: formText(form, "code"), description: formText(form, "description"), amount: formText(form, "amount") };
    case "create-adjustment":
      return { ...base, sourcePayrollStatementId: formText(form, "sourcePayrollStatementId"), type: formText(form, "adjustmentType"), amount: formText(form, "amount"), reason: formText(form, "reason") };
    case "apply-adjustment":
      return { ...base, adjustmentId: formText(form, "adjustmentId"), appliedPayrollStatementId: formText(form, "appliedPayrollStatementId") };
    case "calculate-statement":
      return { ...base, payrollStatementId: formText(form, "payrollStatementId") };
    case "calculate-period":
    case "close-period":
      return { ...base, payrollPeriodId: formText(form, "payrollPeriodId") };
    case "issue-service-receipt":
      return { ...base, providerType: formText(form, "providerType"), providerEmploymentId: optionalFormText(form, "employmentId"), receiptNumber: formText(form, "receiptNumber"), competence: monthDate(formText(form, "competence")), serviceDate: formText(form, "serviceDate"), serviceDescription: formText(form, "serviceDescription"), recipientName: formText(form, "recipientName"), amount: formText(form, "amount"), issuedAt: new Date().toISOString() };
  }
}

export default function PayrollPage() {
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [businessUnits, setBusinessUnits] = useState<readonly BusinessUnitOption[]>([]);
  const [jobRoles, setJobRoles] = useState<readonly JobRoleOption[]>([]);
  const [jobRolesLoading, setJobRolesLoading] = useState(false);
  const [jobRolesRevision, setJobRolesRevision] = useState(0);
  const [employees, setEmployees] = useState<readonly EmployeeOption[]>([]);
  const [employeesRevision, setEmployeesRevision] = useState(0);
  const [serverEmploymentCode, setServerEmploymentCode] = useState("");
  const [periods, setPeriods] = useState<readonly PayrollPeriodOption[]>([]);
  const [periodsRevision, setPeriodsRevision] = useState(0);
  const [serviceReceipts, setServiceReceipts] = useState<readonly ServiceReceiptOption[]>([]);
  const [serviceReceiptsRevision, setServiceReceiptsRevision] = useState(0);
  const [unitLoadState, setUnitLoadState] = useState<UnitLoadState>("loading");
  const [unitErrorMessage, setUnitErrorMessage] = useState("");
  const [competence, setCompetence] = useState("");
  const [statements, setStatements] = useState<readonly PayrollStatementSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [details, setDetails] = useState<StatementDetails | null>(null);
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [detailError, setDetailError] = useState("");
  const [operation, setOperation] = useState<PayrollAction>("create-job-role");
  const [formRevision, setFormRevision] = useState(0);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [confirmationStatementId, setConfirmationStatementId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBusinessUnits() {
      try {
        const query = new URLSearchParams({ resource: "business-units" });
        const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!active) return;
        if (response.status === 403) {
          setUnitLoadState("forbidden");
          setUnitErrorMessage("Seu perfil não possui autorização para acessar a folha de pagamento.");
          return;
        }
        if (!response.ok) {
          throw new Error(payloadMessage(payload, "Não foi possível carregar as unidades empresariais."));
        }

        const units = isRecord(payload) && Array.isArray(payload.businessUnits)
          ? payload.businessUnits.filter(isBusinessUnitOption)
          : [];
        setBusinessUnits(units);
        if (units.length === 0) {
          setUnitLoadState("empty");
          return;
        }
        setUnitLoadState("success");
        if (units.length === 1) setBusinessUnitId(units[0].id);
      } catch (error) {
        if (!active) return;
        setUnitLoadState("error");
        setUnitErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as unidades empresariais.",
        );
      }
    }

    void loadBusinessUnits();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadJobRoles() {
      if (!businessUnitId) {
        setJobRoles([]);
        setJobRolesLoading(false);
        return;
      }

      setJobRolesLoading(true);
      try {
        const query = new URLSearchParams({
          resource: "job-roles",
          businessUnitId,
        });
        const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!response.ok) {
          throw new Error(payloadMessage(payload, "Não foi possível carregar os cargos."));
        }
        if (!active) return;
        const nextJobRoles = isRecord(payload) && Array.isArray(payload.jobRoles)
          ? payload.jobRoles.filter(isJobRoleOption)
          : [];
        setJobRoles(nextJobRoles);
      } catch (error) {
        if (!active) return;
        setJobRoles([]);
        setActionState("error");
        setActionMessage(
          error instanceof Error ? error.message : "Não foi possível carregar os cargos.",
        );
      } finally {
        if (active) setJobRolesLoading(false);
      }
    }

    void loadJobRoles();
    return () => { active = false; };
  }, [businessUnitId, jobRolesRevision]);

  useEffect(() => {
    let active = true;

    async function loadEmployees() {
      if (!businessUnitId) {
        setEmployees([]);
        setServerEmploymentCode("");
        return;
      }

      try {
        const query = new URLSearchParams({
          resource: "employees",
          businessUnitId,
        });
        const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!response.ok) {
          throw new Error(payloadMessage(payload, "Não foi possível carregar os vínculos."));
        }
        if (!active) return;
        const nextEmployees = isRecord(payload) && Array.isArray(payload.employees)
          ? payload.employees.filter(isEmployeeOption)
          : [];
        setEmployees(nextEmployees);
        setServerEmploymentCode(
          isRecord(payload)
            && typeof payload.nextEmploymentCode === "string"
            && /^MAT-\d+$/i.test(payload.nextEmploymentCode)
            ? payload.nextEmploymentCode
            : "",
        );
      } catch (error) {
        if (!active) return;
        setEmployees([]);
        setServerEmploymentCode("");
        setActionState("error");
        setActionMessage(
          error instanceof Error ? error.message : "Não foi possível carregar os vínculos.",
        );
      }
    }

    void loadEmployees();
    return () => { active = false; };
  }, [businessUnitId, employeesRevision]);

  useEffect(() => {
    let active = true;

    async function loadPeriods() {
      if (!businessUnitId) {
        setPeriods([]);
        return;
      }
      try {
        const query = new URLSearchParams({
          resource: "payroll-periods",
          businessUnitId,
        });
        const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!response.ok) {
          throw new Error(payloadMessage(payload, "Não foi possível carregar as competências."));
        }
        if (!active) return;
        setPeriods(
          isRecord(payload) && Array.isArray(payload.periods)
            ? payload.periods.filter(isPayrollPeriodOption)
            : [],
        );
      } catch (error) {
        if (!active) return;
        setPeriods([]);
        setActionState("error");
        setActionMessage(
          error instanceof Error ? error.message : "Não foi possível carregar as competências.",
        );
      }
    }

    void loadPeriods();
    return () => { active = false; };
  }, [businessUnitId, periodsRevision]);

  useEffect(() => {
    let active = true;

    async function loadServiceReceipts() {
      if (!businessUnitId) {
        setServiceReceipts([]);
        return;
      }
      try {
        const query = new URLSearchParams({ resource: "service-receipts", businessUnitId });
        const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!response.ok) throw new Error(payloadMessage(payload, "Não foi possível carregar os recibos de serviço."));
        if (!active) return;
        setServiceReceipts(isRecord(payload) && Array.isArray(payload.receipts) ? payload.receipts.filter(isServiceReceiptOption) : []);
      } catch (error) {
        if (!active) return;
        setServiceReceipts([]);
        setActionState("error");
        setActionMessage(error instanceof Error ? error.message : "Não foi possível carregar os recibos de serviço.");
      }
    }

    void loadServiceReceipts();
    return () => { active = false; };
  }, [businessUnitId, serviceReceiptsRevision]);

  const filteredStatements = useMemo(
    () => competence ? statements.filter((statement) => statement.competence.startsWith(competence)) : statements,
    [competence, statements],
  );
  const selectedBusinessUnit = businessUnits.find((unit) => unit.id === businessUnitId);
  const employmentCode = serverEmploymentCode || nextEmploymentCode(employees);
  const serviceReceiptNumber = nextServiceReceiptNumber(serviceReceipts);
  const validBusinessUnit = unitLoadState === "success" && selectedBusinessUnit !== undefined;
  const selectedClosedStatement = details?.status === "CLOSED"
    && (operation === "add-line-item" || operation === "calculate-statement");

  async function fetchStatements(unitId: string, preserveDetails = false) {
    setLoadState("loading");
    setErrorMessage("");
    if (!preserveDetails) {
      setDetails(null);
      setDetailState("idle");
    }
    try {
      const query = new URLSearchParams({ resource: "statements", businessUnitId: unitId });
      const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
        cache: "no-store",
        headers: developmentUserRequestHeaders(),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payloadMessage(payload, "Não foi possível consultar a folha de pagamento."));
      const nextStatements = isRecord(payload) && Array.isArray(payload.statements)
        ? payload.statements as readonly PayrollStatementSummary[]
        : [];
      setStatements(nextStatements);
      setLoadState("success");
    } catch (error) {
      setStatements([]);
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível consultar a folha de pagamento.");
    }
  }

  async function loadStatements(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUnitId = businessUnitId;
    if (!validBusinessUnit) {
      setLoadState("error");
      setErrorMessage("Selecione uma unidade empresarial para consultar a folha.");
      return;
    }
    await fetchStatements(normalizedUnitId);
  }

  async function loadStatementDetails(unitId: string, statementId: string) {
    setDetailState("loading");
    setDetailError("");
    try {
      const query = new URLSearchParams({ resource: "statement-details", businessUnitId: unitId, payrollStatementId: statementId });
      const response = await fetch(`/api/gestao/folha-pagamento?${query}`, {
        cache: "no-store",
        headers: developmentUserRequestHeaders(),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payloadMessage(payload, "Não foi possível abrir os detalhes da folha."));
      if (!isRecord(payload) || !isRecord(payload.statement)) throw new Error("A API não retornou os detalhes da folha.");
      setDetails(payload.statement as unknown as StatementDetails);
      setDetailState("success");
    } catch (error) {
      setDetailState("error");
      setDetailError(error instanceof Error ? error.message : "Não foi possível abrir os detalhes da folha.");
    }
  }

  async function submitOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const normalizedUnitId = businessUnitId;
    if (!validBusinessUnit) {
      setActionState("error");
      setActionMessage("Selecione primeiro uma unidade empresarial autorizada.");
      return;
    }
    if (selectedClosedStatement) {
      setActionState("error");
      setActionMessage("O demonstrativo selecionado está fechado e não aceita novos lançamentos ou recálculo.");
      return;
    }
    if (confirmationActions.has(operation)) {
      const label = operations.find((item) => item.value === operation)?.label ?? "executar a operação";
      if (!window.confirm(`Confirma ${label.toLocaleLowerCase("pt-BR")}? A API aplicará as regras persistidas da folha.`)) return;
    }

    setActionState("submitting");
    setActionMessage("");
    try {
      const payload = buildActionPayload(operation, normalizedUnitId, new FormData(formElement));
      const response = await fetch("/api/gestao/folha-pagamento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const result = await responsePayload(response);
      if (!response.ok) throw new Error(payloadMessage(result, "A operação não pôde ser concluída."));

      const label = operations.find((item) => item.value === operation)?.label ?? "Operação";
      const createdId = nestedId(result, "employee")
        ?? nestedId(result, "employment")
        ?? nestedId(result, "jobRole")
        ?? nestedId(result, "period")
        ?? nestedId(result, "adjustment")
        ?? nestedId(result, "receipt");
      setActionState("success");
      setActionMessage(`${label} concluído${createdId ? ` — ID ${createdId}` : ""}.`);
      formElement.reset();
      setFormRevision((current) => current + 1);
      if (operation === "create-job-role") {
        setJobRolesRevision((current) => current + 1);
      }
      if (
        operation === "register-employee"
        || operation === "update-employee-personal-data"
        || operation === "create-employment"
        || operation === "update-employment"
        || operation === "terminate-employment"
        || operation === "delete-employee"
      ) {
        setEmployeesRevision((current) => current + 1);
      }
      if (
        operation === "open-period"
        || operation === "calculate-period"
        || operation === "close-period"
      ) {
        setPeriodsRevision((current) => current + 1);
      }
      if (operation === "issue-service-receipt") {
        setServiceReceiptsRevision((current) => current + 1);
      }

      const responseStatementId = nestedId(result, "statement");
      await fetchStatements(normalizedUnitId, true);
      if (responseStatementId) await loadStatementDetails(normalizedUnitId, responseStatementId);
      else if (details) await loadStatementDetails(normalizedUnitId, details.id);
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "A operação não pôde ser concluída.");
    }
  }

  async function postPayrollAction(payload: JsonObject) {
    const response = await fetch("/api/gestao/folha-pagamento", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const result = await responsePayload(response);
    if (!response.ok) {
      throw new Error(payloadMessage(result, "A operação mensal não pôde ser concluída."));
    }
    return result;
  }

  async function runMonthlyAction(monthlyAction: MonthlyAction) {
    if (!validBusinessUnit || !competence) {
      setActionState("error");
      setActionMessage("Selecione a unidade e o mês da folha.");
      return;
    }

    const labels: Record<MonthlyAction, string> = {
      prepare: "preparar a folha",
      calculate: "calcular a folha",
      close: "fechar a folha",
    };
    if (
      monthlyAction !== "prepare"
      && !window.confirm(`Confirma ${labels[monthlyAction]} de ${monthLabel(`${competence}-01`)}?`)
    ) {
      return;
    }

    setActionState("submitting");
    setActionMessage("");
    try {
      let period = periods.find((candidate) => candidate.competence.startsWith(competence));

      if (monthlyAction === "prepare") {
        if (!period) {
          const result = await postPayrollAction({
            action: "open-period",
            businessUnitId,
            competence: monthDate(competence),
          });
          const periodId = nestedId(result, "period");
          if (!periodId) throw new Error("A competência foi aberta sem retornar sua identificação.");
          period = {
            id: periodId,
            businessUnitId,
            competence: `${competence}-01`,
            status: "OPEN",
          };
        }
        if (period.status !== "OPEN") {
          throw new Error("Esta folha já foi calculada ou fechada e não pode ser preparada novamente.");
        }

        const existingEmploymentIds = new Set(
          statements
            .filter((statement) => statement.payrollPeriodId === period?.id)
            .map((statement) => statement.employment.id),
        );
        const activeEmployments = employees.flatMap((employee) => (
          employee.status === "ACTIVE"
            ? employee.employments.filter((employment) => employment.status === "ACTIVE")
            : []
        ));
        for (const employment of activeEmployments) {
          if (existingEmploymentIds.has(employment.id)) continue;
          await postPayrollAction({
            action: "create-statement",
            businessUnitId,
            payrollPeriodId: period.id,
            employmentId: employment.id,
          });
        }
        setPeriodsRevision((current) => current + 1);
        setActionMessage("Folha preparada com os funcionários ativos e seus salários vigentes.");
      } else {
        if (!period) throw new Error("Prepare a folha deste mês antes de continuar.");
        if (monthlyAction === "calculate") {
          const result = await postPayrollAction({ action: "calculate-period", businessUnitId, payrollPeriodId: period.id });
          const counts = calculationCounts(result);
          if (!counts || counts.pending > 0) {
            throw new Error(counts
              ? `O cálculo não foi concluído; ${counts.pending} demonstrativo(s) permanecem pendentes.`
              : "O servidor não confirmou o cálculo integral da folha.");
          }
          setPeriodsRevision((current) => current + 1);
          setActionMessage(counts.calculated > 0
            ? `Folha calculada integralmente: ${counts.calculated} demonstrativo(s) calculado(s), ${counts.alreadyCalculated} já calculado(s) e ${counts.untouched} fechado(s)/cancelado(s) preservado(s).`
            : `Folha já estava totalmente calculada; ${counts.alreadyCalculated} demonstrativo(s) foram preservados sem reprocessamento.`);
        }
        if (monthlyAction === "close") {
          const result = await postPayrollAction({ action: "close-period", businessUnitId, payrollPeriodId: period.id });
          const counts = closureCounts(result);
          if (!counts || counts.pending > 0) {
            throw new Error(counts
              ? `O fechamento não foi concluído; ${counts.pending} demonstrativo(s) permanecem pendentes.`
              : "O servidor não confirmou o fechamento integral da folha.");
          }
          setPeriodsRevision((current) => current + 1);
          setActionMessage(counts.closed > 0
            ? `Folha fechada integralmente: ${counts.closed} demonstrativo(s) fechado(s) e ${counts.alreadyClosed} já fechado(s) preservado(s).`
            : `A folha já estava fechada; ${counts.alreadyClosed} demonstrativo(s) foram preservados sem duplicação.`);
        }
      }

      setActionState("success");
      await fetchStatements(businessUnitId, true);
      if (details) await loadStatementDetails(businessUnitId, details.id);
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "A operação mensal não pôde ser concluída.");
    }
  }

  function openPaymentReceipt(
    statement: StatementDetails,
    receipt: PayrollReceiptSummary,
  ) {
    const params = new URLSearchParams({
      businessUnitId: receipt.businessUnitId,
      payrollStatementId: statement.id,
      employmentId: statement.employment.id,
      employeeId: statement.employee.id,
    });
    const url = `/gestao/documentos/recibos-pagamento/${encodeURIComponent(receipt.id)}?${params}`;
    const receiptWindow = window.open(url, "_blank");
    if (!receiptWindow) {
      setActionState("error");
      setActionMessage("O navegador bloqueou a abertura do recibo. Permita pop-ups para este endereço.");
      return;
    }
    receiptWindow.opener = null;
  }

  function changeBusinessUnit(nextBusinessUnitId: string) {
    setBusinessUnitId(nextBusinessUnitId);
    setJobRoles([]);
    setEmployees([]);
    setServerEmploymentCode("");
    setPeriods([]);
    setServiceReceipts([]);
    setStatements([]);
    setLoadState("idle");
    setErrorMessage("");
    setDetails(null);
    setDetailState("idle");
    setDetailError("");
    setActionState("idle");
    setActionMessage("");
  }

  const emptyAfterFilter = loadState === "success" && statements.length > 0 && filteredStatements.length === 0;

  return (
    <div className="space-y-6">
      <PageHeading
        backHref="/gestao"
        description="Consulte demonstrativos reais e execute operações autorizadas da folha por unidade empresarial."
        eyebrow="Centro de Gestão SV"
        title="Folha de Pagamento"
      />

      <Card className="p-5 sm:p-6">
        <CardHeader><CardTitle>Unidade e competência</CardTitle><CardDescription>Selecione uma unidade empresarial autorizada e a competência mensal desejada.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-end" onSubmit={loadStatements}>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Unidade empresarial<span className="relative"><Building2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><select className={`${inputClasses} pl-10`} disabled={unitLoadState !== "success"} onChange={(event) => changeBusinessUnit(event.target.value)} required value={businessUnitId}><option value="">{unitLoadState === "loading" ? "Carregando unidades..." : "Selecione uma unidade"}</option>{businessUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.code ? ` · ${unit.code}` : ""}</option>)}</select></span></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Competência mensal<span className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClasses} pl-10`} onChange={(event) => setCompetence(event.target.value)} type="month" value={competence} /></span></label>
            <Button className="w-full lg:w-auto" disabled={!validBusinessUnit} loading={loadState === "loading"} type="submit"><Search aria-hidden="true" className="size-4" />Consultar</Button>
          </form>
          {unitLoadState === "loading" ? <p aria-live="polite" className="flex items-center gap-2 text-sm font-bold text-slate-600"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-emerald-600" />Carregando unidades empresariais autorizadas...</p> : null}
          {unitLoadState === "empty" ? <p aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Nenhuma unidade empresarial ativa está disponível para o seu perfil.</p> : null}
          {unitLoadState === "forbidden" ? <p aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{unitErrorMessage}</p> : null}
          {unitLoadState === "error" ? <p aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{unitErrorMessage}</p> : null}
          {unitLoadState === "success" && businessUnits.length > 1 && !businessUnitId ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Escolha uma unidade empresarial para habilitar consultas e operações.</p> : null}
        </CardContent>
      </Card>

      <Card className="p-5 sm:p-6" variant="elevated">
        <CardHeader>
          <CardTitle>Folha do mês</CardTitle>
          <CardDescription>
            Selecione o mês acima e siga os botões na ordem. Salários vigentes entram automaticamente ao preparar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Button disabled={!validBusinessUnit || !competence} onClick={() => void runMonthlyAction("prepare")} type="button">
              1. Preparar folha
            </Button>
            <Button disabled={!validBusinessUnit || !competence} onClick={() => void runMonthlyAction("calculate")} type="button" variant="outline">
              2. Calcular folha
            </Button>
            <Button disabled={!validBusinessUnit || !competence} onClick={() => void runMonthlyAction("close")} type="button" variant="outline">
              3. Fechar folha
            </Button>
          </div>
          {actionState === "submitting" ? <p className="flex items-center gap-2 text-sm font-bold text-slate-600"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Processando a folha mensal...</p> : null}
          {actionState === "success" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{actionMessage}</p> : null}
          {actionState === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{actionMessage}</p> : null}
        </CardContent>
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-black text-slate-700">
          Cadastros, alterações e lançamentos excepcionais
        </summary>
        <section aria-labelledby="payroll-actions-title" className="mt-5 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-slate-950" id="payroll-actions-title">Administrar folha</h2><p className="text-sm text-slate-600">Escolha uma operação suportada pela API. Cálculos e bloqueios permanecem no servidor.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-700"><CircleDollarSign aria-hidden="true" className="size-4" />Operações reais</span></div>
        <Card className="p-5 sm:p-6" variant="elevated">
          <CardHeader><CardTitle>Nova operação</CardTitle><CardDescription>Funcionários, cargos, vínculos, remunerações, períodos, lançamentos, ajustes, processamento e recibos.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <label className="grid gap-2 text-sm font-bold text-slate-700">Ação<select className={inputClasses} onChange={(event) => { setOperation(event.target.value as PayrollAction); setActionState("idle"); setActionMessage(""); }} value={operation}>{["Pessoas", "Folha", "Ajustes", "Processamento", "Recibos"].map((group) => <optgroup key={group} label={group}>{operations.filter((item) => item.group === group).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select></label>

            <form className="space-y-5" key={`${operation}-${details?.id ?? "none"}-${employmentCode}-${formRevision}`} onSubmit={submitOperation}>
              <fieldset className="grid gap-4 md:grid-cols-2" disabled={!validBusinessUnit || actionState === "submitting" || selectedClosedStatement}>
                <legend className="sr-only">Dados da operação selecionada</legend>
                <OperationFields
                  action={operation}
                  details={details}
                  employmentCode={employmentCode}
                  employees={employees}
                  jobRoles={jobRoles}
                  jobRolesLoading={jobRolesLoading}
                  periods={periods}
                  serviceReceiptNumber={serviceReceiptNumber}
                  statements={filteredStatements}
                />
              </fieldset>

              {operation === "add-line-item" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Valores da folha:</strong> informe o valor já apurado para salário, horas extras, abono, férias, 1/3, 13º, benefício ou desconto. O sistema organiza e totaliza os lançamentos, mas esta etapa ainda não calcula automaticamente encargos e percentuais legais.</div> : null}
              {selectedClosedStatement ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">A folha selecionada está fechada. Lançamentos e recálculo estão bloqueados; correções devem seguir o fluxo auditável de ajustes.</div> : null}
              {!validBusinessUnit ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{unitLoadState === "loading" ? "Aguarde o carregamento das unidades empresariais." : "Selecione uma unidade empresarial autorizada no filtro superior para habilitar as operações."}</div> : null}
              {confirmationActions.has(operation) ? <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Esta operação exige confirmação antes do envio.</div> : null}
              {actionState === "success" ? <div aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{actionMessage}</div> : null}
              {actionState === "error" ? <div aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{actionMessage}</div> : null}
              <Button disabled={!validBusinessUnit || selectedClosedStatement} loading={actionState === "submitting"} type="submit"><Plus aria-hidden="true" className="size-4" />Executar operação</Button>
            </form>
          </CardContent>
        </Card>
        </section>
      </details>

      {loadState === "idle" ? <Card className="p-8 text-center" variant="muted"><FileText aria-hidden="true" className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-black text-slate-950">Selecione uma unidade</h2><p className="mt-1 text-sm text-slate-600">A consulta começa depois que os filtros forem enviados.</p></Card> : null}
      {loadState === "loading" ? <Card aria-live="polite" className="flex items-center justify-center gap-3 p-8 text-sm font-bold text-slate-600"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-emerald-600" />Carregando folhas de pagamento...</Card> : null}
      {loadState === "error" ? <Card aria-live="assertive" className="p-5" variant="danger"><h2 className="font-black text-rose-900">Não foi possível carregar</h2><p className="mt-1 text-sm text-rose-800">{errorMessage}</p></Card> : null}
      {loadState === "success" && statements.length === 0 ? <Card className="p-8 text-center" variant="muted"><Users aria-hidden="true" className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-black text-slate-950">Nenhuma folha encontrada</h2><p className="mt-1 text-sm text-slate-600">A unidade consultada ainda não possui demonstrativos registrados.</p></Card> : null}
      {emptyAfterFilter ? <Card className="p-8 text-center" variant="warning"><CalendarDays aria-hidden="true" className="mx-auto size-8 text-amber-600" /><h2 className="mt-3 font-black text-amber-950">Nenhum resultado para a competência</h2><p className="mt-1 text-sm text-amber-800">Altere o filtro mensal para visualizar outros demonstrativos reais.</p></Card> : null}

      {loadState === "success" && filteredStatements.length > 0 ? (
        <section aria-labelledby="payroll-results-title" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-slate-950" id="payroll-results-title">Folhas encontradas</h2><p className="text-sm text-slate-600">Cada registro corresponde ao demonstrativo de um funcionário.</p></div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{filteredStatements.length} demonstrativo{filteredStatements.length === 1 ? "" : "s"}</p></div>
          <div className="grid gap-3">
            {filteredStatements.map((statement) => (
              <Card className="overflow-hidden" key={statement.id}><div className="grid gap-4 p-5 xl:grid-cols-[minmax(15rem,1.4fr)_repeat(3,minmax(8rem,0.7fr))_minmax(11rem,auto)] xl:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black capitalize text-slate-950">{monthLabel(statement.competence)}</p><span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-wide ${statusClasses(statement.status)}`}>{statusLabel(statement.status)}</span></div><p className="mt-2 text-sm font-bold text-slate-700">{statement.employee.fullName}</p><p className="mt-1 text-xs text-slate-500">{selectedBusinessUnit?.name ?? "Unidade empresarial"}{selectedBusinessUnit?.code ? ` · ${selectedBusinessUnit.code}` : ""} · {statement.employment.jobRole}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bruto</p><p className="mt-1 font-black text-slate-950">{money(statement.totals.gross)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Descontos</p><p className="mt-1 font-black text-rose-700">{money(statement.totals.deductions)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Líquido</p><p className="mt-1 font-black text-emerald-700">{money(statement.totals.net)}</p></div><div className="grid gap-2"><Button onClick={() => void loadStatementDetails(statement.businessUnitId, statement.id)} size="small" variant="outline">Ver detalhes<ChevronRight aria-hidden="true" className="size-4" /></Button>{statement.status === "CLOSED" ? <Button onClick={() => setConfirmationStatementId(statement.id)} size="small" type="button">Confirmar pagamento e emitir recibo</Button> : null}</div></div></Card>
            ))}
          </div>
          <Card className="p-4" variant="info"><p className="text-sm text-sky-900"><strong>Dados disponíveis:</strong> a API fornece demonstrativos individuais e a unidade vem do catálogo autorizado. A consolidação total da competência ainda não é retornada e não foi estimada no navegador.</p></Card>
        </section>
      ) : null}

      {detailState === "loading" ? <Card aria-live="polite" className="flex items-center gap-3 p-6"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-emerald-600" /><p className="text-sm font-bold text-slate-600">Carregando detalhes e recibos...</p></Card> : null}
      {detailState === "error" ? <Card aria-live="assertive" className="p-5" variant="danger"><h2 className="font-black text-rose-900">Falha ao abrir os detalhes</h2><p className="mt-1 text-sm text-rose-800">{detailError}</p></Card> : null}

      {details ? (
        <section aria-labelledby="statement-details-title" className="space-y-4">
          <Card className="p-5 sm:p-6" variant="elevated"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Detalhes do demonstrativo</p><CardTitle className="mt-1" id="statement-details-title">{details.employee.fullName}</CardTitle><CardDescription>{details.employment.jobRole} · {monthLabel(details.competence)}</CardDescription></div><span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wide ${statusClasses(details.status)}`}>{statusLabel(details.status)}</span></div></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bruto</p><p className="mt-1 text-lg font-black text-slate-950">{money(details.totals.gross)}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-rose-600">Descontos</p><p className="mt-1 text-lg font-black text-rose-800">{money(details.totals.deductions)}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Líquido</p><p className="mt-1 text-lg font-black text-emerald-800">{money(details.totals.net)}</p></div></div>
              <div><h3 className="font-black text-slate-950">Lançamentos</h3>{details.items.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{details.items.map((item) => <tr key={`${item.code}-${item.type}`}><td className="px-4 py-3 font-mono text-xs text-slate-600">{item.code}</td><td className="px-4 py-3 font-bold text-slate-800">{item.description}</td><td className="px-4 py-3 text-slate-600">{itemTypeLabel(item.type)}</td><td className="px-4 py-3 text-right font-black text-slate-950">{money(item.amount)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-slate-500">Nenhum lançamento registrado.</p>}</div>
              <div><h3 className="font-black text-slate-950">Ajustes</h3>{[...details.adjustments.source, ...details.adjustments.applied].length ? <div className="mt-3 grid gap-2">{[...details.adjustments.source, ...details.adjustments.applied].map((adjustment) => <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={`${adjustment.id}-${adjustment.appliedPayrollStatementId ?? "source"}`}><div><p className="font-bold text-slate-900">{adjustment.reason}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{adjustment.type} · {statusLabel(adjustment.status)}</p></div><p className="font-black text-slate-950">{money(adjustment.amount)}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Nenhum ajuste relacionado.</p>}</div>
              {details.status === "CLOSED" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-black text-emerald-950">Pagamento salarial</h3><p className="mt-1 text-sm text-emerald-900">A confirmação exige liquidação integral, identidade legal válida e, para pagamento bancário, referência e comprovante privado.</p><Button className="mt-3" onClick={() => setConfirmationStatementId(details.id)} type="button">Confirmar pagamento e emitir recibo</Button></div> : null}
              <div><div className="flex items-center gap-2"><ReceiptText aria-hidden="true" className="size-5 text-emerald-700" /><h3 className="font-black text-slate-950">Documentos emitidos</h3></div>{details.receipts.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{details.receipts.map((receipt) => <article className="rounded-xl border border-slate-200 p-4" key={receipt.id}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">Documento {receipt.receiptNumber}</p><p className="mt-1 text-xs text-slate-500">Versão {receipt.version}</p></div><span className={`rounded-full border px-2 py-1 text-[0.65rem] font-black uppercase ${statusClasses(receipt.status)}`}>{statusLabel(receipt.status)}</span></div><p className="mt-3 text-xs text-slate-500">{receipt.issuedAt ? `Emitido em ${new Date(receipt.issuedAt).toLocaleDateString("pt-BR")}` : "Ainda não emitido"}</p><Button className="mt-3 w-full" disabled={receipt.status !== "ISSUED"} onClick={() => openPaymentReceipt(details, receipt)} size="small" type="button" variant="outline">Visualizar documento</Button></article>)}</div> : <p className="mt-2 text-sm text-slate-500">Nenhum documento emitido para este demonstrativo.</p>}</div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <Card className="p-4" variant="warning"><div className="flex items-start gap-3"><Calculator aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" /><p className="text-sm text-amber-900"><strong>Escopo atual:</strong> esta tela envia valores informados e solicita operações ao backend. Ela não calcula férias, 13º, encargos ou percentuais trabalhistas e não declara conformidade legal automática.</p></div></Card>
      {confirmationStatementId ? <SalaryPaymentConfirmation businessUnitId={businessUnitId} onClose={() => setConfirmationStatementId(null)} payrollStatementId={confirmationStatementId} /> : null}
    </div>
  );
}

"use client";

import {
  Building2,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";

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

interface BusinessUnit {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: string;
}

interface JobRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
}

interface PersonalData {
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
}

interface Employment {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly workSchedule: "FULL_TIME" | "PART_TIME" | "HOURLY" | "CUSTOM";
  readonly weeklyWorkingHours: string | null;
  readonly jobRole: { readonly id: string; readonly name: string };
  readonly compensations: readonly {
    readonly id: string;
    readonly amount: string;
    readonly unit: "MONTHLY" | "HOURLY" | "PER_SERVICE";
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
  }[];
}

interface Employee {
  readonly id: string;
  readonly fullName: string;
  readonly status: string;
  readonly personalData?: PersonalData;
  readonly employments: readonly Employment[];
}

type LoadState = "idle" | "loading" | "success" | "error" | "forbidden";
type ActionState = "idle" | "submitting" | "success" | "error";

const endpoint = "/api/gestao/folha-pagamento";
const inputClasses =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusinessUnit(value: unknown): value is BusinessUnit {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.code === "string"
    && typeof value.status === "string";
}

function isJobRole(value: unknown): value is JobRole {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.code === "string"
    && typeof value.name === "string"
    && typeof value.status === "string";
}

function isEmployee(value: unknown): value is Employee {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.fullName === "string"
    && typeof value.status === "string"
    && Array.isArray(value.employments);
}

async function responsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function payloadMessage(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.message === "string"
    ? payload.message
    : fallback;
}

function optionalFormText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredFormText(form: FormData, name: string) {
  const value = optionalFormText(form, name);
  if (!value) throw new Error("Preencha todos os campos obrigatórios.");
  return value;
}

function statusLabel(status: string) {
  const labels: Readonly<Record<string, string>> = {
    ACTIVE: "Ativo",
    INACTIVE: "Inativo",
    ARCHIVED: "Arquivado",
    SUSPENDED: "Suspenso",
    TERMINATED: "Encerrado",
  };
  return labels[status] ?? status;
}

function scheduleLabel(schedule: Employment["workSchedule"]) {
  const labels: Readonly<Record<Employment["workSchedule"], string>> = {
    FULL_TIME: "Integral",
    PART_TIME: "Meio expediente",
    HOURLY: "Por hora",
    CUSTOM: "Personalizada",
  };
  return labels[schedule];
}

function compensationLabel(employment: Employment) {
  const compensation = employment.compensations[0];
  if (!compensation) return "Não informada";
  const amount = Number(compensation.amount);
  const formatted = Number.isFinite(amount)
    ? currency.format(amount)
    : compensation.amount;
  const units = {
    MONTHLY: "mês",
    HOURLY: "hora",
    PER_SERVICE: "serviço",
  } as const;
  return `${formatted} / ${units[compensation.unit]}`;
}

function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { readonly label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input className={inputClasses} {...props} />
    </label>
  );
}

function SensitiveState({
  configured,
  label,
}: {
  readonly configured: boolean;
  readonly label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${
        configured
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {label}: {configured ? "protegido e cadastrado" : "não cadastrado"}
    </span>
  );
}

function ActionMessage({
  state,
  message,
}: {
  readonly state: ActionState;
  readonly message: string;
}) {
  if (state !== "success" && state !== "error") return null;
  return (
    <p
      aria-live={state === "error" ? "assertive" : "polite"}
      className={`rounded-xl border p-4 text-sm font-bold ${
        state === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {message}
    </p>
  );
}

export default function EmployeesPage() {
  const [businessUnits, setBusinessUnits] = useState<readonly BusinessUnit[]>([]);
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [employees, setEmployees] = useState<readonly Employee[]>([]);
  const [jobRoles, setJobRoles] = useState<readonly JobRole[]>([]);
  const [nextEmploymentCode, setNextEmploymentCode] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [unitState, setUnitState] = useState<LoadState>("loading");
  const [employeeState, setEmployeeState] = useState<LoadState>("idle");
  const [loadMessage, setLoadMessage] = useState("");
  const [registrationState, setRegistrationState] = useState<ActionState>("idle");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [updateState, setUpdateState] = useState<ActionState>("idle");
  const [updateMessage, setUpdateMessage] = useState("");
  const [revision, setRevision] = useState(0);

  const uniqueEmployees = useMemo(
    () => Array.from(new Map(employees.map((employee) => [employee.id, employee])).values()),
    [employees],
  );
  const selectedEmployee = uniqueEmployees.find(
    (employee) => employee.id === selectedEmployeeId,
  );
  const selectedUnit = businessUnits.find((unit) => unit.id === businessUnitId);
  const canManage = unitState === "success" && selectedUnit !== undefined;

  useEffect(() => {
    let active = true;

    async function loadBusinessUnits() {
      try {
        const query = new URLSearchParams({ resource: "business-units" });
        const response = await fetch(`${endpoint}?${query}`, {
          cache: "no-store",
          headers: developmentUserRequestHeaders(),
        });
        const payload = await responsePayload(response);
        if (!active) return;
        if (response.status === 403) {
          setUnitState("forbidden");
          setLoadMessage("Seu perfil não possui autorização para administrar funcionários.");
          return;
        }
        if (!response.ok) {
          throw new Error(payloadMessage(payload, "Não foi possível carregar as unidades empresariais."));
        }
        const units = isRecord(payload) && Array.isArray(payload.businessUnits)
          ? payload.businessUnits.filter(isBusinessUnit)
          : [];
        setBusinessUnits(units);
        setUnitState("success");
        if (units.length === 1) setBusinessUnitId(units[0].id);
      } catch (error) {
        if (!active) return;
        setUnitState("error");
        setLoadMessage(error instanceof Error ? error.message : "Não foi possível carregar as unidades empresariais.");
      }
    }

    void loadBusinessUnits();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!businessUnitId) {
      return () => { active = false; };
    }

    async function loadUnitData() {
      setEmployeeState("loading");
      setLoadMessage("");
      try {
        const employeeQuery = new URLSearchParams({
          resource: "employees",
          businessUnitId,
        });
        const roleQuery = new URLSearchParams({
          resource: "job-roles",
          businessUnitId,
        });
        const [employeeResponse, roleResponse] = await Promise.all([
          fetch(`${endpoint}?${employeeQuery}`, {
            cache: "no-store",
            headers: developmentUserRequestHeaders(),
          }),
          fetch(`${endpoint}?${roleQuery}`, {
            cache: "no-store",
            headers: developmentUserRequestHeaders(),
          }),
        ]);
        const [employeePayload, rolePayload] = await Promise.all([
          responsePayload(employeeResponse),
          responsePayload(roleResponse),
        ]);
        if (!employeeResponse.ok) {
          throw new Error(payloadMessage(employeePayload, "Não foi possível carregar os funcionários."));
        }
        if (!roleResponse.ok) {
          throw new Error(payloadMessage(rolePayload, "Não foi possível carregar os cargos."));
        }
        if (!active) return;
        const loadedEmployees = isRecord(employeePayload) && Array.isArray(employeePayload.employees)
          ? employeePayload.employees.filter(isEmployee)
          : [];
        const loadedRoles = isRecord(rolePayload) && Array.isArray(rolePayload.jobRoles)
          ? rolePayload.jobRoles.filter(isJobRole)
          : [];
        setEmployees(loadedEmployees);
        setJobRoles(loadedRoles);
        setNextEmploymentCode(
          isRecord(employeePayload) && typeof employeePayload.nextEmploymentCode === "string"
            ? employeePayload.nextEmploymentCode
            : "",
        );
        setSelectedEmployeeId((current) => (
          loadedEmployees.some((employee) => employee.id === current) ? current : ""
        ));
        setEmployeeState("success");
      } catch (error) {
        if (!active) return;
        setEmployees([]);
        setJobRoles([]);
        setEmployeeState("error");
        setLoadMessage(error instanceof Error ? error.message : "Não foi possível carregar os funcionários.");
      }
    }

    void loadUnitData();
    return () => { active = false; };
  }, [businessUnitId, revision]);

  function changeBusinessUnit(nextId: string) {
    setBusinessUnitId(nextId);
    setEmployees([]);
    setJobRoles([]);
    setNextEmploymentCode("");
    setEmployeeState(nextId ? "loading" : "idle");
    setSelectedEmployeeId("");
    setRegistrationState("idle");
    setUpdateState("idle");
  }

  async function postAction(payload: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const result = await responsePayload(response);
    if (!response.ok) {
      throw new Error(payloadMessage(result, "A operação não pôde ser concluída."));
    }
    return result;
  }

  async function registerEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setRegistrationState("submitting");
    setRegistrationMessage("");
    try {
      if (!canManage) throw new Error("Selecione uma unidade empresarial autorizada.");
      const form = new FormData(formElement);
      const fullName = requiredFormText(form, "fullName");
      const duplicate = uniqueEmployees.some(
        (employee) => employee.fullName.trim().toLocaleLowerCase("pt-BR")
          === fullName.toLocaleLowerCase("pt-BR"),
      );
      if (duplicate) {
        throw new Error("Já existe um funcionário com este nome na unidade selecionada. Atualize o cadastro existente.");
      }
      const amount = optionalFormText(form, "amount");
      const startedAt = requiredFormText(form, "startedAt");
      await postAction({
        action: "register-employee",
        businessUnitId,
        fullName,
        jobRoleId: requiredFormText(form, "jobRoleId"),
        code: requiredFormText(form, "code"),
        type: "EMPLOYEE",
        workSchedule: requiredFormText(form, "workSchedule"),
        weeklyWorkingHours: optionalFormText(form, "weeklyWorkingHours"),
        startedAt,
        ...(amount ? {
          compensation: {
            amount,
            unit: requiredFormText(form, "compensationUnit"),
            effectiveFrom: startedAt,
            changeReason: "Remuneração inicial do vínculo",
          },
        } : {}),
      });
      setRegistrationState("success");
      setRegistrationMessage("Funcionário e vínculo cadastrados com sucesso. Selecione-o abaixo para completar os dados pessoais protegidos.");
      formElement.reset();
      setRevision((current) => current + 1);
    } catch (error) {
      setRegistrationState("error");
      setRegistrationMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o funcionário.");
    }
  }

  async function updatePersonalData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setUpdateState("submitting");
    setUpdateMessage("");
    try {
      if (!canManage || !selectedEmployee) {
        throw new Error("Selecione um funcionário já cadastrado.");
      }
      const form = new FormData(formElement);
      await postAction({
        action: "update-employee-personal-data",
        businessUnitId,
        employeeId: selectedEmployee.id,
        fullName: requiredFormText(form, "fullName"),
        cpf: requiredFormText(form, "cpf"),
        birthDate: requiredFormText(form, "birthDate"),
        identityDocument: optionalFormText(form, "identityDocument"),
        identityIssuer: optionalFormText(form, "identityIssuer"),
        identityState: optionalFormText(form, "identityState")?.toUpperCase() ?? null,
        socialSecurityNumber: optionalFormText(form, "socialSecurityNumber"),
        phone: optionalFormText(form, "phone"),
        email: optionalFormText(form, "email"),
        postalCode: optionalFormText(form, "postalCode"),
        addressStreet: optionalFormText(form, "addressStreet"),
        addressNumber: optionalFormText(form, "addressNumber"),
        addressComplement: optionalFormText(form, "addressComplement"),
        addressNeighborhood: optionalFormText(form, "addressNeighborhood"),
        addressCity: optionalFormText(form, "addressCity"),
        addressState: optionalFormText(form, "addressState")?.toUpperCase() ?? null,
        paymentMethod: optionalFormText(form, "paymentMethod"),
        paymentDetails: optionalFormText(form, "paymentDetails"),
      });
      setUpdateState("success");
      setUpdateMessage("Dados pessoais atualizados com sucesso. Os campos protegidos permanecerão ocultos.");
      formElement.reset();
      setRevision((current) => current + 1);
    } catch (error) {
      setUpdateState("error");
      setUpdateMessage(error instanceof Error ? error.message : "Não foi possível atualizar os dados pessoais.");
    }
  }

  const personalData = selectedEmployee?.personalData;
  const activeRoles = jobRoles.filter((role) => role.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <PageHeading
        backHref="/gestao"
        description="Consulte os vínculos reais por unidade e mantenha os dados cadastrais dos funcionários em uma área própria."
        eyebrow="Centro de Gestão SV"
        title="Funcionários"
      />

      <Card className="p-5 sm:p-6">
        <CardHeader>
          <CardTitle>Unidade empresarial</CardTitle>
          <CardDescription>Selecione a unidade para consultar e administrar somente os funcionários vinculados a ela.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="grid max-w-2xl gap-2 text-sm font-bold text-slate-700">
            Unidade empresarial
            <span className="relative">
              <Building2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <select
                className={`${inputClasses} pl-10`}
                disabled={unitState !== "success"}
                onChange={(event) => changeBusinessUnit(event.target.value)}
                value={businessUnitId}
              >
                <option value="">{unitState === "loading" ? "Carregando unidades..." : "Selecione uma unidade"}</option>
                {businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}{unit.code ? ` · ${unit.code}` : ""}</option>
                ))}
              </select>
            </span>
          </label>
          {unitState === "loading" ? (
            <p aria-live="polite" className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-emerald-600" />
              Carregando unidades empresariais autorizadas...
            </p>
          ) : null}
          {unitState === "success" && businessUnits.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Nenhuma unidade empresarial ativa está disponível.</p>
          ) : null}
          {unitState === "error" || unitState === "forbidden" ? (
            <p aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{loadMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <section aria-labelledby="employee-registration-title" className="space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Pessoas e vínculos</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="employee-registration-title">Cadastro de funcionários</h2>
          <p className="mt-1 text-sm text-slate-600">Cadastre vínculos, consulte a equipe da unidade e atualize os dados pessoais já suportados pela API.</p>
        </div>

        <Card className="p-5 sm:p-6" variant="elevated">
          <CardHeader>
            <CardTitle>Funcionários da unidade</CardTitle>
            <CardDescription>Uma linha por funcionário, usando o vínculo mais recente retornado para a unidade selecionada.</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeState === "loading" ? (
              <p aria-live="polite" className="flex items-center gap-2 py-6 text-sm font-bold text-slate-600"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Carregando funcionários reais...</p>
            ) : null}
            {employeeState === "error" ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
                <span>{loadMessage}</span>
                <Button onClick={() => setRevision((current) => current + 1)} size="small" type="button" variant="outline"><RefreshCw aria-hidden="true" className="size-4" />Tentar novamente</Button>
              </div>
            ) : null}
            {employeeState === "success" && uniqueEmployees.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Nenhum funcionário real está cadastrado nesta unidade.</p>
            ) : null}
            {employeeState === "success" && uniqueEmployees.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Nome</th>
                      <th className="px-4 py-3 font-black">Matrícula</th>
                      <th className="px-4 py-3 font-black">Cargo</th>
                      <th className="px-4 py-3 font-black">Situação</th>
                      <th className="px-4 py-3 font-black">Jornada</th>
                      <th className="px-4 py-3 font-black">Carga horária</th>
                      <th className="px-4 py-3 font-black">Remuneração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {uniqueEmployees.map((employee) => {
                      const employment = employee.employments[0];
                      return (
                        <tr className="bg-white align-top text-slate-700" key={employee.id}>
                          <td className="px-4 py-3 font-bold text-slate-950">{employee.fullName}</td>
                          <td className="px-4 py-3">{employment?.code ?? "Sem vínculo"}</td>
                          <td className="px-4 py-3">{employment?.jobRole.name ?? "Não informado"}</td>
                          <td className="px-4 py-3">{statusLabel(employment?.status ?? employee.status)}</td>
                          <td className="px-4 py-3">{employment ? scheduleLabel(employment.workSchedule) : "Não informada"}</td>
                          <td className="px-4 py-3">{employment?.weeklyWorkingHours ? `${employment.weeklyWorkingHours} h/semana` : "Não informada"}</td>
                          <td className="px-4 py-3 font-bold">{employment ? compensationLabel(employment) : "Não informada"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <CardHeader>
              <CardTitle>Novo funcionário</CardTitle>
              <CardDescription>Cria um único funcionário com vínculo, cargo, jornada e remuneração inicial na unidade selecionada.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={registerEmployee}>
                <fieldset className="grid gap-4 sm:grid-cols-2" disabled={!canManage || registrationState === "submitting"}>
                  <legend className="sr-only">Dados do novo funcionário</legend>
                  <div className="sm:col-span-2"><Field label="Nome completo" name="fullName" required /></div>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Cargo ou função
                    <select className={inputClasses} name="jobRoleId" required>
                      <option value="">Selecione um cargo</option>
                      {activeRoles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.code}</option>)}
                    </select>
                  </label>
                  <Field defaultValue={nextEmploymentCode} label="Matrícula" name="code" readOnly required />
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Jornada
                    <select className={inputClasses} defaultValue="FULL_TIME" name="workSchedule">
                      <option value="FULL_TIME">Integral</option>
                      <option value="PART_TIME">Meio expediente</option>
                      <option value="HOURLY">Por hora</option>
                      <option value="CUSTOM">Personalizada</option>
                    </select>
                  </label>
                  <Field label="Carga horária semanal" min="0.01" name="weeklyWorkingHours" step="0.01" type="number" />
                  <Field label="Data de início" name="startedAt" required type="date" />
                  <Field label="Remuneração inicial" min="0.01" name="amount" step="0.01" type="number" />
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Unidade da remuneração
                    <select className={inputClasses} defaultValue="MONTHLY" name="compensationUnit">
                      <option value="MONTHLY">Mensal</option>
                      <option value="HOURLY">Por hora</option>
                      <option value="PER_SERVICE">Por serviço</option>
                    </select>
                  </label>
                </fieldset>
                {canManage && activeRoles.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Não há cargo ativo disponível nesta unidade. O cadastro depende de um cargo real já existente.</p> : null}
                <ActionMessage message={registrationMessage} state={registrationState} />
                <Button disabled={!canManage || activeRoles.length === 0} loading={registrationState === "submitting"} type="submit"><Plus aria-hidden="true" className="size-4" />Cadastrar funcionário</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="p-5 sm:p-6">
            <CardHeader>
              <CardTitle>Dados pessoais e pagamento</CardTitle>
              <CardDescription>Atualize um cadastro existente. Dados sensíveis nunca são recarregados nem exibidos integralmente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Funcionário
                <select className={inputClasses} disabled={!canManage || employeeState !== "success"} onChange={(event) => { setSelectedEmployeeId(event.target.value); setUpdateState("idle"); }} value={selectedEmployeeId}>
                  <option value="">Selecione um funcionário</option>
                  {uniqueEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                </select>
              </label>

              {selectedEmployee ? (
                <form className="space-y-4" key={selectedEmployee.id} onSubmit={updatePersonalData}>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                    <div className="flex items-start gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><strong>Proteção ativa:</strong> CPF, RG, PIS/NIS e dados de pagamento permanecem cifrados. Redigite cada valor já cadastrado para preservá-lo ou substituí-lo nesta atualização.</p></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SensitiveState configured={Boolean(personalData?.hasCpf)} label="CPF" />
                      <SensitiveState configured={Boolean(personalData?.hasIdentityDocument)} label="RG" />
                      <SensitiveState configured={Boolean(personalData?.hasSocialSecurityNumber)} label="PIS/NIS" />
                      <SensitiveState configured={Boolean(personalData?.hasPaymentDetails)} label="Pagamento" />
                    </div>
                  </div>
                  <fieldset className="grid gap-4 sm:grid-cols-2" disabled={updateState === "submitting"}>
                    <legend className="sr-only">Dados pessoais do funcionário selecionado</legend>
                    <div className="sm:col-span-2"><Field defaultValue={selectedEmployee.fullName} label="Nome completo" name="fullName" required /></div>
                    <Field autoComplete="off" label="CPF (obrigatório para confirmar)" name="cpf" placeholder={personalData?.hasCpf ? "Já cadastrado — redigite para confirmar" : "000.000.000-00"} required type="password" />
                    <Field defaultValue={personalData?.birthDate?.slice(0, 10)} label="Data de nascimento" name="birthDate" required type="date" />
                    <Field autoComplete="off" label="RG" name="identityDocument" placeholder={personalData?.hasIdentityDocument ? "Já cadastrado — redigite para preservar ou substituir" : "Número do RG"} required={Boolean(personalData?.hasIdentityDocument)} type="password" />
                    <Field defaultValue={personalData?.identityIssuer ?? undefined} label="Órgão emissor" name="identityIssuer" />
                    <Field defaultValue={personalData?.identityState ?? undefined} label="UF do RG" maxLength={2} name="identityState" placeholder="CE" />
                    <Field autoComplete="off" label="PIS/NIS" name="socialSecurityNumber" placeholder={personalData?.hasSocialSecurityNumber ? "Já cadastrado — redigite para preservar ou substituir" : "Número do PIS/NIS"} required={Boolean(personalData?.hasSocialSecurityNumber)} type="password" />
                    <Field defaultValue={personalData?.phone ?? undefined} label="Telefone" name="phone" type="tel" />
                    <Field defaultValue={personalData?.email ?? undefined} label="E-mail" name="email" type="email" />
                    <Field defaultValue={personalData?.postalCode ?? undefined} label="CEP" name="postalCode" placeholder="00000-000" />
                    <Field defaultValue={personalData?.addressStreet ?? undefined} label="Rua/Avenida" name="addressStreet" />
                    <Field defaultValue={personalData?.addressNumber ?? undefined} label="Número" name="addressNumber" />
                    <Field defaultValue={personalData?.addressComplement ?? undefined} label="Complemento" name="addressComplement" />
                    <Field defaultValue={personalData?.addressNeighborhood ?? undefined} label="Bairro" name="addressNeighborhood" />
                    <Field defaultValue={personalData?.addressCity ?? undefined} label="Cidade" name="addressCity" />
                    <Field defaultValue={personalData?.addressState ?? undefined} label="Estado (UF)" maxLength={2} name="addressState" placeholder="CE" />
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Forma de pagamento
                      <select className={inputClasses} defaultValue={personalData?.paymentMethod ?? ""} name="paymentMethod">
                        <option value="">Não informada</option>
                        <option value="PIX">PIX</option>
                        <option value="BANK_TRANSFER">Transferência bancária</option>
                        <option value="CASH">Dinheiro</option>
                        <option value="OTHER">Outra</option>
                      </select>
                    </label>
                    <Field autoComplete="off" label="Chave PIX ou dados bancários" name="paymentDetails" placeholder={personalData?.hasPaymentDetails ? "Já cadastrado — redigite para preservar ou substituir" : "Informe somente se necessário"} required={Boolean(personalData?.hasPaymentDetails)} type="password" />
                  </fieldset>
                  <ActionMessage message={updateMessage} state={updateState} />
                  <Button loading={updateState === "submitting"} type="submit"><ShieldCheck aria-hidden="true" className="size-4" />Salvar dados protegidos</Button>
                </form>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Selecione um funcionário real da unidade para consultar os indicadores e atualizar os dados pessoais.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="system-users-title">
        <Card className="p-5 sm:p-6" variant="muted">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><UserRoundCog aria-hidden="true" className="size-5" /></span>
              <div>
                <CardTitle id="system-users-title">Usuários do sistema</CardTitle>
                <CardDescription>Contas de acesso e associação segura com funcionários.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <UsersRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-500" />
              <p>Não há uma API segura disponível nesta etapa para listar ou associar usuários do sistema. A integração será feita na próxima etapa, sem criar ou duplicar usuários.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

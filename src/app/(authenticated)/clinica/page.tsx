import type { Metadata } from "next";
import Link from "next/link";
import {
  Apple,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Database,
  FlaskConical,
  Search,
  UserPlus,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import {
  mvpService,
  type PatientListItem,
  type PatientWorkflowStatus,
} from "@/features/mvp";
import {
  nutritionClinicalFlowHref,
  type NutritionClinicalFlowStepStatus,
} from "@/features/nutrition-clinical-flow";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { prisma } from "@/lib/database/prisma";
import {
  Badge,
  ButtonLink,
  PageHeading,
  PageState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRegion,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Clínica SV",
};

type EtapaClinica = {
  codigo: string;
  titulo: string;
  descricao: string;
  href?: string;
  icone: LucideIcon;
};

const etapasClinicas: EtapaClinica[] = [
  {
    codigo: "01",
    titulo: "Pacientes",
    descricao: "Localize ou acesse o cadastro do paciente.",
    href: "/pacientes",
    icone: Users,
  },
  {
    codigo: "02",
    titulo: "Atendimentos",
    descricao: "Consulte e acompanhe os atendimentos.",
    href: "/atendimentos",
    icone: CalendarDays,
  },
  {
    codigo: "03",
    titulo: "Motor Clínico",
    descricao: "Reúna o contexto clínico do paciente.",
    icone: BrainCircuit,
  },
  {
    codigo: "04",
    titulo: "Estratégia Nutricional",
    descricao: "Estruture o direcionamento nutricional.",
    icone: Apple,
  },
  {
    codigo: "05",
    titulo: "Plano Alimentar",
    descricao: "Organize o planejamento alimentar.",
    icone: UtensilsCrossed,
  },
  {
    codigo: "06",
    titulo: "Exames",
    descricao: "Acompanhe os registros de exames.",
    icone: FlaskConical,
  },
];

const workflowLabels: Readonly<Record<PatientWorkflowStatus, string>> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  WAITING_PROFESSIONAL: "Aguardando profissional",
  PENDING_REVIEW: "Aguardando revisão",
  COMPLETED: "Concluído",
};

type NutritionCentralFilter =
  | "all"
  | "attendance"
  | "strategy"
  | "meal-plan"
  | "deliverable"
  | "completed";

const nutritionCentralFilters: ReadonlyArray<{
  value: NutritionCentralFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "attendance", label: "Em atendimento" },
  { value: "strategy", label: "Estratégia" },
  { value: "meal-plan", label: "Plano alimentar" },
  { value: "deliverable", label: "Entregável" },
  { value: "completed", label: "Concluídos" },
];

const nutritionDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function resolveCentralText(value?: string | string[]) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, 120) : undefined;
}

function resolveCentralFilter(
  value?: string | string[],
): NutritionCentralFilter {
  return value === "attendance" ||
    value === "strategy" ||
    value === "meal-plan" ||
    value === "deliverable" ||
    value === "completed"
    ? value
    : "all";
}

function nutritionCentralHref(
  filter: NutritionCentralFilter,
  search?: string,
) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (search) params.set("query", search);
  const query = params.toString();
  return query ? `/clinica?${query}` : "/clinica";
}

function nutritionReportHref(href: string) {
  const url = new URL(href, "https://clinica-sv.internal");
  url.searchParams.set("view", "nutrition");
  return `${url.pathname}${url.search}`;
}

function NutritionStatusBadge({
  status,
}: {
  status?: NutritionClinicalFlowStepStatus;
}) {
  if (status === "COMPLETED") return <Badge tone="success">Concluído</Badge>;
  if (status === "IN_PROGRESS") return <Badge tone="info">Em andamento</Badge>;
  if (status === "SKIPPED") return <Badge tone="warning">Não realizada</Badge>;
  if (status === "BLOCKED") return <Badge tone="warning">Bloqueado</Badge>;
  if (status === "NOT_STARTED" || status === undefined) {
    return <Badge tone="neutral">Não iniciado</Badge>;
  }

  return <Badge tone="neutral">Estado indisponível</Badge>;
}

async function NutritionCentral({
  filter,
  search,
}: {
  filter: NutritionCentralFilter;
  search?: string;
}) {
  await mvpService.getSession();

  const patients = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              {
                clinicalCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      clinicalCode: true,
      masterRecord: {
        select: {
          status: true,
          attendances: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              updatedAt: true,
              professional: { select: { fullName: true } },
            },
          },
          entries: {
            where: {
              type: { in: ["NUTRITION_STRATEGY", "MEAL_PLAN"] },
              status: { not: "VOIDED" },
              deletedAt: null,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              updatedAt: true,
              updatedBy: { select: { fullName: true } },
            },
          },
          continuity: {
            select: {
              lastActivityAt: true,
              responsible: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  const rows = await Promise.all(
    patients.map(async (patient) => {
      const masterRecord = patient.masterRecord;
      const attendance =
        masterRecord?.status === "ACTIVE"
          ? masterRecord.attendances[0]
          : undefined;
      const flow = attendance
        ? await nutritionClinicalFlowRepository.getFlow({
            patientId: patient.id,
            attendanceId: attendance.id,
          })
        : null;
      const strategy = flow?.flow.find(
        (step) => step.id === "NUTRITION_STRATEGY",
      );
      const mealPlan = flow?.flow.find((step) => step.id === "MEAL_PLAN");
      const deliverable = flow?.flow.find(
        (step) => step.id === "DELIVERABLES",
      );
      const persistedUpdates = [
        masterRecord?.entries[0]
          ? {
              at: masterRecord.entries[0].updatedAt,
              professionalName:
                masterRecord.entries[0].updatedBy.fullName,
            }
          : undefined,
        masterRecord?.continuity?.lastActivityAt
          ? {
              at: masterRecord.continuity.lastActivityAt,
              professionalName:
                masterRecord.continuity.responsible?.fullName,
            }
          : undefined,
        attendance
          ? {
              at: attendance.updatedAt,
              professionalName: attendance.professional.fullName,
            }
          : undefined,
      ]
        .filter(
          (
            update,
          ): update is {
            at: Date;
            professionalName: string | undefined;
          } => Boolean(update),
        )
        .sort((left, right) => right.at.getTime() - left.at.getTime());
      const latestUpdate = persistedUpdates[0];

      return {
        patientId: patient.id,
        patientName: patient.fullName,
        code: patient.clinicalCode,
        attendanceId: attendance?.id,
        attendanceStatus: attendance?.status,
        currentStep: flow?.resumeStep,
        strategy,
        mealPlan,
        deliverable,
        updatedAt: latestUpdate?.at,
        responsibleName:
          latestUpdate?.professionalName ?? attendance?.professional.fullName,
      };
    }),
  );

  const filteredRows = rows
    .filter((row) => {
      if (filter === "attendance") {
        return (
          row.attendanceStatus === "DRAFT" ||
          row.attendanceStatus === "IN_PROGRESS"
        );
      }
      if (filter === "strategy") {
        return row.currentStep?.id === "NUTRITION_STRATEGY";
      }
      if (filter === "meal-plan") {
        return row.currentStep?.id === "MEAL_PLAN";
      }
      if (filter === "deliverable") {
        return row.currentStep?.id === "DELIVERABLES";
      }
      if (filter === "completed") {
        return (
          row.attendanceStatus === "COMPLETED" ||
          row.currentStep?.id === "FINALIZE_ATTENDANCE"
        );
      }
      return true;
    })
    .sort((left, right) => {
      const byUpdate =
        (right.updatedAt?.getTime() ?? 0) -
        (left.updatedAt?.getTime() ?? 0);
      return (
        byUpdate ||
        left.patientName.localeCompare(right.patientName, "pt-BR")
      );
    });

  const noPatients = patients.length === 0 && !search && filter === "all";
  const noResults = filteredRows.length === 0 && !noPatients;

  function SecondaryActions({
    row,
  }: {
    row: (typeof filteredRows)[number];
  }) {
    if (!row.attendanceId || !row.currentStep) return null;

    const strategyHref = nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
      patientId: row.patientId,
      attendanceId: row.attendanceId,
    });
    const mealPlanHref = nutritionClinicalFlowHref("MEAL_PLAN", {
      patientId: row.patientId,
      attendanceId: row.attendanceId,
    });
    const deliverableHref = nutritionClinicalFlowHref("DELIVERABLES", {
      patientId: row.patientId,
      attendanceId: row.attendanceId,
    });
    const reportAvailable =
      row.deliverable?.status === "IN_PROGRESS" ||
      row.deliverable?.status === "COMPLETED";

    return (
      <details className="relative w-full">
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-center text-xs font-bold text-[#1f6a4d] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d]">
          Outras etapas
        </summary>
        <div className="mt-2 grid gap-1.5 text-center text-xs font-bold">
          <Link className="text-[#1f6a4d] underline-offset-4 hover:underline" href={strategyHref}>
            Estratégia
          </Link>
          <Link className="text-[#1f6a4d] underline-offset-4 hover:underline" href={mealPlanHref}>
            Plano alimentar
          </Link>
          <Link className="text-[#1f6a4d] underline-offset-4 hover:underline" href={deliverableHref}>
            Entregáveis
          </Link>
          {reportAvailable ? (
            <Link
              className="text-[#1f6a4d] underline-offset-4 hover:underline"
              href={nutritionReportHref(deliverableHref)}
            >
              Relatório nutricional
            </Link>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <div className="min-w-0">
      <PageHeading
        description="Estratégia nutricional, plano alimentar e entregáveis dos pacientes."
        title="Nutrição"
      />

      <section aria-label="Localizar pacientes" className="mb-5 space-y-3">
        <form className="flex flex-col gap-2 sm:flex-row" method="get">
          {filter !== "all" ? (
            <input name="filter" type="hidden" value={filter} />
          ) : null}
          <label className="sr-only" htmlFor="nutrition-search">
            Pesquisar por nome ou código do paciente
          </label>
          <input
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1f6a4d] focus:ring-2 focus:ring-emerald-100"
            defaultValue={search}
            id="nutrition-search"
            name="query"
            placeholder="Pesquisar por nome ou código do paciente"
            type="search"
          />
          <button
            className="min-h-11 shrink-0 rounded-xl bg-[#1f6a4d] px-5 text-sm font-black text-white transition hover:bg-[#174f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            type="submit"
          >
            Pesquisar
          </button>
        </form>

        <nav aria-label="Filtrar fluxo nutricional" className="flex gap-2 overflow-x-auto pb-1">
          {nutritionCentralFilters.map((option) => {
            const active = filter === option.value;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  active
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                }`}
                href={nutritionCentralHref(option.value, search)}
                key={option.value}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
      </section>

      {noPatients ? (
        <PageState
          action={<ButtonLink href="/pacientes">Abrir pacientes</ButtonLink>}
          description="Não há pacientes cadastrados disponíveis para o fluxo nutricional."
          title="Nenhum paciente encontrado"
        />
      ) : noResults ? (
        <PageState
          action={<ButtonLink href="/clinica">Limpar filtros</ButtonLink>}
          description="Nenhum paciente corresponde à pesquisa ou ao filtro selecionado."
          title="Nenhum paciente encontrado"
        />
      ) : (
        <>
          <TableRegion className="hidden w-full max-w-full overflow-x-hidden xl:block" label="Fluxo nutricional dos pacientes">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
              </colgroup>
              <TableHead>
                <tr>
                  <TableHeaderCell>Paciente</TableHeaderCell>
                  <TableHeaderCell>Etapa atual</TableHeaderCell>
                  <TableHeaderCell className="px-2">Estratégia</TableHeaderCell>
                  <TableHeaderCell className="px-2">Plano alimentar</TableHeaderCell>
                  <TableHeaderCell className="px-2">Entregável</TableHeaderCell>
                  <TableHeaderCell>Atualização</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ação</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => (
                  <tr key={row.patientId}>
                    <TableCell>
                      <p className="line-clamp-2 font-bold leading-5 text-slate-900">
                        {row.patientName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Código {row.code}
                      </p>
                    </TableCell>
                    <TableCell className="break-words text-slate-700">
                      {row.currentStep?.title ?? "—"}
                    </TableCell>
                    <TableCell className="px-2"><NutritionStatusBadge status={row.strategy?.status} /></TableCell>
                    <TableCell className="px-2"><NutritionStatusBadge status={row.mealPlan?.status} /></TableCell>
                    <TableCell className="px-2"><NutritionStatusBadge status={row.deliverable?.status} /></TableCell>
                    <TableCell>
                      <p className="text-sm leading-5 text-slate-700">
                        {row.updatedAt ? nutritionDateFormatter.format(row.updatedAt) : "—"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                        {row.responsibleName ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="pl-2">
                      <div className="ml-auto flex w-full max-w-44 flex-col items-stretch gap-1">
                        {row.currentStep ? (
                          <ButtonLink fullWidth href={row.currentStep.href} size="small" variant="outline">
                            Continuar atendimento
                          </ButtonLink>
                        ) : (
                          <ButtonLink fullWidth href={`/pacientes/${encodeURIComponent(row.patientId)}`} size="small" variant="outline">
                            Abrir prontuário
                          </ButtonLink>
                        )}
                        <SecondaryActions row={row} />
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </TableRegion>

          <div className="space-y-3 xl:hidden">
            {filteredRows.map((row) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={row.patientId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-black leading-5 text-slate-900">{row.patientName}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Código {row.code}</p>
                  </div>
                  <span className="max-w-36 text-right text-xs font-bold text-[#1f6a4d]">
                    {row.currentStep?.title ?? "Sem atendimento"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 border-y border-slate-100 py-3 text-xs min-[430px]:grid-cols-3">
                  <div><dt className="mb-1 font-bold text-slate-500">Estratégia</dt><dd><NutritionStatusBadge status={row.strategy?.status} /></dd></div>
                  <div><dt className="mb-1 font-bold text-slate-500">Plano</dt><dd><NutritionStatusBadge status={row.mealPlan?.status} /></dd></div>
                  <div><dt className="mb-1 font-bold text-slate-500">Entregável</dt><dd><NutritionStatusBadge status={row.deliverable?.status} /></dd></div>
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="font-bold text-slate-500">Atualização</dt>
                    <dd className="mt-1 text-slate-700">{row.updatedAt ? nutritionDateFormatter.format(row.updatedAt) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Responsável</dt>
                    <dd className="mt-1 text-slate-700">{row.responsibleName ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  {row.currentStep ? (
                    <ButtonLink fullWidth href={row.currentStep.href} size="small" variant="outline">
                      Continuar atendimento
                    </ButtonLink>
                  ) : (
                    <ButtonLink fullWidth href={`/pacientes/${encodeURIComponent(row.patientId)}`} size="small" variant="outline">
                      Abrir prontuário
                    </ButtonLink>
                  )}
                  <SecondaryActions row={row} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function criarEtapasClinicas(
  paciente?: PatientListItem,
): EtapaClinica[] {
  if (!paciente) {
    return etapasClinicas;
  }

  const patientId = encodeURIComponent(paciente.patient.id);
  const patientBase = `/pacientes/${patientId}`;

  return etapasClinicas.map((etapa) => {
    switch (etapa.codigo) {
      case "01":
        return {
          ...etapa,
          descricao: "Acesse o prontuário do paciente selecionado.",
          href: patientBase,
        };
      case "02":
        return {
          ...etapa,
          descricao: paciente.openAttendanceId
            ? "Continue o atendimento em andamento."
            : "Consulte ou inicie um atendimento.",
          href: paciente.openAttendanceId
            ? `${patientBase}/continuar`
            : "/atendimentos",
        };
      case "03":
        return {
          ...etapa,
          href: `${patientBase}/motor-clinico`,
        };
      case "04":
        return {
          ...etapa,
          href: `${patientBase}/estrategia-nutricional`,
        };
      case "05":
        return {
          ...etapa,
          href: `${patientBase}/plano-alimentar`,
        };
      case "06":
        return {
          ...etapa,
          href: `${patientBase}/exames`,
        };
      default:
        return etapa;
    }
  });
}

function EtapaCard({
  etapa,
  ultima,
}: {
  etapa: EtapaClinica;
  ultima: boolean;
}) {
  const Icone = etapa.icone;
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#1f6a4d]">
          <Icone aria-hidden="true" className="h-5 w-5" strokeWidth={1.9} />
        </div>

        <span className="text-[11px] font-bold tracking-[0.12em] text-[#a58132]">
          {etapa.codigo}
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-[15px] font-bold leading-tight text-slate-900">
          {etapa.titulo}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {etapa.descricao}
        </p>
      </div>

      <div className="mt-auto pt-4">
        {etapa.href ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1f6a4d]">
            Acessar etapa
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="text-[11px] font-semibold leading-4 text-slate-500">
            Selecione um paciente para acessar
          </span>
        )}
      </div>
    </>
  );

  const classes =
    "relative flex min-h-[190px] flex-col rounded-[22px] border border-[#dce2dd] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]";

  return (
    <div className="relative min-w-0">
      {etapa.href ? (
        <Link
          aria-label={`Acessar ${etapa.titulo}`}
          className={`${classes} group transition duration-200 hover:-translate-y-1 hover:border-[#9fc6ae] hover:shadow-[0_12px_28px_rgba(31,106,77,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2`}
          href={etapa.href}
        >
          {conteudo}
        </Link>
      ) : (
        <article className={classes}>{conteudo}</article>
      )}

      {!ultima ? (
        <span
          aria-hidden="true"
          className="absolute -right-3 top-1/2 z-10 hidden h-px w-6 bg-[#cfb66f] 2xl:block"
        >
          <ArrowRight className="absolute -right-0.5 -top-1.5 h-3 w-3 text-[#a58132]" />
        </span>
      ) : null}
    </div>
  );
}

export default async function ClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{
    attendanceId?: string | string[];
    filter?: string | string[];
    patientId?: string | string[];
    query?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const requestedPatientId = resolveCentralText(query.patientId);

  if (!requestedPatientId) {
    return (
      <NutritionCentral
        filter={resolveCentralFilter(query.filter)}
        search={resolveCentralText(query.query)}
      />
    );
  }

  const masterRecord = requestedPatientId
    ? await mvpService.getPatientMasterRecord(requestedPatientId)
    : null;
  const paciente = masterRecord?.patient;
  const pacienteNaoEncontrado = Boolean(
    requestedPatientId && !paciente,
  );
  const etapas = criarEtapasClinicas(paciente);

  return (
    <div className="min-w-0">
      <header className="overflow-hidden rounded-[26px] border border-[#dce2dd] bg-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#123d2d] via-[#1f6a4d] to-[#d1ad52]" />

        <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#123d2d] to-[#1f6a4d] text-sm font-bold tracking-[0.12em] text-[#e4c878] shadow-lg shadow-emerald-950/10">
              SV
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1f6a4d]">
                Centro Clínico de Nutrição
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Clínica SV
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Gestão integrada do atendimento nutricional
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b9c8be] bg-white px-4 text-sm font-bold text-[#174f3a] transition hover:border-[#1f6a4d] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/pacientes?returnTo=/clinica"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Localizar paciente
            </Link>

            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6a4d] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#174f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/pacientes/novo"
            >
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Novo paciente
            </Link>
          </div>
        </div>

        <div className="border-t border-[#e5ebe7] bg-[#fbfdfb] px-5 py-4 sm:px-7 lg:px-8">
          {paciente ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1f6a4d]">
                  Paciente selecionado
                </p>

                <p className="mt-1 truncate text-base font-bold text-slate-900">
                  {paciente.patient.fullName}
                </p>
              </div>

              {paciente.mainObjective || paciente.workflowStatus ? (
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  {paciente.mainObjective ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Objetivo principal
                      </dt>

                      <dd className="mt-0.5 text-xs font-bold text-slate-700">
                        {paciente.mainObjective}
                      </dd>
                    </div>
                  ) : null}

                  {paciente.workflowStatus ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </dt>

                      <dd className="mt-0.5 text-xs font-bold text-[#1f6a4d]">
                        {workflowLabels[paciente.workflowStatus]}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          ) : pacienteNaoEncontrado ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a58132]">
                  Contexto do atendimento
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  Paciente não encontrado
                </p>
              </div>

              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#b9c8be] bg-white px-4 text-xs font-bold text-[#174f3a] transition hover:border-[#1f6a4d] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
                href="/pacientes?returnTo=/clinica"
              >
                Selecionar outro paciente
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Contexto do atendimento
              </p>

              <p className="mt-1 text-sm font-bold text-slate-700">
                Nenhum paciente selecionado
              </p>
            </div>
          )}
        </div>
      </header>

      <div>
        <section aria-labelledby="fluxo-clinico" className="mt-6">
          <div className="rounded-2xl border border-[#dce5df] bg-[#f4faf6] px-4 py-3 sm:px-5">
            <p className="flex items-start gap-2 text-sm font-medium text-[#174f3a]">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d1ad52]"
              />
              {paciente
                ? `Atendimento clínico de ${paciente.patient.fullName}.`
                : pacienteNaoEncontrado
                  ? "Paciente não encontrado. Selecione outro cadastro para continuar."
                  : "Selecione ou cadastre um paciente para iniciar o atendimento clínico."}
            </p>
          </div>

          <div className="mb-4 mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6a4d]">
              Jornada do atendimento
            </p>

            <h2
              className="mt-1 text-xl font-bold text-slate-900"
              id="fluxo-clinico"
            >
              Fluxo Clínico Integrado
            </h2>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {etapas.map((etapa, index) => (
              <EtapaCard
                etapa={etapa}
                key={etapa.codigo}
                ultima={index === etapas.length - 1}
              />
            ))}
          </div>
        </section>

      </div>

      <footer className="mt-8 border-t border-slate-200 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Conhecimento e suporte
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Recursos complementares do Sistema Integrado SV
            </p>
          </div>

          <nav
            aria-label="Conhecimento e suporte"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-[#1f6a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/administracao/biblioteca-cientifica"
            >
              <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
              Biblioteca Científica
            </Link>

            <Link
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-[#1f6a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/central-de-dados"
            >
              <Database aria-hidden="true" className="h-3.5 w-3.5" />
              Central de Dados
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

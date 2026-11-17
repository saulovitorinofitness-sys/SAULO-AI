import { ArrowLeft, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import {
  PerformanceCalendar,
  type PerformanceCalendarPlanOption,
  type PerformanceCalendarPrescription,
} from "@/components/performance-monitoring/performance-calendar";
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
import { canAccess, mvpService } from "@/features/mvp";
import {
  parseStoredWorkoutPlanPayload,
  performanceEnduranceService,
} from "@/features/performance-endurance";
import { performanceWorkoutRepository } from "@/features/performance-endurance/workout-repository";
import { runningPrescriptionTotals } from "@/features/performance-endurance/running-session-editor";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import type { PerformanceModality } from "@/features/performance-monitoring/contracts";
import { prisma } from "@/lib/database/prisma";

export const metadata: Metadata = { title: "Performance" };

const PerformanceWorkoutWorkspaceLazy = dynamic(
  () =>
    import("@/components/performance-endurance").then(
      (module) => module.PerformanceWorkoutWorkspace,
    ),
  {
    loading: () => (
      <PageState
        description="Carregando o Plano de Treino."
        title="Performance"
      />
    ),
  },
);

type PerformanceFilter = "all" | "planning" | "draft" | "finalized";
type CentralStatus = "PLANNING" | "DRAFT" | "FINALIZED" | "NO_PLAN";

const filterOptions: ReadonlyArray<{
  value: PerformanceFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "planning", label: "Em planejamento" },
  { value: "draft", label: "Rascunhos" },
  { value: "finalized", label: "Finalizados" },
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function resolveText(value?: string | string[]) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, 120) : undefined;
}

function resolveFilter(value?: string | string[]): PerformanceFilter {
  return value === "planning" || value === "draft" || value === "finalized"
    ? value
    : "all";
}

function centralHref(filter: PerformanceFilter, query?: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("query", query);
  const search = params.toString();
  return search ? `/performance-endurance?${search}` : "/performance-endurance";
}

function workspaceHref(
  patientId: string,
  attendanceId: string,
  tab?: "calendar" | "executions",
) {
  const params = new URLSearchParams({ patientId, attendanceId });
  if (tab) params.set("tab", tab);
  return `/performance-endurance?${params.toString()}`;
}

function planModality(
  contractedService: string | undefined,
  primaryModality: string,
): PerformanceModality {
  if (contractedService === "RUNNING_PLAN") return "RUNNING";
  if (contractedService === "CYCLING_PLAN") return "CYCLING";
  if (contractedService?.startsWith("STRENGTH_")) return "STRENGTH";

  const normalized = primaryModality
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (normalized.includes("corrida")) return "RUNNING";
  if (
    normalized.includes("ciclismo") ||
    normalized.includes("bicicleta") ||
    normalized.includes("bike")
  ) {
    return "CYCLING";
  }
  if (normalized.includes("musculacao") || normalized.includes("forca")) {
    return "STRENGTH";
  }
  return "OTHER";
}

async function PerformanceCalendarView({
  patientId,
  backHref,
}: {
  patientId: string;
  backHref: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      deletedAt: null,
      masterRecord: { is: { status: "ACTIVE" } },
    },
    select: {
      fullName: true,
      masterRecord: {
        select: {
          id: true,
          entries: {
            where: {
              type: "WORKOUT_PLAN",
              status: { in: ["DRAFT", "FINALIZED"] },
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              workoutPlan: { select: { title: true, content: true } },
            },
          },
        },
      },
    },
  });

  if (!patient?.masterRecord) {
    return (
      <PageState
        action={
          <ButtonLink
            className="whitespace-nowrap border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80"
            href={backHref}
            size="small"
            variant="outline"
          >
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            Voltar à Central
          </ButtonLink>
        }
        description="O paciente não possui um prontuário ativo disponível para o calendário."
        title="Paciente não localizado"
        tone="blocked"
      />
    );
  }

  const entriesById = new Map(
    patient.masterRecord.entries
      .filter((entry) => entry.workoutPlan)
      .map((entry) => [entry.id, entry] as const),
  );
  const versions = entriesById.size
    ? await prisma.recordVersion.findMany({
        where: {
          entityType: "WORKOUT_PLAN",
          entityId: { in: [...entriesById.keys()] },
          status: "FINALIZED",
        },
        orderBy: [{ entityId: "asc" }, { version: "desc" }],
        select: {
          id: true,
          entityId: true,
          version: true,
          snapshot: true,
        },
      })
    : [];

  const planOptions: PerformanceCalendarPlanOption[] = [];
  const prescribedSessions: PerformanceCalendarPrescription[] = [];
  const draftEntryIds = new Set<string>();
  for (const entry of entriesById.values()) {
    if (entry.status !== "DRAFT" || !entry.workoutPlan) continue;
    const snapshot = parseStoredWorkoutPlanPayload(entry.workoutPlan.content);
    if (!snapshot) continue;
    draftEntryIds.add(entry.id);
    for (const session of snapshot.endurance?.running?.weeks.flatMap(
      (week) => week.sessions,
    ) ?? []) {
      if (session.sessionKind !== "STRUCTURED") continue;
      const totals = runningPrescriptionTotals(session);
      prescribedSessions.push({
        id: `draft:${entry.id}:${session.id}`,
        sessionId: session.id,
        title: `${session.title} · rascunho`,
        modality: "RUNNING",
        scheduledDate: session.scheduledDate,
        plannedDurationSeconds:
          totals.durationSeconds ?? session.estimatedDurationSeconds,
        plannedDistanceMeters:
          totals.distanceMeters ?? session.estimatedDistanceMeters,
        draft: true,
      });
    }
  }
  const latestEntries = new Set<string>();
  for (const version of versions) {
    if (latestEntries.has(version.entityId)) continue;
    latestEntries.add(version.entityId);
    const entry = entriesById.get(version.entityId);
    const snapshot = parseStoredWorkoutPlanPayload(version.snapshot);
    if (!entry?.workoutPlan || snapshot?.status !== "FINALIZED") continue;

    const label =
      snapshot.strategy.programName.trim() || entry.workoutPlan.title;
    const modality = planModality(
      snapshot.service.contractedService,
      snapshot.service.primaryModality,
    );
    for (const session of snapshot.sessions) {
      planOptions.push({
        label,
        versionLabel: `Versão ${version.version}`,
        workoutPlanEntryId: entry.id,
        workoutPlanVersionId: version.id,
        sessionId: session.id,
        sessionLabel: session.name,
        suggestedTitle: session.name,
        modality,
      });
    }
    for (const session of snapshot.endurance?.running?.weeks.flatMap(
      (week) => week.sessions,
    ) ?? []) {
      planOptions.push({
        label,
        versionLabel: `Versão ${version.version}`,
        workoutPlanEntryId: entry.id,
        workoutPlanVersionId: version.id,
        sessionId: session.id,
        sessionLabel: session.title,
        suggestedTitle: session.title,
        modality: "RUNNING",
      });
      if (
        session.sessionKind === "STRUCTURED" &&
        !draftEntryIds.has(entry.id)
      ) {
        const totals = runningPrescriptionTotals(session);
        prescribedSessions.push({
          id: `${version.id}:${session.id}`,
          sessionId: session.id,
          title: session.title,
          modality: "RUNNING",
          scheduledDate: session.scheduledDate,
          plannedDurationSeconds:
            totals.durationSeconds ?? session.estimatedDurationSeconds,
          plannedDistanceMeters:
            totals.distanceMeters ?? session.estimatedDistanceMeters,
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      <ButtonLink
        className="w-fit whitespace-nowrap border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80"
        href={backHref}
        size="small"
        variant="outline"
      >
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
        Voltar à Central
      </ButtonLink>
      <PerformanceCalendar
        masterRecordId={patient.masterRecord.id}
        patientName={patient.fullName}
        planOptions={planOptions}
        prescribedSessions={prescribedSessions}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: CentralStatus }) {
  if (status === "FINALIZED") return <Badge tone="success">Finalizado</Badge>;
  if (status === "DRAFT") return <Badge tone="warning">Rascunho</Badge>;
  if (status === "PLANNING") return <Badge tone="info">Em planejamento</Badge>;
  return <Badge tone="neutral">Sem plano</Badge>;
}

function actionLabel(status: CentralStatus) {
  if (status === "FINALIZED") return "Abrir plano";
  if (status === "DRAFT") return "Continuar planejamento";
  return "Iniciar planejamento";
}

async function PerformanceCentral({
  filter,
  query,
}: {
  filter: PerformanceFilter;
  query?: string;
}) {
  const patients = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      masterRecord: { is: { status: "ACTIVE" } },
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" as const } },
              {
                clinicalCode: {
                  contains: query,
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
      clinicalCode: true,
      fullName: true,
      masterRecord: {
        select: {
          id: true,
          entries: {
            where: {
              type: "WORKOUT_PLAN",
              status: { in: ["DRAFT", "FINALIZED"] },
              attendanceId: { not: null },
              deletedAt: null,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              id: true,
              attendanceId: true,
              status: true,
              updatedAt: true,
              updatedBy: { select: { id: true, fullName: true } },
              workoutPlan: { select: { title: true } },
            },
          },
          attendances: {
            where: {
              status: { in: ["DRAFT", "IN_PROGRESS"] },
              deletedAt: null,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              updatedAt: true,
              professional: { select: { id: true, fullName: true } },
            },
          },
        },
      },
    },
  });

  const entryIds = patients.flatMap(
    (patient) => patient.masterRecord?.entries.map((entry) => entry.id) ?? [],
  );
  const versions = entryIds.length
    ? await prisma.recordVersion.findMany({
        where: {
          entityType: "WORKOUT_PLAN",
          entityId: { in: entryIds },
        },
        orderBy: { version: "desc" },
        select: {
          entityId: true,
          responsible: { select: { id: true, fullName: true } },
        },
      })
    : [];
  const responsibleByEntry = new Map(
    versions.map((version) => [version.entityId, version.responsible] as const),
  );

  const rows = patients
    .map((patient) => {
      const plan = patient.masterRecord?.entries[0];
      const attendance = patient.masterRecord?.attendances[0];
      const status: CentralStatus = plan
        ? plan.status === "FINALIZED"
          ? "FINALIZED"
          : "DRAFT"
        : attendance?.status === "IN_PROGRESS"
          ? "PLANNING"
          : "NO_PLAN";
      const routeAttendanceId = plan?.attendanceId ?? attendance?.id;
      const responsible = plan
        ? responsibleByEntry.get(plan.id) ?? plan.updatedBy
        : attendance?.professional;

      return {
        patientId: patient.id,
        masterRecordId: patient.masterRecord?.id,
        patientName: patient.fullName,
        code: patient.clinicalCode,
        planTitle: plan?.workoutPlan?.title,
        status,
        updatedAt: plan?.updatedAt ?? attendance?.updatedAt,
        responsibleName: responsible?.fullName,
        routeAttendanceId,
      };
    })
    .filter((row) => {
      if (filter === "planning") return row.status === "PLANNING";
      if (filter === "draft") return row.status === "DRAFT";
      if (filter === "finalized") return row.status === "FINALIZED";
      return true;
    })
    .sort((left, right) => {
      const byUpdate =
        (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0);
      return byUpdate || left.patientName.localeCompare(right.patientName, "pt-BR");
    });

  const noPatients = patients.length === 0 && !query;
  const noResults = rows.length === 0 && !noPatients;

  return (
    <>
      <PageHeading
        description="Planejamento, prescrição e acompanhamento dos treinos dos pacientes."
        title="Performance"
      />

      <section aria-label="Localizar pacientes" className="mb-5 space-y-3">
        <form className="flex flex-col gap-2 sm:flex-row" method="get">
          {filter !== "all" ? (
            <input name="filter" type="hidden" value={filter} />
          ) : null}
          <label className="sr-only" htmlFor="performance-search">
            Pesquisar por nome ou código do paciente
          </label>
          <input
            className="min-h-11 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-emerald-100"
            defaultValue={query}
            id="performance-search"
            name="query"
            placeholder="Pesquisar por nome ou código do paciente"
            type="search"
          />
          <button
            className="min-h-11 shrink-0 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            type="submit"
          >
            Pesquisar
          </button>
        </form>

        <nav aria-label="Filtrar planos por situação" className="flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map((option) => {
            const active = filter === option.value;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  active
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                }`}
                href={centralHref(option.value, query)}
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
          description="Não há pacientes cadastrados disponíveis para a Performance."
          title="Nenhum paciente encontrado"
        />
      ) : noResults ? (
        <PageState
          action={<ButtonLink href="/performance-endurance">Limpar filtros</ButtonLink>}
          description="Nenhum paciente corresponde à pesquisa ou ao filtro selecionado."
          title="Nenhum paciente encontrado"
        />
      ) : (
        <>
          <TableRegion className="hidden md:block" label="Pacientes e planos de treino">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Paciente</TableHeaderCell>
                  <TableHeaderCell>Código</TableHeaderCell>
                  <TableHeaderCell>Plano</TableHeaderCell>
                  <TableHeaderCell>Situação</TableHeaderCell>
                  <TableHeaderCell>Última atualização</TableHeaderCell>
                  <TableHeaderCell>Profissional responsável</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ação</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <tr key={row.patientId}>
                    <TableCell className="font-bold text-[var(--text-primary)]">
                      {row.patientName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--text-secondary)]">
                      {row.code}
                    </TableCell>
                    <TableCell className="max-w-52 text-[var(--text-secondary)]">
                      {row.planTitle ?? "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--text-secondary)]">
                      {row.updatedAt ? dateFormatter.format(row.updatedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {row.responsibleName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex w-48 max-w-full flex-col items-stretch gap-1.5">
                        {row.routeAttendanceId ? (
                          <ButtonLink
                            className="w-full whitespace-nowrap"
                            href={workspaceHref(row.patientId, row.routeAttendanceId)}
                            size="small"
                            variant="primary"
                          >
                            {actionLabel(row.status)}
                          </ButtonLink>
                        ) : (
                          <ButtonLink
                            className="w-full whitespace-nowrap"
                            href={`/pacientes/${row.patientId}`}
                            size="small"
                            variant="primary"
                          >
                            Abrir prontuário
                          </ButtonLink>
                        )}
                        {row.masterRecordId ? (
                          <>
                            <ButtonLink
                              className="w-full whitespace-nowrap"
                              href={`/pacientes/${encodeURIComponent(row.patientId)}/evolucao-avaliacoes?aba=performance`}
                              size="small"
                              variant="outline"
                            >
                              Evolução e comparativos
                            </ButtonLink>
                            <ButtonLink
                              className="w-full whitespace-nowrap border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80"
                              href={workspaceHref(
                                row.patientId,
                                row.routeAttendanceId,
                                "calendar",
                              )}
                              size="small"
                              variant="outline"
                            >
                              <CalendarDays
                                aria-hidden="true"
                                className="size-4 shrink-0"
                              />
                              Calendário de treinos
                            </ButtonLink>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </TableRegion>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <article className="rounded-2xl border border-[var(--line)] bg-white p-4" key={row.patientId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black text-[var(--text-primary)]">{row.patientName}</h2>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Código {row.code}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                {row.planTitle ? (
                  <p className="mt-3 text-sm font-bold text-[var(--text-secondary)]">{row.planTitle}</p>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-xs">
                  <div>
                    <dt className="font-bold text-[var(--muted)]">Atualização</dt>
                    <dd className="mt-1 text-[var(--text-secondary)]">
                      {row.updatedAt ? dateFormatter.format(row.updatedAt) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--muted)]">Responsável</dt>
                    <dd className="mt-1 text-[var(--text-secondary)]">{row.responsibleName ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  {row.routeAttendanceId ? (
                    <ButtonLink
                      className="min-h-11 whitespace-nowrap"
                      fullWidth
                      href={workspaceHref(row.patientId, row.routeAttendanceId)}
                      size="small"
                      variant="primary"
                    >
                      {actionLabel(row.status)}
                    </ButtonLink>
                  ) : (
                    <ButtonLink
                      className="min-h-11 whitespace-nowrap"
                      fullWidth
                      href={`/pacientes/${row.patientId}`}
                      size="small"
                      variant="primary"
                    >
                      Abrir prontuário
                    </ButtonLink>
                  )}
                  {row.masterRecordId ? (
                    <>
                      <ButtonLink
                        className="min-h-11 whitespace-nowrap"
                        fullWidth
                        href={`/pacientes/${encodeURIComponent(row.patientId)}/evolucao-avaliacoes?aba=performance`}
                        size="small"
                        variant="outline"
                      >
                        Evolução e comparativos
                      </ButtonLink>
                      <ButtonLink
                        className="min-h-11 whitespace-nowrap border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80"
                        fullWidth
                        href={workspaceHref(
                          row.patientId,
                          row.routeAttendanceId,
                          "calendar",
                        )}
                        size="small"
                        variant="outline"
                      >
                        <CalendarDays
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        Calendário de treinos
                      </ButtonLink>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    attendanceId?: string | string[];
    calendarPatientId?: string | string[];
    filter?: string | string[];
    patientId?: string | string[];
    query?: string | string[];
    scenario?: string | string[];
  }>;
}) {
  const [params, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "READ")
  ) {
    return (
      <PageState
        action={
          <ButtonLink href="/pacientes" variant="outline">
            Voltar para pacientes
          </ButtonLink>
        }
        description="Seu perfil não possui acesso à prescrição de treino."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }

  const patientId = resolveText(params.patientId);
  const attendanceId = resolveText(params.attendanceId);
  if (!patientId) {
    const filter = resolveFilter(params.filter);
    const query = resolveText(params.query);
    const calendarPatientId = resolveText(params.calendarPatientId);
    if (calendarPatientId) {
      return (
        <PerformanceCalendarView
          backHref={centralHref(filter, query)}
          patientId={calendarPatientId}
        />
      );
    }
    return (
      <PerformanceCentral
        filter={filter}
        query={query}
      />
    );
  }

  const [view, clinicalFlow] = attendanceId
    ? await Promise.all([
        performanceWorkoutRepository.get(
          patientId,
          attendanceId,
          access.user.id,
        ),
        nutritionClinicalFlowRepository.getFlow({
          patientId,
          attendanceId,
          scenario: resolveText(params.scenario),
        }),
      ])
    : [
        await performanceEnduranceService.getWorkout(access.user, patientId),
        null,
      ];
  if (!view) {
    return (
      <PageState
        action={
          <ButtonLink href={`/pacientes/${patientId}`}>
            Voltar ao prontuário
          </ButtonLink>
        }
        description="O paciente precisa possuir um atendimento válido para abrir a prescrição de treino."
        title="Atendimento não localizado"
        tone="blocked"
      />
    );
  }

  const preservedParams = new URLSearchParams();
  const scenario = resolveText(params.scenario);
  if (scenario) preservedParams.set("scenario", scenario);
  preservedParams.set("patientId", patientId);
  preservedParams.set("attendanceId", view.attendanceId);
  const performanceHref = `/performance-endurance?${preservedParams.toString()}`;
  const performanceOperationalStatus = clinicalFlow?.flow.find(
    (step) => step.id === "PERFORMANCE",
  )?.status;

  return (
    <>
      <PatientBreadcrumb
        items={[
          { label: "Performance", href: performanceHref },
          { label: view.patient.name },
        ]}
      />
      <div className="mb-4 flex justify-end">
        <ButtonLink
          href={`/pacientes/${encodeURIComponent(patientId)}/evolucao-avaliacoes?aba=performance`}
          variant="outline"
        >
          Evolução e comparativos
        </ButtonLink>
      </div>
      <PerformanceWorkoutWorkspaceLazy
        initialView={view}
        operationalStatus={performanceOperationalStatus}
      />
    </>
  );
}

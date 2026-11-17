import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Search,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AttendanceStateActions } from "@/components/attendance/attendance-state-actions";
import { FinalizeAttendanceCard } from "@/components/attendance/finalize-attendance-card";
import { AttendanceIcon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import type { Prisma } from "@/generated/prisma/client";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { isVisibleNutritionClinicalFlowStep } from "@/features/nutrition-clinical-flow";
import { clinicalAttendanceTypeLabel } from "@/features/patient-registration/attendance-presentation";
import { prisma } from "@/lib/database/prisma";
import type {
  AttendanceStage,
  AttendanceStatus,
} from "@/modules/attendance";

export const metadata: Metadata = { title: "Atendimentos" };

const TIME_ZONE = "America/Sao_Paulo";

const attendanceStatuses = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly AttendanceStatus[];

const attendanceStatusLabels: Readonly<Record<AttendanceStatus, string>> = {
  DRAFT: "Preparado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const attendanceStatusClasses: Readonly<Record<AttendanceStatus, string>> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  IN_PROGRESS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COMPLETED: "border-sky-200 bg-sky-50 text-sky-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
};

const attendanceStageLabels: Readonly<Record<AttendanceStage, string>> = {
  RECEPTION: "Recepção",
  MASTER_RECORD_LOADING: "Carregamento do prontuário",
  PENDING_CHECK: "Verificação de pendências",
  CLINICAL_SUMMARY: "Resumo clínico",
  CONSULTATION_TYPE: "Definição da consulta",
  READY: "Pronto para iniciar",
  IN_PROGRESS: "Atendimento em andamento",
  COMPLETED: "Atendimento concluído",
  CANCELLED: "Atendimento cancelado",
};

type SearchValue = string | string[] | undefined;

function singleValue(value: SearchValue) {
  return typeof value === "string" ? value : undefined;
}

function resolveSearch(value: SearchValue) {
  const search = singleValue(value)?.trim();
  return search ? search.slice(0, 180) : undefined;
}

function resolveStatus(value: SearchValue): AttendanceStatus | undefined {
  const status = singleValue(value);
  return attendanceStatuses.find((candidate) => candidate === status);
}

function dateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).format(date);
}

function dayRange(date: Date) {
  const day = dateInput(date);
  const startsAt = new Date(`${day}T00:00:00-03:00`);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return { startsAt, endsAt };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(value);
}

const linkButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#b8cec5] px-3.5 text-xs font-black text-[var(--primary)] transition hover:bg-[var(--brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

export default async function AttendancesPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: SearchValue;
    attendanceId?: SearchValue;
    patientId?: SearchValue;
    query?: SearchValue;
    status?: SearchValue;
  }>;
}) {
  const [rawQuery, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);

  if (!canAccess(access, "ATTENDANCE", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso aos atendimentos. A autorização do servidor permanece obrigatória."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const canUpdateAttendances = canAccess(access, "ATTENDANCE", "UPDATE");
  const action = singleValue(rawQuery.action);
  const attendanceId = singleValue(rawQuery.attendanceId)?.trim();
  const patientId = singleValue(rawQuery.patientId)?.trim();

  if (action === "finalize" && attendanceId && patientId) {
    const attendanceForFinalization = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      select: {
        clinicalType: true,
        masterRecord: {
          select: {
            patient: {
              select: { clinicalCode: true, fullName: true },
            },
          },
        },
        startedAt: true,
        status: true,
      },
    });

    if (attendanceForFinalization?.status === "COMPLETED") {
      return (
        <PageState
          action={
            <Link className={linkButtonClass} href="/atendimentos">
              Voltar aos atendimentos
            </Link>
          }
          description="Este atendimento já foi finalizado. Nenhuma nova confirmação é necessária."
          title="Atendimento finalizado"
        />
      );
    }

    if (!canUpdateAttendances) {
      return (
        <PageState
          description="Seu perfil não possui permissão para finalizar atendimentos."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }

    const finalizationFlow = attendanceForFinalization?.status === "IN_PROGRESS"
      ? await nutritionClinicalFlowRepository.getFlow({
          patientId,
          attendanceId,
        })
      : null;

    if (!finalizationFlow || attendanceForFinalization?.status !== "IN_PROGRESS") {
      return (
        <PageState
          action={
            <Link className={linkButtonClass} href="/atendimentos">
              Voltar aos atendimentos
            </Link>
          }
          description="Este atendimento não está disponível para finalização."
          title="Finalização indisponível"
          tone="blocked"
        />
      );
    }

    return (
      <>
        <PageHeading
          description="Revise as etapas concluídas e pendentes antes de confirmar o encerramento."
          eyebrow="Atendimento"
          title="Finalizar atendimento"
        />
        <FinalizeAttendanceCard
          attendanceId={attendanceId}
          attendanceDate={attendanceForFinalization.startedAt?.toISOString()}
          attendanceType={clinicalAttendanceTypeLabel(attendanceForFinalization.clinicalType ?? undefined)}
          completedSteps={finalizationFlow.flow.filter((step) => isVisibleNutritionClinicalFlowStep(step) && step.id !== "PATIENT_REGISTRATION" && step.id !== "FINALIZE_ATTENDANCE" && step.status === "COMPLETED").map((step) => step.title)}
          hasClinicalRecords={finalizationFlow.closureEligibility.completedClinicalStepIds.length > 0}
          patientClinicalCode={attendanceForFinalization.masterRecord.patient.clinicalCode}
          patientId={patientId}
          patientName={attendanceForFinalization.masterRecord.patient.fullName}
          pendingSteps={finalizationFlow.flow.filter((step) => isVisibleNutritionClinicalFlowStep(step) && step.id !== "PATIENT_REGISTRATION" && step.id !== "FINALIZE_ATTENDANCE" && step.status !== "COMPLETED").map((step) => step.title)}
        />
      </>
    );
  }

  const search = resolveSearch(rawQuery.query);
  const status = resolveStatus(rawQuery.status);
  const now = new Date();
  const today = dayRange(now);
  const canReadScheduling = canAccess(access, "SCHEDULING", "READ");
  const activeMasterRecord = {
    status: "ACTIVE",
    patient: { deletedAt: null },
  } satisfies Prisma.MasterRecordWhereInput;
  const attendanceWhere = {
    deletedAt: null,
    masterRecord: activeMasterRecord,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              masterRecord: {
                patient: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
            },
            {
              masterRecord: {
                patient: {
                  clinicalCode: { contains: search.toUpperCase() },
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.AttendanceWhereInput;

  const [
    attendances,
    todayCount,
    inProgressCount,
    completedCount,
    upcomingAppointmentCount,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: attendanceWhere,
      orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        clinicalType: true,
        currentStage: true,
        receivedAt: true,
        startedAt: true,
        status: true,
        professional: { select: { fullName: true } },
        masterRecord: {
          select: {
            patient: {
              select: { clinicalCode: true, fullName: true, id: true },
            },
          },
        },
      },
    }),
    prisma.attendance.count({
      where: {
        deletedAt: null,
        masterRecord: activeMasterRecord,
        receivedAt: { gte: today.startsAt, lt: today.endsAt },
      },
    }),
    prisma.attendance.count({
      where: {
        deletedAt: null,
        masterRecord: activeMasterRecord,
        status: "IN_PROGRESS",
      },
    }),
    prisma.attendance.count({
      where: {
        deletedAt: null,
        masterRecord: activeMasterRecord,
        status: "COMPLETED",
      },
    }),
    canReadScheduling
      ? prisma.appointment.count({
          where: {
            deletedAt: null,
            startsAt: { gte: now },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
        })
      : Promise.resolve(0),
  ]);

  const clinicalFlowByAttendanceId = new Map(
    await Promise.all(
      attendances.map(async (attendance) => [
        attendance.id,
        await nutritionClinicalFlowRepository.getFlow({
          patientId: attendance.masterRecord.patient.id,
          attendanceId: attendance.id,
        }),
      ] as const),
    ),
  );

  const metrics = [
    {
      label: "Atendimentos de hoje",
      value: todayCount,
      icon: AttendanceIcon,
    },
    { label: "Em andamento", value: inProgressCount, icon: Clock3 },
    { label: "Concluídos", value: completedCount, icon: CheckCircle2 },
    {
      label: "Próximos agendamentos",
      value: upcomingAppointmentCount,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          canReadScheduling ? (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              href="/agenda"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              Abrir Agenda clínica
            </Link>
          ) : null
        }
        description="Acompanhe os atendimentos registrados e retome o cuidado com segurança."
        eyebrow="Operação clínica"
        title="Atendimentos"
      />

      <section aria-label="Resumo dos atendimentos">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-subtle)] sm:p-5"
                key={metric.label}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[var(--muted)]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">
                      {metric.value}
                    </p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--primary)]">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="attendance-list-title"
        className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-subtle)]"
      >
        <div className="border-b border-[var(--line)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">
                Registros reais
              </p>
              <h2
                className="mt-1 text-xl font-black text-[var(--text-primary)]"
                id="attendance-list-title"
              >
                Histórico de atendimentos
              </h2>
            </div>

            <form
              action="/atendimentos"
              className="grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_12rem_auto] sm:items-end"
              method="get"
            >
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Pesquisar paciente
                <span className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={search}
                    maxLength={180}
                    name="query"
                    placeholder="Nome ou código"
                    type="search"
                  />
                </span>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Situação
                <select
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={status ?? ""}
                  name="status"
                >
                  <option value="">Todos</option>
                  {attendanceStatuses.map((value) => (
                    <option key={value} value={value}>
                      {attendanceStatusLabels[value]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-4 text-sm font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                type="submit"
              >
                Filtrar
              </button>
            </form>
          </div>

          {search || status ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500">
                {attendances.length} registro
                {attendances.length === 1 ? " encontrado" : "s encontrados"}
              </p>
              <Link
                className="text-xs font-black text-[var(--primary)] hover:underline"
                href="/atendimentos"
              >
                Limpar filtros
              </Link>
            </div>
          ) : null}
        </div>

        {attendances.length === 0 ? (
          <div className="px-5 py-10 sm:px-8">
            <PageState
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {canReadScheduling ? (
                    <Link className={linkButtonClass} href="/agenda">
                      Abrir Agenda
                    </Link>
                  ) : null}
                  <Link className={linkButtonClass} href="/pacientes">
                    Abrir Pacientes
                  </Link>
                </div>
              }
              description={
                search || status
                  ? "Nenhum atendimento corresponde aos filtros informados."
                  : "Os atendimentos registrados aparecerão aqui."
              }
              title={
                search || status
                  ? "Nenhum atendimento encontrado"
                  : "Nenhum atendimento registrado"
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {attendances.map((attendance) => {
              const patient = attendance.masterRecord.patient;
              const occurredAt = attendance.startedAt ?? attendance.receivedAt;
              const clinicalFlow = clinicalFlowByAttendanceId.get(attendance.id);
              const currentStep = clinicalFlow?.resumeStep;
              const canContinue = attendance.status === "IN_PROGRESS";
              const canStart = attendance.status === "DRAFT";
              const canFinalize = canUpdateAttendances && canContinue;
              const stage = canContinue
                ? currentStep?.title ??
                  attendanceStageLabels[attendance.currentStage]
                : undefined;
              const finalizeParams = new URLSearchParams({
                action: "finalize",
                attendanceId: attendance.id,
                patientId: patient.id,
              });

              return (
                <article
                  className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[8.5rem_minmax(0,1.25fr)_minmax(11rem,0.75fr)_auto] lg:items-center"
                  key={attendance.id}
                >
                  <div>
                    <p className="text-sm font-black capitalize text-[var(--text-primary)]">
                      {formatDate(occurredAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                      {formatTime(occurredAt)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-black text-[var(--text-primary)] sm:text-base">
                        {patient.fullName}
                      </h3>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                        {patient.clinicalCode}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {clinicalAttendanceTypeLabel(attendance.clinicalType ?? undefined)}
                    </p>
                    {stage ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        Etapa atual: {stage}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${attendanceStatusClasses[attendance.status]}`}
                    >
                      {attendanceStatusLabels[attendance.status]}
                    </span>
                    <p className="mt-2 truncate text-xs font-semibold text-[var(--text-secondary)]">
                      {attendance.professional.fullName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
                    <Link
                      className={linkButtonClass}
                      href={`/pacientes/${patient.id}`}
                    >
                      Abrir prontuário
                    </Link>
                    {canContinue ? (
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#12664f] px-3.5 text-xs font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        href={`/pacientes/${patient.id}/continuar`}
                      >
                        Continuar atendimento
                      </Link>
                    ) : null}
                    {canStart ? (
                      <AttendanceStateActions attendanceId={attendance.id} patientId={patient.id} redirectAfterStart />
                    ) : null}
                    {canFinalize ? (
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-xs font-black text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                        href={`/atendimentos?${finalizeParams.toString()}`}
                      >
                        Finalizar consulta
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

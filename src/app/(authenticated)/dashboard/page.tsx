import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  ListChecks,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import type { Prisma } from "@/generated/prisma/client";
import { APPOINTMENT_STATUS_LABELS } from "@/features/scheduling/contracts";
import { schedulingRepository } from "@/features/scheduling/repository";
import { canAccess, mvpService } from "@/features/mvp";
import { prisma } from "@/lib/database/prisma";
import type { ConsultationType } from "@/modules/attendance";

export const metadata: Metadata = { title: "Visão Geral" };

const TIME_ZONE = "America/Sao_Paulo";

const consultationTypeLabels: Readonly<Record<ConsultationType, string>> = {
  INITIAL: "Consulta inicial",
  FOLLOW_UP: "Retorno",
  PHYSICAL_ASSESSMENT: "Avaliação física",
  POSTURAL_ASSESSMENT: "Avaliação postural",
  TRAINING: "Treinamento",
  NUTRITION: "Nutrição",
};

const patientStatusLabels = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
} as const;

const pendingStatusLabels = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  SKIPPED: "Ignorada",
  BLOCKED: "Bloqueada",
} as const;

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

function greetingFor(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }).format(date),
  );

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function longDate(date: Date) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
    weekday: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Nenhum atendimento";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: TIME_ZONE,
  }).format(value);
}

export default async function DashboardPage() {
  const access = await mvpService.getSession();
  const now = new Date();
  const range = dayRange(now);
  const canReadScheduling = canAccess(access, "SCHEDULING", "READ");
  const canReadPatients = canAccess(access, "PATIENTS", "READ");
  const canCreatePatients = canAccess(access, "PATIENTS", "CREATE");
  const canReadAttendances = canAccess(access, "ATTENDANCE", "READ");

  const pendingWhere = {
    status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
    OR: [{ responsibleUserId: access.user.id }, { responsibleUserId: null }],
    continuity: {
      status: "ACTIVE",
      masterRecord: {
        status: "ACTIVE",
        patient: { status: "ACTIVE", deletedAt: null },
      },
    },
  } satisfies Prisma.ContinuityStepWhereInput;

  const [
    appointments,
    activePatientCount,
    recentPatients,
    openAttendanceCount,
    pendingCount,
    pendingSteps,
  ] = await Promise.all([
    canReadScheduling
      ? schedulingRepository.listForDay(range.startsAt, range.endsAt)
      : Promise.resolve([]),
    canReadPatients
      ? prisma.patient.count({
          where: { status: "ACTIVE", deletedAt: null },
        })
      : Promise.resolve(0),
    canReadPatients
      ? prisma.patient.findMany({
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 5,
          select: {
            id: true,
            fullName: true,
            status: true,
            masterRecord: {
              select: {
                status: true,
                continuity: {
                  select: {
                    steps: {
                      where: {
                        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
                      },
                      orderBy: { sortOrder: "asc" },
                      take: 1,
                      select: { status: true, title: true },
                    },
                  },
                },
                attendances: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    createdAt: true,
                    receivedAt: true,
                    startedAt: true,
                    status: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    canReadAttendances
      ? prisma.attendance.count({
          where: {
            deletedAt: null,
            status: { in: ["DRAFT", "IN_PROGRESS"] },
          },
        })
      : Promise.resolve(0),
    canReadPatients && canReadAttendances
      ? prisma.continuityStep.count({ where: pendingWhere })
      : Promise.resolve(0),
    canReadPatients && canReadAttendances
      ? prisma.continuityStep.findMany({
          where: pendingWhere,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: 4,
          select: {
            id: true,
            status: true,
            title: true,
            continuity: {
              select: {
                masterRecord: {
                  select: {
                    patient: { select: { fullName: true, id: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const visibleAppointments = appointments.filter(
    (appointment) => appointment.status !== "CANCELLED",
  );
  const upcomingAppointments = visibleAppointments
    .filter(
      (appointment) =>
        new Date(appointment.startsAt) >= now &&
        (appointment.status === "SCHEDULED" ||
          appointment.status === "CONFIRMED"),
    )
    .slice(0, 5);
  const attendanceTypes = upcomingAppointments.length
    ? await prisma.attendance.findMany({
        where: {
          appointmentId: { in: upcomingAppointments.map(({ id }) => id) },
          deletedAt: null,
        },
        select: { appointmentId: true, consultationType: true },
      })
    : [];
  const attendanceTypeByAppointment = new Map(
    attendanceTypes.flatMap((attendance) =>
      attendance.appointmentId
        ? [[attendance.appointmentId, attendance.consultationType] as const]
        : [],
    ),
  );

  const metrics = [
    ...(canReadScheduling
      ? [
          {
            label: "Agenda de hoje",
            value: visibleAppointments.length,
            detail: visibleAppointments.length === 1 ? "agendamento" : "agendamentos",
            icon: CalendarDays,
          },
        ]
      : []),
    ...(canReadAttendances
      ? [
          {
            label: "Em andamento",
            value: openAttendanceCount,
            detail: openAttendanceCount === 1 ? "atendimento" : "atendimentos",
            icon: Clock3,
          },
        ]
      : []),
    ...(canReadPatients && canReadAttendances
      ? [
          {
            label: "Pendências",
            value: pendingCount,
            detail: pendingCount === 1 ? "ação disponível" : "ações disponíveis",
            icon: ListChecks,
          },
        ]
      : []),
    ...(canReadPatients
      ? [
          {
            label: "Pacientes ativos",
            value: activePatientCount,
            detail: activePatientCount === 1 ? "cadastro ativo" : "cadastros ativos",
            icon: Users,
          },
        ]
      : []),
  ];

  const shortcuts = [
    ...(canCreatePatients
      ? [{ label: "Novo paciente", href: "/pacientes/novo", icon: Plus }]
      : []),
    ...(canReadScheduling
      ? [{ label: "Agenda clínica", href: "/agenda", icon: CalendarDays }]
      : []),
    ...(canReadPatients
      ? [{ label: "Pacientes", href: "/pacientes", icon: Users }]
      : []),
    ...(canReadAttendances
      ? [{ label: "Atendimentos", href: "/atendimentos", icon: ClipboardList }]
      : []),
  ];

  const firstName = access.user.fullName.trim().split(/\s+/u)[0] || "profissional";

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[#244b40] bg-[linear-gradient(135deg,#0a4938_0%,#12664f_72%,#1b765d_100%)] px-5 py-7 text-white shadow-[0_18px_45px_rgba(10,73,56,0.16)] sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-8 -top-10 size-48 rounded-full border border-[#d6bc70]/20" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d6bc70]">
            Clínica SV · Visão Geral
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            {greetingFor(now)}, {firstName}.
          </h1>
          <p className="mt-3 text-sm font-semibold capitalize text-emerald-50/75">
            {longDate(now)}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">
            Acompanhe a operação do dia e retome as próximas ações sem perder o contexto do cuidado.
          </p>
        </div>
      </header>

      {metrics.length ? (
        <section aria-labelledby="daily-summary-title">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Hoje</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--text-primary)]" id="daily-summary-title">Resumo do dia</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-subtle)] sm:p-5" key={metric.label}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-[var(--muted)]">{metric.label}</p>
                      <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">{metric.value}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{metric.detail}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--primary)]"><Icon aria-hidden="true" className="size-5" /></span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <div className="space-y-6">
          {canReadScheduling ? (
            <section aria-labelledby="next-appointments-title" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-subtle)]">
              <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Agenda clínica</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]" id="next-appointments-title">Próximos atendimentos</h2>
                </div>
                <Link className="text-xs font-black text-[var(--primary)] hover:underline" href="/agenda">Ver agenda</Link>
              </div>
              {upcomingAppointments.length ? (
                <div className="divide-y divide-[var(--line)]">
                  {upcomingAppointments.map((appointment) => {
                    const patientName =
                      "patient" in appointment && appointment.patient
                        ? appointment.patient.fullName
                        : appointment.contactName;
                    const consultationType = attendanceTypeByAppointment.get(appointment.id);
                    return (
                      <article className="grid gap-3 px-5 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(9rem,auto)] sm:items-center sm:px-6" key={appointment.id}>
                        <p className="text-lg font-black tabular-nums text-[var(--primary)]">{formatTime(appointment.startsAt)}</p>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--text-primary)]">{patientName}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{consultationType ? consultationTypeLabels[consultationType] : "Tipo não informado"}</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="truncate text-xs font-bold text-[var(--text-secondary)]">{appointment.professional.fullName}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{APPOINTMENT_STATUS_LABELS[appointment.status]}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--primary)]"><CalendarDays aria-hidden="true" className="size-5" /></span>
                  <p className="mt-4 text-sm font-black text-[var(--text-primary)]">Nenhum próximo atendimento hoje</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">A agenda não possui horários futuros confirmados ou agendados para este dia.</p>
                </div>
              )}
            </section>
          ) : null}

          {canReadPatients ? (
            <section aria-labelledby="recent-patients-title" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-subtle)]">
              <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Cadastros</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]" id="recent-patients-title">Pacientes recentes</h2>
                </div>
                <Link className="text-xs font-black text-[var(--primary)] hover:underline" href="/pacientes">Ver todos os pacientes</Link>
              </div>
              {recentPatients.length ? (
                <div className="divide-y divide-[var(--line)]">
                  {recentPatients.map((patient) => {
                    const currentStep = patient.masterRecord?.continuity?.steps[0];
                    const lastAttendance = patient.masterRecord?.attendances[0];
                    const hasOpenAttendance = lastAttendance?.status === "DRAFT" || lastAttendance?.status === "IN_PROGRESS";
                    const canContinue = Boolean(lastAttendance && (hasOpenAttendance || currentStep));
                    const situation = hasOpenAttendance
                      ? "Em atendimento"
                      : currentStep?.status === "BLOCKED"
                        ? "Bloqueado"
                        : currentStep
                          ? "Em acompanhamento"
                          : patientStatusLabels[patient.status];
                    const href = canContinue
                      ? `/pacientes/${patient.id}/continuar`
                      : `/pacientes/${patient.id}`;
                    return (
                      <article className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(9rem,0.9fr)_auto] sm:items-center sm:px-6" key={patient.id}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--text-primary)]">{patient.fullName}</p>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">{currentStep?.title ?? "Nenhuma etapa pendente"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-secondary)]">{situation}</p>
                          <p className="mt-1 text-[11px] text-slate-400">Último: {formatDateTime(lastAttendance?.startedAt ?? lastAttendance?.receivedAt ?? lastAttendance?.createdAt)}</p>
                        </div>
                        <Link className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#b8cec5] px-3 text-xs font-black text-[var(--primary)] transition hover:bg-[var(--brand-soft)]" href={href}>
                          {canContinue ? "Continuar" : "Abrir prontuário"}
                          <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <UserRound aria-hidden="true" className="mx-auto size-6 text-[var(--primary)]" />
                  <p className="mt-3 text-sm font-black text-[var(--text-primary)]">Nenhum paciente cadastrado</p>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {canReadPatients && canReadAttendances ? (
            <section aria-labelledby="pending-title" className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-subtle)] sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Ações</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]" id="pending-title">Pendências</h2>
              {pendingSteps.length ? (
                <div className="mt-4 space-y-2.5">
                  {pendingSteps.map((pending) => {
                    const patient = pending.continuity.masterRecord.patient;
                    return (
                      <Link className="group block rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-3 transition hover:border-amber-300 hover:bg-amber-50" href={`/pacientes/${patient.id}/continuar`} key={pending.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-amber-950">{pending.title}</p>
                            <p className="mt-1 truncate text-[11px] text-amber-800/75">{patient.fullName} · {pendingStatusLabels[pending.status]}</p>
                          </div>
                          <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700 transition group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-[var(--surface-elevated)] px-4 py-6 text-center">
                  <p className="text-sm font-black text-[var(--text-primary)]">Nenhuma pendência acionável</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Não há etapas pendentes atribuídas ou disponíveis.</p>
                </div>
              )}
            </section>
          ) : null}

          {shortcuts.length ? (
            <section aria-labelledby="shortcuts-title" className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-subtle)] sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">Navegação</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]" id="shortcuts-title">Atalhos</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {shortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;
                  return (
                    <Link className="group flex min-h-12 items-center gap-3 rounded-xl border border-[var(--line)] px-3.5 text-sm font-black text-[var(--text-primary)] transition hover:border-[#91b7a8] hover:bg-[var(--brand-soft)]" href={shortcut.href} key={shortcut.href}>
                      <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--primary)] group-hover:bg-white"><Icon aria-hidden="true" className="size-4" /></span>
                      <span className="flex-1">{shortcut.label}</span>
                      <ArrowRight aria-hidden="true" className="size-4 text-[var(--primary)] transition group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

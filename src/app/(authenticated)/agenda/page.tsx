import type { Metadata } from "next";

import { ClinicalAgenda } from "@/components/scheduling/clinical-agenda";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { schedulingRepository } from "@/features/scheduling/repository";

export const metadata: Metadata = { title: "Agenda Clínica" };

function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date);
}

function resolveRequestedDate(value?: string | string[]) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(parsed.getTime()) || formatDateInput(parsed) !== value
    ? undefined
    : value;
}

function dayRange(date: string) {
  const startsAt = new Date(`${date}T00:00:00-03:00`);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 1);

  return { startsAt, endsAt };
}

export default async function ClinicalAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const [params, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);

  if (!canAccess(access, "SCHEDULING", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso à agenda. Solicite a revisão das permissões ao administrador."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const requestedDate = resolveRequestedDate(params.date);
  const selectedDate = requestedDate ?? formatDateInput(new Date());
  const operationalView = requestedDate === undefined;
  const range = dayRange(selectedDate);
  const upcomingEndsAt = new Date(range.endsAt);
  upcomingEndsAt.setUTCDate(upcomingEndsAt.getUTCDate() + 7);
  const [appointments, professionals, upcomingAppointments] = await Promise.all([
    schedulingRepository.listForDay(range.startsAt, range.endsAt),
    schedulingRepository.listProfessionals(),
    operationalView
      ? schedulingRepository.listForDay(range.endsAt, upcomingEndsAt)
      : Promise.resolve(undefined),
  ]);

  return (
    <ClinicalAgenda
      appointments={appointments}
      canCreate={canAccess(access, "SCHEDULING", "CREATE")}
      canUpdate={canAccess(access, "SCHEDULING", "UPDATE")}
      professionals={professionals}
      selectedDate={selectedDate}
      upcomingAppointments={upcomingAppointments}
    />
  );
}

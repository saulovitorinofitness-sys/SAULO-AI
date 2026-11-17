"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { CloseIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type ClinicalAppointmentView,
  type SchedulingProfessionalOption,
} from "@/features/scheduling/contracts";
import type { AppointmentStatus } from "@/modules/scheduling";

interface PatientOption {
  readonly masterRecordId: string;
  readonly code: string;
  readonly patient: {
    readonly id: string;
    readonly fullName: string;
  };
}

interface AppointmentFormState {
  identityMode: "CONTACT" | "PATIENT";
  masterRecordId: string;
  contactName: string;
  contactPhone: string;
  professionalUserId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string;
}

const statusClasses: Readonly<Record<AppointmentStatus, string>> = {
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-800",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COMPLETED: "border-teal-200 bg-teal-50 text-teal-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  NO_SHOW: "border-amber-200 bg-amber-50 text-amber-800",
  RESCHEDULED: "border-violet-200 bg-violet-50 text-violet-800",
};

const UPCOMING_INITIAL_LIMIT = 6;

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function displayDay(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function displayTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function localDateAndTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function appointmentUrl(date: string) {
  return `/agenda?${new URLSearchParams({ date }).toString()}`;
}

function appointmentCountLabel(count: number) {
  return `${count} ${count === 1 ? "compromisso" : "compromissos"}`;
}

function appointmentDateKey(value: string) {
  const date = localDateAndTime(value);
  return date.date;
}

function displayUpcomingDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(new Date(`${value}T12:00:00-03:00`));
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function currentPatientOption(
  appointment: ClinicalAppointmentView,
): PatientOption | undefined {
  if (!appointment.masterRecordId || !appointment.patient) return undefined;

  return {
    masterRecordId: appointment.masterRecordId,
    code: appointment.patient.code,
    patient: {
      id: appointment.patient.id,
      fullName: appointment.patient.fullName,
    },
  };
}

function appointmentName(appointment: ClinicalAppointmentView) {
  return appointment.patient?.fullName ?? appointment.contactName;
}

export function ClinicalAgenda({
  appointments,
  professionals,
  selectedDate,
  upcomingAppointments,
  canCreate,
  canUpdate,
}: {
  readonly appointments: readonly ClinicalAppointmentView[];
  readonly professionals: readonly SchedulingProfessionalOption[];
  readonly selectedDate: string;
  readonly upcomingAppointments?: readonly ClinicalAppointmentView[];
  readonly canCreate: boolean;
  readonly canUpdate: boolean;
}) {
  const router = useRouter();
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicalAppointmentView>();
  const [form, setForm] = useState<AppointmentFormState>({
    identityMode: "CONTACT",
    masterRecordId: "",
    contactName: "",
    contactPhone: "",
    professionalUserId: professionals[0]?.id ?? "",
    date: selectedDate,
    startsAt: "08:00",
    endsAt: "09:00",
    status: "SCHEDULED",
    notes: "",
  });
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<readonly PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const operationalView = upcomingAppointments !== undefined;
  const allUpcomingAppointments = upcomingAppointments ?? [];
  const visibleUpcomingAppointments = showAllUpcoming
    ? allUpcomingAppointments
    : allUpcomingAppointments.slice(0, UPCOMING_INITIAL_LIMIT);
  const groupedUpcomingAppointments = Array.from(
    visibleUpcomingAppointments.reduce(
      (groups, appointment) => {
        const key = appointmentDateKey(appointment.startsAt);
        const current = groups.get(key) ?? [];
        current.push(appointment);
        groups.set(key, current);
        return groups;
      },
      new Map<string, ClinicalAppointmentView[]>(),
    ),
  );

  useEffect(() => {
    if (!dialogOpen || form.identityMode !== "PATIENT") return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingPatients(true);
      try {
        const params = new URLSearchParams({ page: "1" });
        if (patientQuery.trim()) params.set("query", patientQuery.trim());
        const response = await fetch(`/api/patients?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          patients?: readonly PatientOption[];
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message);

        const entries = payload.patients ?? [];
        const editingPatient = editing
          ? currentPatientOption(editing)
          : undefined;
        if (
          editingPatient &&
          !entries.some(
            (entry) =>
              entry.masterRecordId === editingPatient.masterRecordId,
          )
        ) {
          setPatients([editingPatient, ...entries]);
        } else {
          setPatients(entries);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setError(
          requestError instanceof Error && requestError.message
            ? requestError.message
            : "Não foi possível consultar os pacientes.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingPatients(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dialogOpen, editing, form.identityMode, patientQuery]);

  useEffect(() => {
    if (!dialogOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen, saving]);

  function openCreate() {
    setEditing(undefined);
    setPatientQuery("");
    setPatients([]);
    setError(undefined);
    setForm({
      identityMode: "CONTACT",
      masterRecordId: "",
      contactName: "",
      contactPhone: "",
      professionalUserId: professionals[0]?.id ?? "",
      date: selectedDate,
      startsAt: "08:00",
      endsAt: "09:00",
      status: "SCHEDULED",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(appointment: ClinicalAppointmentView) {
    const start = localDateAndTime(appointment.startsAt);
    const end = localDateAndTime(appointment.endsAt);
    setEditing(appointment);
    setPatientQuery("");
    const patientOption = currentPatientOption(appointment);
    setPatients(patientOption ? [patientOption] : []);
    setError(undefined);
    setForm({
      identityMode: appointment.masterRecordId ? "PATIENT" : "CONTACT",
      masterRecordId: appointment.masterRecordId ?? "",
      contactName: appointment.contactName ?? "",
      contactPhone: appointment.contactPhone ?? "",
      professionalUserId: appointment.professional.id,
      date: start.date,
      startsAt: start.time,
      endsAt: end.time,
      status: appointment.status,
      notes: appointment.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function persistAppointment(
    appointment: ClinicalAppointmentView | undefined,
    values: AppointmentFormState,
  ) {
    const response = await fetch(
      appointment
        ? `/api/appointments/${appointment.id}`
        : "/api/appointments",
      {
        body: JSON.stringify({
          ...(values.identityMode === "PATIENT"
            ? { masterRecordId: values.masterRecordId }
            : {
                contactName: values.contactName.trim(),
                contactPhone: values.contactPhone.trim(),
              }),
          professionalUserId: values.professionalUserId,
          startsAt: toIso(values.date, values.startsAt),
          endsAt: toIso(values.date, values.endsAt),
          status: values.status,
          notes: values.notes.trim() || undefined,
          ...(appointment ? { version: appointment.version } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: appointment ? "PATCH" : "POST",
      },
    );
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message || "Não foi possível salvar o agendamento.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSaving(true);
    try {
      await persistAppointment(editing, form);
      setDialogOpen(false);
      const destination = appointmentUrl(form.date);
      if (form.date === selectedDate) router.refresh();
      else router.push(destination);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o agendamento.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment(appointment: ClinicalAppointmentView) {
    if (!window.confirm(`Cancelar o agendamento de ${appointmentName(appointment)}?`)) {
      return;
    }

    const start = localDateAndTime(appointment.startsAt);
    const end = localDateAndTime(appointment.endsAt);
    setError(undefined);
    setSaving(true);
    try {
      await persistAppointment(appointment, {
        identityMode: appointment.masterRecordId ? "PATIENT" : "CONTACT",
        masterRecordId: appointment.masterRecordId ?? "",
        contactName: appointment.contactName ?? "",
        contactPhone: appointment.contactPhone ?? "",
        professionalUserId: appointment.professional.id,
        date: start.date,
        startsAt: start.time,
        endsAt: end.time,
        status: "CANCELLED",
        notes: appointment.notes ?? "",
      });
      router.refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Não foi possível cancelar o agendamento.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        action={
          canCreate ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12664f] px-4 text-sm font-bold text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              onClick={openCreate}
              type="button"
            >
              <PlusIcon className="size-4" />
              Novo agendamento
            </button>
          ) : null
        }
        description="Organize os compromissos dos pacientes e profissionais em uma visão diária."
        eyebrow="Clínica SV"
        title="Agenda Clínica"
      />

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              {operationalView ? "Agenda de hoje" : "Agenda do dia"} ·{" "}
              {appointmentCountLabel(appointments.length)}
            </p>
            <h2 className="mt-1 capitalize text-lg font-black text-slate-900">
              {displayDay(selectedDate)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              aria-label="Visualizar dia anterior"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              href={appointmentUrl(addDays(selectedDate, -1))}
            >
              Anterior
            </Link>
            <Link
              className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
              href="/agenda"
            >
              Hoje
            </Link>
            <Link
              aria-label="Visualizar próximo dia"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              href={appointmentUrl(addDays(selectedDate, 1))}
            >
              Próximo
            </Link>
            <form action="/agenda" className="flex items-center gap-2" method="get">
              <label className="sr-only" htmlFor="agenda-date">
                Selecionar data da agenda
              </label>
              <input
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                defaultValue={selectedDate}
                id="agenda-date"
                name="date"
                type="date"
              />
              <button
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                type="submit"
              >
                Ir
              </button>
            </form>
          </div>
        </div>
      </section>

      {error && !dialogOpen ? (
        <p
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {appointments.length === 0 ? (
        <PageState
          description="Nenhum compromisso foi registrado para esta data."
          title="Agenda livre"
        />
      ) : (
        <div className="space-y-2.5" role="list">
          {appointments.map((appointment) => (
            <article
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
              key={appointment.id}
              role="listitem"
            >
              <div className="border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
                <p className="text-xl font-black tabular-nums text-slate-900">
                  {displayTime(appointment.startsAt)}
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-500">
                  até {displayTime(appointment.endsAt)}
                </p>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black text-slate-900">
                    {appointmentName(appointment)}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${statusClasses[appointment.status]}`}
                  >
                    {APPOINTMENT_STATUS_LABELS[appointment.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">
                    {appointment.professional.fullName}
                  </span>
                  <span aria-hidden="true"> · </span>
                  {appointment.patient
                    ? `Paciente ${appointment.patient.code}`
                    : `Novo contato · ${appointment.contactPhone}`}
                </p>
                {appointment.notes ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                    {appointment.notes}
                  </p>
                ) : null}
              </div>

              {canUpdate ? (
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => openEdit(appointment)}
                    type="button"
                  >
                    Editar
                  </button>
                  {appointment.status !== "CANCELLED" &&
                  appointment.status !== "COMPLETED" ? (
                    <button
                      className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      disabled={saving}
                      onClick={() => void cancelAppointment(appointment)}
                      type="button"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {operationalView ? (
        <section
          aria-labelledby="upcoming-appointments-title"
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Próximos agendamentos
              </p>
              <h2
                className="mt-1 text-lg font-black text-slate-900"
                id="upcoming-appointments-title"
              >
                Próximos 7 dias ·{" "}
                {appointmentCountLabel(allUpcomingAppointments.length)}
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              A partir de amanhã
            </p>
          </div>

          {allUpcomingAppointments.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500">
              Nenhum compromisso registrado para os próximos 7 dias.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {groupedUpcomingAppointments.map(([date, entries]) => (
                <section aria-labelledby={`upcoming-date-${date}`} key={date}>
                  <h3
                    className="mb-2 capitalize text-xs font-black uppercase tracking-[0.1em] text-slate-500"
                    id={`upcoming-date-${date}`}
                  >
                    {displayUpcomingDate(date)}
                  </h3>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {entries.map((appointment) => (
                      <article
                        className="grid gap-2 px-3 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                        key={appointment.id}
                      >
                        <p className="text-sm font-black tabular-nums text-slate-900">
                          {displayTime(appointment.startsAt)}
                          <span className="ml-1 font-semibold text-slate-400">
                            – {displayTime(appointment.endsAt)}
                          </span>
                        </p>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-sm font-black text-slate-900">
                              {appointmentName(appointment)}
                            </h4>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusClasses[appointment.status]}`}
                            >
                              {APPOINTMENT_STATUS_LABELS[appointment.status]}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {appointment.professional.fullName}
                            <span aria-hidden="true"> · </span>
                            {appointment.patient
                              ? `Paciente ${appointment.patient.code}`
                              : `Novo contato · ${appointment.contactPhone}`}
                          </p>
                        </div>

                        {canUpdate ? (
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            <button
                              className="min-h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                              onClick={() => openEdit(appointment)}
                              type="button"
                            >
                              Editar
                            </button>
                            {appointment.status !== "CANCELLED" &&
                            appointment.status !== "COMPLETED" ? (
                              <button
                                className="min-h-8 rounded-lg border border-red-200 px-2.5 text-[11px] font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                                disabled={saving}
                                onClick={() =>
                                  void cancelAppointment(appointment)
                                }
                                type="button"
                              >
                                Cancelar
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))}

              {allUpcomingAppointments.length > UPCOMING_INITIAL_LIMIT ? (
                <div className="flex justify-center border-t border-slate-100 pt-4">
                  <button
                    aria-expanded={showAllUpcoming}
                    className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
                    onClick={() => setShowAllUpcoming((current) => !current)}
                    type="button"
                  >
                    {showAllUpcoming ? "Mostrar menos" : "Ver próximos"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              setDialogOpen(false);
            }
          }}
        >
          <section
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
            role="dialog"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Agenda Clínica
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900" id={dialogTitleId}>
                  {editing ? "Editar agendamento" : "Novo agendamento"}
                </h2>
              </div>
              <button
                aria-label="Fechar formulário"
                className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <form className="space-y-5 p-5 sm:p-6" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="text-sm font-bold text-slate-800">
                  Quem está agendando?
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    aria-pressed={form.identityMode === "CONTACT"}
                    className={`min-h-10 rounded-lg px-3 text-sm font-bold transition ${
                      form.identityMode === "CONTACT"
                        ? "bg-white text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        identityMode: "CONTACT",
                        masterRecordId: "",
                      }))
                    }
                    type="button"
                  >
                    Novo contato
                  </button>
                  <button
                    aria-pressed={form.identityMode === "PATIENT"}
                    className={`min-h-10 rounded-lg px-3 text-sm font-bold transition ${
                      form.identityMode === "PATIENT"
                        ? "bg-white text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        contactName: "",
                        contactPhone: "",
                        identityMode: "PATIENT",
                      }))
                    }
                    type="button"
                  >
                    Paciente cadastrado
                  </button>
                </div>
              </fieldset>

              {form.identityMode === "CONTACT" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="text-sm font-bold text-slate-800"
                      htmlFor="contact-name"
                    >
                      Nome
                    </label>
                    <input
                      autoComplete="name"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      id="contact-name"
                      maxLength={180}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contactName: event.target.value,
                        }))
                      }
                      required
                      value={form.contactName}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-bold text-slate-800"
                      htmlFor="contact-phone"
                    >
                      Telefone / WhatsApp
                    </label>
                    <input
                      autoComplete="tel"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      id="contact-phone"
                      inputMode="tel"
                      maxLength={30}
                      minLength={8}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contactPhone: event.target.value,
                        }))
                      }
                      required
                      type="tel"
                      value={form.contactPhone}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    className="text-sm font-bold text-slate-800"
                    htmlFor="patient-search"
                  >
                    Paciente
                  </label>
                  <div className="relative mt-1.5">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="min-h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      id="patient-search"
                      onChange={(event) => setPatientQuery(event.target.value)}
                      placeholder="Buscar por nome, CPF, telefone ou código"
                      type="search"
                      value={patientQuery}
                    />
                  </div>
                  <select
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        masterRecordId: event.target.value,
                      }))
                    }
                    required
                    value={form.masterRecordId}
                  >
                    <option value="">
                      {loadingPatients
                        ? "Consultando pacientes..."
                        : "Selecione um paciente"}
                    </option>
                    {patients.map((entry) => (
                      <option
                        key={entry.masterRecordId}
                        value={entry.masterRecordId}
                      >
                        {entry.patient.fullName} · {entry.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-slate-800" htmlFor="agenda-professional">
                  Profissional responsável
                </label>
                <select
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  id="agenda-professional"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      professionalUserId: event.target.value,
                    }))
                  }
                  required
                  value={form.professionalUserId}
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.fullName}
                      {professional.professionalTitle
                        ? ` · ${professional.professionalTitle}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-bold text-slate-800" htmlFor="appointment-date">
                    Data
                  </label>
                  <input
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    id="appointment-date"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, date: event.target.value }))
                    }
                    required
                    type="date"
                    value={form.date}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800" htmlFor="appointment-start">
                    Início
                  </label>
                  <input
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    id="appointment-start"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startsAt: event.target.value }))
                    }
                    required
                    type="time"
                    value={form.startsAt}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800" htmlFor="appointment-end">
                    Término
                  </label>
                  <input
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    id="appointment-end"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endsAt: event.target.value }))
                    }
                    required
                    type="time"
                    value={form.endsAt}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800" htmlFor="appointment-status">
                  Status
                </label>
                <select
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  id="appointment-status"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as AppointmentStatus,
                    }))
                  }
                  value={form.status}
                >
                  {(editing ? APPOINTMENT_STATUSES : APPOINTMENT_STATUSES.slice(0, 2)).map(
                    (status) => (
                      <option key={status} value={status}>
                        {APPOINTMENT_STATUS_LABELS[status]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800" htmlFor="appointment-notes">
                  Observação <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <textarea
                  className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  id="appointment-notes"
                  maxLength={4000}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  value={form.notes}
                />
              </div>

              {error ? (
                <p
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Voltar
                </button>
                <button
                  className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-bold text-white transition hover:bg-[#0a4938] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving || professionals.length === 0}
                  type="submit"
                >
                  {saving ? "Salvando..." : "Salvar agendamento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

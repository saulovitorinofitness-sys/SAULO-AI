"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  NumberInput,
  PageState,
  Select,
  Textarea,
} from "@/components/ui";
import {
  PERFORMANCE_MODALITIES,
  WORKOUT_SCHEDULE_STATUSES,
  type PerformanceModality,
  type WorkoutScheduledSession,
  type WorkoutScheduleStatus,
} from "@/features/performance-monitoring/contracts";

const API_PATH = "/api/performance-monitoring/scheduled-sessions";

const modalityLabels: Readonly<Record<PerformanceModality, string>> = {
  STRENGTH: "Musculação",
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  OTHER: "Outra modalidade",
};

const modalityStyles: Readonly<Record<PerformanceModality, string>> = {
  STRENGTH: "border-emerald-200 bg-emerald-50/80",
  RUNNING: "border-sky-200 bg-sky-50/80",
  CYCLING: "border-amber-200 bg-amber-50/80",
  OTHER: "border-slate-200 bg-slate-50",
};

const statusLabels: Readonly<Record<WorkoutScheduleStatus, string>> = {
  SCHEDULED: "Programado",
  RESCHEDULED: "Reprogramado",
  COMPLETED: "Concluído",
  SKIPPED: "Não realizado",
  CANCELLED: "Cancelado",
};

const statusTones: Readonly<
  Record<WorkoutScheduleStatus, "info" | "neutral" | "success" | "warning">
> = {
  SCHEDULED: "info",
  RESCHEDULED: "warning",
  COMPLETED: "success",
  SKIPPED: "neutral",
  CANCELLED: "neutral",
};

export interface PerformanceCalendarPlanOption {
  readonly label: string;
  readonly versionLabel: string;
  readonly workoutPlanEntryId: string;
  readonly workoutPlanVersionId: string;
  readonly sessionId?: string;
  readonly sessionLabel?: string;
  readonly suggestedTitle?: string;
  readonly modality?: PerformanceModality;
}

export interface PerformanceCalendarPrescription {
  readonly id: string;
  readonly sessionId: string;
  readonly title: string;
  readonly modality: PerformanceModality;
  readonly scheduledDate: string;
  readonly plannedDurationSeconds?: number;
  readonly plannedDistanceMeters?: number;
  readonly draft?: boolean;
}

export interface PerformanceCalendarProps {
  readonly masterRecordId: string;
  readonly patientName: string;
  readonly planOptions: readonly PerformanceCalendarPlanOption[];
  readonly prescribedSessions?: readonly PerformanceCalendarPrescription[];
}

type CalendarSessionFields = Pick<
  WorkoutScheduledSession,
  | "id"
  | "masterRecordId"
  | "title"
  | "modality"
  | "scheduledStartAt"
  | "scheduledEndAt"
  | "plannedDurationSeconds"
  | "timeZone"
  | "status"
  | "revision"
  | "createdAt"
  | "updatedAt"
>;

interface CalendarSession extends CalendarSessionFields {
  readonly sessionId?: string;
}

interface ScheduleFormState {
  readonly planOptionIndex: string;
  readonly title: string;
  readonly modality: PerformanceModality;
  readonly date: string;
  readonly time: string;
  readonly durationMinutes: string;
  readonly timeZone: string;
  readonly notes: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModality(value: unknown): value is PerformanceModality {
  return (
    typeof value === "string" &&
    PERFORMANCE_MODALITIES.some((modality) => modality === value)
  );
}

function isScheduleStatus(value: unknown): value is WorkoutScheduleStatus {
  return (
    typeof value === "string" &&
    WORKOUT_SCHEDULE_STATUSES.some((status) => status === value)
  );
}

function isCalendarSession(value: unknown): value is CalendarSession {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.masterRecordId === "string" &&
    typeof value.title === "string" &&
    isModality(value.modality) &&
    typeof value.scheduledStartAt === "string" &&
    typeof value.timeZone === "string" &&
    isScheduleStatus(value.status) &&
    typeof value.revision === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.sessionId === undefined || typeof value.sessionId === "string") &&
    (value.scheduledEndAt === undefined ||
      typeof value.scheduledEndAt === "string") &&
    (value.plannedDurationSeconds === undefined ||
      typeof value.plannedDurationSeconds === "number")
  );
}

function responseMessage(payload: unknown) {
  return isObject(payload) && typeof payload.message === "string"
    ? payload.message
    : undefined;
}

function sessionsFromResponse(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.scheduledSessions)) {
    return undefined;
  }

  return payload.scheduledSessions.every(isCalendarSession)
    ? payload.scheduledSessions
    : undefined;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const day = values.get("day");
    const month = values.get("month");
    const year = values.get("year");
    return day && month && year ? `${year}-${month}-${day}` : localDateKey(date);
  } catch {
    return localDateKey(date);
  }
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function periodLabel(days: readonly Date[]) {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return "";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return `${formatter.format(first)} – ${formatter.format(last)} de ${last.getFullYear()}`;
}

function sessionTime(session: CalendarSession) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: session.timeZone,
    }).format(new Date(session.scheduledStartAt));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(session.scheduledStartAt));
  }
}

function durationLabel(durationSeconds?: number) {
  if (durationSeconds === undefined) return "Duração não informada";
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function timeZoneDisplayLabel(timeZone: string) {
  return timeZone === "America/Sao_Paulo" ? "Horário de Brasília" : timeZone;
}

function scheduledDate(date: string, time: string) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateParts || !timeParts) return undefined;

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  const hours = Number(timeParts[1]);
  const minutes = Number(timeParts[2]);
  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hours ||
    result.getMinutes() !== minutes
  ) {
    return undefined;
  }

  return result;
}

function planOptionLabel(option: PerformanceCalendarPlanOption) {
  return [option.label, option.versionLabel, option.sessionLabel]
    .filter(Boolean)
    .join(" · ");
}

function SessionCard({ session }: { readonly session: CalendarSession }) {
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border p-3 ${modalityStyles[session.modality]}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {modalityLabels[session.modality]}
      </p>
      <div className="mt-1.5 min-w-0">
        <Badge tone={statusTones[session.status]}>
          {statusLabels[session.status]}
        </Badge>
      </div>
      <h4 className="mt-2 line-clamp-2 min-w-0 break-normal text-sm font-black leading-5 text-slate-900 [overflow-wrap:normal] [word-break:normal]">
        {session.title}
      </h4>
      <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-700">
        <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0">
          {sessionTime(session)} · {durationLabel(session.plannedDurationSeconds)}
        </span>
      </p>
    </article>
  );
}

function PrescriptionCard({ session }: { readonly session: PerformanceCalendarPrescription }) {
  return (
    <article className={`min-w-0 overflow-hidden rounded-xl border p-3 ${modalityStyles[session.modality]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{modalityLabels[session.modality]}</p>
      <div className="mt-1.5"><Badge tone="info">Prescrito</Badge></div>
      <h4 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">{session.title}</h4>
      <p className="mt-2 text-xs font-bold text-slate-700">Horário não informado</p>
      <p className="mt-1 text-xs text-slate-600">
        {session.plannedDurationSeconds !== undefined ? durationLabel(session.plannedDurationSeconds) : "Duração não informada"}
        {session.plannedDistanceMeters !== undefined
          ? ` · ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(session.plannedDistanceMeters / 1_000)} km`
          : ""}
      </p>
    </article>
  );
}

export function PerformanceCalendar({
  masterRecordId,
  patientName,
  planOptions,
  prescribedSessions = [],
}: PerformanceCalendarProps) {
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [weekStartAt, setWeekStartAt] = useState(() =>
    startOfWeek(new Date()).getTime(),
  );
  const [sessions, setSessions] = useState<readonly CalendarSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [timeZone] = useState(browserTimeZone);
  const [form, setForm] = useState<ScheduleFormState>(() => ({
    planOptionIndex: "",
    title: "",
    modality: "STRENGTH",
    date: localDateKey(new Date()),
    time: "08:00",
    durationMinutes: "60",
    timeZone: browserTimeZone(),
    notes: "",
  }));

  const weekStart = useMemo(() => new Date(weekStartAt), [weekStartAt]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const todayKey = localDateKey(new Date());
  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarSession[]>();
    const draftSessionIds = new Set(
      prescribedSessions.flatMap((session) =>
        session.draft ? [session.sessionId] : [],
      ),
    );

    for (const session of sessions) {
      if (session.sessionId && draftSessionIds.has(session.sessionId)) continue;
      const key = dateKeyInTimeZone(
        new Date(session.scheduledStartAt),
        session.timeZone,
      );
      const entries = grouped.get(key) ?? [];
      entries.push(session);
      grouped.set(key, entries);
    }

    return grouped;
  }, [prescribedSessions, sessions]);
  const prescribedByDay = useMemo(() => {
    const scheduledSessionIds = new Set(
      sessions.flatMap((session) => session.sessionId ? [session.sessionId] : []),
    );
    const grouped = new Map<string, PerformanceCalendarPrescription[]>();
    for (const session of prescribedSessions) {
      if (!session.draft && scheduledSessionIds.has(session.sessionId)) continue;
      const entries = grouped.get(session.scheduledDate) ?? [];
      entries.push(session);
      grouped.set(session.scheduledDate, entries);
    }
    return grouped;
  }, [prescribedSessions, sessions]);

  useEffect(() => {
    const controller = new AbortController();
    const rangeEnd = new Date(
      addDays(weekStart, 7).getTime() - 1,
    );
    const params = new URLSearchParams({
      masterRecordId,
      from: weekStart.toISOString(),
      to: rangeEnd.toISOString(),
    });

    void (async () => {
      setLoading(true);
      setLoadError(undefined);

      try {
        const response = await fetch(`${API_PATH}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => undefined);

        if (!response.ok) {
          throw new Error(
            responseMessage(payload) ||
              "Não foi possível consultar o calendário de treinos.",
          );
        }

        const result = sessionsFromResponse(payload);
        if (!result) {
          throw new Error("O calendário retornou uma resposta inválida.");
        }
        if (!controller.signal.aborted) setSessions(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setSessions([]);
          setLoadError(
            error instanceof Error && error.message
              ? error.message
              : "Não foi possível consultar o calendário de treinos.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [masterRecordId, reloadKey, weekStart]);

  useEffect(() => {
    if (!dialogOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setDialogOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen, saving]);

  function openScheduleForm() {
    const firstOption = planOptions[0];
    if (!firstOption) return;

    setFormError(undefined);
    setSuccessMessage(undefined);
    setForm({
      planOptionIndex: "0",
      title:
        firstOption.suggestedTitle ?? firstOption.sessionLabel ?? "",
      modality: firstOption.modality ?? "STRENGTH",
      date: localDateKey(new Date()),
      time: "08:00",
      durationMinutes: "60",
      timeZone,
      notes: "",
    });
    setDialogOpen(true);
  }

  function selectPlanOption(value: string) {
    const index = Number(value);
    const option = Number.isInteger(index) ? planOptions[index] : undefined;

    setForm((current) => ({
      ...current,
      planOptionIndex: value,
      title:
        option?.suggestedTitle ?? option?.sessionLabel ?? current.title,
      modality: option?.modality ?? current.modality,
    }));
  }

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFormError(undefined);
    setSuccessMessage(undefined);

    const optionIndex = Number(form.planOptionIndex);
    const option = Number.isInteger(optionIndex)
      ? planOptions[optionIndex]
      : undefined;
    const startAt = scheduledDate(form.date, form.time);
    const durationMinutes = Number(form.durationMinutes);

    if (!option) {
      setFormError("Selecione um plano e uma versão disponíveis.");
      return;
    }
    if (!form.title.trim()) {
      setFormError("Informe o título do treino.");
      return;
    }
    if (!startAt) {
      setFormError("Informe uma data e um horário válidos.");
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setFormError("Informe a duração planejada em minutos inteiros.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterRecordId,
          workoutPlanEntryId: option.workoutPlanEntryId,
          workoutPlanVersionId: option.workoutPlanVersionId,
          sessionId: option.sessionId,
          title: form.title.trim(),
          modality: form.modality,
          scheduledStartAt: startAt.toISOString(),
          plannedDurationSeconds: durationMinutes * 60,
          timeZone: form.timeZone,
          notes: form.notes.trim() || undefined,
        }),
      });
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(
          responseMessage(payload) || "Não foi possível programar o treino.",
        );
      }

      setDialogOpen(false);
      setSuccessMessage("Treino programado com sucesso.");
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível programar o treino.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden" variant="elevated">
      <header className="border-b border-emerald-900/10 bg-emerald-950 px-4 py-4 text-white sm:px-5 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-200">
              Calendário de treinos
            </p>
            <h2 className="mt-1 truncate text-xl font-black">{patientName}</h2>
            <p className="mt-1 text-sm text-emerald-100">
              {periodLabel(weekDays)}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="grid grid-cols-3 gap-2">
              <Button
                aria-label="Semana anterior"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() =>
                  setWeekStartAt((current) =>
                    addDays(new Date(current), -7).getTime(),
                  )
                }
                size="small"
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <Button
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setWeekStartAt(startOfWeek(new Date()).getTime())}
                size="small"
                type="button"
                variant="outline"
              >
                Hoje
              </Button>
              <Button
                aria-label="Próxima semana"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() =>
                  setWeekStartAt((current) =>
                    addDays(new Date(current), 7).getTime(),
                  )
                }
                size="small"
                type="button"
                variant="outline"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <Button
              className="bg-amber-400 text-emerald-950 hover:bg-amber-300"
              disabled={planOptions.length === 0}
              onClick={openScheduleForm}
              size="small"
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              Programar treino
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 bg-white p-4 sm:p-5 lg:p-6">
        {successMessage ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
          >
            {successMessage}
          </p>
        ) : null}

        {planOptions.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Finalize uma versão real do plano de treino para liberar novas
            programações.
          </p>
        ) : null}

        {loading ? (
          <div
            aria-live="polite"
            className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50"
            role="status"
          >
            <div className="text-center">
              <span
                aria-hidden="true"
                className="mx-auto block size-7 animate-spin rounded-full border-2 border-emerald-700 border-r-transparent"
              />
              <p className="mt-3 text-sm font-bold text-slate-600">
                Carregando calendário...
              </p>
            </div>
          </div>
        ) : loadError ? (
          <PageState
            action={
              <Button
                onClick={() => setReloadKey((current) => current + 1)}
                size="small"
                type="button"
                variant="outline"
              >
                Tentar novamente
              </Button>
            }
            description={loadError}
            title="Não foi possível carregar os treinos"
            tone="danger"
          />
        ) : (
          <>
            {sessions.length === 0 && prescribedSessions.length === 0 ? (
              <p
                className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                role="status"
              >
                Nenhum treino programado para esta semana.
              </p>
            ) : null}

            <ol className="hidden grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 lg:grid">
              {weekDays.map((day) => {
                const key = localDateKey(day);
                const daySessions = sessionsByDay.get(key) ?? [];
                const dayPrescriptions = prescribedByDay.get(key) ?? [];
                const isToday = key === todayKey;

                return (
                  <li
                    className={`min-w-0 border-r border-slate-200 last:border-r-0 ${
                      isToday ? "bg-emerald-50/60" : "bg-white"
                    }`}
                    key={key}
                  >
                    <div
                      className={`border-b border-slate-200 px-2 py-3 text-center ${
                        isToday ? "bg-emerald-100/70" : "bg-slate-50"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "short",
                        }).format(day)}
                      </p>
                      <p
                        className={`mt-1 text-lg font-black ${
                          isToday ? "text-emerald-800" : "text-slate-900"
                        }`}
                      >
                        {day.getDate()}
                      </p>
                    </div>
                    <div className="min-h-64 space-y-2 p-2">
                      {daySessions.length || dayPrescriptions.length ? (
                        <>
                        {daySessions.map((session) => (
                          <SessionCard key={session.id} session={session} />
                        ))}
                        {dayPrescriptions.map((session) => (
                          <PrescriptionCard key={session.id} session={session} />
                        ))}
                        </>
                      ) : (
                        <p className="px-1 py-3 text-center text-xs text-slate-400">
                          Sem treino
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <ol className="space-y-3 lg:hidden">
              {weekDays.map((day) => {
                const key = localDateKey(day);
                const daySessions = sessionsByDay.get(key) ?? [];
                const dayPrescriptions = prescribedByDay.get(key) ?? [];
                const isToday = key === todayKey;

                return (
                  <li
                    className={`rounded-2xl border p-3 ${
                      isToday
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                    key={key}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black capitalize text-slate-900">
                          {new Intl.DateTimeFormat("pt-BR", {
                            weekday: "long",
                          }).format(day)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "long",
                          }).format(day)}
                        </p>
                      </div>
                      {isToday ? <Badge tone="success">Hoje</Badge> : null}
                    </div>
                    {daySessions.length || dayPrescriptions.length ? (
                      <div className="space-y-2">
                        {daySessions.map((session) => (
                          <SessionCard key={session.id} session={session} />
                        ))}
                        {dayPrescriptions.map((session) => (
                          <PrescriptionCard key={session.id} session={session} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Sem treino programado.
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              setDialogOpen(false);
            }
          }}
        >
          <section
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-2xl sm:rounded-3xl"
            role="dialog"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Performance
                </p>
                <h3
                  className="mt-1 text-xl font-black text-slate-950"
                  id={dialogTitleId}
                >
                  Programar treino
                </h3>
                <p className="mt-1 text-sm text-slate-500">{patientName}</p>
              </div>
              <button
                aria-label="Fechar formulário"
                className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </header>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={submitSchedule}
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                <FormField
                  id="performance-calendar-plan"
                  label="Plano e versão"
                  required
                >
                  <Select
                    className="mt-1.5"
                    id="performance-calendar-plan"
                    onChange={(event) => selectPlanOption(event.target.value)}
                    required
                    value={form.planOptionIndex}
                  >
                    <option value="">Selecione o plano prescrito</option>
                    {planOptions.map((option, index) => (
                      <option
                        key={`${option.workoutPlanEntryId}:${option.workoutPlanVersionId}:${option.sessionId ?? index}`}
                        value={String(index)}
                      >
                        {planOptionLabel(option)}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormField
                  className="sm:col-span-2"
                  id="performance-calendar-title"
                  label="Título"
                  required
                >
                  <Input
                    className="mt-1.5"
                    id="performance-calendar-title"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                    value={form.title}
                  />
                </FormField>

                <FormField
                  id="performance-calendar-modality"
                  label="Modalidade"
                  required
                >
                  <Select
                    className="mt-1.5"
                    id="performance-calendar-modality"
                    onChange={(event) => {
                      const modality = PERFORMANCE_MODALITIES.find(
                        (item) => item === event.target.value,
                      );
                      if (modality) {
                        setForm((current) => ({ ...current, modality }));
                      }
                    }}
                    value={form.modality}
                  >
                    {PERFORMANCE_MODALITIES.map((modality) => (
                      <option key={modality} value={modality}>
                        {modalityLabels[modality]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  id="performance-calendar-duration"
                  label="Duração planejada (min)"
                  required
                >
                  <NumberInput
                    className="mt-1.5"
                    id="performance-calendar-duration"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        durationMinutes: event.target.value,
                      }))
                    }
                    required
                    step={1}
                    value={form.durationMinutes}
                  />
                </FormField>

                <FormField
                  id="performance-calendar-date"
                  label="Data"
                  required
                >
                  <Input
                    className="mt-1.5"
                    id="performance-calendar-date"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.date}
                  />
                </FormField>

                <FormField
                  id="performance-calendar-time"
                  label="Horário"
                  required
                >
                  <Input
                    className="mt-1.5"
                    id="performance-calendar-time"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        time: event.target.value,
                      }))
                    }
                    required
                    type="time"
                    value={form.time}
                  />
                </FormField>

                <FormField
                  className="sm:col-span-2"
                  help="Detectado automaticamente neste dispositivo."
                  id="performance-calendar-time-zone"
                  label="Fuso horário"
                >
                  <Input
                    className="mt-1.5"
                    id="performance-calendar-time-zone"
                    readOnly
                    value={timeZoneDisplayLabel(form.timeZone)}
                  />
                </FormField>

                <FormField
                  className="sm:col-span-2"
                  id="performance-calendar-notes"
                  label="Observações (opcional)"
                >
                  <Textarea
                    className="mt-1.5"
                    id="performance-calendar-notes"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Orientações específicas para esta programação."
                    value={form.notes}
                  />
                </FormField>
                </div>

                {formError ? (
                  <p
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
                    role="alert"
                  >
                    {formError}
                  </p>
                ) : null}
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:px-6">
                <Button
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Voltar
                </Button>
                <Button disabled={saving} loading={saving} type="submit">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  {saving ? "Programando..." : "Programar treino"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </Card>
  );
}

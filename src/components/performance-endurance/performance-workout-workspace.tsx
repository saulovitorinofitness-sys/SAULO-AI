"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  SlidersHorizontal,
  Watch,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  NumberInput,
  SectionHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { buttonStyles } from "@/components/ui/button";
import { PerformanceDeliverablePreview } from "@/components/deliverables/performance-deliverable-preview";
import { PerformanceExecutionsWorkspace } from "@/components/performance-endurance/performance-executions-workspace";
import {
  RunningPlanConfigurationForm,
  type RunningPlanConfiguration,
  type RunningPlanConfigurationFormErrors,
} from "@/components/performance-endurance/running-plan-configuration-form";
import {
  PerformanceCalendar,
  type PerformanceCalendarPlanOption,
  type PerformanceCalendarPrescription,
} from "@/components/performance-monitoring/performance-calendar";
import {
  initialRunningWeek,
} from "@/components/performance-endurance/running-session-editor";
import { AssistedRunningWeekPanel } from "@/components/performance-endurance/assisted-running-week-panel";
import {
  applyAssistedWorkoutProposal,
  proposeAssistedWorkoutStructure,
  type AssistedWorkoutApplicationMode,
  type AssistedWorkoutExercise,
  type AssistedWorkoutProposal,
} from "@/features/performance-endurance/assisted-workout";
import {
  PERFORMANCE_SERVICE_LABELS,
  PERFORMANCE_SERVICE_OPTIONS,
  PHYSICAL_VALENCE_OPTIONS,
  PROGRAM_FOCUS_OPTIONS,
  PROGRAM_PHASE_OPTIONS,
  WORKOUT_START_MODE_LABELS,
  WORKOUT_START_MODES,
  type ExerciseLibraryItemView,
  type PerformanceWorkoutView,
  type PeriodizationCycle,
  type TrainingMethodDefinition,
  type WorkoutExercise,
  type WorkoutPlanDraft,
  type WorkoutProfessionalContext,
  type WorkoutSession,
  type WorkoutWeekday,
} from "@/features/performance-endurance/workout-contracts";
import {
  STANDARD_TRAINING_METHODS,
  buildWorkoutMethodGlossary,
  confirmWorkoutPlanningTransition,
  parseWorkoutPlanDraft,
  validateWorkoutPlanFinalization,
} from "@/features/performance-endurance/workout-record";
import { runningPlanConfigurationSchema } from "@/features/performance-endurance/endurance-workout-schemas";
import {
  applyRunningProposal,
} from "@/features/performance-endurance/assisted-running-week";
import {
  runningPrescriptionTotals,
  selectRunningPreview,
  type EditableRunningSessionProposal,
  type RunningProposalApplicationMode,
} from "@/features/performance-endurance/running-session-editor";
import { workoutSheetReducer } from "@/features/performance-endurance/workout-sheet";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type { NutritionClinicalFlowStepStatus } from "@/features/nutrition-clinical-flow/flow";

const NOT_INFORMED = "Não informado";

function RunningPrintPreviewPortal({
  children,
  source,
}: {
  readonly children: ReactNode;
  readonly source: "DRAFT" | "PROPOSAL";
}) {
  useEffect(() => {
    document.body.classList.add("running-print-preview-open");
    return () => document.body.classList.remove("running-print-preview-open");
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="running-print-preview-portal fixed inset-0 z-[100] overflow-y-auto bg-slate-100 px-3 py-5"
      data-running-print-source={source}
    >
      <div className="mx-auto w-full max-w-[76rem] space-y-4 bg-white pb-8">
        {children}
      </div>
    </div>,
    document.body,
  );
}

const DEFAULT_WORKOUT_SESSION_NAMES = [
  "Treino A",
  "Treino B",
  "Treino C",
  "Treino D",
] as const;
const MAX_WORKOUT_SESSIONS = 30;
const LOCAL_WORKOUT_DRAFT_SCHEMA_VERSION = 1;
const PERFORMANCE_FLOW_STEP_ID = "PERFORMANCE";
const SKIP_REASON_MAX_LENGTH = 1_000;
type WorkspaceTab =
  | "SUMMARY"
  | "PLANNING"
  | "WORKOUTS"
  | "CALENDAR"
  | "EXECUTIONS";
type PlanningModalityView = "STRENGTH" | "RUNNING";

export function performanceWorkspaceTabFromQuery(value: string | null) {
  if (value === "planning") return "PLANNING" as const;
  if (value === "workouts") return "WORKOUTS" as const;
  if (value === "calendar") return "CALENDAR" as const;
  if (value === "executions") return "EXECUTIONS" as const;
  return "SUMMARY" as const;
}

async function apiErrorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return undefined;
}

const workspaceTabs = [
  {
    id: "SUMMARY",
    label: "Resumo",
    description:
      "Contexto clínico, avaliações corporais e histórico do planejamento.",
    icon: ClipboardList,
  },
  {
    id: "PLANNING",
    label: "Planejamento",
    description:
      "Estratégia, periodização e configurações profissionais da prescrição.",
    icon: SlidersHorizontal,
  },
  {
    id: "WORKOUTS",
    label: "Treinos",
    description:
      "Construtor de sessões, exercícios e parâmetros de execução.",
    icon: Dumbbell,
  },
  {
    id: "CALENDAR",
    label: "Calendário",
    description:
      "Sessões prescritas e programação do mesmo paciente e atendimento.",
    icon: CalendarDays,
  },
  {
    id: "EXECUTIONS",
    label: "Execuções e relógio",
    description:
      "Importação Apple Health e histórico de execuções registradas.",
    icon: Watch,
  },
] as const satisfies readonly {
  id: WorkspaceTab;
  label: string;
  description: string;
  icon: typeof ClipboardList;
}[];
const weekdayLabels: Readonly<Record<WorkoutWeekday, string>> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

function localWorkoutDraftKey(patientId: string, attendanceId: string) {
  return `saulo-ai:performance-workout-draft:${encodeURIComponent(patientId)}:${encodeURIComponent(attendanceId)}`;
}

function workspacePlanModality(draft: WorkoutPlanDraft) {
  if (draft.service.contractedService === "RUNNING_PLAN") return "RUNNING" as const;
  if (draft.service.contractedService === "CYCLING_PLAN") return "CYCLING" as const;
  if (draft.service.contractedService?.startsWith("STRENGTH_")) {
    return "STRENGTH" as const;
  }
  const normalized = draft.service.primaryModality
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (normalized.includes("corrida")) return "RUNNING" as const;
  if (normalized.includes("ciclismo") || normalized.includes("bike")) {
    return "CYCLING" as const;
  }
  if (normalized.includes("musculacao") || normalized.includes("forca")) {
    return "STRENGTH" as const;
  }
  return "OTHER" as const;
}

export function performanceWorkspaceCalendarData(
  view: Pick<
    PerformanceWorkoutView,
    "entryId" | "status" | "version" | "workoutPlanVersionId"
  >,
  draft: WorkoutPlanDraft,
) {
  const planOptions: PerformanceCalendarPlanOption[] = [];
  const prescribedSessions: PerformanceCalendarPrescription[] = [];
  const label = draft.strategy.programName.trim() || "Plano de Treino";
  const canScheduleFromPlan = Boolean(
    view.status === "FINALIZED" &&
      view.entryId &&
      view.workoutPlanVersionId,
  );

  if (canScheduleFromPlan) {
    for (const session of draft.sessions) {
      planOptions.push({
        label,
        versionLabel: `Versão ${view.version}`,
        workoutPlanEntryId: view.entryId as string,
        workoutPlanVersionId: view.workoutPlanVersionId as string,
        sessionId: session.id,
        sessionLabel: session.name,
        suggestedTitle: session.name,
        modality: workspacePlanModality(draft),
      });
    }
  }

  for (const session of draft.endurance?.running?.weeks.flatMap(
    (week) => week.sessions,
  ) ?? []) {
    if (session.sessionKind !== "STRUCTURED") continue;
    const totals = runningPrescriptionTotals(session);
    prescribedSessions.push({
      id: `workspace:${view.entryId ?? "draft"}:${session.id}`,
      sessionId: session.id,
      title:
        view.status === "FINALIZED" ? session.title : `${session.title} · rascunho`,
      modality: "RUNNING",
      scheduledDate: session.scheduledDate,
      plannedDurationSeconds:
        totals.durationSeconds ?? session.estimatedDurationSeconds,
      plannedDistanceMeters:
        totals.distanceMeters ?? session.estimatedDistanceMeters,
      draft: view.status !== "FINALIZED",
    });
    if (canScheduleFromPlan) {
      planOptions.push({
        label,
        versionLabel: `Versão ${view.version}`,
        workoutPlanEntryId: view.entryId as string,
        workoutPlanVersionId: view.workoutPlanVersionId as string,
        sessionId: session.id,
        sessionLabel: session.title,
        suggestedTitle: session.title,
        modality: "RUNNING",
      });
    }
  }

  return { planOptions, prescribedSessions };
}

function removeLocalWorkoutDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // A indisponibilidade do armazenamento local não pode bloquear o plano.
  }
}

function parseLocalWorkoutDraft(value: string) {
  try {
    const stored = JSON.parse(value) as unknown;
    if (!stored || typeof stored !== "object") return null;
    const candidate = stored as Record<string, unknown>;
    if (
      candidate.schemaVersion !== LOCAL_WORKOUT_DRAFT_SCHEMA_VERSION ||
      typeof candidate.savedAt !== "string" ||
      Number.isNaN(Date.parse(candidate.savedAt))
    ) {
      return null;
    }
    const draft = parseWorkoutPlanDraft(candidate.draft);
    return draft ? { draft, savedAt: candidate.savedAt } : null;
  } catch {
    return null;
  }
}

function informed(value?: string) {
  return value?.trim() || NOT_INFORMED;
}

interface DisplayMetric {
  readonly label: string;
  readonly value: string;
}

function formatClinicalDate(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

function formatPersistedText(value: string) {
  return value
    .replace(
      /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      (_match, year: string, month: string, day: string) =>
        `${day}/${month}/${year}`,
    )
    .replace(/\bmusculacao\b/giu, "Musculação")
    .replace(
      /(^| · |\n)(\p{Ll})/gu,
      (_match, prefix: string, letter: string) =>
        `${prefix}${letter.toLocaleUpperCase("pt-BR")}`,
    );
}

function parsedMeasurements(value?: string): readonly DisplayMetric[] {
  if (!value || value === NOT_INFORMED) return [];
  return value.split(" | ").flatMap((part) => {
    const separator = part.indexOf(":");
    if (separator < 1) return [];
    const label = part.slice(0, separator).trim();
    const measurement = part.slice(separator + 1).trim();
    return label && measurement ? [{ label, value: measurement }] : [];
  });
}

function parsedAnthropometry(value?: string): readonly DisplayMetric[] {
  if (!value || value === NOT_INFORMED) return [];
  return value.split(" · ").flatMap((part) => {
    const measurement = part.trim();
    if (!measurement || measurement === NOT_INFORMED) return [];
    if (measurement.endsWith(" kg")) {
      return [{ label: "Peso", value: measurement }];
    }
    if (measurement.endsWith(" cm")) {
      return [{ label: "Altura", value: measurement }];
    }
    return [];
  });
}

function MetricGrid({ metrics }: { metrics: readonly DisplayMetric[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          className="rounded-xl bg-[var(--surface-elevated)] p-3"
          key={metric.label}
        >
          <dt className="text-[11px] font-black text-[var(--muted)]">
            {metric.label}
          </dt>
          <dd className="mt-1 text-sm font-black text-[var(--text-primary)]">
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function inheritedFactValue(
  facts: PerformanceWorkoutView["inheritedFacts"],
  key: string,
) {
  const value = facts.find((fact) => fact.key === key)?.value.trim();
  return value && value !== NOT_INFORMED ? value : undefined;
}

function inheritedActivityDetail(
  facts: PerformanceWorkoutView["inheritedFacts"],
  label: "Frequência" | "Duração",
) {
  const routine = inheritedFactValue(facts, "weekly-availability");
  const prefix = `${label}:`;
  const detail = routine
    ?.split(" · ")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return detail?.slice(prefix.length).trim() || undefined;
}

function normalizedComparisonValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function contextAvailability(
  context: WorkoutProfessionalContext | undefined,
  fallback: {
    readonly weeklyAvailability?: string;
    readonly sessionDuration?: string;
  },
) {
  const careItems = [
    ...(context?.painAndLimitations ?? []),
    ...(context?.relevantInjuries ?? []),
    ...(context?.relevantContraindications ?? []),
    ...(context?.relevantPosturalFindings ?? []),
  ];
  const checks = [
    ["Objetivo do paciente", Boolean(context?.objective?.trim())],
    ["Experiência de treinamento", Boolean(context?.trainingExperience?.trim())],
    [
      "Disponibilidade semanal",
      Boolean(context?.weeklyAvailability?.trim() || fallback.weeklyAvailability),
    ],
    [
      "Duração disponível por sessão",
      context?.sessionDurationMinutes !== undefined || Boolean(fallback.sessionDuration),
    ],
    ["Modalidades praticadas", Boolean(context?.practicedModalities?.length)],
    ["Cuidados relevantes", careItems.length > 0],
    ["Avaliações físicas estruturadas", Boolean(context?.physicalAssessments?.length)],
  ] as const;

  return {
    careItems,
    available: checks.filter(([, present]) => present).map(([label]) => label),
    missing: checks.filter(([, present]) => !present).map(([label]) => label),
  };
}

function emptyExercise(
  name: string,
  libraryExerciseId?: string,
  libraryExerciseSource?: ExerciseLibraryItemView["sourceKind"],
): WorkoutExercise {
  return {
    id: crypto.randomUUID(),
    order: 1,
    name,
    libraryExerciseId,
    libraryExerciseSource,
    prescription: "",
    sets: "",
    repetitions: "",
    load: "",
    loadUnit: "",
    rir: "",
    rpe: "",
    intensityType: "",
    intensityValue: "",
    restInterval: "",
    cadence: "",
    rangeOfMotion: "",
    methodId: "",
    observations: "",
    patientInstructions: "",
    substituteExercise: "",
  };
}

function emptySession(name: string): WorkoutSession {
  return {
    id: crypto.randomUUID(),
    name,
    objective: "",
    estimatedDuration: "",
    observations: "",
    exercises: [],
  };
}

function emptyCycle(): PeriodizationCycle {
  return {
    id: crypto.randomUUID(),
    level: "MESOCYCLE",
    name: "",
    startDate: "",
    endDate: "",
    objective: "",
    observations: "",
  };
}

function emptyCustomMethod(): TrainingMethodDefinition {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: "",
    studentExplanation: "",
    executionInstruction: "",
    objective: "",
    professionalObservation: "",
    custom: true,
  };
}

function emptyRunningPlanConfiguration(): RunningPlanConfiguration {
  return {
    modality: "RUNNING",
    primaryObjective: "",
    currentLevel: "",
    startDate: "",
    cycleDurationWeeks: undefined as unknown as number,
    weeklyFrequency: undefined as unknown as number,
    availableWeekdays: [],
    environment: "ROAD",
    primaryUnit: "TIME",
    primaryIntensityMethod: "RPE",
    generalObservation: "",
  };
}

function customMethodHasContent(method: TrainingMethodDefinition) {
  return [
    method.name,
    method.studentExplanation,
    method.executionInstruction,
    method.objective,
    method.professionalObservation,
  ].some((value) => value.trim().length > 0);
}

function libraryMatch(
  library: readonly ExerciseLibraryItemView[],
  name: string,
) {
  const normalized = name.trim().toLocaleLowerCase("pt-BR");
  return library.find(
    (item) => item.name.toLocaleLowerCase("pt-BR") === normalized,
  );
}

interface ExerciseLibrarySelection {
  readonly query: string;
  readonly exerciseId?: string;
}

export function PerformanceWorkoutWorkspace({
  initialView,
  operationalStatus,
}: {
  initialView: PerformanceWorkoutView;
  operationalStatus?: NutritionClinicalFlowStepStatus;
}) {
  const [currentView, setCurrentView] =
    useState<PerformanceWorkoutView>(initialView);
  const localDraftStorageKey = useMemo(
    () =>
      localWorkoutDraftKey(
        initialView.patient.id,
        initialView.attendanceId,
      ),
    [initialView.attendanceId, initialView.patient.id],
  );
  const latestViewRef = useRef(initialView);
  const latestDraftRef = useRef(initialView.draft);
  const lastSavedDraftRef = useRef(JSON.stringify(initialView.draft));
  const autosaveReadyRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const saveInFlightRef = useRef(false);
  const pendingAutosaveRef = useRef(false);
  const queuedAutosaveRef = useRef(false);
  const saveRef = useRef<
    (action: "SAVE_DRAFT" | "FINALIZE", automatic?: boolean) => Promise<boolean>
  >(async () => false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipRequestInFlightRef = useRef(false);
  const skipDialogRef = useRef<HTMLElement>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipReasonError, setSkipReasonError] = useState<string>();
  const [skipRequestError, setSkipRequestError] = useState<string>();
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const [performanceMarkedSkipped, setPerformanceMarkedSkipped] =
    useState(false);
  const performanceSkipped =
    operationalStatus === "SKIPPED" || performanceMarkedSkipped;
  const performanceCanBeSkipped =
    operationalStatus === "NOT_STARTED" ||
    operationalStatus === "IN_PROGRESS" ||
    operationalStatus === "BLOCKED";
  const {
    draft,
    status,
    version,
    updatedAt,
    responsibleProfessional,
    professionalContext,
  } = currentView;
  const calendarData = useMemo(
    () => performanceWorkspaceCalendarData(currentView, draft),
    [currentView, draft],
  );
  function setDraft(update: SetStateAction<WorkoutPlanDraft>) {
    if (performanceSkipped) return;
    setActionError("");
    setAutosaveError("");
    if (status === "DRAFT") setAutosaveStatus("PENDING");
    setCurrentView((current) => ({
      ...current,
      draft:
        typeof update === "function" ? update(current.draft) : update,
    }));
  }
  const [assistedProposal, setAssistedProposal] = useState<
    AssistedWorkoutProposal | undefined
  >();
  const [assistedApplicationMode, setAssistedApplicationMode] =
    useState<AssistedWorkoutApplicationMode>("APPEND");
  const [assistedReplacementConfirmed, setAssistedReplacementConfirmed] =
    useState(false);
  const [assistedPrintPreviewOpen, setAssistedPrintPreviewOpen] =
    useState(false);
  const [deliverablePreview, setDeliverablePreview] = useState<
    "GENERAL" | "RUNNING_DRAFT" | "RUNNING_PROPOSAL" | undefined
  >();
  const [runningProposal, setRunningProposal] = useState<
    EditableRunningSessionProposal | undefined
  >();
  const [runningApplicationMode, setRunningApplicationMode] =
    useState<RunningProposalApplicationMode>("APPEND");
  const [assistedExperience, setAssistedExperience] = useState(
    initialView.professionalContext?.trainingExperience ?? "",
  );
  const [assistedDuration, setAssistedDuration] = useState(
    initialView.professionalContext?.sessionDurationMinutes !== undefined
      ? `${initialView.professionalContext.sessionDurationMinutes} min`
      : "",
  );
  const [assistedEquipment, setAssistedEquipment] = useState("");
  const [library, setLibrary] = useState<ExerciseLibraryItemView[]>(() =>
    initialView.exerciseLibrary.filter(
      (exercise) =>
        exercise.active &&
        exercise.category !== "RUNNING" &&
        exercise.category !== "CYCLING",
    ),
  );
  const [newActivity, setNewActivity] = useState("");
  const [customValence, setCustomValence] = useState("");
  const [customSessionName, setCustomSessionName] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    () => initialView.draft.sessions[0]?.id,
  );
  const [exerciseSelections, setExerciseSelections] = useState<
    Record<string, ExerciseLibrarySelection>
  >({});
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [openCustomMethodId, setOpenCustomMethodId] = useState<string>();
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<
    "IDLE" | "PENDING" | "SAVING" | "SAVED" | "ERROR"
  >("IDLE");
  const [autosaveError, setAutosaveError] = useState("");
  const [localRecoveryDraft, setLocalRecoveryDraft] = useState<
    WorkoutPlanDraft | undefined
  >();
  const [savingAction, setSavingAction] = useState<
    "SAVE_DRAFT" | "FINALIZE"
  >();
  const [transitionConfirmationOpen, setTransitionConfirmationOpen] =
    useState(false);
  const [transitionEffectiveDate, setTransitionEffectiveDate] = useState("");
  const [transitionError, setTransitionError] = useState("");
  const saving = savingAction !== undefined;
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentError, setAdjustmentError] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>(() =>
      performanceWorkspaceTabFromQuery(searchParams.get("tab")),
    );
  const [activePlanningModality, setActivePlanningModality] =
    useState<PlanningModalityView>(() => {
      const primaryModality = normalizedComparisonValue(
        initialView.draft.service.primaryModality,
      );
      return initialView.draft.endurance?.running &&
        (primaryModality === "corrida" || primaryModality === "running")
        ? "RUNNING"
        : "STRENGTH";
    });
  const [adjusting, setAdjusting] = useState(false);
  const [bodyCompositionExpanded, setBodyCompositionExpanded] =
    useState(false);
  const [perimetryExpanded, setPerimetryExpanded] = useState(false);
  const [runningConfigurationDraft, setRunningConfigurationDraft] = useState<
    RunningPlanConfiguration | undefined
  >();
  const [runningConfigurationErrors, setRunningConfigurationErrors] =
    useState<RunningPlanConfigurationFormErrors>();
  function applyServerView(nextView: PerformanceWorkoutView) {
    latestViewRef.current = nextView;
    latestDraftRef.current = nextView.draft;
    setCurrentView(nextView);
    setActiveSessionId((current) =>
      current &&
      nextView.draft.sessions.some((session) => session.id === current)
        ? current
        : nextView.draft.sessions[0]?.id,
    );
  }
  useEffect(() => {
    latestViewRef.current = currentView;
    latestDraftRef.current = draft;
  }, [currentView, draft]);
  const finalized = status === "FINALIZED";
  const plannedPhase = draft.strategy.nextPhase?.trim();
  const plannedFocus = draft.strategy.nextFocus?.trim();
  const phaseWillChange = Boolean(
    plannedPhase && plannedPhase !== draft.strategy.currentPhase.trim(),
  );
  const focusWillChange = Boolean(
    plannedFocus && plannedFocus !== draft.strategy.currentFocus?.trim(),
  );
  const canConfirmPlanningTransition = phaseWillChange || focusWillChange;
  const officialDocumentParams = new URLSearchParams({
    patientId: currentView.patient.id,
    attendanceId: currentView.attendanceId,
  });
  const officialDocumentHref = `/clinica/plano-alimentar/entregavel?${new URLSearchParams({
    ...Object.fromEntries(officialDocumentParams),
    view: "performance",
  }).toString()}`;
  const officialPrintHref = `/clinica/plano-alimentar/entregavel/imprimir?${new URLSearchParams({
    ...Object.fromEntries(officialDocumentParams),
    documentType: "performance",
    intent: "PRINT",
  }).toString()}`;
  const officialPdfHref = officialPrintHref.replace(
    "intent=PRINT",
    "intent=SAVE_PDF",
  );
  useEffect(() => {
    if (performanceSkipped) return;
    if (initialView.status === "FINALIZED") {
      removeLocalWorkoutDraft(localDraftStorageKey);
      return;
    }
    let storedValue: string | null = null;
    try {
      storedValue = window.localStorage.getItem(localDraftStorageKey);
    } catch {
      return;
    }
    if (!storedValue) return;
    const stored = parseLocalWorkoutDraft(storedValue);
    const loadedAt = initialView.updatedAt
      ? Date.parse(initialView.updatedAt)
      : 0;
    if (
      !stored ||
      Date.parse(stored.savedAt) <= loadedAt ||
      JSON.stringify(stored.draft) === JSON.stringify(initialView.draft)
    ) {
      removeLocalWorkoutDraft(localDraftStorageKey);
      return;
    }
    const noticeTimer = window.setTimeout(() => {
      setLocalRecoveryDraft(stored.draft);
    }, 0);
    return () => window.clearTimeout(noticeTimer);
  }, [
    initialView.draft,
    initialView.status,
    initialView.updatedAt,
    localDraftStorageKey,
    performanceSkipped,
  ]);

  useEffect(() => {
    if (performanceSkipped) return;
    if (finalized) {
      removeLocalWorkoutDraft(localDraftStorageKey);
      return;
    }
    if (localRecoveryDraft) return;
    if (
      autosaveStatus === "PENDING" ||
      autosaveStatus === "SAVING" ||
      autosaveStatus === "ERROR"
    ) {
      try {
        window.localStorage.setItem(
          localDraftStorageKey,
          JSON.stringify({
            schemaVersion: LOCAL_WORKOUT_DRAFT_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            draft,
          }),
        );
      } catch {
        // O autosave do servidor continua funcionando sem armazenamento local.
      }
    } else if (autosaveStatus === "SAVED") {
      removeLocalWorkoutDraft(localDraftStorageKey);
    }
  }, [
    autosaveStatus,
    draft,
    finalized,
    localDraftStorageKey,
    localRecoveryDraft,
    performanceSkipped,
  ]);
  const autosaveMessage =
    autosaveStatus === "PENDING"
      ? "Alterações pendentes"
      : autosaveStatus === "SAVING"
        ? "Salvando automaticamente…"
        : autosaveStatus === "SAVED"
          ? "Salvo automaticamente"
          : autosaveStatus === "ERROR"
            ? autosaveError ||
              "Não foi possível salvar automaticamente. As alterações continuam nesta tela; tente Salvar rascunho novamente."
            : undefined;
  const patientRecordHref = `/pacientes/${encodeURIComponent(currentView.patient.id)}`;
  const officialDeliverableHref = useMemo(() => {
    const params = new URLSearchParams({
      patientId: currentView.patient.id,
      attendanceId: currentView.attendanceId,
      view: "performance",
    });
    const scenario = searchParams.get("scenario")?.trim();
    if (scenario) params.set("scenario", scenario);

    return `/clinica/plano-alimentar/entregavel?${params.toString()}`;
  }, [currentView.attendanceId, currentView.patient.id, searchParams]);
  const activeSession =
    draft.sessions.find((session) => session.id === activeSessionId) ??
    draft.sessions[0];
  const nextDefaultSessionName = DEFAULT_WORKOUT_SESSION_NAMES.find(
    (name) =>
      !draft.sessions.some(
        (session) =>
          normalizedComparisonValue(session.name) ===
          normalizedComparisonValue(name),
      ),
  );
  const requestedNewSessionName =
    customSessionName.trim() || nextDefaultSessionName;
  const sessionNameAlreadyExists = requestedNewSessionName
    ? draft.sessions.some(
        (session) =>
          normalizedComparisonValue(session.name) ===
          normalizedComparisonValue(requestedNewSessionName),
      )
    : false;
  const allMethods = useMemo(
    () => [
      ...STANDARD_TRAINING_METHODS,
      ...draft.customMethods.filter((method) => method.name.trim()),
    ],
    [draft.customMethods],
  );
  const visibleCustomMethods = draft.customMethods.filter(
    (method) =>
      customMethodHasContent(method) || method.id === openCustomMethodId,
  );
  const hasOpenEmptyCustomMethod = draft.customMethods.some(
    (method) =>
      method.id === openCustomMethodId && !customMethodHasContent(method),
  );
  const glossary = useMemo(
    () => buildWorkoutMethodGlossary(draft),
    [draft],
  );
  const inheritedWeeklyAvailability = useMemo(
    () =>
      inheritedFactValue(
        currentView.inheritedFacts,
        "possible-weekly-frequency",
      ) ?? inheritedActivityDetail(
        currentView.inheritedFacts,
        "Frequência",
      ),
    [currentView.inheritedFacts],
  );
  const inheritedSessionDuration = useMemo(
    () =>
      inheritedFactValue(currentView.inheritedFacts, "session-duration") ??
      inheritedActivityDetail(currentView.inheritedFacts, "Duração"),
    [currentView.inheritedFacts],
  );
  const displayedWeeklyAvailability =
    professionalContext?.weeklyAvailability?.trim() ||
    inheritedWeeklyAvailability;
  const displayedSessionDuration =
    professionalContext?.sessionDurationMinutes !== undefined
      ? `${professionalContext.sessionDurationMinutes} min`
      : inheritedSessionDuration;
  const assistedStrategyFrequency =
    Number.isInteger(draft.strategy.weeklyFrequency) &&
    (draft.strategy.weeklyFrequency ?? 0) >= 1 &&
    (draft.strategy.weeklyFrequency ?? 0) <= 7
      ? draft.strategy.weeklyFrequency
      : undefined;
  const assistedContext = useMemo(
    () =>
      contextAvailability(professionalContext, {
        weeklyAvailability: inheritedWeeklyAvailability,
        sessionDuration: inheritedSessionDuration,
      }),
    [
      inheritedSessionDuration,
      inheritedWeeklyAvailability,
      professionalContext,
    ],
  );
  useEffect(() => {
    if (performanceSkipped) return;
    let active = true;
    void fetch("/api/performance/exercises?status=ACTIVE", {
      headers: developmentUserRequestHeaders(),
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as
          | { items?: ExerciseLibraryItemView[] }
          | null;
        if (active && response.ok && result?.items) {
          setLibrary(
            result.items.filter(
              (exercise) =>
                exercise.active &&
                exercise.category !== "RUNNING" &&
                exercise.category !== "CYCLING",
            ),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [performanceSkipped]);

  useEffect(() => {
    if (!adjustmentOpen) return;

    document.getElementById("adjust-workout-plan-reason")?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const dialog = document.getElementById("adjust-workout-plan-dialog");
        const focusable = dialog
          ? [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)")]
          : [];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      if (event.key !== "Escape" || adjusting) return;
      setAdjustmentOpen(false);
      setAdjustmentReason("");
      setAdjustmentError("");
      window.setTimeout(
        () => document.getElementById("adjust-workout-plan-trigger")?.focus(),
        0,
      );
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adjusting, adjustmentOpen]);

  useEffect(() => {
    if (!skipDialogOpen) return;

    const previousActiveElement = document.activeElement;
    skipDialogRef.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus();

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [skipDialogOpen]);

  function openSkipDialog() {
    if (!performanceCanBeSkipped || performanceSkipped || saving) return;
    setSkipReason("");
    setSkipReasonError(undefined);
    setSkipRequestError(undefined);
    setSkipDialogOpen(true);
  }

  function closeSkipDialog() {
    if (skipSubmitting || skipRequestInFlightRef.current) return;
    setSkipDialogOpen(false);
    setSkipReasonError(undefined);
    setSkipRequestError(undefined);
  }

  function handleSkipDialogKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      closeSkipDialog();
      return;
    }

    if (event.key !== "Tab") return;
    const focusableElements = skipDialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements?.length) return;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function skipPerformance() {
    if (
      !performanceCanBeSkipped ||
      performanceSkipped ||
      skipRequestInFlightRef.current ||
      saveInFlightRef.current
    ) {
      return;
    }

    const normalizedReason = skipReason.trim();
    if (!normalizedReason) {
      setSkipReasonError("Informe o motivo da não realização.");
      return;
    }
    if (normalizedReason.length > SKIP_REASON_MAX_LENGTH) {
      setSkipReasonError(
        `O motivo deve ter no máximo ${SKIP_REASON_MAX_LENGTH} caracteres.`,
      );
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = undefined;
    }
    pendingAutosaveRef.current = false;
    queuedAutosaveRef.current = false;
    skipRequestInFlightRef.current = true;
    setSkipSubmitting(true);
    setSkipReasonError(undefined);
    setSkipRequestError(undefined);

    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(currentView.patient.id)}/attendances/${encodeURIComponent(currentView.attendanceId)}/clinical-flow/${encodeURIComponent(PERFORMANCE_FLOW_STEP_ID)}/skip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: normalizedReason }),
        },
      );
      const responseMessage = await apiErrorMessage(response);

      if (!response.ok) {
        throw new Error(
          responseMessage ||
            "Não foi possível marcar Performance como não realizada.",
        );
      }

      setPerformanceMarkedSkipped(true);
      setSkipDialogOpen(false);
      setSkipReason("");
      router.refresh();
    } catch (error) {
      setSkipRequestError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível marcar Performance como não realizada.",
      );
    } finally {
      skipRequestInFlightRef.current = false;
      setSkipSubmitting(false);
    }
  }

  function updateService(
    change: Partial<WorkoutPlanDraft["service"]>,
  ) {
    setDraft((current) => ({
      ...current,
      service: { ...current.service, ...change },
    }));
  }

  function startRunningConfiguration() {
    setRunningConfigurationDraft(
      draft.endurance?.running?.configuration ??
        emptyRunningPlanConfiguration(),
    );
    setRunningConfigurationErrors(undefined);
  }

  function cancelRunningConfiguration() {
    setRunningConfigurationDraft(undefined);
    setRunningConfigurationErrors(undefined);
  }

  function confirmRunningConfiguration() {
    if (!runningConfigurationDraft) return;

    if (
      !Number.isInteger(runningConfigurationDraft.weeklyFrequency) ||
      (runningConfigurationDraft.weeklyFrequency ?? 0) < 1 ||
      (runningConfigurationDraft.weeklyFrequency ?? 0) > 7
    ) {
      setRunningConfigurationErrors({
        weeklyFrequency:
          "Informe Corridas por semana, entre 1 e 7. Os demais dados preenchidos foram preservados.",
      });
      window.setTimeout(
        () => document.getElementById("running-weekly-frequency")?.focus(),
        0,
      );
      return;
    }

    if (
      runningConfigurationDraft.primaryObjective === "Preparação para TAF" &&
      !runningConfigurationDraft.testGoal
    ) {
      setRunningConfigurationErrors({
        "testGoal.requiredDistanceMeters":
          "Informe a distância exigida pelo TAF.",
        "testGoal.targetDurationSeconds": "Informe o tempo-alvo do TAF.",
        "testGoal.testDate": "Informe a data do teste.",
      });
      window.setTimeout(
        () => document.getElementById("running-test-distance")?.focus(),
        0,
      );
      return;
    }

    const result = runningPlanConfigurationSchema.safeParse(
      runningConfigurationDraft,
    );
    if (!result.success) {
      const errors: Record<string, string | undefined> = {};
      const fieldMessages: Readonly<Record<string, string>> = {
        primaryObjective: "Informe o objetivo principal para confirmar.",
        currentLevel: "Selecione o nível atual para confirmar.",
        startDate: "Informe uma data de início válida para confirmar.",
        cycleDurationWeeks:
          "Informe a duração do ciclo em semanas, com um número inteiro maior que zero.",
        weeklyFrequency:
          "Informe Corridas por semana, entre 1 e 7, para confirmar.",
        availableWeekdays:
          "Revise os dias disponíveis marcados para confirmar.",
        environment: "Selecione o ambiente de corrida para confirmar.",
        primaryUnit: "Selecione a unidade principal para confirmar.",
        primaryIntensityMethod:
          "Selecione o método principal de intensidade para confirmar.",
        "testGoal.requiredDistanceMeters":
          "Informe a distância exigida pelo TAF, em metros.",
        "testGoal.targetDurationSeconds":
          "Informe um tempo-alvo válido para o TAF.",
        "testGoal.testDate": "Informe uma data válida para o TAF.",
      };
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (path && !errors[path]) {
          errors[path] = fieldMessages[path] ?? issue.message;
        }
      });
      setRunningConfigurationErrors(errors);
      const firstPath = result.error.issues[0]?.path.join(".");
      const fieldIds: Readonly<Record<string, string>> = {
        primaryObjective: "running-primary-objective",
        currentLevel: "running-current-level",
        startDate: "running-start-date",
        cycleDurationWeeks: "running-cycle-duration",
        weeklyFrequency: "running-weekly-frequency",
        availableWeekdays: "running-available-weekdays",
        environment: "running-environment",
        primaryUnit: "running-primary-unit",
        primaryIntensityMethod: "running-intensity-method",
        "testGoal.requiredDistanceMeters": "running-test-distance",
        "testGoal.targetDurationSeconds": "running-test-target-duration",
        "testGoal.testDate": "running-test-date",
      };
      const firstFieldId = firstPath ? fieldIds[firstPath] : undefined;
      if (firstFieldId) {
        window.setTimeout(
          () => document.getElementById(firstFieldId)?.focus(),
          0,
        );
      }
      return;
    }

    const currentDraft = latestDraftRef.current;
    const nextDraft: WorkoutPlanDraft = {
      ...currentDraft,
      endurance: {
        ...currentDraft.endurance,
        running: {
          configuration: result.data,
          weeks:
            currentDraft.endurance?.running?.weeks.length
              ? currentDraft.endurance.running.weeks
              : [initialRunningWeek(result.data.startDate)],
        },
      },
    };

    // Save draft is an imperative action and may be clicked before React has
    // committed this state update. Keep its source snapshot synchronized now.
    latestDraftRef.current = nextDraft;
    latestViewRef.current = { ...latestViewRef.current, draft: nextDraft };
    setActionError("");
    if (status === "DRAFT") setAutosaveStatus("PENDING");
    setCurrentView((current) => ({ ...current, draft: nextDraft }));
    setRunningConfigurationDraft(undefined);
    setRunningConfigurationErrors(undefined);
  }

  function updateStrategy(
    change: Partial<WorkoutPlanDraft["strategy"]>,
  ) {
    setDraft((current) => ({
      ...current,
      strategy: { ...current.strategy, ...change },
    }));
  }

  function updateSession(
    sessionId: string,
    change: Partial<WorkoutSession>,
  ) {
    setDraft((current) =>
      workoutSheetReducer(current, {
        type: "UPDATE_SESSION",
        sessionId,
        change,
      }),
    );
  }

  function updateExercise(
    sessionId: string,
    exerciseId: string,
    change: Partial<WorkoutExercise>,
  ) {
    setDraft((current) =>
      workoutSheetReducer(current, {
        type: "UPDATE_EXERCISE",
        sessionId,
        exerciseId,
        change,
      }),
    );
  }

  function addExercise(
    sessionId: string,
    libraryExerciseId: string,
  ) {
    const selectedExercise = library.find(
      (exercise) => exercise.id === libraryExerciseId,
    );
    const session = draft.sessions.find((item) => item.id === sessionId);
    if (!selectedExercise || !session) return;
    if (
      session.exercises.some(
        (exercise) => exercise.libraryExerciseId === selectedExercise.id,
      )
    ) {
      setMessage(`${selectedExercise.name} já está incluído nesta sessão.`);
      return;
    }
    setDraft((current) => {
      const currentSession = current.sessions.find(
        (item) => item.id === sessionId,
      );
      if (
        !currentSession ||
        currentSession.exercises.some(
          (exercise) => exercise.libraryExerciseId === selectedExercise.id,
        )
      ) {
        return current;
      }
      return workoutSheetReducer(current, {
        type: "ADD_EXERCISE",
        sessionId,
        exercise: emptyExercise(
          selectedExercise.name,
          selectedExercise.id,
          selectedExercise.sourceKind,
        ),
      });
    });
    setExerciseSelections((current) => ({
      ...current,
      [sessionId]: { query: "" },
    }));
  }

  function moveExercise(
    sessionId: string,
    exerciseId: string,
    direction: -1 | 1,
  ) {
    setDraft((current) =>
      workoutSheetReducer(current, {
        type: "MOVE_EXERCISE",
        sessionId,
        exerciseId,
        direction,
      }),
    );
  }

  function selectSessionFromKeyboard(
    event: ReactKeyboardEvent<HTMLAnchorElement>,
    sessionIndex: number,
  ) {
    const lastIndex = draft.sessions.length - 1;
    const targetIndex =
      event.key === "ArrowRight"
        ? (sessionIndex + 1) % draft.sessions.length
        : event.key === "ArrowLeft"
          ? (sessionIndex - 1 + draft.sessions.length) % draft.sessions.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : undefined;
    if (targetIndex === undefined) return;

    event.preventDefault();
    const target = draft.sessions[targetIndex];
    setActiveSessionId(target.id);
    window.setTimeout(
      () => document.getElementById(`workout-session-tab-${target.id}`)?.focus(),
      0,
    );
  }

  function createWorkoutSession() {
    const name = requestedNewSessionName?.trim();
    if (
      finalized ||
      !name ||
      sessionNameAlreadyExists ||
      draft.sessions.length >= MAX_WORKOUT_SESSIONS
    ) {
      return;
    }

    const session = emptySession(name);
    setDraft((current) =>
      workoutSheetReducer(current, {
        type: "ADD_SESSION",
        session,
      }),
    );
    setActiveSessionId(session.id);
    setCustomSessionName("");
    setMessage(`${name} criado e selecionado.`);
  }

  function removeWorkoutSession(sessionId: string) {
    if (finalized) return;

    const removedIndex = draft.sessions.findIndex(
      (session) => session.id === sessionId,
    );
    if (removedIndex < 0) return;
    const remainingSessions = draft.sessions.filter(
      (session) => session.id !== sessionId,
    );
    const nextSession =
      remainingSessions[Math.min(removedIndex, remainingSessions.length - 1)];
    setDraft((current) =>
      workoutSheetReducer(current, {
        type: "REMOVE_SESSION",
        sessionId,
      }),
    );
    setExerciseSelections((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setActiveSessionId(nextSession?.id);
  }

  function generateAssistedProposal() {
    if (!professionalContext) return;
    setAssistedPrintPreviewOpen(false);
    setAssistedReplacementConfirmed(false);
    setAssistedProposal(
      proposeAssistedWorkoutStructure({
        context: {
          ...professionalContext,
          painAndLimitations: assistedContext.careItems,
          relevantInjuries: [],
          relevantContraindications: [],
          relevantPosturalFindings: [],
        },
        contractedService: draft.service.contractedService,
        primaryModality: draft.service.primaryModality,
        objective:
          draft.service.trainingObjective || professionalContext.objective,
        trainingExperience: assistedExperience,
        weeklyFrequency: draft.strategy.weeklyFrequency,
        sessionDuration: assistedDuration || displayedSessionDuration,
        availableEquipment: assistedEquipment
          .split(/[,;\n]/u)
          .map((item) => item.trim())
          .filter(Boolean),
        exerciseLibrary: library,
        existingSessionNames: draft.sessions.map((session) => session.name),
        applicationMode: assistedApplicationMode,
      }),
    );
  }

  function updateAssistedSession(
    sessionId: string,
    change: Partial<Omit<WorkoutSession, "exercises">>,
  ) {
    setAssistedProposal((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId ? { ...session, ...change } : session,
            ),
          }
        : current,
    );
  }

  function updateAssistedExercise(
    sessionId: string,
    exerciseId: string,
    change: Partial<AssistedWorkoutExercise>,
  ) {
    setAssistedProposal((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    exercises: session.exercises.map((exercise) =>
                      exercise.id === exerciseId
                        ? { ...exercise, ...change }
                        : exercise,
                    ),
                  }
                : session,
            ),
          }
        : current,
    );
  }

  function cancelAssistedProposal() {
    setAssistedPrintPreviewOpen(false);
    setAssistedProposal(undefined);
    setAssistedReplacementConfirmed(false);
  }

  function applyAssistedProposal() {
    if (!assistedProposal?.sessions.length) return;
    if (
      assistedProposal.applicationMode === "REPLACE" &&
      assistedProposal.existingSessionCount > 0 &&
      !assistedReplacementConfirmed
    ) {
      return;
    }
    const firstAppliedSessionId = assistedProposal.sessions[0]?.id;
    setDraft((current) =>
      applyAssistedWorkoutProposal(current, assistedProposal),
    );
    if (assistedProposal.applicationMode === "REPLACE") {
      setExerciseSelections({});
    }
    setAssistedPrintPreviewOpen(false);
    setAssistedProposal(undefined);
    setAssistedReplacementConfirmed(false);
    setActiveSessionId(firstAppliedSessionId);
    setActiveWorkspaceTab("WORKOUTS");
    setMessage(
      assistedProposal.applicationMode === "REPLACE"
        ? "Nova ficha aplicada ao rascunho. As sessões anteriores foram substituídas; revise antes de finalizar."
        : "Sugestão adicionada ao rascunho. As sessões anteriores foram preservadas; revise antes de finalizar.",
    );
  }

  function openCustomMethodForm() {
    const existingEmptyMethod = draft.customMethods.find(
      (method) => !customMethodHasContent(method),
    );
    if (existingEmptyMethod) {
      setOpenCustomMethodId(existingEmptyMethod.id);
      return;
    }

    const method = emptyCustomMethod();
    setDraft((current) => ({
      ...current,
      customMethods: [...current.customMethods, method],
    }));
    setOpenCustomMethodId(method.id);
  }

  async function save(
    action: "SAVE_DRAFT" | "FINALIZE",
    automatic = false,
    draftOverride?: WorkoutPlanDraft,
  ): Promise<boolean> {
    if (performanceSkipped || skipRequestInFlightRef.current) return false;
    if (saveInFlightRef.current) {
      if (action === "SAVE_DRAFT") {
        pendingAutosaveRef.current = true;
        queuedAutosaveRef.current = true;
        if (automatic) setAutosaveStatus("PENDING");
      }
      return false;
    }

    const submittedView = latestViewRef.current;
    const submittedDraft = draftOverride ?? latestDraftRef.current;
    const submittedSignature = JSON.stringify(submittedDraft);
    if (
      automatic &&
      (submittedView.status !== "DRAFT" ||
        submittedSignature === lastSavedDraftRef.current)
    ) {
      pendingAutosaveRef.current = false;
      return false;
    }
    if (!parseWorkoutPlanDraft(submittedDraft)) {
      const errorMessage =
        "O rascunho contém um campo incompatível e não foi enviado. Revise a configuração de Corrida; suas alterações continuam nesta tela.";
      pendingAutosaveRef.current = true;
      if (automatic) {
        setAutosaveError(errorMessage);
        setAutosaveStatus("ERROR");
      } else {
        setMessage(errorMessage);
        setActionError(errorMessage);
      }
      return false;
    }
    setActionError("");
    setAutosaveError("");
    if (action === "FINALIZE") {
      const issues = validateWorkoutPlanFinalization(submittedDraft, library);
      if (issues.length) {
        const sessionIndexMatch = issues[0].path.match(/^sessions\.(\d+)/);
        const invalidSession = sessionIndexMatch
          ? submittedDraft.sessions[Number(sessionIndexMatch[1])]
          : undefined;
        const sessionLabel = invalidSession?.name.trim();
        const errorMessage =
          sessionLabel &&
          !normalizedComparisonValue(issues[0].message).startsWith(
            normalizedComparisonValue(sessionLabel),
          )
            ? `${sessionLabel}: ${issues[0].message}`
            : issues[0].message;
        if (invalidSession) setActiveSessionId(invalidSession.id);
        setMessage(errorMessage);
        setActionError(errorMessage);
        return false;
      }
    }
    if (
      action === "FINALIZE" &&
      !window.confirm(
        "Finalizar este Plano de Treino? Depois disso ele ficará protegido contra alterações acidentais.",
      )
    ) {
      return false;
    }
    saveInFlightRef.current = true;
    setSavingAction(action);
    if (automatic) {
      setAutosaveStatus("SAVING");
    } else {
      setAutosaveStatus("IDLE");
      setMessage(
        action === "FINALIZE"
          ? "Finalizando Plano de Treino..."
          : "Salvando rascunho...",
      );
    }
    try {
      const response = await fetch(
        `/api/patients/${submittedView.patient.id}/attendances/${submittedView.attendanceId}/workout-plan`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...developmentUserRequestHeaders(),
          },
          body: JSON.stringify({
            action,
            draft: submittedDraft,
            expectedRevision: submittedView.version,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { record?: PerformanceWorkoutView; message?: string }
        | null;
      if (!response.ok || !result?.record) {
        const errorMessage =
          response.status === 409
            ? "Este plano foi alterado em outra sessão. Atualize a página antes de continuar."
            : result?.message ??
              "Não foi possível salvar o Plano de Treino.";
        if (automatic) {
          pendingAutosaveRef.current = true;
          setAutosaveError(
            `${errorMessage} As alterações continuam nesta tela.`,
          );
          setAutosaveStatus("ERROR");
        } else {
          setMessage(errorMessage);
          setActionError(errorMessage);
        }
        return false;
      }
      const newestDraft = latestDraftRef.current;
      const hasNewerDraft =
        draftOverride === undefined &&
        action === "SAVE_DRAFT" &&
        JSON.stringify(newestDraft) !== submittedSignature;
      lastSavedDraftRef.current = submittedSignature;
      pendingAutosaveRef.current = hasNewerDraft;
      if (draftOverride !== undefined) queuedAutosaveRef.current = false;
      if (action === "FINALIZE" || !hasNewerDraft) {
        removeLocalWorkoutDraft(localDraftStorageKey);
        setLocalRecoveryDraft(undefined);
      }
      applyServerView(
        hasNewerDraft ? { ...result.record, draft: newestDraft } : result.record,
      );
      if (automatic) {
        setAutosaveStatus(hasNewerDraft ? "PENDING" : "SAVED");
      } else {
        setAutosaveStatus("IDLE");
        setMessage(
          action === "FINALIZE"
            ? "Plano de Treino finalizado pelo profissional."
            : "Rascunho salvo no Prontuário Mestre.",
        );
      }
      return true;
    } catch {
      const errorMessage =
        action === "FINALIZE"
          ? "Não foi possível finalizar o Plano de Treino."
          : "Não foi possível salvar o Plano de Treino.";
      if (automatic) {
        pendingAutosaveRef.current = true;
        setAutosaveError(
          `${errorMessage} As alterações continuam nesta tela.`,
        );
        setAutosaveStatus("ERROR");
      } else {
        setMessage(errorMessage);
        setActionError(errorMessage);
      }
      return false;
    } finally {
      saveInFlightRef.current = false;
      setSavingAction(undefined);
      if (
        queuedAutosaveRef.current &&
        latestViewRef.current.status === "DRAFT"
      ) {
        queuedAutosaveRef.current = false;
        window.setTimeout(() => {
          void saveRef.current("SAVE_DRAFT", true);
        }, 0);
      }
    }
  }

  function openPlanningTransitionConfirmation() {
    setTransitionEffectiveDate("");
    setTransitionError("");
    setTransitionConfirmationOpen(true);
  }

  function cancelPlanningTransitionConfirmation() {
    setTransitionConfirmationOpen(false);
    setTransitionEffectiveDate("");
    setTransitionError("");
  }

  async function confirmPlanningTransition() {
    if (!transitionEffectiveDate) {
      setTransitionError("Informe a data efetiva da mudança.");
      return;
    }

    const currentDraft = latestDraftRef.current;
    const transitionedDraft = confirmWorkoutPlanningTransition(currentDraft, {
      effectiveDate: transitionEffectiveDate,
      recordedAt: new Date().toISOString(),
    });
    if (transitionedDraft === currentDraft) {
      setTransitionError("Não há mudança planejada diferente para confirmar.");
      return;
    }

    const saved = await save("SAVE_DRAFT", false, transitionedDraft);
    if (!saved) return;

    setTransitionConfirmationOpen(false);
    setTransitionEffectiveDate("");
    setTransitionError("");
    setMessage("Mudança de fase e foco confirmada no planejamento.");
  }

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const signature = JSON.stringify(draft);
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      lastSavedDraftRef.current = signature;
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = undefined;
    }
    if (finalized || performanceSkipped) {
      pendingAutosaveRef.current = false;
      queuedAutosaveRef.current = false;
      return;
    }
    if (signature === lastSavedDraftRef.current) {
      pendingAutosaveRef.current = false;
      return;
    }

    pendingAutosaveRef.current = true;
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = undefined;
      void saveRef.current("SAVE_DRAFT", true);
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = undefined;
      }
    };
  }, [draft, finalized, performanceSkipped]);

  function recoverLocalDraft() {
    if (!localRecoveryDraft || finalized) return;
    setLocalRecoveryDraft(undefined);
    setDraft(localRecoveryDraft);
  }

  function discardLocalDraft() {
    removeLocalWorkoutDraft(localDraftStorageKey);
    setLocalRecoveryDraft(undefined);
  }

  function openAdjustmentDialog() {
    setAdjustmentReason("");
    setAdjustmentError("");
    setAdjustmentOpen(true);
  }

  function closeAdjustmentDialog() {
    if (adjusting) return;
    setAdjustmentOpen(false);
    setAdjustmentReason("");
    setAdjustmentError("");
    window.setTimeout(
      () => document.getElementById("adjust-workout-plan-trigger")?.focus(),
      0,
    );
  }

  async function adjustPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adjusting || performanceSkipped) return;

    const reason = adjustmentReason.trim();
    if (!reason) {
      setAdjustmentError("Informe o motivo do ajuste.");
      document.getElementById("adjust-workout-plan-reason")?.focus();
      return;
    }

    setAdjusting(true);
    setAdjustmentError("");
    try {
      const response = await fetch(
        `/api/patients/${currentView.patient.id}/attendances/${currentView.attendanceId}/workout-plan`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...developmentUserRequestHeaders(),
          },
          body: JSON.stringify({
            action: "ADJUST_PLAN",
            reason,
            expectedRevision: version,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { record?: PerformanceWorkoutView }
        | null;

      if (!response.ok || !result?.record) {
        setAdjustmentError(
          response.status === 409
            ? "Este plano foi alterado em outra sessão. Atualize a página antes de continuar."
            : response.status === 400
              ? "Informe o motivo do ajuste."
              : "Não foi possível abrir o plano para ajustes.",
        );
        return;
      }

      applyServerView(result.record);
      setAdjustmentOpen(false);
      setAdjustmentReason("");
      setActionError("");
      setMessage(
        "Plano aberto para ajustes. A última entrega oficial foi preservada.",
      );
    } catch {
      setAdjustmentError("Não foi possível abrir o plano para ajustes.");
    } finally {
      setAdjusting(false);
    }
  }

  const inheritedFactsByKey = new Map(
    currentView.inheritedFacts.map((fact) => [fact.key, fact]),
  );
  const persistedFact = (key: string) => {
    const fact = inheritedFactsByKey.get(key);
    return fact && fact.value !== NOT_INFORMED ? fact : undefined;
  };
  const objectiveFact = persistedFact("primary-objective");
  const modalityFact = persistedFact("sport-modality");
  const availabilityParts = [
    displayedWeeklyAvailability
      ? `Frequência: ${displayedWeeklyAvailability}`
      : undefined,
    displayedSessionDuration
      ? `Duração: ${displayedSessionDuration}`
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const summaryCareFacts = [
    ["injuries-surgeries", "Lesões e cirurgias"],
    ["pain", "Dores"],
    ["functional-limitations", "Limitações funcionais"],
    ["contraindications", "Contraindicações e restrições"],
    ["mobility-stability", "Mobilidade e estabilidade"],
    ["strengthening-stretching", "Fortalecimento e alongamento"],
    ["postural-changes", "Cuidados posturais"],
  ] as const;
  const careItems = summaryCareFacts.flatMap(([key, label]) => {
    const fact = persistedFact(key);
    return fact ? [{ label, value: fact.value, source: fact.source }] : [];
  });
  const careSources = [...new Set(careItems.map((item) => item.source))];

  const anthropometryFact = persistedFact("weight-height");
  const anthropometryMetrics = parsedAnthropometry(anthropometryFact?.value);
  const bodyCompositionFact = persistedFact("body-composition");
  const bodyCompositionMetrics = parsedMeasurements(bodyCompositionFact?.value);
  const bodyCompositionByLabel = new Map(
    bodyCompositionMetrics.map((metric) => [metric.label, metric]),
  );
  const anthropometryWeight = anthropometryMetrics.find(
    (metric) => metric.label === "Peso",
  );
  const essentialBodyComposition = [
    bodyCompositionByLabel.get("Peso") ?? anthropometryWeight,
    bodyCompositionByLabel.get("IMC"),
    bodyCompositionByLabel.get("Gordura corporal")
      ? {
          label: "Percentual de gordura",
          value: bodyCompositionByLabel.get("Gordura corporal")!.value,
        }
      : undefined,
    bodyCompositionByLabel.get("Massa de gordura"),
    bodyCompositionByLabel.get("Massa livre de gordura"),
    bodyCompositionByLabel.get("Massa muscular esquelética"),
    bodyCompositionByLabel.get("Gordura visceral"),
    bodyCompositionByLabel.get("Água corporal total"),
  ].filter((metric): metric is DisplayMetric => Boolean(metric));
  const compositionDetailDefinitions = [
    {
      title: "Hidratação",
      labels: ["Água intracelular", "Água extracelular"],
    },
    {
      title: "Proteínas e minerais",
      labels: ["Proteína", "Minerais"],
    },
    {
      title: "Composição segmentar dos braços",
      labels: [
        "Massa magra — braço direito",
        "Massa magra — braço esquerdo",
        "Gordura — braço direito",
        "Gordura — braço esquerdo",
      ],
    },
    {
      title: "Composição segmentar do tronco",
      labels: ["Massa magra — tronco", "Gordura — tronco"],
    },
    {
      title: "Composição segmentar das pernas",
      labels: [
        "Massa magra — perna direita",
        "Massa magra — perna esquerda",
        "Gordura — perna direita",
        "Gordura — perna esquerda",
      ],
    },
  ].map((group) => ({
    ...group,
    metrics: group.labels.flatMap((label) => {
      const metric = bodyCompositionByLabel.get(label);
      return metric ? [metric] : [];
    }),
  }));
  const groupedCompositionLabels = new Set([
    ...essentialBodyComposition.map((metric) =>
      metric.label === "Percentual de gordura"
        ? "Gordura corporal"
        : metric.label,
    ),
    ...compositionDetailDefinitions.flatMap((group) => group.labels),
  ]);
  const otherCompositionMetrics = bodyCompositionMetrics.filter(
    (metric) => !groupedCompositionLabels.has(metric.label),
  );
  const hasCompositionDetails =
    compositionDetailDefinitions.some((group) => group.metrics.length) ||
    otherCompositionMetrics.length > 0;

  const perimetryFact = persistedFact("perimetry");
  const perimetryMetrics = parsedMeasurements(perimetryFact?.value);
  const perimetryByLabel = new Map(
    perimetryMetrics.map((metric) => [metric.label, metric]),
  );
  const perimetryGroups = [
    {
      title: "Tronco",
      labels: ["Pescoço", "Ombros", "Tórax", "Cintura", "Abdômen", "Quadril"],
    },
    {
      title: "Membros superiores",
      labels: [
        "Braço direito",
        "Braço esquerdo",
        "Antebraço direito",
        "Antebraço esquerdo",
      ],
    },
    {
      title: "Membros inferiores",
      labels: [
        "Coxa direita",
        "Coxa esquerda",
        "Panturrilha direita",
        "Panturrilha esquerda",
      ],
    },
  ].map((group) => ({
    ...group,
    metrics: group.labels.flatMap((label) => {
      const metric = perimetryByLabel.get(label);
      return metric ? [metric] : [];
    }),
  }));

  function renderPlanActions(position: "top" | "bottom") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
        <p
          aria-live={position === "bottom" ? "polite" : undefined}
          className={
            actionError
              ? "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800"
              : "text-xs font-bold text-[var(--text-secondary)]"
          }
          role={actionError ? "alert" : "status"}
        >
          {actionError ||
            (savingAction === "FINALIZE"
              ? message
              : !finalized && autosaveMessage
                ? autosaveMessage
                : message ||
                  (finalized
                    ? "Plano de Treino finalizado pelo profissional."
                    : "O rascunho pode ser salvo incompleto e continuado depois."))}
        </p>
        <div className="flex flex-wrap gap-2">
          {finalized ? (
            <>
              <Link className={buttonStyles({ size: "small", variant: "outline" })} href={officialDocumentHref}>Visualizar</Link>
              <Link className={buttonStyles({ size: "small" })} href={officialPrintHref}>Imprimir</Link>
              <Link className={buttonStyles({ size: "small", variant: "outline" })} href={officialPdfHref}>Salvar em PDF</Link>
              <Button
                disabled={adjusting}
                id={
                  position === "top"
                    ? "adjust-workout-plan-trigger"
                    : undefined
                }
                onClick={openAdjustmentDialog}
                type="button"
              >
                Ajustar plano
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={saving}
                onClick={() => setDeliverablePreview("GENERAL")}
                type="button"
                variant="outline"
              >
                Prévia geral do plano
              </Button>
              <Button
                disabled={saving}
                loading={savingAction === "SAVE_DRAFT"}
                onClick={() => void save("SAVE_DRAFT")}
                type="button"
                variant="secondary"
              >
                {savingAction === "SAVE_DRAFT"
                  ? "Salvando..."
                  : "Salvar rascunho"}
              </Button>
              <Button
                disabled={saving}
                loading={savingAction === "FINALIZE"}
                onClick={() => void save("FINALIZE")}
                type="button"
              >
                {savingAction === "FINALIZE"
                  ? "Finalizando..."
                  : "Finalizar Plano de Treino"}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (assistedPrintPreviewOpen && assistedProposal?.sessions.length) {
    const previewView: PerformanceWorkoutView = {
      ...currentView,
      status: "DRAFT",
      draft: applyAssistedWorkoutProposal(currentView.draft, assistedProposal),
      updatedAt: undefined,
    };

    return (
      <div className="mx-auto w-full max-w-[76rem] space-y-4 bg-white pb-8">
        <nav
          aria-label="Ações da prévia da sugestão assistida"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3 print:hidden"
        >
          <Button
            onClick={() => setAssistedPrintPreviewOpen(false)}
            type="button"
            variant="secondary"
          >
            Voltar à sugestão
          </Button>
          <Button onClick={() => window.print()} type="button">
            Imprimir / Salvar em PDF
          </Button>
        </nav>
        <PerformanceDeliverablePreview
          documentStatus="Prévia — não finalizado"
          hidePrintActions
          professional={{
            userId: currentView.responsibleProfessionalId,
            fullName: currentView.responsibleProfessional,
            registrations: [],
          }}
          view={previewView}
        />
      </div>
    );
  }

  if (deliverablePreview === "GENERAL") {
    return (
      <div className="mx-auto w-full max-w-[76rem] space-y-4 bg-white pb-8">
        <nav
          aria-label="Ações da prévia do rascunho"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3 print:hidden"
        >
          <Button onClick={() => setDeliverablePreview(undefined)} type="button" variant="secondary">
            Voltar ao editor
          </Button>
          <Button onClick={() => window.print()} type="button">
            Imprimir / Salvar em PDF
          </Button>
        </nav>
        <PerformanceDeliverablePreview
          documentStatus="Prévia — rascunho não finalizado"
          hidePrintActions
          professional={{
            userId: currentView.responsibleProfessionalId,
            fullName: currentView.responsibleProfessional,
            registrations: [],
          }}
          view={{ ...currentView, status: "DRAFT", updatedAt: undefined }}
        />
      </div>
    );
  }

  const runningPreviewSelection = draft.endurance?.running
    ? deliverablePreview === "RUNNING_PROPOSAL"
      ? runningProposal
        ? selectRunningPreview(draft.endurance.running, runningProposal)
        : undefined
      : deliverablePreview === "RUNNING_DRAFT"
        ? selectRunningPreview(draft.endurance.running)
        : undefined
    : undefined;

  if (
    (deliverablePreview === "RUNNING_DRAFT" || deliverablePreview === "RUNNING_PROPOSAL") &&
    runningPreviewSelection &&
    runningPreviewSelection.source !== "EMPTY"
  ) {
    const previewRunning = runningPreviewSelection.running;
    const isProposalPreview = runningPreviewSelection.source === "PROPOSAL";
    const previewView: PerformanceWorkoutView = {
      ...currentView,
      status: "DRAFT",
      updatedAt: undefined,
      draft: {
        ...draft,
        endurance: { ...draft.endurance, running: previewRunning },
      },
    };
    return (
      <RunningPrintPreviewPortal source={isProposalPreview ? "PROPOSAL" : "DRAFT"}>
        <nav
          aria-label={`Ações da prévia ${isProposalPreview ? "da proposta" : "do rascunho"} de corrida`}
          className="running-print-controls flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3 print:hidden"
        >
          <Button onClick={() => setDeliverablePreview(undefined)} type="button" variant="secondary">
            {isProposalPreview ? "Voltar à proposta" : "Voltar ao editor"}
          </Button>
          <Button onClick={() => window.print()} type="button">Imprimir / Salvar em PDF</Button>
        </nav>
        <PerformanceDeliverablePreview
          contentScope="RUNNING"
          documentStatus={isProposalPreview
            ? runningProposal?.scope === "PERIOD"
              ? "Proposta do período — não aplicada"
              : "Proposta da semana — não aplicada"
            : "Prévia da Corrida — rascunho não finalizado"}
          hidePrintActions
          professional={{
            userId: currentView.responsibleProfessionalId,
            fullName: currentView.responsibleProfessional,
            registrations: [],
          }}
          view={previewView}
        />
      </RunningPrintPreviewPortal>
    );
  }

  if (performanceSkipped) {
    return (
      <div className="space-y-6 pb-8">
        <Card
          className="overflow-hidden border-amber-300 bg-amber-50"
          variant="elevated"
        >
          <nav
            aria-label="Navegação da Performance"
            className="border-b border-amber-200 bg-white p-4 md:px-7"
          >
            <Button
              onClick={() => router.push(patientRecordHref)}
              size="small"
              type="button"
              variant="outline"
            >
              ← Voltar ao prontuário
            </Button>
          </nav>
          <div className="p-5 md:p-7" role="status">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
              Atendimento selecionado
            </p>
            <h1 className="mt-2 text-2xl font-black text-amber-950">
              Performance — Não realizada
            </h1>
            <p className="mt-2 text-sm text-amber-900">
              A etapa de Performance foi registrada como não realizada neste
              atendimento. Nenhum plano de treino vazio foi criado.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Card className="overflow-hidden" variant="elevated">
        <nav
          aria-label="Navegação do Plano de Treino"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)] p-4 md:px-7"
        >
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => router.push(patientRecordHref)}
            size="small"
            type="button"
            variant="outline"
          >
            ← Voltar ao prontuário
          </Button>
          <Link
            className={`${buttonStyles({ variant: "secondary", size: "small" })} flex-1 sm:flex-none`}
            href={officialDeliverableHref}
          >
            Ver entrega oficial
          </Link>
        </nav>
        <div className="bg-[var(--primary)] px-5 py-6 text-white md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
                Performance · Prescrição de treino
              </p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">
                {currentView.patient.name}
              </h1>
              <p className="mt-1 text-sm text-emerald-50">
                {currentView.patient.code} · Atendimento vinculado ao
                Prontuário Mestre
              </p>
            </div>
            <Badge tone={finalized ? "success" : "warning"}>
              {finalized ? "Finalizado" : "Rascunho"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-[var(--muted)]">
          <span>
            Responsável: {responsibleProfessional} · versão{" "}
            {version}
          </span>
          <span>
            {updatedAt
              ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(updatedAt))}`
              : "Ainda não salvo"}
          </span>
        </div>
      </Card>

      {performanceCanBeSkipped ? (
        <section
          aria-labelledby="skip-performance-action-title"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p
              className="text-sm font-black text-amber-950"
              id="skip-performance-action-title"
            >
              Performance não realizada neste atendimento?
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Registre o motivo sem criar ou finalizar um plano de treino vazio.
            </p>
          </div>
          <Button
            className="shrink-0 border-amber-400 text-amber-950 hover:bg-amber-100"
            disabled={saving || skipSubmitting}
            onClick={openSkipDialog}
            type="button"
            variant="outline"
          >
            Marcar Performance como não realizada
          </Button>
        </section>
      ) : null}

      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 rounded-2xl border border-[var(--line)] bg-white/95 p-2 shadow-sm backdrop-blur print:hidden">
        <div
          aria-label="Áreas do Plano de Treino"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
          role="tablist"
        >
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeWorkspaceTab === tab.id;

            return (
              <button
                aria-controls={`workspace-panel-${tab.id.toLowerCase()}`}
                aria-selected={active}
                className={`flex min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-xl px-3 py-3 text-center text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
                  active
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-[var(--primary)]"
                }`}
                id={`workspace-tab-${tab.id.toLowerCase()}`}
                key={tab.id}
                onClick={() => setActiveWorkspaceTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--muted)]">
          {
            workspaceTabs.find((tab) => tab.id === activeWorkspaceTab)
              ?.description
          }
        </p>
      </div>

      {localRecoveryDraft && !finalized ? (
        <Card className="border-amber-300 bg-amber-50 p-5" variant="elevated">
          <div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <div>
              <p className="font-black text-amber-950">
                Encontramos alterações não salvas deste plano.
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Escolha se deseja recuperar o formulário local ou descartar a
                cópia deste atendimento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={discardLocalDraft} type="button" variant="outline">
                Descartar cópia
              </Button>
              <Button onClick={recoverLocalDraft} type="button">
                Recuperar alterações
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div
        aria-labelledby="workspace-tab-summary"
        className="scroll-mt-44 space-y-6"
        hidden={activeWorkspaceTab !== "SUMMARY"}
        id="workspace-panel-summary"
        role="tabpanel"
      >
      <Card className="border-l-4 border-l-blue-400 bg-white p-5 md:p-6">
        <SectionHeader
          description="Informações reais do Prontuário Mestre reunidas sem duplicação para apoiar a decisão profissional."
          title="Resumo para prescrição"
        />
        <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Objetivo do paciente",
              value: professionalContext?.objective?.trim() || objectiveFact?.value,
              origin: objectiveFact?.source ?? "Prontuário Mestre",
            },
            {
              label: "Experiência de treinamento",
              value: professionalContext?.trainingExperience?.trim(),
              origin: "Prontuário Mestre",
            },
            {
              label: "Disponibilidade semanal",
              value: availabilityParts.join(" · ") || undefined,
              origin: "Anamnese",
            },
            {
              label: "Modalidades praticadas",
              value:
                professionalContext?.practicedModalities?.join(" · ") ||
                modalityFact?.value,
              origin: modalityFact?.source ?? "Anamnese",
            },
          ].map((item) => (
            <div
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
              key={item.label}
            >
              <dt className="text-xs font-black text-[var(--muted)]">
                {item.label}
              </dt>
              <dd className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {item.value
                  ? formatPersistedText(item.value)
                  : "Sem registro persistido"}
              </dd>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
                Origem: {item.origin}
              </p>
            </div>
          ))}
        </dl>

        <section className="mt-4 rounded-xl border border-[var(--line)] p-4" aria-labelledby="prescription-care-title">
          <h3 className="text-sm font-black" id="prescription-care-title">
            Lesões, cirurgias, dores, limitações e cuidados relevantes
          </h3>
          {careItems.length ? (
            <dl className="mt-3 grid gap-3 md:grid-cols-2">
              {careItems.map((item) => (
                <div className="rounded-lg bg-[var(--surface-elevated)] p-3" key={item.label}>
                  <dt className="text-xs font-black text-[var(--muted)]">{item.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold">
                    {formatPersistedText(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Nenhum cuidado específico persistido no prontuário.
            </p>
          )}
          <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
            Origem: {careSources.length ? careSources.join(" · ") : "Prontuário Mestre"}
          </p>
        </section>

      </Card>

      <Card className="border-l-4 border-l-emerald-400 bg-white p-5 md:p-6">
        <SectionHeader
          description="Registros corporais reais organizados por origem, sem cálculo ou interpretação adicional."
          title="Avaliações corporais disponíveis"
        />

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-blue-100 bg-blue-50/30 p-4" aria-labelledby="anthropometry-title">
            <h3 className="text-sm font-black" id="anthropometry-title">
              Antropometria
            </h3>
            {anthropometryMetrics.length ? (
              <div className="mt-3">
                <MetricGrid metrics={anthropometryMetrics} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Nenhuma avaliação antropométrica persistida.
              </p>
            )}
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
              Origem: {anthropometryFact?.source ?? "Antropometria"}
            </p>
          </section>

          <section className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-4 xl:col-span-2" aria-labelledby="body-composition-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black" id="body-composition-title">
                Composição corporal
              </h3>
              {hasCompositionDetails ? (
                <button
                  aria-expanded={bodyCompositionExpanded}
                  className="rounded-lg px-2 py-1 text-xs font-black text-[var(--primary)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  onClick={() => setBodyCompositionExpanded((value) => !value)}
                  type="button"
                >
                  {bodyCompositionExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
              ) : null}
            </div>
            {essentialBodyComposition.length ? (
              <div className="mt-3">
                <MetricGrid metrics={essentialBodyComposition} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Nenhuma composição corporal persistida.
              </p>
            )}
            {bodyCompositionExpanded ? (
              <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
                {compositionDetailDefinitions.map((group) =>
                  group.metrics.length ? (
                    <section key={group.title}>
                      <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        {group.title}
                      </h4>
                      <MetricGrid metrics={group.metrics} />
                    </section>
                  ) : null,
                )}
                {otherCompositionMetrics.length ? (
                  <section>
                    <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                      Outros indicadores persistidos
                    </h4>
                    <MetricGrid metrics={otherCompositionMetrics} />
                  </section>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
              Origem: {bodyCompositionFact?.source ?? "Bioimpedância"}
              {!bodyCompositionByLabel.has("Peso") && anthropometryWeight
                ? " · Antropometria"
                : ""}
            </p>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 xl:col-span-3" aria-labelledby="perimetry-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black" id="perimetry-title">
                  Perimetria
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {perimetryMetrics.length
                    ? "Avaliação de perimetria disponível."
                    : "Nenhuma avaliação de perimetria persistida."}
                </p>
              </div>
              {perimetryMetrics.length ? (
                <button
                  aria-expanded={perimetryExpanded}
                  className="rounded-lg px-2 py-1 text-xs font-black text-[var(--primary)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  onClick={() => setPerimetryExpanded((value) => !value)}
                  type="button"
                >
                  {perimetryExpanded ? "Ocultar medidas" : "Ver medidas"}
                </button>
              ) : null}
            </div>
            {perimetryExpanded ? (
              <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 xl:grid-cols-3">
                {perimetryGroups.map((group) =>
                  group.metrics.length ? (
                    <section key={group.title}>
                      <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        {group.title}
                      </h4>
                      <MetricGrid metrics={group.metrics} />
                    </section>
                  ) : null,
                )}
              </div>
            ) : null}
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
              Origem: {perimetryFact?.source ?? "Perimetria"}
            </p>
          </section>

          {professionalContext?.physicalAssessments?.length ? (
            <section className="rounded-xl border border-[var(--line)] p-4 xl:col-span-3" aria-labelledby="physical-assessments-title">
              <h3 className="text-sm font-black" id="physical-assessments-title">
                Avaliações físicas estruturadas
              </h3>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {professionalContext.physicalAssessments.map((assessment) => (
                  <li className="rounded-lg bg-[var(--surface-elevated)] p-3 text-sm" key={assessment.assessmentId}>
                    <p className="font-black">
                      {formatPersistedText(assessment.assessmentName)}
                    </p>
                    <p className="mt-1 text-[var(--muted)]">
                      {formatClinicalDate(assessment.performedAt)}
                      {` · ${formatPersistedText(assessment.evaluatedCapacity)}`}
                    </p>
                    <p className="mt-2">
                      {formatPersistedText(assessment.resultSummary)}
                    </p>
                    {assessment.professionalInterpretation ? (
                      <p className="mt-2 text-[var(--muted)]">
                        Interpretação:{" "}
                        {formatPersistedText(
                          assessment.professionalInterpretation,
                        )}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
                Origem: Prontuário Mestre
              </p>
            </section>
          ) : null}
        </div>
      </Card>

      <Card className="border-l-4 border-l-slate-300 bg-white p-5 md:p-6">
        <SectionHeader
          description="Referências históricas preservadas somente para consulta profissional."
          title="Histórico do planejamento"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="base-protocol-title">
            <h3 className="text-sm font-black" id="base-protocol-title">
              Protocolo-base anterior
            </h3>
            {professionalContext?.activeProtocol ? (
              <div className="mt-3 text-sm">
                <p className="font-black">
                  {formatPersistedText(
                    professionalContext.activeProtocol.protocolName,
                  )}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  Biblioteca científica
                  {professionalContext.activeProtocol.version
                    ? ` · versão ${professionalContext.activeProtocol.version}`
                    : ""}
                </p>
                {professionalContext.activeProtocol.professionalNotes ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    {formatPersistedText(
                      professionalContext.activeProtocol.professionalNotes,
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">{NOT_INFORMED}</p>
            )}
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
              Origem: Plano de Treino anterior
            </p>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="previous-plan-title">
            <h3 className="text-sm font-black" id="previous-plan-title">
              Plano anterior e divisão semanal anterior
            </h3>
            {professionalContext?.previousWorkoutPlan ? (
              <div className="mt-3 text-sm">
                <p className="font-black">
                  {formatPersistedText(
                    informed(professionalContext.previousWorkoutPlan.objective),
                  )}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  Versão {professionalContext.previousWorkoutPlan.version} · finalizado em{" "}
                  {formatClinicalDate(
                    professionalContext.previousWorkoutPlan.createdAt,
                  )}
                </p>
                {professionalContext.previousWorkoutPlan.professionalSummary ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    {formatPersistedText(
                      professionalContext.previousWorkoutPlan.professionalSummary,
                    )}
                  </p>
                ) : null}
                {professionalContext.previousWorkoutPlan.weeklyDivision?.length ? (
                  <ul className="mt-3 space-y-1">
                    {professionalContext.previousWorkoutPlan.weeklyDivision.map((entry) => (
                      <li key={`${entry.weekday}-${entry.weeklyOrder}`}>
                        <span className="font-black">{weekdayLabels[entry.weekday]}:</span>{" "}
                        {formatPersistedText(entry.sessionName)} ·{" "}
                        {formatPersistedText(entry.primaryFocus)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[var(--muted)]">
                    Divisão semanal anterior: {NOT_INFORMED}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">{NOT_INFORMED}</p>
            )}
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
              Origem: Plano de Treino anterior
            </p>
          </section>

          <section
            aria-labelledby="planning-transitions-title"
            className="rounded-xl border border-[var(--line)] p-4 lg:col-span-2"
          >
            <h3 className="text-sm font-black" id="planning-transitions-title">
              Mudanças de fase e foco
            </h3>
            {draft.strategy.transitions?.length ? (
              <ol className="mt-3 space-y-3">
                {draft.strategy.transitions.map((transition, index) => (
                  <li
                    className="rounded-xl bg-[var(--surface-elevated)] p-3 text-sm"
                    key={`${transition.effectiveDate}-${transition.recordedAt}-${index}`}
                  >
                    <p className="font-black">
                      Data efetiva: {formatClinicalDate(transition.effectiveDate)}
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Fase: {transition.phaseBefore || NOT_INFORMED} →{" "}
                      {transition.phaseAfter || NOT_INFORMED}
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Foco: {transition.focusBefore || NOT_INFORMED} →{" "}
                      {transition.focusAfter || NOT_INFORMED}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Nenhuma mudança de fase registrada
              </p>
            )}
          </section>
        </div>
      </Card>
      </div>

      <div
        aria-labelledby="workspace-tab-planning"
        className="scroll-mt-44 space-y-6"
        hidden={activeWorkspaceTab !== "PLANNING"}
        id="workspace-panel-planning"
        role="tabpanel"
      >
        {renderPlanActions("top")}
        <Card className="p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="shrink-0">
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                Modalidades do plano
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Selecione o planejamento que deseja visualizar.
              </p>
            </div>
            <div
              aria-label="Modalidades do plano"
              className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4"
              role="tablist"
            >
              <button
                aria-selected={activePlanningModality === "STRENGTH"}
                className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 ${
                  activePlanningModality === "STRENGTH"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                    : "border-[var(--line)] bg-white text-[var(--text-secondary)] hover:bg-[var(--secondary)]"
                }`}
                onClick={() => setActivePlanningModality("STRENGTH")}
                role="tab"
                type="button"
              >
                Musculação
              </button>
              <button
                aria-selected={activePlanningModality === "RUNNING"}
                className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 ${
                  activePlanningModality === "RUNNING"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                    : "border-[var(--line)] bg-white text-[var(--text-secondary)] hover:bg-[var(--secondary)]"
                }`}
                onClick={() => setActivePlanningModality("RUNNING")}
                role="tab"
                type="button"
              >
                Corrida
              </button>
              {[
                ["Ciclismo", "cycling"],
                ["Outros", "other"],
              ].map(([label, id]) => (
                <button
                  aria-describedby={`planning-modality-${id}-status`}
                  className="min-h-10 cursor-not-allowed rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-black text-slate-500"
                  disabled
                  key={id}
                  role="tab"
                  type="button"
                >
                  <span>{label}</span>
                  <span
                    className="ml-1 text-[10px] uppercase tracking-wide"
                    id={`planning-modality-${id}-status`}
                  >
                    Em breve
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
        <fieldset className="space-y-6" disabled={finalized}>
        {activePlanningModality === "RUNNING" ? (
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                  Corrida
                </p>
                <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">
                  Configuração do plano
                </h2>
                {draft.endurance?.running ? (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {draft.endurance.running.configuration.primaryObjective}
                    {` · ${draft.endurance.running.configuration.currentLevel}`}
                    {` · início em ${formatClinicalDate(
                      draft.endurance.running.configuration.startDate,
                    )}`}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    A corrida ainda não foi adicionada a este Plano de Treino.
                  </p>
                )}
              </div>
              {!runningConfigurationDraft ? (
                <Button
                  disabled={finalized}
                  onClick={startRunningConfiguration}
                  type="button"
                  variant="secondary"
                >
                  {draft.endurance?.running
                    ? "Editar configuração"
                    : "Adicionar corrida ao plano"}
                </Button>
              ) : null}
            </div>

            {runningConfigurationDraft ? (
              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <RunningPlanConfigurationForm
                  disabled={finalized}
                  errors={runningConfigurationErrors}
                  masterRecordId={currentView.masterRecordId}
                  onChange={(value) => {
                    setRunningConfigurationDraft(value);
                    if (runningConfigurationErrors) {
                      setRunningConfigurationErrors(undefined);
                    }
                  }}
                  value={runningConfigurationDraft}
                />
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    disabled={finalized}
                    onClick={cancelRunningConfiguration}
                    type="button"
                    variant="outline"
                  >
                    Cancelar edição
                  </Button>
                  <Button
                    disabled={finalized}
                    onClick={confirmRunningConfiguration}
                    type="button"
                  >
                    Confirmar configuração
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}
        {activePlanningModality === "STRENGTH" ? (
        <Card className="p-5 md:p-6">
          <SectionHeader
            description="A prescrição deste módulo modifica somente o serviço contratado. Outras práticas são registradas apenas como carga externa relevante."
            title="Serviço e contexto do treino"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField id="performance-service" label="Serviço contratado">
              <Select
                id="performance-service"
                onChange={(event) =>
                  updateService({
                    contractedService:
                      (event.target.value ||
                        undefined) as WorkoutPlanDraft["service"]["contractedService"],
                  })
                }
                value={draft.service.contractedService ?? ""}
              >
                <option value="">Não informado</option>
                {PERFORMANCE_SERVICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {PERFORMANCE_SERVICE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="performance-plan-type" label="Tipo de plano">
              <Input
                id="performance-plan-type"
                onChange={(event) =>
                  updateService({ planType: event.target.value })
                }
                value={draft.service.planType}
              />
            </FormField>
            <FormField id="performance-objective" label="Objetivo do treino">
              <Input
                id="performance-objective"
                onChange={(event) =>
                  updateService({ trainingObjective: event.target.value })
                }
                value={draft.service.trainingObjective}
              />
            </FormField>
            <FormField id="performance-modality" label="Modalidade principal">
              <Input
                id="performance-modality"
                onChange={(event) =>
                  updateService({ primaryModality: event.target.value })
                }
                value={draft.service.primaryModality}
              />
            </FormField>
          </div>
          <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
            <h3 className="text-sm font-black">Outras atividades praticadas</h3>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Nova atividade externa"
                onChange={(event) => setNewActivity(event.target.value)}
                placeholder="Ex.: corrida realizada por conta própria"
                value={newActivity}
              />
              <Button
                disabled={!newActivity.trim()}
                onClick={() => {
                  updateService({
                    otherActivities: [
                      ...draft.service.otherActivities,
                      {
                        id: crypto.randomUUID(),
                        name: newActivity.trim(),
                        supervision: "",
                      },
                    ],
                  });
                  setNewActivity("");
                }}
                type="button"
                variant="secondary"
              >
                Adicionar
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {draft.service.otherActivities.map((activity) => (
                <div
                  className="grid gap-2 rounded-lg bg-[var(--surface-elevated)] p-3 md:grid-cols-[1fr_15rem_auto]"
                  key={activity.id}
                >
                  <Input
                    aria-label="Nome da atividade externa"
                    onChange={(event) =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.map((item) =>
                            item.id === activity.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                      })
                    }
                    value={activity.name}
                  />
                  <Select
                    aria-label={`Acompanhamento de ${activity.name}`}
                    onChange={(event) =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.map((item) =>
                            item.id === activity.id
                              ? {
                                  ...item,
                                  supervision: event.target
                                    .value as typeof activity.supervision,
                                }
                              : item,
                          ),
                      })
                    }
                    value={activity.supervision}
                  >
                    <option value="">Não informado</option>
                    <option value="PROFESSIONAL">
                      Acompanhada pelo profissional
                    </option>
                    <option value="SELF_DIRECTED">Por conta própria</option>
                  </Select>
                  <Button
                    onClick={() =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.filter(
                            (item) => item.id !== activity.id,
                          ),
                      })
                    }
                    type="button"
                    variant="ghost"
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
        ) : null}

        {activePlanningModality === "STRENGTH" ? (
          <>
        <Card className="p-5 md:p-6">
          <SectionHeader
            description="Seleção profissional livre. Sugestões nunca substituem esta decisão."
            title="Valências físicas"
          />
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PHYSICAL_VALENCE_OPTIONS.map((valence) => (
              <label
                className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-3 text-sm font-bold"
                key={valence}
              >
                <input
                  checked={draft.valences.includes(valence)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      valences: event.target.checked
                        ? [...current.valences, valence]
                        : current.valences.filter(
                            (item) => item !== valence,
                          ),
                    }))
                  }
                  type="checkbox"
                />
                {valence}
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Valência personalizada"
              onChange={(event) => setCustomValence(event.target.value)}
              placeholder="Valência personalizada"
              value={customValence}
            />
            <Button
              disabled={!customValence.trim()}
              onClick={() => {
                if (!draft.valences.includes(customValence.trim())) {
                  setDraft((current) => ({
                    ...current,
                    valences: [...current.valences, customValence.trim()],
                  }));
                }
                setCustomValence("");
              }}
              type="button"
              variant="secondary"
            >
              Adicionar personalizada
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.valences
              .filter(
                (item) =>
                  !PHYSICAL_VALENCE_OPTIONS.some(
                    (standard) => standard === item,
                  ),
              )
              .map((item) => (
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold"
                  key={item}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      valences: current.valences.filter(
                        (value) => value !== item,
                      ),
                    }))
                  }
                  type="button"
                >
                  {item} ×
                </button>
              ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <SectionHeader
            description="A periodização formal é opcional. Todos os campos podem permanecer incompletos no rascunho."
            title="Estratégia e periodização"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField id="program-name" label="Nome do programa">
              <Input
                id="program-name"
                onChange={(event) =>
                  updateStrategy({ programName: event.target.value })
                }
                value={draft.strategy.programName}
              />
            </FormField>
            <FormField id="program-start" label="Data inicial">
              <Input
                id="program-start"
                onChange={(event) =>
                  updateStrategy({ startDate: event.target.value })
                }
                type="date"
                value={draft.strategy.startDate}
              />
            </FormField>
            <FormField id="program-duration" label="Duração prevista">
              <Input
                id="program-duration"
                onChange={(event) =>
                  updateStrategy({ expectedDuration: event.target.value })
                }
                placeholder="Ex.: 8 semanas"
                value={draft.strategy.expectedDuration}
              />
            </FormField>
            <FormField id="weekly-frequency" label="Frequência semanal">
              <NumberInput
                id="weekly-frequency"
                min={1}
                onChange={(event) =>
                  updateStrategy({
                    weeklyFrequency: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                value={draft.strategy.weeklyFrequency ?? ""}
              />
            </FormField>
            <FormField id="cycle-objective" label="Objetivo do ciclo">
              <Input
                id="cycle-objective"
                onChange={(event) =>
                  updateStrategy({ cycleObjective: event.target.value })
                }
                value={draft.strategy.cycleObjective}
              />
            </FormField>
            <FormField id="training-split" label="Divisão do treino">
              <Input
                id="training-split"
                onChange={(event) =>
                  updateStrategy({ trainingSplit: event.target.value })
                }
                placeholder="Ex.: A/B/C ou personalizada"
                value={draft.strategy.trainingSplit}
              />
            </FormField>
            <FormField id="current-phase" label="Fase atual">
              <Input
                id="current-phase"
                list="performance-phase-options"
                onChange={(event) =>
                  updateStrategy({ currentPhase: event.target.value })
                }
                value={draft.strategy.currentPhase}
              />
              <datalist id="performance-phase-options">
                {PROGRAM_PHASE_OPTIONS.map((phase) => (
                  <option
                    key={phase}
                    label={
                      phase === "Polimento"
                        ? "Polimento (pré-prova)"
                        : phase
                    }
                    value={phase}
                  />
                ))}
              </datalist>
            </FormField>
            <FormField id="current-focus" label="Foco atual">
              <Select
                id="current-focus"
                onChange={(event) =>
                  updateStrategy({ currentFocus: event.target.value })
                }
                value={draft.strategy.currentFocus ?? ""}
              >
                <option value="">{NOT_INFORMED}</option>
                {PROGRAM_FOCUS_OPTIONS.map((focus) => (
                  <option key={focus} value={focus}>
                    {focus}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="next-phase" label="Próxima fase planejada">
              <Select
                id="next-phase"
                onChange={(event) =>
                  updateStrategy({ nextPhase: event.target.value })
                }
                value={draft.strategy.nextPhase ?? ""}
              >
                <option value="">{NOT_INFORMED}</option>
                {PROGRAM_PHASE_OPTIONS.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase === "Polimento"
                      ? "Polimento (pré-prova)"
                      : phase}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="next-focus" label="Próximo foco">
              <Select
                id="next-focus"
                onChange={(event) =>
                  updateStrategy({ nextFocus: event.target.value })
                }
                value={draft.strategy.nextFocus ?? ""}
              >
                <option value="">{NOT_INFORMED}</option>
                {PROGRAM_FOCUS_OPTIONS.map((focus) => (
                  <option key={focus} value={focus}>
                    {focus}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="current-week" label="Semana atual">
              <NumberInput
                id="current-week"
                min={1}
                onChange={(event) =>
                  updateStrategy({
                    currentWeek: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                value={draft.strategy.currentWeek ?? ""}
              />
            </FormField>
          </div>
          <p
            aria-live="polite"
            className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]"
          >
            <strong className="text-[var(--text-primary)]">Resumo do foco:</strong>{" "}
            Agora: {draft.strategy.currentFocus?.trim() || NOT_INFORMED} · Depois:{" "}
            {draft.strategy.nextFocus?.trim() || NOT_INFORMED}
          </p>
          {!finalized && canConfirmPlanningTransition ? (
            <div className="mt-4">
              <Button
                disabled={saving}
                onClick={openPlanningTransitionConfirmation}
                type="button"
                variant="secondary"
              >
                Confirmar mudança de fase
              </Button>
            </div>
          ) : null}
          {transitionConfirmationOpen ? (
            <section
              aria-labelledby="confirm-planning-transition-title"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
              role="dialog"
            >
              <h3 className="font-black text-amber-950" id="confirm-planning-transition-title">
                Confirmar mudança de fase
              </h3>
              <div className="mt-3 grid gap-2 text-sm text-amber-950 sm:grid-cols-2">
                {phaseWillChange ? (
                  <p>
                    <strong>Fase:</strong>{" "}
                    {draft.strategy.currentPhase.trim() || NOT_INFORMED} → {plannedPhase}
                  </p>
                ) : null}
                {focusWillChange ? (
                  <p>
                    <strong>Foco:</strong>{" "}
                    {draft.strategy.currentFocus?.trim() || NOT_INFORMED} → {plannedFocus}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 max-w-xs">
                <FormField
                  error={transitionError}
                  id="transition-effective-date"
                  label="Data efetiva"
                  required
                >
                  <Input
                    aria-invalid={Boolean(transitionError)}
                    id="transition-effective-date"
                    onChange={(event) => {
                      setTransitionEffectiveDate(event.target.value);
                      setTransitionError("");
                    }}
                    required
                    type="date"
                    value={transitionEffectiveDate}
                  />
                </FormField>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={saving}
                  onClick={cancelPlanningTransitionConfirmation}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={saving || !transitionEffectiveDate}
                  loading={savingAction === "SAVE_DRAFT"}
                  onClick={() => void confirmPlanningTransition()}
                  type="button"
                >
                  Confirmar mudança
                </Button>
              </div>
            </section>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["priorities", "Prioridades"],
              ["restrictions", "Restrições"],
              ["macrocycle", "Macrociclo"],
              ["mesocycle", "Mesociclo"],
              ["microcycle", "Microciclo"],
              ["observations", "Observações"],
            ].map(([key, label]) => (
              <FormField id={`strategy-${key}`} key={key} label={label}>
                <Textarea
                  id={`strategy-${key}`}
                  onChange={(event) =>
                    updateStrategy({
                      [key]: event.target.value,
                    } as Partial<WorkoutPlanDraft["strategy"]>)
                  }
                  value={
                    draft.strategy[
                      key as
                        | "priorities"
                        | "restrictions"
                        | "macrocycle"
                        | "mesocycle"
                        | "microcycle"
                        | "observations"
                    ]
                  }
                />
              </FormField>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black">Ciclos</h3>
            <Button
              onClick={() =>
                updateStrategy({
                  cycles: [...draft.strategy.cycles, emptyCycle()],
                })
              }
              type="button"
              variant="secondary"
            >
              Criar ciclo
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {draft.strategy.cycles.map((cycle) => (
              <div
                className="grid gap-3 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2 xl:grid-cols-6"
                key={cycle.id}
              >
                <Select
                  aria-label="Nível do ciclo"
                  onChange={(event) =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.map((item) =>
                        item.id === cycle.id
                          ? {
                              ...item,
                              level: event.target
                                .value as PeriodizationCycle["level"],
                            }
                          : item,
                      ),
                    })
                  }
                  value={cycle.level}
                >
                  <option value="MACROCYCLE">Macrociclo</option>
                  <option value="MESOCYCLE">Mesociclo</option>
                  <option value="MICROCYCLE">Microciclo</option>
                </Select>
                {(["name", "startDate", "endDate", "objective"] as const).map(
                  (field) => (
                    <Input
                      aria-label={`${field} do ciclo`}
                      key={field}
                      onChange={(event) =>
                        updateStrategy({
                          cycles: draft.strategy.cycles.map((item) =>
                            item.id === cycle.id
                              ? {
                                  ...item,
                                  [field]: event.target.value,
                                }
                              : item,
                          ),
                        })
                      }
                      type={
                        field === "startDate" || field === "endDate"
                          ? "date"
                          : "text"
                      }
                      value={cycle[field]}
                    />
                  ),
                )}
                <Button
                  onClick={() =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.filter(
                        (item) => item.id !== cycle.id,
                      ),
                    })
                  }
                  type="button"
                  variant="ghost"
                >
                  Excluir
                </Button>
                <Textarea
                  aria-label="Observações do ciclo"
                  className="md:col-span-2 xl:col-span-6"
                  onChange={(event) =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.map((item) =>
                        item.id === cycle.id
                          ? {
                              ...item,
                              observations: event.target.value,
                            }
                          : item,
                      ),
                    })
                  }
                  placeholder="Observações do ciclo"
                  value={cycle.observations}
                />
              </div>
            ))}
          </div>
        </Card>

          <Card className="p-5 md:p-6">
            <SectionHeader
              description="O Modo livre é independente de IA, protocolos ou biblioteca."
              title="Modo de montagem"
            />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKOUT_START_MODES.map((mode) => (
              <label
                className={`rounded-xl border p-4 text-sm font-black ${
                  draft.startMode === mode
                    ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary)]"
                    : "border-[var(--line)]"
                }`}
                key={mode}
              >
                <input
                  checked={draft.startMode === mode}
                  className="mr-2"
                  name="workout-start-mode"
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      startMode: mode,
                    }))
                  }
                  type="radio"
                />
                {WORKOUT_START_MODE_LABELS[mode]}
              </label>
            ))}
          </div>
        </Card>
          {draft.startMode === "ASSISTED" ? (
            <Card className="p-5 md:p-6">
              <fieldset className="mb-4">
                <legend className="text-sm font-black">
                  Como aplicar a proposta ao rascunho?
                </legend>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {([
                    {
                      mode: "APPEND",
                      title: "Adicionar aos treinos existentes",
                      description:
                        "Preserva as sessões atuais e continua a sequência de nomes.",
                    },
                    {
                      mode: "REPLACE",
                      title: "Montar uma nova ficha",
                      description:
                        "Cria a prévia a partir do Treino A e, após confirmação, substitui as sessões atuais.",
                    },
                  ] as const).map((option) => (
                    <label
                      className={`cursor-pointer rounded-xl border p-4 text-sm ${
                        assistedApplicationMode === option.mode
                          ? "border-[var(--primary)] bg-[var(--secondary)]"
                          : "border-[var(--line)]"
                      }`}
                      key={option.mode}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          checked={assistedApplicationMode === option.mode}
                          className="mt-1"
                          name="assisted-application-mode"
                          onChange={() => {
                            setAssistedApplicationMode(option.mode);
                            setAssistedProposal(undefined);
                            setAssistedReplacementConfirmed(false);
                          }}
                          type="radio"
                        />
                        <span>
                          <span className="block font-black">{option.title}</span>
                          <span className="mt-1 block text-[var(--muted)]">
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  id="assisted-experience"
                  label="Experiência de treinamento"
                >
                  <Input
                    id="assisted-experience"
                    onChange={(event) => setAssistedExperience(event.target.value)}
                    placeholder="Ex.: iniciante"
                    value={assistedExperience}
                  />
                </FormField>
                <div className="rounded-xl border border-[var(--line)] px-3 py-2">
                  <p className="text-xs font-black text-[var(--muted)]">
                    Frequência semanal
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {assistedStrategyFrequency !== undefined
                      ? `${assistedStrategyFrequency}x por semana`
                      : "Não informado — corrija em Estratégia e periodização."}
                  </p>
                </div>
                <FormField id="assisted-duration" label="Duração por sessão">
                  <Input
                    id="assisted-duration"
                    onChange={(event) => setAssistedDuration(event.target.value)}
                    placeholder="Ex.: 50 min"
                    value={assistedDuration}
                  />
                </FormField>
                <FormField
                  id="assisted-equipment"
                  label="Filtrar por equipamento (opcional)"
                >
                  <Input
                    id="assisted-equipment"
                    onChange={(event) => setAssistedEquipment(event.target.value)}
                    placeholder="Sem filtro: academia convencional"
                    value={assistedEquipment}
                  />
                </FormField>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  Gerar, editar ou cancelar a prévia não altera o rascunho, mesmo
                  com salvamento automático. Aplicar não finaliza o plano nem altera
                  entregas oficiais.
                </p>
                <Button
                  disabled={!professionalContext}
                  onClick={generateAssistedProposal}
                  type="button"
                  variant="secondary"
                >
                  Gerar proposta de estrutura
                </Button>
              </div>

              {assistedProposal ? (
                <section
                  aria-labelledby="assisted-proposal-title"
                  className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black" id="assisted-proposal-title">
                        Proposta de estrutura
                      </h4>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Referência somente para análise profissional; o rascunho
                        permanece inalterado até a aplicação confirmada.
                      </p>
                    </div>
                    <Badge tone="warning">Exige confirmação profissional</Badge>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [
                        "Objetivo reconhecido",
                        assistedProposal.recognizedObjective ?? NOT_INFORMED,
                      ],
                      [
                        "Frequência semanal",
                        assistedProposal.suggestedWeeklyFrequency ?? NOT_INFORMED,
                      ],
                      [
                        "Duração por sessão",
                        assistedProposal.sessionDuration ?? NOT_INFORMED,
                      ],
                      [
                        "Filtro de equipamento",
                        assistedProposal.availableEquipment.length
                          ? assistedProposal.availableEquipment.join(" · ")
                          : "Academia convencional (sem filtro)",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-xl bg-[var(--surface-elevated)] p-3"
                        key={label}
                      >
                        <dt className="text-xs font-black text-[var(--muted)]">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div
                    aria-live="polite"
                    className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-sm"
                  >
                    {assistedProposal.applicationMode === "APPEND" ? (
                      <p>
                        <span className="font-black">
                          Adicionar aos treinos existentes:
                        </span>{" "}
                        {assistedProposal.existingSessionCount} existentes +{" "}
                        {assistedProposal.sessions.length} sugeridos ={" "}
                        <span className="font-black">
                          {assistedProposal.resultingSessionCount} sessões no rascunho
                        </span>
                        . As sessões atuais serão preservadas.
                      </p>
                    ) : (
                      <p>
                        <span className="font-black">Montar uma nova ficha:</span>{" "}
                        a prévia começa no Treino A e terá{" "}
                        <span className="font-black">
                          {assistedProposal.resultingSessionCount} sessões
                        </span>
                        , conforme a frequência semanal. Ao aplicar, ela substituirá{" "}
                        {assistedProposal.existingSessionCount} sessões atuais do
                        rascunho.
                      </p>
                    )}
                  </div>

                  {assistedProposal.sessions.length ? (
                    <div className="mt-4 space-y-4">
                      <h5 className="text-sm font-black text-[var(--text-primary)]">
                        Prévia dos treinos sugeridos
                      </h5>
                      {assistedProposal.sessions.map((session) => (
                        <article
                          className="rounded-xl border border-[var(--line)] p-4"
                          key={session.id}
                        >
                          <div className="grid gap-3 md:grid-cols-3">
                            <FormField
                              id={`${session.id}-assisted-name`}
                              label="Nome do treino"
                            >
                              <Input
                                id={`${session.id}-assisted-name`}
                                onChange={(event) =>
                                  updateAssistedSession(session.id, {
                                    name: event.target.value,
                                  })
                                }
                                value={session.name}
                              />
                            </FormField>
                            <FormField
                              id={`${session.id}-assisted-objective`}
                              label="Objetivo da sessão"
                            >
                              <Input
                                id={`${session.id}-assisted-objective`}
                                onChange={(event) =>
                                  updateAssistedSession(session.id, {
                                    objective: event.target.value,
                                  })
                                }
                                value={session.objective}
                              />
                            </FormField>
                            <FormField
                              id={`${session.id}-assisted-duration`}
                              label="Duração estimada"
                            >
                              <Input
                                id={`${session.id}-assisted-duration`}
                                onChange={(event) =>
                                  updateAssistedSession(session.id, {
                                    estimatedDuration: event.target.value,
                                  })
                                }
                                value={session.estimatedDuration}
                              />
                            </FormField>
                          </div>
                          <Textarea
                            aria-label={`Cuidados do ${session.name}`}
                            className="mt-3"
                            onChange={(event) =>
                              updateAssistedSession(session.id, {
                                observations: event.target.value,
                              })
                            }
                            value={session.observations}
                          />
                          <div className="mt-3 space-y-2">
                            {session.exercises.map((exercise) => (
                              <div
                                className="grid gap-2 rounded-lg bg-[var(--surface-elevated)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)_6rem_7rem_8rem]"
                                key={exercise.id}
                              >
                                <Input
                                  aria-label="Exercício sugerido"
                                  onChange={(event) =>
                                    updateAssistedExercise(
                                      session.id,
                                      exercise.id,
                                      { name: event.target.value },
                                    )
                                  }
                                  value={exercise.name}
                                />
                                <Input
                                  aria-label={`Equipamento necessário para ${exercise.name}`}
                                  onChange={(event) =>
                                    updateAssistedExercise(
                                      session.id,
                                      exercise.id,
                                      { requiredEquipment: event.target.value },
                                    )
                                  }
                                  placeholder="Equipamento necessário"
                                  value={exercise.requiredEquipment}
                                />
                                <Input
                                  aria-label={`Séries de ${exercise.name}`}
                                  onChange={(event) =>
                                    updateAssistedExercise(
                                      session.id,
                                      exercise.id,
                                      { sets: event.target.value },
                                    )
                                  }
                                  placeholder="Séries"
                                  value={exercise.sets}
                                />
                                <Input
                                  aria-label={`Repetições de ${exercise.name}`}
                                  onChange={(event) =>
                                    updateAssistedExercise(
                                      session.id,
                                      exercise.id,
                                      { repetitions: event.target.value },
                                    )
                                  }
                                  placeholder="Repetições"
                                  value={exercise.repetitions}
                                />
                                <Input
                                  aria-label={`Descanso de ${exercise.name}`}
                                  onChange={(event) =>
                                    updateAssistedExercise(
                                      session.id,
                                      exercise.id,
                                      { restInterval: event.target.value },
                                    )
                                  }
                                  placeholder="Descanso"
                                  value={exercise.restInterval}
                                />
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Divisão semanal sugerida
                      </h5>
                      {assistedProposal.suggestedWeeklyDivision.length ? (
                        <ul className="mt-2 space-y-1 text-sm">
                          {assistedProposal.suggestedWeeklyDivision.map((entry) => (
                            <li key={`${entry.weekday}-${entry.weeklyOrder}`}>
                              <span className="font-black">
                                {weekdayLabels[entry.weekday]}:
                              </span>{" "}
                              {entry.sessionName} · {entry.primaryFocus}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Divisão não sugerida por ausência ou conflito de informações.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Prioridades
                      </h5>
                      <p className="mt-2 text-sm">
                        {assistedProposal.priorities.length
                          ? assistedProposal.priorities.join(" · ")
                          : NOT_INFORMED}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Cuidados e limitações
                      </h5>
                      <p className="mt-2 text-sm">
                        {assistedProposal.careAndLimitations.length
                          ? assistedProposal.careAndLimitations.join(" · ")
                          : NOT_INFORMED}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Protocolo-base sugerido
                      </h5>
                      <p className="mt-2 text-sm">
                        {assistedProposal.suggestedBaseProtocol?.protocolName ??
                          NOT_INFORMED}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Dados essenciais ausentes
                      </h5>
                      {assistedProposal.missingInformation.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {assistedProposal.missingInformation.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm">Nenhuma ausência identificada</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                        Alertas de coerência
                      </h5>
                      {assistedProposal.coherenceAlerts.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm font-bold text-amber-900">
                          {assistedProposal.coherenceAlerts.map((alert) => (
                            <li key={alert}>{alert}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm">Nenhum alerta identificado</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                      Justificativas profissionais
                    </h5>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                      {assistedProposal.professionalRationales.map((rationale) => (
                        <li key={rationale}>{rationale}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {assistedProposal.applicationMode === "REPLACE" &&
                    assistedProposal.existingSessionCount > 0 ? (
                      <label className="mr-auto flex max-w-2xl items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                        <input
                          checked={assistedReplacementConfirmed}
                          className="mt-1"
                          onChange={(event) =>
                            setAssistedReplacementConfirmed(event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>
                          Confirmo que a nova ficha substituirá as{" "}
                          {assistedProposal.existingSessionCount} sessões atuais do
                          rascunho.
                        </span>
                      </label>
                    ) : null}
                    {assistedProposal.sessions.length ? (
                      <Button
                        onClick={() => setAssistedPrintPreviewOpen(true)}
                        type="button"
                        variant="secondary"
                      >
                        Prévia de impressão
                      </Button>
                    ) : null}
                    <Button
                      onClick={cancelAssistedProposal}
                      type="button"
                      variant="outline"
                    >
                      Cancelar sugestão
                    </Button>
                    <Button
                      disabled={
                        !assistedProposal.sessions.length ||
                        (assistedProposal.applicationMode === "REPLACE" &&
                          assistedProposal.existingSessionCount > 0 &&
                          !assistedReplacementConfirmed)
                      }
                      onClick={applyAssistedProposal}
                      type="button"
                    >
                      {assistedProposal.applicationMode === "REPLACE"
                        ? "Aplicar e substituir sessões"
                        : "Adicionar ao rascunho"}
                    </Button>
                  </div>
                </section>
              ) : null}
            </Card>
          ) : null}

        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              description="Métodos personalizados com nome ficam disponíveis na prescrição e alimentam o glossário do PDF."
              title="Métodos de treinamento"
            />
            <Button
              disabled={hasOpenEmptyCustomMethod}
              onClick={openCustomMethodForm}
              type="button"
              variant="secondary"
            >
              Criar método personalizado
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {visibleCustomMethods.map((method) => (
              <div
                className="grid gap-3 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2"
                key={method.id}
              >
                {[
                  ["name", "Nome"],
                  ["studentExplanation", "Explicação para o aluno"],
                  ["executionInstruction", "Instrução de execução"],
                  ["objective", "Objetivo"],
                  ["professionalObservation", "Observação profissional"],
                ].map(([field, label]) => (
                  <FormField
                    id={`${method.id}-${field}`}
                    key={field}
                    label={label}
                  >
                    <Input
                      id={`${method.id}-${field}`}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          customMethods: current.customMethods.map((item) =>
                            item.id === method.id
                              ? {
                                  ...item,
                                  [field]: event.target.value,
                                }
                              : item,
                          ),
                        }))
                      }
                      value={
                        method[
                          field as
                            | "name"
                            | "studentExplanation"
                            | "executionInstruction"
                            | "objective"
                            | "professionalObservation"
                        ]
                      }
                    />
                  </FormField>
                ))}
                <div className="md:col-span-2 md:text-right">
                  <Button
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        customMethods: current.customMethods.filter(
                          (item) => item.id !== method.id,
                        ),
                        sessions: current.sessions.map((session) => ({
                          ...session,
                          exercises: session.exercises.map((exercise) =>
                            exercise.methodId === method.id
                              ? { ...exercise, methodId: "" }
                              : exercise,
                          ),
                        })),
                      }))
                    }
                    type="button"
                    variant="ghost"
                  >
                    Excluir método
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </Card>
          </>
        ) : null}

        </fieldset>
        {renderPlanActions("bottom")}
      </div>

      <div
        aria-labelledby="workspace-tab-workouts"
        className="scroll-mt-44 space-y-6"
        hidden={activeWorkspaceTab !== "WORKOUTS"}
        id="workspace-panel-workouts"
        role="tabpanel"
      >
        {renderPlanActions("top")}
        <Card className="p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black">Modalidade das sessões</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Abrir uma modalidade não altera o serviço contratado nem a ficha salva.</p>
            </div>
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Modalidade das sessões">
              <Button onClick={() => setActivePlanningModality("STRENGTH")} type="button" variant={activePlanningModality === "STRENGTH" ? "primary" : "outline"}>Musculação</Button>
              <Button onClick={() => setActivePlanningModality("RUNNING")} type="button" variant={activePlanningModality === "RUNNING" ? "primary" : "outline"}>Corrida</Button>
            </div>
          </div>
        </Card>
        <fieldset className="space-y-6" disabled={finalized}>
        {activePlanningModality === "RUNNING" ? (
          draft.endurance?.running ? (
            <AssistedRunningWeekPanel
              applicationMode={runningApplicationMode}
              attendanceId={currentView.attendanceId}
              contextExperience={professionalContext?.trainingExperience}
              contextSessionDurationMinutes={professionalContext?.sessionDurationMinutes}
              disabled={finalized}
              onApplicationModeChange={setRunningApplicationMode}
              onApply={() => {
                if (!runningProposal) return;
                const affectedPeriod = `${runningProposal.period.startDate} a ${runningProposal.period.endDate}`;
                setDraft((current) => {
                  const running = current.endurance?.running;
                  if (!running) return current;
                  return {
                    ...current,
                    endurance: {
                      ...current.endurance,
                      running: applyRunningProposal(
                        running,
                        runningProposal,
                        runningApplicationMode,
                      ),
                    },
                  };
                });
                setRunningProposal(undefined);
                setMessage(`Planejamento de Corrida aplicado ao rascunho no período de ${affectedPeriod}; o plano não foi finalizado.`);
              }}
              onManualChange={(running) =>
                setDraft((current) => ({
                  ...current,
                  endurance: { ...current.endurance, running },
                }))
              }
              onPreviewDraft={() => setDeliverablePreview("RUNNING_DRAFT")}
              onPreviewProposal={() => setDeliverablePreview("RUNNING_PROPOSAL")}
              onProposalChange={setRunningProposal}
              proposal={runningProposal}
              patientId={currentView.patient.id}
              value={draft.endurance.running}
            />
          ) : (
            <Card className="p-5 md:p-6">
              <p className="font-black text-slate-950">Configure a corrida primeiro</p>
              <p className="mt-2 text-sm text-slate-600">Na aba Planejamento, abra Corrida e adicione a configuração ao plano. O serviço contratado não será alterado.</p>
              <Button className="mt-4" onClick={() => {
                setActiveWorkspaceTab("PLANNING");
                setActivePlanningModality("RUNNING");
              }} type="button" variant="secondary">Ir para configuração</Button>
            </Card>
          )
        ) : null}
        <div className="space-y-6" hidden={activePlanningModality !== "STRENGTH"}>
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              description="Prescrição manual aberta. Nenhum parâmetro obriga o preenchimento dos demais."
              title="Construtor de treino"
            />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              aria-label="Nome personalizado do treino"
              onChange={(event) =>
                setCustomSessionName(event.target.value)
              }
              placeholder={
                nextDefaultSessionName
                  ? `Próximo: ${nextDefaultSessionName} ou informe um nome personalizado`
                  : "Nome do novo treino personalizado"
              }
              value={customSessionName}
            />
            <Button
              disabled={
                finalized ||
                !requestedNewSessionName ||
                sessionNameAlreadyExists ||
                draft.sessions.length >= MAX_WORKOUT_SESSIONS
              }
              onClick={createWorkoutSession}
              type="button"
              variant="secondary"
            >
              + Novo treino
            </Button>
          </div>
          {sessionNameAlreadyExists ? (
            <p className="mt-2 text-xs font-bold text-amber-800">
              Já existe um treino com esse nome.
            </p>
          ) : draft.sessions.length >= MAX_WORKOUT_SESSIONS ? (
            <p className="mt-2 text-xs font-bold text-amber-800">
              Limite de {MAX_WORKOUT_SESSIONS} treinos atingido.
            </p>
          ) : null}

          {draft.sessions.length ? (
            <div
              aria-label="Treinos do plano"
              className="mt-5 overflow-x-auto border-b border-[var(--line)] pb-1"
              role="tablist"
            >
              <div className="flex min-w-max gap-2">
                {draft.sessions.map((session, sessionIndex) => {
                  const active = activeSession?.id === session.id;
                  return (
                    <a
                      aria-controls={`workout-session-panel-${session.id}`}
                      aria-selected={active}
                      className={`inline-flex min-h-11 items-center rounded-t-xl border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${
                        active
                          ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary-hover)]"
                          : "border-[var(--line)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                      }`}
                      href={`#workout-session-panel-${session.id}`}
                      id={`workout-session-tab-${session.id}`}
                      key={session.id}
                      onClick={(event) => {
                        event.preventDefault();
                        setActiveSessionId(session.id);
                      }}
                      onKeyDown={(event) =>
                        selectSessionFromKeyboard(event, sessionIndex)
                      }
                      role="tab"
                      tabIndex={active ? 0 : -1}
                    >
                      {session.name.trim() || `Treino ${sessionIndex + 1}`}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}

          <datalist id="exercise-library-options">
            {library.map((exercise) => (
              <option key={exercise.id} value={exercise.name} />
            ))}
          </datalist>
          <datalist id="load-unit-options">
            {['kg', 'lb', 'placa', 'elástico', 'peso corporal'].map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>

          <div className="mt-5 space-y-5">
            {!draft.sessions.length ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                Nenhuma sessão criada. Use “+ Novo treino” para começar.
              </p>
            ) : null}
            {activeSession
              ? [activeSession].map((session) => {
                  const selection = exerciseSelections[session.id] ?? {
                    query: "",
                  };
                  const selectedExercise = selection.exerciseId
                    ? library.find(
                        (exercise) => exercise.id === selection.exerciseId,
                      )
                    : undefined;
                  const alreadyAdded = selectedExercise
                    ? session.exercises.some(
                        (exercise) =>
                          exercise.libraryExerciseId === selectedExercise.id,
                      )
                    : false;
                  return (
                <section
                  aria-labelledby={`workout-session-tab-${session.id}`}
                  className="rounded-2xl border border-[var(--line)] p-4"
                  id={`workout-session-panel-${session.id}`}
                  key={session.id}
                  role="tabpanel"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_12rem_auto]">
                    <FormField
                      id={`${session.id}-name`}
                      label="Nome do treino"
                    >
                      <Input
                        id={`${session.id}-name`}
                        onChange={(event) =>
                          updateSession(session.id, {
                            name: event.target.value,
                          })
                        }
                        value={session.name}
                      />
                    </FormField>
                    <FormField
                      id={`${session.id}-objective`}
                      label="Objetivo da sessão"
                    >
                      <Input
                        id={`${session.id}-objective`}
                        onChange={(event) =>
                          updateSession(session.id, {
                            objective: event.target.value,
                          })
                        }
                        placeholder="Ex.: força de membros inferiores"
                        value={session.objective}
                      />
                    </FormField>
                    <FormField
                      id={`${session.id}-duration`}
                      label="Duração estimada"
                    >
                      <Input
                        id={`${session.id}-duration`}
                        onChange={(event) =>
                          updateSession(session.id, {
                            estimatedDuration: event.target.value,
                          })
                        }
                        placeholder="Ex.: 60 min"
                        value={session.estimatedDuration}
                      />
                    </FormField>
                    <div className="self-end">
                      <Button
                        disabled={finalized}
                        onClick={() => removeWorkoutSession(session.id)}
                        type="button"
                        variant="ghost"
                      >
                        Excluir treino
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-[var(--surface-elevated)] p-3">
                    <label
                      className="text-xs font-black"
                      htmlFor={`${session.id}-exercise-search`}
                    >
                      Pesquisar exercício ativo da biblioteca
                    </label>
                    <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                      <Input
                        id={`${session.id}-exercise-search`}
                        list="exercise-library-options"
                        onChange={(event) => {
                          const query = event.target.value;
                          const exactMatch = libraryMatch(library, query);
                          setExerciseSelections((current) => ({
                            ...current,
                            [session.id]: {
                              query,
                              exerciseId: exactMatch?.id,
                            },
                          }));
                        }}
                        placeholder="Digite para localizar na biblioteca"
                        value={selection.query}
                      />
                      <Button
                        disabled={!selectedExercise || alreadyAdded}
                        onClick={() => {
                          if (selectedExercise) {
                            addExercise(session.id, selectedExercise.id);
                          }
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Adicionar à sessão
                      </Button>
                    </div>
                    {selection.query.trim() && !selectedExercise ? (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        Selecione um exercício ativo já cadastrado na biblioteca.
                      </p>
                    ) : alreadyAdded ? (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        Este exercício já está incluído nesta sessão.
                      </p>
                    ) : selectedExercise ? (
                      <p className="mt-2 text-xs font-bold text-emerald-700">
                        Exercício localizado na biblioteca.
                      </p>
                    ) : null}
                    {!library.length ? (
                      <p className="mt-2 text-xs font-bold text-[var(--muted)]">
                        Nenhum exercício ativo disponível. Cadastre-o primeiro na{" "}
                        <a
                          className="text-[var(--primary)] underline"
                          href="/performance-endurance/exercicios"
                        >
                          Biblioteca de Exercícios
                        </a>
                        .
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    {session.exercises.map((exercise, exerciseIndex) => {
                      const advancedExpanded = expandedExerciseIds.has(
                        exercise.id,
                      );

                      return (
                      <article
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        key={exercise.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-black">
                            {exercise.order}.{" "}
                            {exercise.name || "Exercício sem nome"}
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              aria-label={`Mover ${exercise.name} para cima`}
                              disabled={exerciseIndex === 0}
                              onClick={() =>
                                moveExercise(
                                  session.id,
                                  exercise.id,
                                  -1,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              ↑
                            </Button>
                            <Button
                              aria-label={`Mover ${exercise.name} para baixo`}
                              disabled={
                                exerciseIndex ===
                                session.exercises.length - 1
                              }
                              onClick={() =>
                                moveExercise(
                                  session.id,
                                  exercise.id,
                                  1,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              ↓
                            </Button>
                            <Button
                              onClick={() =>
                                setDraft((current) =>
                                  workoutSheetReducer(current, {
                                    type: "REMOVE_EXERCISE",
                                    sessionId: session.id,
                                    exerciseId: exercise.id,
                                  }),
                                )
                              }
                              type="button"
                              variant="ghost"
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ["sets", "Séries"],
                            ["repetitions", "Repetições ou faixa"],
                            ["load", "Carga"],
                            ["restInterval", "Descanso (segundos)"],
                          ].map(([field, label]) => (
                            <FormField
                              id={`${exercise.id}-${field}`}
                              key={field}
                              label={label}
                            >
                              <Input
                                id={`${exercise.id}-${field}`}
                                onChange={(event) =>
                                  updateExercise(
                                    session.id,
                                    exercise.id,
                                    {
                                      [field]: event.target.value,
                                    },
                                  )
                                }
                                placeholder={
                                  field === "restInterval" ? "Ex.: 60" : undefined
                                }
                                value={
                                  exercise[
                                    field as
                                      | "sets"
                                      | "repetitions"
                                      | "load"
                                      | "restInterval"
                                  ]
                                }
                              />
                            </FormField>
                          ))}
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            aria-controls={`${exercise.id}-advanced-parameters`}
                            aria-expanded={advancedExpanded}
                            className="rounded-lg px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                            onClick={() =>
                              setExpandedExerciseIds((current) => {
                                const next = new Set(current);
                                if (next.has(exercise.id)) {
                                  next.delete(exercise.id);
                                } else {
                                  next.add(exercise.id);
                                }
                                return next;
                              })
                            }
                            type="button"
                          >
                            {advancedExpanded
                              ? "Ocultar parâmetros avançados"
                              : "Mostrar parâmetros avançados"}
                          </button>
                        </div>

                        <div
                          className="mt-3 rounded-xl border border-violet-100 bg-violet-50/30 p-3"
                          hidden={!advancedExpanded}
                          id={`${exercise.id}-advanced-parameters`}
                        >
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                            <div className="sm:col-span-2 lg:col-span-4 xl:col-span-6">
                              <FormField
                                id={`${exercise.id}-prescription`}
                                label="Prescrição livre"
                              >
                                <Input
                                  id={`${exercise.id}-prescription`}
                                  onChange={(event) =>
                                    updateExercise(
                                      session.id,
                                      exercise.id,
                                      { prescription: event.target.value },
                                    )
                                  }
                                  placeholder="Ex.: 3 séries até RIR 2"
                                  value={exercise.prescription}
                                />
                              </FormField>
                              <p className="mt-1 text-xs text-violet-700">
                                Use somente quando a prescrição não puder ser
                                representada pelos campos estruturados.
                              </p>
                            </div>
                            {[
                              ["cadence", "Cadência"],
                              ["rangeOfMotion", "Amplitude"],
                              ["substituteExercise", "Exercício substituto"],
                            ].map(([field, label]) => (
                              <FormField
                                id={`${exercise.id}-${field}`}
                                key={field}
                                label={label}
                              >
                                <Input
                                  id={`${exercise.id}-${field}`}
                                  onChange={(event) =>
                                    updateExercise(
                                      session.id,
                                      exercise.id,
                                      { [field]: event.target.value },
                                    )
                                  }
                                  value={
                                    exercise[
                                      field as
                                        | "cadence"
                                        | "rangeOfMotion"
                                        | "substituteExercise"
                                    ]
                                  }
                                />
                              </FormField>
                            ))}
                          <FormField
                            id={`${exercise.id}-load-unit`}
                            label="Unidade da carga"
                          >
                            <Input
                              id={`${exercise.id}-load-unit`}
                              list="load-unit-options"
                              onChange={(event) =>
                                updateExercise(session.id, exercise.id, {
                                  loadUnit: event.target.value,
                                })
                              }
                              placeholder="Ex.: kg"
                              value={exercise.loadUnit}
                            />
                          </FormField>
                          <FormField id={`${exercise.id}-rir`} label="RIR">
                            <Input
                              id={`${exercise.id}-rir`}
                              onChange={(event) =>
                                updateExercise(session.id, exercise.id, {
                                  rir: event.target.value,
                                })
                              }
                              placeholder="Ex.: 2"
                              value={exercise.rir}
                            />
                          </FormField>
                          <FormField id={`${exercise.id}-rpe`} label="RPE">
                            <Input
                              id={`${exercise.id}-rpe`}
                              onChange={(event) =>
                                updateExercise(session.id, exercise.id, {
                                  rpe: event.target.value,
                                })
                              }
                              placeholder="Ex.: 8"
                              value={exercise.rpe}
                            />
                          </FormField>
                          <FormField
                            id={`${exercise.id}-intensity-type`}
                            label="Intensidade adicional"
                          >
                            <Select
                              id={`${exercise.id}-intensity-type`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  {
                                    intensityType: event.target
                                      .value as WorkoutExercise["intensityType"],
                                  },
                                )
                              }
                              value={exercise.intensityType}
                            >
                              <option value="">Não utilizada</option>
                              <option value="PERCENT_1RM">% de 1RM</option>
                            </Select>
                          </FormField>
                          <FormField
                            id={`${exercise.id}-intensity-value`}
                            label="Valor da intensidade"
                          >
                            <Input
                              id={`${exercise.id}-intensity-value`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  {
                                    intensityValue: event.target.value,
                                  },
                                )
                              }
                              value={exercise.intensityValue}
                            />
                          </FormField>
                          <FormField
                            id={`${exercise.id}-method`}
                            label="Método"
                          >
                            <Select
                              id={`${exercise.id}-method`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  { methodId: event.target.value },
                                )
                              }
                              value={exercise.methodId}
                            >
                              <option value="">Sem método específico</option>
                              {allMethods.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name || "Método sem nome"}
                                </option>
                              ))}
                            </Select>
                          </FormField>
                          <FormField
                            id={`${exercise.id}-observations`}
                            label="Observação profissional"
                          >
                            <Input
                              id={`${exercise.id}-observations`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  { observations: event.target.value },
                                )
                              }
                              value={exercise.observations}
                            />
                          </FormField>
                          <FormField
                            id={`${exercise.id}-patient-instructions`}
                            label="Instrução específica ao paciente"
                          >
                            <Input
                              id={`${exercise.id}-patient-instructions`}
                              onChange={(event) =>
                                updateExercise(session.id, exercise.id, {
                                  patientInstructions: event.target.value,
                                })
                              }
                              value={exercise.patientInstructions}
                            />
                          </FormField>
                        </div>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                  <FormField
                    id={`${session.id}-observations`}
                    label="Observações do treino"
                  >
                    <Textarea
                      id={`${session.id}-observations`}
                      onChange={(event) =>
                        updateSession(session.id, {
                          observations: event.target.value,
                        })
                      }
                      value={session.observations}
                    />
                  </FormField>
                </section>
                  );
                })
              : null}
          </div>
        </Card>

      <Card className="p-5 md:p-6">
        <SectionHeader
          description="Estrutura pronta para o gerador de PDF. Somente métodos realmente usados são incluídos, sem duplicação."
          title="Como executar os métodos deste treino"
        />
        {glossary.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {glossary.map((method) => (
              <article
                className="rounded-xl border border-[var(--line)] p-4"
                key={method.methodId}
              >
                <h3 className="font-black">{method.name}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {method.studentExplanation}
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Execução: {method.executionInstruction}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  Objetivo: {method.objective}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Nenhum método específico utilizado no treino.
          </p>
        )}
      </Card>
        </div>
        </fieldset>
        {renderPlanActions("bottom")}
      </div>

      <div
        aria-labelledby="workspace-tab-calendar"
        className="scroll-mt-44"
        hidden={activeWorkspaceTab !== "CALENDAR"}
        id="workspace-panel-calendar"
        role="tabpanel"
      >
        <PerformanceCalendar
          masterRecordId={currentView.masterRecordId}
          patientName={currentView.patient.name}
          planOptions={calendarData.planOptions}
          prescribedSessions={calendarData.prescribedSessions}
        />
      </div>

      <div
        aria-labelledby="workspace-tab-executions"
        className="scroll-mt-44"
        hidden={activeWorkspaceTab !== "EXECUTIONS"}
        id="workspace-panel-executions"
        role="tabpanel"
      >
        <PerformanceExecutionsWorkspace
          masterRecordId={currentView.masterRecordId}
          patientName={currentView.patient.name}
        />
      </div>

      {skipDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onKeyDown={handleSkipDialogKeyDown}
        >
          <section
            aria-describedby="skip-performance-description"
            aria-labelledby="skip-performance-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            ref={skipDialogRef}
            role="dialog"
          >
            <h2
              className="text-lg font-black text-slate-950"
              id="skip-performance-title"
            >
              Marcar Performance como não realizada
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-slate-600"
              id="skip-performance-description"
            >
              Esta decisão vale somente para este atendimento. Nenhum plano de
              treino vazio será criado ou finalizado.
            </p>
            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void skipPerformance();
              }}
            >
              {skipRequestError ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900"
                  role="alert"
                >
                  {skipRequestError}
                </div>
              ) : null}
              <FormField
                error={skipReasonError}
                help={
                  skipReasonError
                    ? undefined
                    : `Informe o motivo operacional em até ${SKIP_REASON_MAX_LENGTH} caracteres.`
                }
                id="skip-performance-reason"
                label="Motivo"
                required
              >
                <Textarea
                  aria-invalid={Boolean(skipReasonError)}
                  disabled={skipSubmitting}
                  id="skip-performance-reason"
                  maxLength={SKIP_REASON_MAX_LENGTH}
                  onChange={(event) => {
                    setSkipReason(event.target.value);
                    if (skipReasonError) setSkipReasonError(undefined);
                  }}
                  placeholder="Descreva por que a etapa não foi realizada"
                  required
                  value={skipReason}
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={skipSubmitting}
                  onClick={closeSkipDialog}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={skipSubmitting}
                  loading={skipSubmitting}
                  type="submit"
                  variant="destructive"
                >
                  {skipSubmitting
                    ? "Registrando..."
                    : "Confirmar como não realizada"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {adjustmentOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeAdjustmentDialog();
            }
          }}
        >
          <section
            aria-describedby="adjust-workout-plan-description"
            aria-labelledby="adjust-workout-plan-title"
            aria-modal="true"
            className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl"
            id="adjust-workout-plan-dialog"
            role="dialog"
          >
            <form onSubmit={adjustPlan}>
              <div className="border-b border-[var(--line)] p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                  Plano finalizado
                </p>
                <h2
                  className="mt-1 text-xl font-black text-[var(--text-primary)]"
                  id="adjust-workout-plan-title"
                >
                  Ajustar plano
                </h2>
                <p
                  className="mt-2 text-sm text-[var(--text-secondary)]"
                  id="adjust-workout-plan-description"
                >
                  A última entrega oficial será preservada. As alterações serão
                  feitas no plano atual.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <FormField
                  error={adjustmentError || undefined}
                  id="adjust-workout-plan-reason"
                  label="Motivo do ajuste"
                  required
                >
                  <Textarea
                    aria-describedby={
                      adjustmentError
                        ? "adjust-workout-plan-reason-description"
                        : undefined
                    }
                    aria-invalid={Boolean(adjustmentError)}
                    aria-required="true"
                    className="mt-2"
                    disabled={adjusting}
                    id="adjust-workout-plan-reason"
                    onChange={(event) => {
                      setAdjustmentReason(event.target.value);
                      if (adjustmentError) setAdjustmentError("");
                    }}
                    value={adjustmentReason}
                  />
                </FormField>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] p-5 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  disabled={adjusting}
                  onClick={closeAdjustmentDialog}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button loading={adjusting} type="submit">
                  {adjusting ? "Confirmando..." : "Confirmar ajuste"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

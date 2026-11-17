import type {
  EnduranceIntensityTarget,
  EnduranceSessionBlock,
  EnduranceSessionStage,
  EnduranceStageCompletion,
  RunningEnvironment,
  StructuredEnduranceSession,
} from "./endurance-workout-contracts";
import type {
  WorkoutPlanEnduranceModality,
  WorkoutPlanEnduranceWeek,
  WorkoutWeekday,
} from "./workout-contracts";
import type { RunningPlanningReference } from "./running-planning-references";

export const RUNNING_SESSION_TEMPLATES = [
  ["WALK_RUN", "Caminhada e corrida"],
  ["EASY_RUN", "Rodagem"],
  ["INTERVAL", "Intervalado"],
  ["TEMPO", "Ritmo sustentado"],
  ["PROGRESSIVE", "Progressivo"],
  ["FARTLEK", "Fartlek"],
  ["LONG_RUN", "Longo"],
  ["TEST", "Teste"],
] as const;

export type RunningSessionTemplateId =
  (typeof RUNNING_SESSION_TEMPLATES)[number][0];

const weekdayByUtcDay: readonly WorkoutWeekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function weekdayFromIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? undefined
    : weekdayByUtcDay[date.getUTCDay()];
}

export interface RunningPrescriptionTotals {
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
  readonly completeness: "PRESCRIBED" | "PARTIAL";
  readonly durationCompleteness: "PRESCRIBED" | "PARTIAL";
  readonly distanceCompleteness: "PRESCRIBED" | "PARTIAL";
  readonly recoveryCount: number;
}

export type RunningDistanceUnit = "M" | "KM";

export interface RunningCompletionDraft {
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
}

export function runningCompletionForMode(
  type: EnduranceStageCompletion["type"],
  draft: RunningCompletionDraft,
): EnduranceStageCompletion | undefined {
  if (type === "TIME") {
    return draft.durationSeconds !== undefined && draft.durationSeconds > 0
      ? { type: "TIME", durationSeconds: draft.durationSeconds }
      : undefined;
  }
  if (type === "DISTANCE") {
    return draft.distanceMeters !== undefined && draft.distanceMeters > 0
      ? { type: "DISTANCE", distanceMeters: draft.distanceMeters }
      : undefined;
  }
  return { type: "OPEN_MANUAL" };
}

export function distanceMetersFromDisplay(
  value: number,
  unit: RunningDistanceUnit,
) {
  return unit === "KM" ? value * 1_000 : value;
}

export function distanceDisplayFromMeters(
  distanceMeters: number,
  unit: RunningDistanceUnit,
) {
  return unit === "KM" ? distanceMeters / 1_000 : distanceMeters;
}

const noIntensity: EnduranceIntensityTarget = { type: "NONE" };

function stage(
  name: string,
  type: EnduranceSessionStage["type"],
  order: number,
  id: () => string,
): EnduranceSessionStage {
  return {
    id: id(),
    order,
    name,
    type,
    completion: { type: "OPEN_MANUAL" },
    intensityTarget: noIntensity,
    studentInstruction: "A definir pelo profissional.",
  };
}

function stageBlock(
  name: string,
  type: EnduranceSessionStage["type"],
  order: number,
  id: () => string,
): EnduranceSessionBlock {
  return {
    blockType: "STAGE",
    id: id(),
    order,
    stage: stage(name, type, 1, id),
  };
}

function standardBlocks(id: () => string) {
  return [
    stageBlock("Aquecimento", "WARM_UP", 1, id),
    stageBlock("Trabalho", "WORK", 2, id),
    stageBlock("Recuperação", "RECOVERY", 3, id),
    stageBlock("Volta à calma", "COOL_DOWN", 4, id),
  ] as const;
}

function intervalBlocks(id: () => string) {
  return [
    stageBlock("Aquecimento", "WARM_UP", 1, id),
    {
      blockType: "REPEAT",
      id: id(),
      order: 2,
      repetitions: 1,
      includeRecoveryAfterLast: false,
      stages: [
        stage("Trabalho", "WORK", 1, id),
        stage("Recuperação", "RECOVERY", 2, id),
      ],
    },
    stageBlock("Volta à calma", "COOL_DOWN", 3, id),
  ] as const satisfies readonly EnduranceSessionBlock[];
}

export function createRunningSessionFromTemplate(input: {
  readonly templateId: RunningSessionTemplateId;
  readonly scheduledDate: string;
  readonly weekday: WorkoutWeekday;
  readonly environment: Extract<RunningEnvironment, "ROAD" | "TRACK" | "TREADMILL">;
  readonly id?: () => string;
}): StructuredEnduranceSession & { readonly modality: "RUNNING" } {
  const id = input.id ?? (() => crypto.randomUUID());
  const label = RUNNING_SESSION_TEMPLATES.find(
    ([templateId]) => templateId === input.templateId,
  )?.[1];
  if (!label) throw new Error("RUNNING_TEMPLATE_NOT_FOUND");
  const interval = input.templateId === "INTERVAL" || input.templateId === "FARTLEK";

  return {
    id: id(),
    modality: "RUNNING",
    title: label,
    scheduledDate: input.scheduledDate,
    weekday: input.weekday,
    sessionType: input.templateId,
    objective: "A definir pelo profissional.",
    environment: input.environment,
    primaryUnit: "DISTANCE",
    primaryIntensityMethod: "RPE",
    professionalGuidance: "Revisar a prescrição antes de aplicar.",
    status: "PLANNED",
    sessionKind: "STRUCTURED",
    blocks: interval ? intervalBlocks(id) : standardBlocks(id),
  };
}

function completionValue(completion: EnduranceStageCompletion) {
  if (completion.type === "TIME") {
    return { durationSeconds: completion.durationSeconds };
  }
  if (completion.type === "DISTANCE") {
    return { distanceMeters: completion.distanceMeters };
  }
  return {};
}

function hasPrescribedCompletion(stage: EnduranceSessionStage) {
  return stage.completion.type === "TIME"
    ? stage.completion.durationSeconds > 0
    : stage.completion.type === "DISTANCE" && stage.completion.distanceMeters > 0;
}

export function runningPrescriptionTotals(
  session: StructuredEnduranceSession,
): RunningPrescriptionTotals {
  let durationSeconds = 0;
  let distanceMeters = 0;
  let hasDuration = false;
  let hasDistance = false;
  let durationPartial = false;
  let distancePartial = false;
  let recoveryCount = 0;

  const add = (stage: EnduranceSessionStage, multiplier: number) => {
    const value = completionValue(stage.completion);
    const paceSecondsPerKilometer =
      stage.intensityTarget?.type === "PACE" &&
      stage.intensityTarget.target.valueType === "SINGLE"
        ? stage.intensityTarget.target.value
        : undefined;
    if (value.durationSeconds !== undefined) {
      const roundedDuration = Math.round(value.durationSeconds);
      durationSeconds += roundedDuration * multiplier;
      hasDuration = true;
      if (paceSecondsPerKilometer) {
        distanceMeters +=
          (roundedDuration / paceSecondsPerKilometer) * 1_000 * multiplier;
        hasDistance = true;
      } else {
        distancePartial = true;
      }
    } else if (value.distanceMeters !== undefined) {
      distanceMeters += value.distanceMeters * multiplier;
      hasDistance = true;
      if (paceSecondsPerKilometer) {
        durationSeconds +=
          (value.distanceMeters / 1_000) * paceSecondsPerKilometer * multiplier;
        hasDuration = true;
      } else {
        durationPartial = true;
      }
    } else {
      durationPartial = true;
      distancePartial = true;
    }
  };

  for (const block of session.blocks) {
    if (block.blockType === "STAGE") {
      add(block.stage, 1);
      if (block.stage.type === "RECOVERY" && hasPrescribedCompletion(block.stage)) {
        recoveryCount += 1;
      }
      continue;
    }
    for (const repeatedStage of block.stages) {
      const multiplier = repeatedStage.type === "RECOVERY"
        ? Math.max(
            0,
            block.repetitions - (block.includeRecoveryAfterLast ? 0 : 1),
          )
        : block.repetitions;
      add(repeatedStage, multiplier);
      if (repeatedStage.type === "RECOVERY" && hasPrescribedCompletion(repeatedStage)) {
        recoveryCount += multiplier;
      }
    }
  }

  return {
    durationSeconds: hasDuration ? Math.round(durationSeconds) : undefined,
    distanceMeters: hasDistance ? distanceMeters : undefined,
    completeness:
      durationPartial || distancePartial ? "PARTIAL" : "PRESCRIBED",
    durationCompleteness: durationPartial ? "PARTIAL" : "PRESCRIBED",
    distanceCompleteness: distancePartial ? "PARTIAL" : "PRESCRIBED",
    recoveryCount,
  };
}

export function formatRunningDuration(durationSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  if (!seconds) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}

export function paceSecondsPerKilometerFromSpeed(speedKilometersPerHour: number) {
  return speedKilometersPerHour > 0 ? 3_600 / speedKilometersPerHour : undefined;
}

export function speedKilometersPerHourFromPace(paceSecondsPerKilometer: number) {
  return paceSecondsPerKilometer > 0 ? 3_600 / paceSecondsPerKilometer : undefined;
}

export function runningFrequencyStatus(
  prescribedFrequency: number | undefined,
  programmedSessions: number,
) {
  return {
    programmedSessions,
    prescribedFrequency,
    diverges:
      prescribedFrequency !== undefined &&
      prescribedFrequency !== programmedSessions,
  };
}

export function replaceRunningSessionInWeeks(
  weeks: readonly WorkoutPlanEnduranceWeek<"RUNNING">[],
  session: StructuredEnduranceSession & { readonly modality: "RUNNING" },
) {
  let found = false;
  const updated = weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((current) => {
      if (current.id !== session.id) return current;
      found = true;
      return session;
    }),
  }));
  if (found) return updated;
  const first = updated[0];
  if (!first) throw new Error("RUNNING_WEEK_NOT_FOUND");
  return [
    { ...first, sessions: [...first.sessions, session] },
    ...updated.slice(1),
  ];
}

export function removeRunningSessionFromWeeks(
  weeks: readonly WorkoutPlanEnduranceWeek<"RUNNING">[],
  sessionId: string,
) {
  return weeks.map((week) => ({
    ...week,
    sessions: week.sessions.filter((session) => session.id !== sessionId),
  }));
}

export type RunningProposalApplicationMode = "APPEND" | "REPLACE";
export type RunningProposalScope = "WEEK" | "PERIOD";

export interface RunningPlanningDecisionBasis {
  readonly decision: "OBJECTIVE" | "SESSION_STRUCTURE" | "DURATION" | "INTENSITY" | "RECOVERY";
  readonly label: string;
  readonly source: string;
  readonly origin: string;
  readonly evidence: string;
  readonly influence: string;
  readonly contextualOnly: boolean;
}

/** Editable suggestion kept outside the draft until the professional applies it. */
export interface EditableRunningSessionProposal {
  readonly id: string;
  readonly source: "ASSISTED_SUGGESTION";
  readonly scope: RunningProposalScope;
  readonly period: {
    readonly startDate: string;
    readonly endDate: string;
  };
  readonly strategySnapshot: {
    readonly objective: string;
    readonly weeklyFrequency: number;
  };
  readonly readiness: {
    readonly status: "READY" | "REVIEW_REQUIRED";
    readonly missingInformation: readonly string[];
    readonly reviewConfirmed?: boolean;
  };
  readonly reviewNotes: readonly string[];
  readonly dataUsed?: readonly RunningPlanningReference[];
  readonly decisionBasis?: readonly RunningPlanningDecisionBasis[];
  readonly weeks: readonly WorkoutPlanEnduranceWeek<"RUNNING">[];
}

export function runningProposalPreview(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
  proposal: EditableRunningSessionProposal,
): WorkoutPlanEnduranceModality<"RUNNING"> {
  return {
    ...running,
    weeks: proposal.weeks.map((week) => ({
      ...week,
      sessions: [...week.sessions],
    })),
  };
}

export type RunningPreviewSelection =
  | { readonly source: "EMPTY" }
  | {
      readonly source: "DRAFT" | "PROPOSAL";
      readonly running: WorkoutPlanEnduranceModality<"RUNNING">;
    };

/** Selects the in-memory Corrida snapshot without applying or persisting it. */
export function selectRunningPreview(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
  proposal?: EditableRunningSessionProposal,
): RunningPreviewSelection {
  if (proposal) {
    return {
      source: "PROPOSAL",
      running: runningProposalPreview(running, proposal),
    };
  }
  if (running.weeks.some((week) => week.sessions.length > 0)) {
    return { source: "DRAFT", running };
  }
  return { source: "EMPTY" };
}

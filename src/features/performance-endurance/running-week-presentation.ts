import type {
  EnduranceIntensityTarget,
  EnduranceSessionStage,
  EnduranceZoneCode,
  EnduranceZoneDefinition,
  EnduranceZoneProfile,
  StructuredEnduranceSession,
} from "./endurance-workout-contracts";
import {
  formatRunningDuration,
  runningPrescriptionTotals,
} from "./running-session-editor";
import type {
  WorkoutPlanEnduranceModality,
  WorkoutPlanEnduranceSession,
  WorkoutWeekday,
} from "./workout-contracts";

export const RUNNING_WEEKDAYS: readonly WorkoutWeekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const RUNNING_WEEKDAY_SHORT_LABELS: Readonly<Record<WorkoutWeekday, string>> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

export interface RunningWeekGridCell {
  readonly date: string;
  readonly inCyclePeriod: boolean;
  readonly weekday: WorkoutWeekday;
  readonly sessions: readonly RunningStructuredSession[];
}

type RunningStructuredSession = WorkoutPlanEnduranceSession<"RUNNING"> &
  StructuredEnduranceSession;

export interface RunningWeekGridRow {
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly guidance?: string;
  readonly cells: readonly RunningWeekGridCell[];
}

function isoDateAfterDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayFromDate(value: string): WorkoutWeekday {
  const day = new Date(`${value}T12:00:00.000Z`).getUTCDay();
  return RUNNING_WEEKDAYS[(day + 6) % 7];
}

export function buildRunningWeekGrid(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
): readonly RunningWeekGridRow[] {
  const cycleStartDate = running.configuration.startDate;
  const cycleEndDate = isoDateAfterDays(
    cycleStartDate,
    running.configuration.cycleDurationWeeks * 7 - 1,
  );
  const sessions = running.weeks
    .flatMap((week) => week.sessions)
    .filter(
      (session): session is RunningStructuredSession =>
        session.sessionKind === "STRUCTURED",
    );
  const prescribedDates = sessions.map((session) => session.scheduledDate);
  const presentationStartDate = [cycleStartDate, ...prescribedDates].sort()[0];
  const presentationEndDate = [cycleEndDate, ...prescribedDates].sort().at(-1) as string;
  const calendarStartDate = isoDateAfterDays(
    presentationStartDate,
    -RUNNING_WEEKDAYS.indexOf(weekdayFromDate(presentationStartDate)),
  );
  const calendarEndDate = isoDateAfterDays(
    presentationEndDate,
    6 - RUNNING_WEEKDAYS.indexOf(weekdayFromDate(presentationEndDate)),
  );
  const calendarDayCount =
    Math.round(
      (new Date(`${calendarEndDate}T12:00:00.000Z`).getTime() -
        new Date(`${calendarStartDate}T12:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1;

  return Array.from(
    { length: calendarDayCount / 7 },
    (_, weekIndex): RunningWeekGridRow => {
      const startDate = isoDateAfterDays(calendarStartDate, weekIndex * 7);
      const endDate = isoDateAfterDays(startDate, 6);
      const persistedWeek = running.weeks.find(
        (week) =>
          week.startDate <= endDate && week.endDate >= startDate,
      );
      const dates = Array.from({ length: 7 }, (_, dayIndex) =>
        isoDateAfterDays(startDate, dayIndex),
      );

      return {
        weekNumber: weekIndex + 1,
        startDate,
        endDate,
        guidance: persistedWeek?.weeklyGuidance,
        cells: RUNNING_WEEKDAYS.map((weekday) => {
          const date = dates.find(
            (candidate) => weekdayFromDate(candidate) === weekday,
          ) as string;
          return {
            date,
            inCyclePeriod: date >= cycleStartDate && date <= cycleEndDate,
            weekday,
            sessions: sessions.filter(
              (session) => session.scheduledDate === date,
            ),
          };
        }),
      };
    },
  );
}

function formatDistance(distanceMeters: number) {
  return distanceMeters >= 1_000
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(distanceMeters / 1_000)} km`
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(distanceMeters)} m`;
}

function stageCompletion(stage: EnduranceSessionStage) {
  if (stage.completion.type === "TIME") {
    return formatRunningDuration(stage.completion.durationSeconds);
  }
  if (stage.completion.type === "DISTANCE") {
    return formatDistance(stage.completion.distanceMeters);
  }
  return "a definir";
}

function compactCompletion(stage: EnduranceSessionStage) {
  return stageCompletion(stage).replace(
    / (?=(?:h|min|s|km|m)\b)/gu,
    "\u00a0",
  );
}

function compactStageLabel(stage: EnduranceSessionStage) {
  if (stage.type === "WARM_UP") return "Aquec.";
  if (stage.type === "PREPARATION") return "Prep.";
  if (stage.type === "WORK") return "Trabalho";
  if (stage.type === "RECOVERY") return "Recup.";
  if (stage.type === "COOL_DOWN") return "Final";
  return stage.name;
}

export function runningBlockSequenceLines(
  session: StructuredEnduranceSession,
): readonly string[] {
  return session.blocks.flatMap((block) => {
    if (block.blockType === "STAGE") {
      return [`${compactStageLabel(block.stage)}: ${compactCompletion(block.stage)}`];
    }
    const recoveryCount = Math.max(
      0,
      block.repetitions - (block.includeRecoveryAfterLast ? 0 : 1),
    );
    return block.stages.map((stage) => {
      if (stage.type === "WORK") {
        return `Tiros: ${block.repetitions} × ${compactCompletion(stage)}`;
      }
      if (stage.type === "RECOVERY") {
        return `Recup.: ${recoveryCount} × ${compactCompletion(stage)}${
          block.includeRecoveryAfterLast ? " · inclui recuperação final" : ""
        }`;
      }
      return `${compactStageLabel(stage)}: ${block.repetitions} × ${compactCompletion(stage)}`;
    });
  });
}

function compactTotalValue(value: string) {
  return value.replace(/ (?=(?:h|min|s|km|m)\b)/gu, "\u00a0");
}

export function runningSessionGridTotalLines(
  session: StructuredEnduranceSession,
): readonly string[] {
  const totals = runningPrescriptionTotals(session);
  const duration = totals.durationSeconds === undefined
    ? undefined
    : compactTotalValue(formatRunningDuration(totals.durationSeconds));
  const distance = totals.distanceMeters === undefined
    ? undefined
    : compactTotalValue(formatDistance(totals.distanceMeters));

  if (
    duration &&
    distance &&
    totals.durationCompleteness === "PRESCRIBED" &&
    totals.distanceCompleteness === "PRESCRIBED"
  ) {
    return [`Total: ${duration} · ${distance}`];
  }
  if (duration && !distance && totals.durationCompleteness === "PRESCRIBED") {
    return [`Total: ${duration}`];
  }
  if (distance && !duration && totals.distanceCompleteness === "PRESCRIBED") {
    return [`Total: ${distance}`];
  }

  const lines: string[] = [];
  if (duration) {
    lines.push(`${totals.durationCompleteness === "PARTIAL" ? "Tempo parc." : "Tempo"}: ${duration}`);
  } else if (totals.durationCompleteness === "PARTIAL") {
    lines.push("Tempo parc.: sem ritmo/velocidade");
  }
  if (distance) {
    lines.push(`${totals.distanceCompleteness === "PARTIAL" ? "Dist. parc." : "Dist."}: ${distance}`);
  }
  return lines.length ? lines : ["Total: a definir"];
}

export function runningBlockSequence(session: StructuredEnduranceSession) {
  return session.blocks
    .map((block) => {
      if (block.blockType === "STAGE") {
        return `${block.stage.name} · ${stageCompletion(block.stage)}`;
      }
      const work = block.stages.find((stage) => stage.type === "WORK");
      const recovery = block.stages.find((stage) => stage.type === "RECOVERY");
      const workLabel = work
        ? `${block.repetitions} tiros de ${stageCompletion(work)}`
        : `${block.repetitions} repetições`;
      if (!recovery) return workLabel;
      const recoveryCount = Math.max(
        0,
        block.repetitions - (block.includeRecoveryAfterLast ? 0 : 1),
      );
      return `${workLabel} · ${recoveryCount} recuperações de ${stageCompletion(recovery)}, ${
        block.includeRecoveryAfterLast
          ? "inclusive após o último tiro"
          : "somente entre tiros"
      }`;
    })
    .join(" → ");
}

function numericRange(target: EnduranceIntensityTarget) {
  if (!("target" in target)) return undefined;
  return target.target.valueType === "SINGLE"
    ? [target.target.value, target.target.value] as const
    : [target.target.minimum, target.target.maximum] as const;
}

function paceLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function intensityTargetLabel(target: EnduranceIntensityTarget) {
  if (target.type === "FREE_GUIDANCE") return "Esforço por orientação";
  if (target.type === "NONE") return undefined;
  const range = numericRange(target);
  if (!range) return undefined;
  const [minimum, maximum] = range;
  const value = minimum === maximum ? `${minimum}` : `${minimum}–${maximum}`;
  if (target.type === "RPE") return `RPE ${value}`;
  if (target.type === "HEART_RATE") return `${value} bpm`;
  if (target.type === "POWER") return `${value} W`;
  if (target.type === "CADENCE") return `${value} passos/min`;
  if (target.type === "PACE") {
    const pace = minimum === maximum
      ? paceLabel(minimum)
      : `${paceLabel(minimum)}–${paceLabel(maximum)}`;
    return `${pace} min/km`;
  }
  return undefined;
}

function zoneRange(
  zone: EnduranceZoneDefinition,
  type: EnduranceIntensityTarget["type"],
) {
  if (type === "RPE") return [zone.minimumRpe, zone.maximumRpe] as const;
  if (type === "HEART_RATE") {
    return [zone.minimumHeartRateBpm, zone.maximumHeartRateBpm] as const;
  }
  if (type === "PACE") {
    return [
      zone.minimumPaceSecondsPerKilometer,
      zone.maximumPaceSecondsPerKilometer,
    ] as const;
  }
  if (type === "POWER") {
    return [zone.minimumPowerWatts, zone.maximumPowerWatts] as const;
  }
  return [undefined, undefined] as const;
}

function matchingZone(
  target: EnduranceIntensityTarget,
  profile: EnduranceZoneProfile | undefined,
) {
  const targetRange = numericRange(target);
  if (!profile || !targetRange) return undefined;
  return (Object.entries(profile.zones) as Array<[
    EnduranceZoneCode,
    EnduranceZoneDefinition,
  ]>).find(([, zone]) => {
    const [minimum, maximum] = zoneRange(zone, target.type);
    return (
      minimum !== undefined &&
      maximum !== undefined &&
      targetRange[0] >= minimum &&
      targetRange[1] <= maximum
    );
  });
}

export interface RunningIntensityPresentation {
  readonly label: string;
  readonly guidance?: string;
  readonly zone?: EnduranceZoneCode;
  readonly tone: "NEUTRAL" | "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
}

export function runningIntensityPresentation(
  session: StructuredEnduranceSession,
  profile?: EnduranceZoneProfile,
  options?: { readonly preserveLegacyQualitativePresentation?: boolean },
): RunningIntensityPresentation {
  const targets = session.blocks.flatMap((block) =>
    (block.blockType === "STAGE" ? [block.stage] : block.stages)
      .filter((stage) => stage.type === "WORK")
      .flatMap((stage) => stage.intensityTarget ? [stage.intensityTarget] : []),
  );
  const target = targets.find((candidate) => intensityTargetLabel(candidate));
  if (!target) {
    return { label: "Intensidade a definir", tone: "NEUTRAL" };
  }
  if (
    target.type === "FREE_GUIDANCE" &&
    options?.preserveLegacyQualitativePresentation
  ) {
    return { label: "Intensidade a definir", tone: "NEUTRAL" };
  }
  const label = intensityTargetLabel(target) as string;
  if (target.type === "FREE_GUIDANCE") {
    return {
      label,
      guidance: target.guidance,
      tone: "NEUTRAL",
    };
  }
  const matched = matchingZone(target, profile);
  if (!matched) return { label, tone: "NEUTRAL" };
  const [zoneCode, zone] = matched;
  return {
    label: `${zoneCode}${zone.name ? ` · ${zone.name}` : ""} · ${label}`,
    zone: zoneCode,
    tone: zoneCode,
  };
}

export function runningSessionTotalLabel(session: StructuredEnduranceSession) {
  const totals = runningPrescriptionTotals(session);
  const parts: string[] = [];
  if (totals.durationSeconds !== undefined) {
    parts.push(
      `${totals.durationCompleteness === "PARTIAL" ? "Tempo parcial" : "Tempo"}: ${formatRunningDuration(totals.durationSeconds)}`,
    );
  } else if (totals.durationCompleteness === "PARTIAL") {
    parts.push("Tempo parcial: sem ritmo/velocidade");
  }
  if (totals.distanceMeters !== undefined) {
    parts.push(
      `${totals.distanceCompleteness === "PARTIAL" ? "Distância parcial" : "Distância"}: ${formatDistance(totals.distanceMeters)}`,
    );
  }
  return parts.join(" · ") || "Total a definir";
}

"use client";

import { useEffect, useRef, useState } from "react";

import { AutoGrowTextarea, Badge, Button, Card, FormField, Input, NumberInput, Select } from "@/components/ui";
import { RunningWeekGrid } from "@/components/performance-endurance/running-week-grid";
import type {
  EnduranceIntensityTarget,
  EnduranceSessionBlock,
  EnduranceSessionStage,
  StructuredEnduranceSession,
} from "@/features/performance-endurance/endurance-workout-contracts";
import {
  RUNNING_SESSION_TEMPLATES,
  createRunningSessionFromTemplate,
  distanceDisplayFromMeters,
  distanceMetersFromDisplay,
  formatRunningDuration,
  paceSecondsPerKilometerFromSpeed,
  removeRunningSessionFromWeeks,
  replaceRunningSessionInWeeks,
  runningCompletionForMode,
  runningFrequencyStatus,
  runningPrescriptionTotals,
  speedKilometersPerHourFromPace,
  weekdayFromIsoDate,
  type RunningDistanceUnit,
  type RunningSessionTemplateId,
} from "@/features/performance-endurance/running-session-editor";
import type {
  WorkoutPlanEnduranceModality,
  WorkoutWeekday,
} from "@/features/performance-endurance/workout-contracts";

const weekdays: readonly [WorkoutWeekday, string][] = [
  ["MONDAY", "Segunda-feira"],
  ["TUESDAY", "Terça-feira"],
  ["WEDNESDAY", "Quarta-feira"],
  ["THURSDAY", "Quinta-feira"],
  ["FRIDAY", "Sexta-feira"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"],
];

const environmentLabels = {
  ROAD: "Rua",
  TRACK: "Pista",
  TREADMILL: "Esteira",
} as const;

type RunningSession = StructuredEnduranceSession & { readonly modality: "RUNNING" };
type IntensityMode = "NONE" | "RPE" | "PACE" | "SPEED" | "HEART_RATE";

interface ManualSessionFormElement {
  open: boolean;
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
  querySelector: (selectors: string) => Element | null;
}

export function revealRunningManualSessionForm(
  form: ManualSessionFormElement,
) {
  form.open = true;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  const firstEditable = form.querySelector(
    "select:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
  );
  if (firstEditable && "focus" in firstEditable && typeof firstEditable.focus === "function") {
    (firstEditable as HTMLElement).focus({ preventScroll: true });
  }
}

function dateAfterDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function formatDistance(meters: number) {
  return meters >= 1_000
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(meters / 1_000)} km`
    : `${meters} m`;
}

function workStage(session: RunningSession) {
  return session.blocks.flatMap((block) =>
    block.blockType === "STAGE" ? [block.stage] : block.stages,
  ).find((stage) => stage.type === "WORK");
}

function qualitativeWorkGuidance(session: RunningSession) {
  const target = workStage(session)?.intensityTarget;
  return target?.type === "FREE_GUIDANCE" ? target.guidance : undefined;
}

function targetIntensityMode(
  target: EnduranceIntensityTarget | undefined,
): IntensityMode {
  if (target?.type === "RPE") return "RPE";
  if (target?.type === "HEART_RATE") return "HEART_RATE";
  if (target?.type === "PACE") {
    return target.preferredDisplay === "SPEED" ? "SPEED" : "PACE";
  }
  return "NONE";
}

function intensityMode(session: RunningSession): IntensityMode {
  if (session.primaryIntensityMethod === "SPEED") return "SPEED";
  if (
    session.primaryIntensityMethod === "RPE" ||
    session.primaryIntensityMethod === "PACE" ||
    session.primaryIntensityMethod === "HEART_RATE"
  ) {
    return session.primaryIntensityMethod;
  }
  return "NONE";
}

function singleTargetValue(target: EnduranceIntensityTarget | undefined) {
  return target && "target" in target && target.target.valueType === "SINGLE"
    ? target.target.value
    : undefined;
}

function displayedTargetValue(
  target: EnduranceIntensityTarget | undefined,
  mode: IntensityMode,
) {
  const value = singleTargetValue(target);
  if (value === undefined) return "";
  if (mode === "SPEED" && target?.type === "PACE") {
    const speed = speedKilometersPerHourFromPace(value);
    return speed ? speed.toFixed(1).replace(".", ",") : "";
  }
  if (mode === "PACE" && target?.type === "PACE") {
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(Math.round(value % 60)).padStart(2, "0")}`;
  }
  return String(value);
}

function displayedIntensityValue(session: RunningSession) {
  return displayedTargetValue(
    workStage(session)?.intensityTarget,
    intensityMode(session),
  );
}

function mapStages(
  session: RunningSession,
  transform: (stage: EnduranceSessionStage) => EnduranceSessionStage,
): RunningSession {
  return {
    ...session,
    blocks: session.blocks.map((block) =>
      block.blockType === "STAGE"
        ? { ...block, stage: transform(block.stage) }
        : { ...block, stages: block.stages.map(transform) },
    ),
  };
}

function intensityTargetFromInput(
  mode: IntensityMode,
  rawValue: string,
) {
  const normalized = rawValue.replace(",", ".").trim();
  let target: EnduranceIntensityTarget = { type: "NONE" };
  if (mode === "RPE") {
    const value = Number(normalized);
    if (Number.isFinite(value) && value >= 0 && value <= 10) {
      target = { type: "RPE", unit: "RPE", target: { valueType: "SINGLE", value } };
    }
  } else if (mode === "HEART_RATE") {
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) {
      target = { type: "HEART_RATE", unit: "BEATS_PER_MINUTE", target: { valueType: "SINGLE", value } };
    }
  } else if (mode === "PACE") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
    const value = match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
    if (value && Number(match?.[2]) < 60) {
      target = { type: "PACE", unit: "SECONDS_PER_KILOMETER", preferredDisplay: "PACE", target: { valueType: "SINGLE", value } };
    }
  } else if (mode === "SPEED") {
    const pace = paceSecondsPerKilometerFromSpeed(Number(normalized));
    if (pace) {
      target = { type: "PACE", unit: "SECONDS_PER_KILOMETER", preferredDisplay: "SPEED", target: { valueType: "SINGLE", value: pace } };
    }
  }
  return target;
}

function setMainIntensity(
  session: RunningSession,
  mode: IntensityMode,
  rawValue: string,
) {
  const target = intensityTargetFromInput(mode, rawValue);
  return mapStages(
    { ...session, primaryIntensityMethod: mode },
    (stage) => stage.type === "WORK" ? { ...stage, intensityTarget: target } : stage,
  );
}

function changeStageIntensityMode(
  target: EnduranceIntensityTarget | undefined,
  mode: IntensityMode,
): EnduranceIntensityTarget {
  if (
    (mode === "PACE" || mode === "SPEED") &&
    target?.type === "PACE"
  ) {
    return { ...target, preferredDisplay: mode };
  }
  return { type: "NONE" };
}

function changeIntensityMode(session: RunningSession, mode: IntensityMode) {
  const currentTarget = workStage(session)?.intensityTarget;
  if (
    (mode === "PACE" || mode === "SPEED") &&
    currentTarget?.type === "PACE"
  ) {
    return mapStages(
      { ...session, primaryIntensityMethod: mode },
      (stage) =>
        stage.type === "WORK"
          ? {
              ...stage,
              intensityTarget: {
                ...currentTarget,
                preferredDisplay: mode,
              },
            }
          : stage,
    );
  }
  return setMainIntensity(session, mode, "");
}

function updateStage(
  session: RunningSession,
  stageId: string,
  change: Partial<EnduranceSessionStage>,
) {
  return mapStages(session, (stage) =>
    stage.id === stageId ? { ...stage, ...change } : stage,
  );
}

function updateBlock(
  session: RunningSession,
  blockId: string,
  change: Partial<EnduranceSessionBlock>,
): RunningSession {
  return {
    ...session,
    blocks: session.blocks.map((block) =>
      block.id === blockId ? { ...block, ...change } as EnduranceSessionBlock : block,
    ),
  };
}

function StageEditor({
  stage,
  disabled,
  onChange,
}: {
  readonly stage: EnduranceSessionStage;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<EnduranceSessionStage>) => void;
}) {
  const [selectedCompletionType, setSelectedCompletionType] = useState(
    stage.completion.type,
  );
  const [timeDraftSeconds, setTimeDraftSeconds] = useState<number | undefined>(
    stage.completion.type === "TIME"
      ? stage.completion.durationSeconds
      : undefined,
  );
  const [distanceDraftMeters, setDistanceDraftMeters] = useState<
    number | undefined
  >(
    stage.completion.type === "DISTANCE"
      ? stage.completion.distanceMeters
      : undefined,
  );
  const [distanceUnit, setDistanceUnit] =
    useState<RunningDistanceUnit>("M");
  const [intensityModeOverride, setIntensityModeOverride] =
    useState<IntensityMode>();
  const selectedIntensityMode =
    intensityModeOverride ?? targetIntensityMode(stage.intensityTarget);

  function selectCompletionType(type: EnduranceSessionStage["completion"]["type"]) {
    setSelectedCompletionType(type);
    const completion = runningCompletionForMode(type, {
      durationSeconds: timeDraftSeconds,
      distanceMeters: distanceDraftMeters,
    });
    if (completion) onChange({ completion });
  }

  function saveTime(durationSeconds: number | undefined) {
    setTimeDraftSeconds(durationSeconds);
    if (durationSeconds !== undefined && durationSeconds > 0) {
      onChange({ completion: { type: "TIME", durationSeconds } });
    }
  }

  function saveDistance(distanceMeters: number | undefined) {
    setDistanceDraftMeters(distanceMeters);
    if (distanceMeters !== undefined && distanceMeters > 0) {
      onChange({ completion: { type: "DISTANCE", distanceMeters } });
    }
  }

  return (
    <div className="grid min-w-0 gap-3 border-l-2 border-slate-300 py-3 pl-3 lg:grid-cols-2 2xl:grid-cols-5">
      <FormField className="min-w-0 lg:col-span-2 2xl:col-span-1" help="Decisão profissional. Descreva em linguagem direta o que o aluno fará neste bloco." id={`${stage.id}-instruction`} label={`${stage.name} · instrução`}>
        <AutoGrowTextarea aria-describedby={`${stage.id}-instruction-description`} disabled={disabled} id={`${stage.id}-instruction`} onChange={(event) => onChange({ studentInstruction: event.target.value })} rows={3} value={stage.studentInstruction} />
      </FormField>
      <FormField help="Escolha como o bloco termina. Comando manual não define tempo nem distância: o encerramento é feito manualmente e o bloco não entra nesses totais enquanto permanecer aberto." id={`${stage.id}-completion`} label="Como o bloco termina">
        <Select
          aria-describedby={`${stage.id}-completion-description`}
          disabled={disabled}
          id={`${stage.id}-completion`}
          onChange={(event) => {
            selectCompletionType(
              event.target.value as EnduranceSessionStage["completion"]["type"],
            );
          }}
          value={selectedCompletionType}
        >
          <option value="OPEN_MANUAL">Comando manual · sem tempo ou distância</option>
          <option value="TIME">Após um tempo definido</option>
          <option value="DISTANCE">Após uma distância definida</option>
        </Select>
      </FormField>
      {selectedCompletionType === "TIME" ? (
        <FormField help="Informe minutos e segundos. O total precisa ser maior que zero; se não estiver definido, deixe os campos vazios." id={`${stage.id}-completion-minutes`} label="Duração do bloco">
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                aria-describedby={`${stage.id}-completion-minutes-description`}
                aria-label={`${stage.name}: minutos`}
                disabled={disabled}
                id={`${stage.id}-completion-minutes`}
                min={0}
                onChange={(event) => {
                  if (!event.target.value) {
                    saveTime(undefined);
                    return;
                  }
                  const minutes = Number(event.target.value);
                  if (!Number.isInteger(minutes) || minutes < 0) return;
                  const seconds = Math.round(timeDraftSeconds ?? 0) % 60;
                  if (minutes * 60 + seconds <= 0) return;
                  saveTime(minutes * 60 + seconds);
                }}
                step={1}
                value={timeDraftSeconds === undefined ? "" : Math.floor(Math.round(timeDraftSeconds) / 60)}
              />
              <NumberInput
                aria-describedby={`${stage.id}-completion-minutes-description`}
                aria-label={`${stage.name}: segundos`}
                disabled={disabled}
                id={`${stage.id}-completion-seconds`}
                max={59}
                min={0}
                onChange={(event) => {
                  if (!event.target.value) {
                    saveTime(undefined);
                    return;
                  }
                  const seconds = Number(event.target.value);
                  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return;
                  const minutes = Math.floor(Math.round(timeDraftSeconds ?? 0) / 60);
                  if (minutes * 60 + seconds <= 0) return;
                  saveTime(minutes * 60 + seconds);
                }}
                step={1}
                value={timeDraftSeconds === undefined ? "" : Math.round(timeDraftSeconds) % 60}
              />
            </div>
            <p className="text-xs text-slate-600">
              {timeDraftSeconds === undefined
                ? "Informe minutos e segundos para concluir a troca."
                : formatRunningDuration(timeDraftSeconds)}
            </p>
          </div>
        </FormField>
      ) : selectedCompletionType === "DISTANCE" ? (
        <FormField help="Informe um valor maior que zero e escolha metros (m) ou quilômetros (km)." id={`${stage.id}-completion-distance`} label="Distância do bloco">
          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
              <NumberInput
                aria-describedby={`${stage.id}-completion-distance-description`}
                aria-label={`${stage.name}: distância`}
                disabled={disabled}
                id={`${stage.id}-completion-distance`}
                min={0}
                onChange={(event) => {
                  if (!event.target.value) {
                    saveDistance(undefined);
                    return;
                  }
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value) || value <= 0) return;
                  saveDistance(distanceMetersFromDisplay(value, distanceUnit));
                }}
                step={distanceUnit === "KM" ? 0.01 : 1}
                value={
                  distanceDraftMeters === undefined
                    ? ""
                    : distanceDisplayFromMeters(distanceDraftMeters, distanceUnit)
                }
              />
              <Select
                aria-describedby={`${stage.id}-completion-distance-description`}
                aria-label={`${stage.name}: unidade da distância`}
                disabled={disabled}
                id={`${stage.id}-completion-distance-unit`}
                onChange={(event) =>
                  setDistanceUnit(event.target.value as RunningDistanceUnit)
                }
                value={distanceUnit}
              >
                <option value="M">m</option>
                <option value="KM">km</option>
              </Select>
            </div>
            <p className="text-xs text-slate-600">
              {distanceDraftMeters === undefined
                ? "Informe a distância em m ou km para concluir a troca; o valor anterior continua preservado."
                : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(distanceDraftMeters)} m na prescrição`}
            </p>
          </div>
        </FormField>
      ) : <div />}
      {stage.intensityTarget?.type === "FREE_GUIDANCE" ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p className="font-black">Esforço por orientação</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{stage.intensityTarget.guidance}</p>
        </div>
      ) : null}
      <FormField help="Opcional. Escolha como controlar o esforço deste bloco. Sem orientação nem alvo estruturado, mantenha a intensidade a definir." id={`${stage.id}-intensity-mode`} label="Como controlar a intensidade">
        <Select
          aria-describedby={`${stage.id}-intensity-mode-description`}
          aria-label={`${stage.name}: escala de intensidade`}
          disabled={disabled}
          id={`${stage.id}-intensity-mode`}
          onChange={(event) => {
            const mode = event.target.value as IntensityMode;
            setIntensityModeOverride(mode);
            onChange({
              intensityTarget: changeStageIntensityMode(
                stage.intensityTarget,
                mode,
              ),
            });
          }}
          value={selectedIntensityMode}
        >
          <option value="NONE">{stage.intensityTarget?.type === "FREE_GUIDANCE" ? "Esforço por orientação · texto preservado" : "Intensidade a definir"}</option>
          <option value="RPE">Percepção de esforço · RPE (0–10)</option>
          <option value="PACE">Ritmo (min/km)</option>
          <option value="SPEED">Velocidade (km/h)</option>
          <option value="HEART_RATE">Frequência cardíaca (bpm)</option>
        </Select>
      </FormField>
      {selectedIntensityMode !== "NONE" ? (
        <FormField
          help={
            selectedIntensityMode === "PACE"
              ? "Informe minutos e segundos por quilômetro. Exemplo: 05:30."
              : selectedIntensityMode === "SPEED"
                ? "Informe quilômetros por hora. Exemplo: 10,5."
                : selectedIntensityMode === "HEART_RATE"
                  ? "Informe batimentos por minuto somente quando houver valor conhecido."
                  : "Informe a percepção de esforço de 0 a 10."
          }
          id={`${stage.id}-intensity-value`}
          label={
            selectedIntensityMode === "PACE"
              ? "Meta (mm:ss min/km)"
              : selectedIntensityMode === "SPEED"
                ? "Meta (km/h)"
                : selectedIntensityMode === "HEART_RATE"
                  ? "Meta (bpm)"
                  : "Meta RPE (0–10)"
          }
        >
          <Input
            aria-describedby={`${stage.id}-intensity-value-description`}
            aria-label={`${stage.name}: valor da intensidade`}
            defaultValue={displayedTargetValue(
              stage.intensityTarget,
              selectedIntensityMode,
            )}
            disabled={disabled}
            id={`${stage.id}-intensity-value`}
            key={`${stage.id}-${selectedIntensityMode}-${displayedTargetValue(stage.intensityTarget, selectedIntensityMode)}`}
            onBlur={(event) =>
              onChange({
                intensityTarget: intensityTargetFromInput(
                  selectedIntensityMode,
                  event.target.value,
                ),
              })
            }
            placeholder={
              selectedIntensityMode === "PACE" ? "Exemplo: 05:30" : undefined
            }
          />
        </FormField>
      ) : (
        <div />
      )}
    </div>
  );
}

export function RunningSessionEditor({
  value,
  runningWeeklyFrequency,
  disabled,
  onChange,
  manualFormOpenRequest = 0,
}: {
  readonly value: WorkoutPlanEnduranceModality<"RUNNING">;
  readonly runningWeeklyFrequency?: number;
  readonly disabled: boolean;
  readonly onChange: (value: WorkoutPlanEnduranceModality<"RUNNING">) => void;
  readonly manualFormOpenRequest?: number;
}) {
  const manualFormRef = useRef<HTMLDetailsElement>(null);
  const sessions = value.weeks.flatMap((week) => week.sessions).filter(
    (session): session is RunningSession => session.sessionKind === "STRUCTURED",
  );
  const [activeId, setActiveId] = useState<string | undefined>(sessions[0]?.id);
  const [templateId, setTemplateId] = useState<RunningSessionTemplateId>("WALK_RUN");
  const [scheduledDate, setScheduledDate] = useState(value.configuration.startDate);
  const [weekday, setWeekday] = useState<WorkoutWeekday>(
    weekdayFromIsoDate(value.configuration.startDate) ??
      value.configuration.availableWeekdays[0] ??
      "MONDAY",
  );
  const [environment, setEnvironment] = useState<"ROAD" | "TRACK" | "TREADMILL">(
    value.configuration.environment === "TRACK" || value.configuration.environment === "TREADMILL"
      ? value.configuration.environment
      : "ROAD",
  );
  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const baseFrequency = runningFrequencyStatus(runningWeeklyFrequency, sessions.length);
  const frequency = {
    ...baseFrequency,
    diverges: value.weeks.length <= 1
      ? baseFrequency.diverges
      : runningWeeklyFrequency !== undefined && value.weeks.some(
          (week) => week.sessions.filter((session) => session.sessionKind === "STRUCTURED").length > runningWeeklyFrequency,
        ),
  };
  const totals = active ? runningPrescriptionTotals(active) : undefined;

  useEffect(() => {
    if (manualFormOpenRequest < 1 || !manualFormRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (manualFormRef.current) {
        revealRunningManualSessionForm(manualFormRef.current);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [manualFormOpenRequest]);

  function saveSession(session: RunningSession) {
    onChange({ ...value, weeks: replaceRunningSessionInWeeks(value.weeks, session) });
    setActiveId(session.id);
  }

  function createSession(blank: boolean) {
    const session = createRunningSessionFromTemplate({ templateId, scheduledDate, weekday, environment });
    saveSession(blank ? { ...session, title: "Nova sessão", sessionType: "CUSTOM" } : session);
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Corrida · semana</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Editor de sessões</h2>
          <p className="mt-1 text-sm text-slate-600"><strong>Decisão profissional.</strong> O que for confirmado aqui alimenta o calendário e a ficha impressa.</p>
        </div>
        <div className={`min-w-0 max-w-full break-words rounded-xl border px-3 py-2 text-sm font-bold ${frequency.diverges ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} role="status">
          {frequency.programmedSessions} sessão(ões) programada(s){value.weeks.length > 1 ? " no período" : ""}
          {frequency.prescribedFrequency !== undefined ? ` · Corridas por semana: ${frequency.prescribedFrequency}` : " · Corridas por semana não informado em Planejamento → Corrida"}
          {frequency.diverges ? " · revisar divergência" : ""}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-900">Entenda tempo, distância e intensidade</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li><strong>Comando manual:</strong> o bloco fica sem tempo ou distância de encerramento. Ele não contribui para esses totais até receber um critério numérico.</li>
          <li><strong>RPE:</strong> percepção de esforço de 0 a 10.</li>
          <li><strong>Ritmo:</strong> minutos e segundos para percorrer 1 km. <strong>Velocidade:</strong> quilômetros percorridos por hora.</li>
          <li><strong>Frequência cardíaca:</strong> batimentos por minuto; informe somente quando houver valor conhecido para a decisão.</li>
        </ul>
      </details>

      <div className="mt-5">
        <RunningWeekGrid
          activeSessionId={active?.id}
          onSelectSession={setActiveId}
          running={value}
        />
      </div>

      <details className="mt-5 scroll-mt-44 border-t border-slate-200 pt-3" ref={manualFormRef}>
        <summary className="cursor-pointer text-sm font-black text-sky-800">
          Adicionar sessão manual
        </summary>
      <div className="mt-3 bg-slate-50 p-3">
        <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <Button disabled={disabled || !scheduledDate} onClick={() => createSession(false)} size="small" type="button">Adicionar com modelo</Button>
          <Button disabled={disabled || !scheduledDate} onClick={() => createSession(true)} size="small" type="button" variant="outline">Adicionar do zero</Button>
          <Button onClick={() => {
            if (!manualFormRef.current) return;
            manualFormRef.current.open = false;
            manualFormRef.current.querySelector<HTMLElement>("summary")?.focus();
          }} size="small" type="button" variant="ghost">Cancelar</Button>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FormField help="Opcional como ponto de partida. Escolher um modelo não adiciona a sessão; confirme em uma das ações acima." id="running-template" label="Estrutura inicial da sessão">
          <Select aria-describedby="running-template-description" disabled={disabled} id="running-template" onChange={(event) => setTemplateId(event.target.value as RunningSessionTemplateId)} value={templateId}>
            {RUNNING_SESSION_TEMPLATES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </FormField>
        <FormField help="Obrigatória para adicionar. Define em qual semana e dia a sessão entrará." id="running-date" label="Data da sessão">
          <Input aria-describedby="running-date-description" disabled={disabled} id="running-date" onChange={(event) => {
            const nextDate = event.target.value;
            setScheduledDate(nextDate);
            const derivedWeekday = weekdayFromIsoDate(nextDate);
            if (derivedWeekday) setWeekday(derivedWeekday);
          }} type="date" value={scheduledDate} />
        </FormField>
        <FormField help="Derivado automaticamente quando uma data é informada." id="running-weekday" label="Dia da semana">
          <Select aria-describedby="running-weekday-description" disabled={disabled || Boolean(scheduledDate)} id="running-weekday" onChange={(event) => setWeekday(event.target.value as WorkoutWeekday)} value={weekday}>
            {weekdays.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </FormField>
        <FormField help="Local previsto para esta sessão. Pode diferir do ambiente principal do ciclo." id="running-environment" label="Local da sessão">
          <Select aria-describedby="running-environment-description" disabled={disabled} id="running-environment" onChange={(event) => setEnvironment(event.target.value as typeof environment)} value={environment}>
            {Object.entries(environmentLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </FormField>
        </div>
      </div>
      </details>

      {!sessions.length ? <p className="mt-5 border border-dashed border-slate-300 p-4 text-sm text-slate-600">Monte a primeira sessão do zero ou escolha um modelo. As semanas futuras permanecem apenas como “A planejar”.</p> : null}

      {active ? (
        <section className="mt-5 space-y-4 border-t-2 border-sky-700 pt-4" aria-label={`Editar ${active.title}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700">Sessão selecionada</p>
              <h3 className="break-words text-lg font-black text-slate-950">{active.title}</h3>
            </div>
            <Button disabled={disabled} onClick={() => {
              onChange({ ...value, weeks: removeRunningSessionFromWeeks(value.weeks, active.id) });
              setActiveId(sessions.find((session) => session.id !== active.id)?.id);
            }} type="button" variant="ghost">Excluir sessão</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField help="Nome que identifica a sessão no calendário e na ficha." id={`${active.id}-title`} label="Nome da sessão">
              <Input aria-describedby={`${active.id}-title-description`} disabled={disabled} id={`${active.id}-title`} onChange={(event) => saveSession({ ...active, title: event.target.value })} value={active.title} />
            </FormField>
            <FormField help="Data prescrita. Alterá-la move a sessão para a semana correspondente." id={`${active.id}-date`} label="Data da sessão">
              <Input aria-describedby={`${active.id}-date-description`} disabled={disabled} id={`${active.id}-date`} onChange={(event) => {
                const scheduledDate = event.target.value;
                saveSession({
                  ...active,
                  scheduledDate,
                  weekday: weekdayFromIsoDate(scheduledDate),
                });
              }} type="date" value={active.scheduledDate} />
            </FormField>
            <FormField help="Derivado da data quando ela estiver preenchida." id={`${active.id}-weekday`} label="Dia da semana">
              <Select aria-describedby={`${active.id}-weekday-description`} disabled={disabled || Boolean(active.scheduledDate)} id={`${active.id}-weekday`} onChange={(event) => saveSession({ ...active, weekday: event.target.value as WorkoutWeekday })} value={weekdayFromIsoDate(active.scheduledDate) ?? active.weekday ?? "MONDAY"}>
                {weekdays.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            </FormField>
          </div>

          <details className="border-y border-slate-200 py-3">
            <summary className="cursor-pointer text-sm font-black text-slate-800">Parâmetros avançados</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FormField className="lg:col-span-2" help="Finalidade específica do treino prescrito, separada da meta futura do ciclo." id={`${active.id}-objective`} label="Finalidade da sessão">
              <Input aria-describedby={`${active.id}-objective-description`} disabled={disabled} id={`${active.id}-objective`} onChange={(event) => saveSession({ ...active, objective: event.target.value })} value={active.objective} />
            </FormField>
            <FormField help="Local previsto para executar esta sessão." id={`${active.id}-environment`} label="Local da sessão">
              <Select aria-describedby={`${active.id}-environment-description`} disabled={disabled} id={`${active.id}-environment`} onChange={(event) => saveSession({ ...active, environment: event.target.value as RunningSession["environment"] })} value={active.environment}>
                {Object.entries(environmentLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            </FormField>
            <FormField help="Opcional. Forma predominante de comunicar o esforço. Cada bloco pode manter uma intensidade própria." id={`${active.id}-intensity`} label="Controle principal de intensidade">
              <Select aria-describedby={`${active.id}-intensity-description`} disabled={disabled} id={`${active.id}-intensity`} onChange={(event) => saveSession(changeIntensityMode(active, event.target.value as IntensityMode))} value={intensityMode(active)}>
                <option value="NONE">{qualitativeWorkGuidance(active) ? "Esforço por orientação · texto preservado" : "Intensidade a definir"}</option>
                <option value="RPE">Percepção de esforço · RPE (0–10)</option>
                <option value="PACE">Ritmo (min/km)</option>
                <option value="SPEED">Velocidade (km/h)</option>
                <option value="HEART_RATE">Frequência cardíaca (bpm)</option>
              </Select>
            </FormField>
            {qualitativeWorkGuidance(active) ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 lg:col-span-2">
                <p className="font-black">Esforço por orientação</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{qualitativeWorkGuidance(active)}</p>
              </div>
            ) : null}
            {intensityMode(active) !== "NONE" ? (
              <FormField help={intensityMode(active) === "PACE" ? "Minutos e segundos por quilômetro. Exemplo: 05:30." : intensityMode(active) === "SPEED" ? "Quilômetros por hora. Exemplo: 10,5." : intensityMode(active) === "HEART_RATE" ? "Batimentos por minuto; use apenas valor conhecido." : "Percepção de esforço de 0 a 10."} id={`${active.id}-intensity-value`} label={intensityMode(active) === "PACE" ? "Valor principal de ritmo (mm:ss min/km)" : intensityMode(active) === "SPEED" ? "Valor principal de velocidade (km/h)" : intensityMode(active) === "HEART_RATE" ? "Valor principal de frequência cardíaca (bpm)" : "Valor principal de RPE (0–10)"}>
                <Input
                  aria-describedby={`${active.id}-intensity-value-description`}
                  defaultValue={displayedIntensityValue(active)}
                  disabled={disabled}
                  id={`${active.id}-intensity-value`}
                  key={`${active.id}-${intensityMode(active)}`}
                  onBlur={(event) =>
                    saveSession(
                      setMainIntensity(
                        active,
                        intensityMode(active),
                        event.target.value,
                      ),
                    )
                  }
                  placeholder={intensityMode(active) === "PACE" ? "Exemplo: 05:30" : undefined}
                />
              </FormField>
            ) : <div />}
            <FormField className="md:col-span-2 lg:col-span-4" help="Opcional. Texto que o aluno receberá para executar a sessão." id={`${active.id}-guidance`} label="Orientação da sessão para o aluno">
              <AutoGrowTextarea aria-describedby={`${active.id}-guidance-description`} disabled={disabled} id={`${active.id}-guidance`} onChange={(event) => saveSession({ ...active, professionalGuidance: event.target.value })} rows={3} value={active.professionalGuidance} />
            </FormField>
            </div>
          </details>

          <div className="flex min-w-0 flex-wrap gap-2">
            {totals?.durationSeconds !== undefined ? <Badge tone={totals.durationCompleteness === "PARTIAL" ? "warning" : "success"}>Tempo {totals.durationCompleteness === "PARTIAL" ? "parcial" : "prescrito"}: <span className="whitespace-nowrap">{formatRunningDuration(totals.durationSeconds)}</span></Badge> : null}
            {totals?.durationSeconds === undefined && totals?.durationCompleteness === "PARTIAL" ? <Badge tone="warning">Tempo parcial: não calculável sem ritmo ou velocidade</Badge> : null}
            {totals?.distanceMeters !== undefined ? <Badge tone={totals.distanceCompleteness === "PARTIAL" ? "warning" : "success"}>Distância {totals.distanceCompleteness === "PARTIAL" ? "parcial" : "prescrita"}: <span className="whitespace-nowrap">{formatDistance(totals.distanceMeters)}</span></Badge> : null}
            {active.estimatedDurationSeconds !== undefined ? <Badge tone="info">Duração originalmente planejada: <span className="whitespace-nowrap">{formatRunningDuration(active.estimatedDurationSeconds)}</span></Badge> : null}
            {active.estimatedDistanceMeters !== undefined ? <Badge tone="info">Distância originalmente planejada: <span className="whitespace-nowrap">{formatDistance(active.estimatedDistanceMeters)}</span></Badge> : null}
            {totals?.recoveryCount ? <Badge>{totals.recoveryCount} recuperação(ões)</Badge> : null}
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {active.blocks.map((block) => (
              <div className="py-3" key={block.id}>
                {block.blockType === "REPEAT" ? (
                  <div className="mb-3 grid gap-3 sm:grid-cols-2">
                    <FormField help="Número de vezes que o conjunto de trabalho e recuperação será repetido." id={`${block.id}-repetitions`} label="Número de repetições">
                      <NumberInput aria-describedby={`${block.id}-repetitions-description`} disabled={disabled} id={`${block.id}-repetitions`} min={1} onChange={(event) => {
                        const repetitions = Number(event.target.value);
                        if (Number.isInteger(repetitions) && repetitions > 0) saveSession(updateBlock(active, block.id, { repetitions }));
                      }} value={block.repetitions} />
                    </FormField>
                    <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
                      <input checked={block.includeRecoveryAfterLast} disabled={disabled} onChange={(event) => saveSession(updateBlock(active, block.id, { includeRecoveryAfterLast: event.target.checked }))} type="checkbox" />
                      Incluir recuperação após o último tiro
                    </label>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {(block.blockType === "STAGE" ? [block.stage] : block.stages).map((currentStage) => (
                    <StageEditor disabled={disabled} key={currentStage.id} onChange={(change) => saveSession(updateStage(active, currentStage.id, change))} stage={currentStage} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <FormField help="Opcional. Orientação geral compartilhada pelo ciclo de Corrida." id="running-cycle-guidance" label="Orientações gerais do ciclo para o aluno">
            <AutoGrowTextarea
              aria-describedby="running-cycle-guidance-description"
              disabled={disabled}
              id="running-cycle-guidance"
              onChange={(event) =>
                onChange({
                  ...value,
                  configuration: {
                    ...value.configuration,
                    generalObservation: event.target.value,
                  },
                })
              }
              placeholder="Exemplo: respeite os dias de recuperação e interrompa em caso de dor."
              rows={3}
              value={value.configuration.generalObservation ?? ""}
            />
          </FormField>
        </section>
      ) : null}
    </Card>
  );
}

export function initialRunningWeek(startDate: string): WorkoutPlanEnduranceModality<"RUNNING">["weeks"][number] {
  return {
    id: crypto.randomUUID(),
    weekNumber: 1,
    startDate,
    endDate: dateAfterDays(startDate, 6),
    phase: "Semana 1",
    objective: "A definir pelo profissional.",
    weeklyGuidance: "Revisar as sessões antes de finalizar.",
    sessions: [],
  };
}

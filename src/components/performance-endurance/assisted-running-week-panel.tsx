"use client";

import { useEffect, useMemo, useState } from "react";

import { AutoGrowTextarea, Button, Card, FormField, NumberInput, Select } from "@/components/ui";
import { RunningSessionEditor } from "@/components/performance-endurance/running-session-editor";
import {
  assistedRunningQuestions,
  generateAssistedRunningWeek,
  generateAssistedRunningPeriod,
  runningProposalResultingCount,
  type AssistedRunningDayStrategy,
  type AssistedRunningSessionFormat,
  type AssistedRunningSharedStrategy,
  type RunningCurrentPractice,
  type RunningExperience,
  type RunningReturnContext,
} from "@/features/performance-endurance/assisted-running-week";
import {
  selectRunningPreview,
  type EditableRunningSessionProposal,
  type RunningProposalApplicationMode,
} from "@/features/performance-endurance/running-session-editor";
import type {
  WorkoutPlanEnduranceModality,
  WorkoutWeekday,
} from "@/features/performance-endurance/workout-contracts";
import {
  selectedRunningPlanningReferences,
  withLocalRunningManualReference,
  type RunningPlanningReference,
  type RunningPlanningReferenceSet,
} from "@/features/performance-endurance/running-planning-references";

const weekdays: readonly [WorkoutWeekday, string][] = [
  ["MONDAY", "Segunda"],
  ["TUESDAY", "Terça"],
  ["WEDNESDAY", "Quarta"],
  ["THURSDAY", "Quinta"],
  ["FRIDAY", "Sexta"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"],
];

type DoseUnit = "TIME" | "DISTANCE";
type IntensityKind = "FREE_GUIDANCE" | "RPE" | "HEART_RATE" | "PACE";

interface RunningDayStrategyDraft {
  readonly format: AssistedRunningSessionFormat;
  readonly objective: string;
  readonly warmUpMinutes: number | "";
  readonly workUnit: DoseUnit;
  readonly workValue: number | "";
  readonly repetitions: number | "";
  readonly recoveryUnit: DoseUnit;
  readonly recoveryValue: number | "";
  readonly coolDownMinutes: number | "";
  readonly intensityKind: IntensityKind;
  readonly intensityValue: string;
  readonly rationale: string;
}

function emptyDayStrategy(): RunningDayStrategyDraft {
  return {
    format: "CONTINUOUS",
    objective: "",
    warmUpMinutes: "",
    workUnit: "TIME",
    workValue: "",
    repetitions: "",
    recoveryUnit: "TIME",
    recoveryValue: "",
    coolDownMinutes: "",
    intensityKind: "FREE_GUIDANCE",
    intensityValue: "",
    rationale: "",
  };
}

function prescribedDose(unit: DoseUnit, value: number | "") {
  if (typeof value !== "number" || value <= 0) return undefined;
  return unit === "TIME"
    ? { type: "TIME" as const, durationSeconds: value * 60 }
    : { type: "DISTANCE" as const, distanceMeters: value };
}

function paceSeconds(value: string) {
  const match = /^(\d+):([0-5]\d)$/u.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

function dayStrategy(weekday: WorkoutWeekday, draft: RunningDayStrategyDraft): AssistedRunningDayStrategy | undefined {
  const work = prescribedDose(draft.workUnit, draft.workValue);
  if (!work) return undefined;
  const numericIntensity = Number(draft.intensityValue);
  const intensity = draft.intensityKind === "FREE_GUIDANCE"
    ? draft.intensityValue.trim()
      ? { type: "FREE_GUIDANCE" as const, guidance: draft.intensityValue.trim() }
      : undefined
    : draft.intensityKind === "PACE"
      ? paceSeconds(draft.intensityValue)
        ? { type: "PACE" as const, unit: "SECONDS_PER_KILOMETER" as const, target: { valueType: "SINGLE" as const, value: paceSeconds(draft.intensityValue)! } }
        : undefined
      : Number.isFinite(numericIntensity) && numericIntensity > 0
        ? draft.intensityKind === "RPE"
          ? { type: "RPE" as const, unit: "RPE" as const, target: { valueType: "SINGLE" as const, value: numericIntensity } }
          : { type: "HEART_RATE" as const, unit: "BEATS_PER_MINUTE" as const, target: { valueType: "SINGLE" as const, value: numericIntensity } }
        : undefined;
  if (!intensity) return undefined;
  return {
    weekday,
    format: draft.format,
    sessionObjective: draft.objective,
    warmUp: prescribedDose("TIME", draft.warmUpMinutes),
    work,
    repetitions: draft.format === "CONTINUOUS" ? undefined : typeof draft.repetitions === "number" ? draft.repetitions : undefined,
    recovery: draft.format === "CONTINUOUS" ? undefined : prescribedDose(draft.recoveryUnit, draft.recoveryValue),
    coolDown: prescribedDose("TIME", draft.coolDownMinutes),
    workIntensity: intensity,
    rationale: draft.rationale.trim() || undefined,
  };
}

function experienceFromContext(value: string | undefined): RunningExperience | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  if (normalized.includes("inician")) return "BEGINNER";
  if (normalized.includes("avanc")) return "ADVANCED";
  return "INTERMEDIATE";
}

function formatReferenceDuration(value: number | undefined) {
  if (!value) return "Não disponível";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatReferenceDistance(value: number | undefined) {
  return value ? `${(value / 1_000).toFixed(2)} km` : "Não disponível";
}

function formatReferencePace(value: number | undefined) {
  if (!value) return "Não disponível";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}

function referenceKindLabel(kind: RunningPlanningReference["kind"]) {
  if (kind === "EXECUTION") return "Execução";
  if (kind === "PHYSICAL_ASSESSMENT") return "Avaliação";
  return "Referência manual";
}

export function activateRunningManualEntry(input: {
  readonly source: "MOUNT_MANUALLY" | "CONTINUE_MANUALLY";
  readonly sessionCount: number;
  readonly activateManualMode: () => void;
  readonly requestManualForm: () => void;
}) {
  input.activateManualMode();
  if (input.source === "CONTINUE_MANUALLY" || input.sessionCount === 0) {
    input.requestManualForm();
  }
}

export function activateRunningAssistedGeneration(input: {
  readonly scope: "WEEK" | "PERIOD";
  readonly hasProposal: boolean;
  readonly activateAssistedMode: () => void;
  readonly selectScope: (scope: "WEEK" | "PERIOD") => void;
  readonly preserveAndReviseProposal: () => void;
}) {
  input.activateAssistedMode();
  input.selectScope(input.scope);
  if (input.hasProposal) input.preserveAndReviseProposal();
}

export function AssistedRunningWeekPanel({
  value,
  patientId,
  attendanceId,
  contextExperience,
  contextSessionDurationMinutes,
  disabled,
  proposal,
  applicationMode,
  onManualChange,
  onProposalChange,
  onApplicationModeChange,
  onPreviewDraft,
  onPreviewProposal,
  onApply,
}: {
  readonly value: WorkoutPlanEnduranceModality<"RUNNING">;
  readonly patientId: string;
  readonly attendanceId: string;
  readonly contextExperience?: string;
  readonly contextSessionDurationMinutes?: number;
  readonly disabled: boolean;
  readonly proposal?: EditableRunningSessionProposal;
  readonly applicationMode: RunningProposalApplicationMode;
  readonly onManualChange: (value: WorkoutPlanEnduranceModality<"RUNNING">) => void;
  readonly onProposalChange: (proposal: EditableRunningSessionProposal | undefined) => void;
  readonly onApplicationModeChange: (mode: RunningProposalApplicationMode) => void;
  readonly onPreviewDraft: () => void;
  readonly onPreviewProposal: () => void;
  readonly onApply: () => void;
}) {
  const inheritedExperience = experienceFromContext(contextExperience);
  const inheritedDays = value.configuration.availableWeekdays;
  const [mode, setMode] = useState<"MANUAL" | "ASSISTED">(proposal ? "ASSISTED" : "MANUAL");
  const [manualFormOpenRequest, setManualFormOpenRequest] = useState(0);
  const [revisingProposal, setRevisingProposal] = useState(false);
  const [generationScope, setGenerationScope] = useState<"WEEK" | "PERIOD">(
    proposal?.scope ?? "WEEK",
  );
  const [experience, setExperience] = useState<RunningExperience>(inheritedExperience ?? "BEGINNER");
  const [availableWeekdays, setAvailableWeekdays] = useState<readonly WorkoutWeekday[]>(inheritedDays);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(contextSessionDurationMinutes ?? 40);
  const [comfortableContinuousMinutes, setComfortableContinuousMinutes] = useState<number | "">("");
  const [currentPractice, setCurrentPractice] = useState<RunningCurrentPractice | "">("");
  const [dayStrategies, setDayStrategies] = useState<Partial<Record<WorkoutWeekday, RunningDayStrategyDraft>>>({});
  const [detailedStrategyOpen, setDetailedStrategyOpen] = useState(false);
  const [sharedFormat, setSharedFormat] = useState<AssistedRunningSessionFormat | "UNKNOWN" | "">("");
  const [sharedWorkUnit, setSharedWorkUnit] = useState<DoseUnit>("TIME");
  const [sharedWorkValue, setSharedWorkValue] = useState<number | "">("");
  const [sharedRepetitions, setSharedRepetitions] = useState<number | "">("");
  const [sharedRecoveryUnit, setSharedRecoveryUnit] = useState<DoseUnit>("TIME");
  const [sharedRecoveryValue, setSharedRecoveryValue] = useState<number | "">("");
  const [sharedIntensity, setSharedIntensity] = useState("");
  const [sharedIntensityUnknown, setSharedIntensityUnknown] = useState(false);
  const [recentReturn, setRecentReturn] = useState(false);
  const [returnContext, setReturnContext] = useState<RunningReturnContext>("UNKNOWN");
  const [rehabilitationProtocolIndicated, setRehabilitationProtocolIndicated] = useState(false);
  const [runningRestrictions, setRunningRestrictions] = useState("");
  const [safetyContextReviewed, setSafetyContextReviewed] = useState(false);
  const [targetWeekId, setTargetWeekId] = useState(value.weeks[0]?.id ?? "");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [referenceSet, setReferenceSet] = useState<RunningPlanningReferenceSet>();
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<readonly string[]>([]);
  const [referenceLoadState, setReferenceLoadState] = useState<
    "IDLE" | "LOADING" | "READY" | "ERROR"
  >("IDLE");
  const [referenceLoadError, setReferenceLoadError] = useState<string>();
  const [referenceReloadKey, setReferenceReloadKey] = useState(0);
  const effectiveReferenceSet = useMemo(
    () => referenceSet
      ? withLocalRunningManualReference({
          referenceSet,
          manualReferenceData: value.configuration.athleteReferenceData,
        })
      : undefined,
    [referenceSet, value.configuration.athleteReferenceData],
  );
  const selectedDays = inheritedDays.length ? inheritedDays : availableWeekdays;
  const plannedDays = [...new Set(selectedDays)].slice(0, value.configuration.weeklyFrequency ?? 0);
  const objective = value.configuration.primaryObjective;
  const frequency = value.configuration.weeklyFrequency ?? 0;
  const proposalEditorValue = useMemo(() => {
    if (!proposal) return undefined;
    return {
      ...value,
      weeks: proposal.weeks,
    };
  }, [proposal, value]);
  const selectedReferences = useMemo(
    () => effectiveReferenceSet
      ? selectedRunningPlanningReferences(effectiveReferenceSet, selectedReferenceIds)
      : [],
    [effectiveReferenceSet, selectedReferenceIds],
  );
  const sharedStrategy = useMemo<AssistedRunningSharedStrategy>(() => ({
    format: sharedFormat || undefined,
    work: prescribedDose(sharedWorkUnit, sharedWorkValue),
    repetitions: typeof sharedRepetitions === "number" ? sharedRepetitions : undefined,
    recovery: prescribedDose(sharedRecoveryUnit, sharedRecoveryValue),
    workIntensity: sharedIntensity.trim()
      ? { type: "FREE_GUIDANCE", guidance: sharedIntensity.trim() }
      : undefined,
    intensityUnknown: sharedIntensityUnknown,
  }), [
    sharedFormat,
    sharedIntensity,
    sharedIntensityUnknown,
    sharedRecoveryUnit,
    sharedRecoveryValue,
    sharedRepetitions,
    sharedWorkUnit,
    sharedWorkValue,
  ]);
  const professionalStrategy = useMemo(() => ({
    currentPractice: currentPractice || undefined,
    comfortableContinuousDurationSeconds:
      typeof comfortableContinuousMinutes === "number" && comfortableContinuousMinutes > 0
        ? comfortableContinuousMinutes * 60
        : undefined,
    recentReturn,
    returnContext: recentReturn ? returnContext : undefined,
    rehabilitationProtocolIndicated:
      recentReturn && returnContext === "INJURY_REHABILITATION"
        ? rehabilitationProtocolIndicated
        : undefined,
    explicitRestrictions: runningRestrictions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    safetyContextReviewed,
    sharedStrategy: detailedStrategyOpen ? undefined : sharedStrategy,
    sessions: detailedStrategyOpen ? plannedDays.flatMap((weekday) => {
      const strategy = dayStrategy(weekday, dayStrategies[weekday] ?? emptyDayStrategy());
      return strategy ? [strategy] : [];
    }) : undefined,
  }), [
    comfortableContinuousMinutes,
    currentPractice,
    dayStrategies,
    detailedStrategyOpen,
    plannedDays,
    recentReturn,
    rehabilitationProtocolIndicated,
    returnContext,
    runningRestrictions,
    safetyContextReviewed,
    sharedStrategy,
  ]);
  const commonGenerationInput = useMemo(() => ({
    running: value,
    objective,
    runningWeeklyFrequency: frequency,
    experience: inheritedExperience ?? experience,
    availableWeekdays: selectedDays,
    sessionDurationMinutes: contextSessionDurationMinutes ?? sessionDurationMinutes,
    selectedReferences,
    professionalStrategy,
  }), [
    contextSessionDurationMinutes,
    experience,
    frequency,
    inheritedExperience,
    objective,
    professionalStrategy,
    selectedDays,
    selectedReferences,
    sessionDurationMinutes,
    value,
  ]);
  const essentialQuestions = assistedRunningQuestions(commonGenerationInput);
  const generationPendingInformation = [
    ...(!objective.trim() ? ["Objetivo principal da Corrida"] : []),
    ...(frequency < 1 || frequency > 7 ? ["Corridas por semana"] : []),
  ];
  const resultingCount = proposal
    ? runningProposalResultingCount(value, proposal, applicationMode)
    : 0;
  const proposalPeriod = proposal
    ? `${new Intl.DateTimeFormat("pt-BR").format(new Date(`${proposal.period.startDate}T12:00:00Z`))} a ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${proposal.period.endDate}T12:00:00Z`))}`
    : "";
  const usesDeterministicFallback = proposal?.decisionBasis?.some(
    (basis) => basis.decision === "SESSION_STRUCTURE" && basis.source === "Proposta determinística para revisão",
  ) ?? false;
  const sessionCount = value.weeks.reduce(
    (total, week) => total + week.sessions.length,
    0,
  );

  function enterManualMode(source: "MOUNT_MANUALLY" | "CONTINUE_MANUALLY") {
    activateRunningManualEntry({
      source,
      sessionCount,
      activateManualMode: () => setMode("MANUAL"),
      requestManualForm: () => setManualFormOpenRequest((current) => current + 1),
    });
  }

  function enterAssistedMode(scope: "WEEK" | "PERIOD") {
    activateRunningAssistedGeneration({
      scope,
      hasProposal: Boolean(proposal),
      activateAssistedMode: () => setMode("ASSISTED"),
      selectScope: setGenerationScope,
      preserveAndReviseProposal: () => setRevisingProposal(true),
    });
  }

  useEffect(() => {
    if (mode !== "ASSISTED") return;
    const controller = new AbortController();
    async function loadReferences() {
      setReferenceLoadState("LOADING");
      setReferenceLoadError(undefined);
      try {
        const response = await fetch(
          `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/workout-plan/running-references`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | { referenceSet?: RunningPlanningReferenceSet; message?: string }
          | null;
        if (!response.ok || !payload?.referenceSet) {
          throw new Error(
            payload?.message ?? "Não foi possível carregar os dados reais para o planejamento.",
          );
        }
        const reconciledReferenceSet = withLocalRunningManualReference({
          referenceSet: payload.referenceSet,
          manualReferenceData: value.configuration.athleteReferenceData,
        });
        setReferenceSet(payload.referenceSet);
        setSelectedReferenceIds(reconciledReferenceSet.selectedReferenceIds);
        setReferenceLoadState("READY");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setReferenceLoadError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar os dados reais para o planejamento.",
        );
        setReferenceLoadState("ERROR");
      }
    }
    void loadReferences();
    return () => controller.abort();
  }, [
    attendanceId,
    mode,
    patientId,
    referenceReloadKey,
    value.configuration.athleteReferenceData,
  ]);

  function previewRunningDraft() {
    if (selectRunningPreview(value).source === "EMPTY") {
      setPreviewError(
        "Adicione uma sessão ao rascunho para visualizar a prévia do rascunho de Corrida",
      );
      return;
    }
    setPreviewError(undefined);
    onPreviewDraft();
  }

  function previewActiveProposal() {
    if (!proposal) return;
    setPreviewError(undefined);
    onPreviewProposal();
  }

  function toggleDay(weekday: WorkoutWeekday) {
    setAvailableWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((candidate) => candidate !== weekday)
        : [...current, weekday],
    );
  }

  function toggleReference(referenceId: string) {
    setSelectedReferenceIds((current) =>
      current.includes(referenceId)
        ? current.filter((candidate) => candidate !== referenceId)
        : [...current, referenceId],
    );
  }

  function updateDayStrategy(
    weekday: WorkoutWeekday,
    update: (current: RunningDayStrategyDraft) => RunningDayStrategyDraft,
  ) {
    setDayStrategies((current) => ({
      ...current,
      [weekday]: update(current[weekday] ?? emptyDayStrategy()),
    }));
  }

  function generate() {
    setError(undefined);
    if (referenceLoadState === "LOADING" || referenceLoadState === "IDLE") {
      setError(
        "Aguarde a consulta das referências antes de gerar.",
      );
      return;
    }
    if (generationPendingInformation.length) {
      setError("Preencha as informações mínimas indicadas ou continue manualmente.");
      return;
    }
    try {
      const generated = generationScope === "PERIOD"
        ? generateAssistedRunningPeriod(commonGenerationInput)
        : generateAssistedRunningWeek({ ...commonGenerationInput, targetWeekId });
      onProposalChange(generated);
      setRevisingProposal(false);
      setReplaceConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar a proposta.");
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Treinos · Corrida</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Como deseja montar a Corrida?</h2>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4" role="group" aria-label="Ações da Corrida">
            <Button className="w-full whitespace-normal text-center" onClick={() => enterManualMode("MOUNT_MANUALLY")} type="button" variant={mode === "MANUAL" ? "primary" : "outline"}>Montar manualmente</Button>
            <Button className="w-full whitespace-normal text-center" onClick={() => enterAssistedMode("WEEK")} type="button" variant={mode === "ASSISTED" && generationScope === "WEEK" ? "primary" : "outline"}>Gerar semana assistida</Button>
            <Button className="w-full whitespace-normal text-center" onClick={() => enterAssistedMode("PERIOD")} type="button" variant={mode === "ASSISTED" && generationScope === "PERIOD" ? "primary" : "outline"}>Gerar planejamento do período</Button>
            <Button className="w-full whitespace-normal text-center" disabled={disabled} onClick={previewRunningDraft} type="button" variant="secondary">Prévia do rascunho</Button>
          </div>
        </div>
        {previewError ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950" role="alert">
            {previewError}
          </p>
        ) : null}
      </Card>

      {mode === "MANUAL" ? (
        <RunningSessionEditor
          disabled={disabled}
          manualFormOpenRequest={manualFormOpenRequest}
          onChange={onManualChange}
          runningWeeklyFrequency={value.configuration.weeklyFrequency}
          value={value}
        />
      ) : null}

      {mode === "ASSISTED" && (!proposal || revisingProposal) ? (
        <Card className="p-5 md:p-6">
          <h2 className="text-lg font-black text-slate-950">{generationScope === "PERIOD" ? "Gerar planejamento do período" : "Gerar semana assistida"}</h2>
          <p className="mt-1 text-sm text-slate-600">A geração usa a avaliação e a configuração já registradas na Corrida. O tempo disponível é limite por sessão, não uma duração obrigatória.</p>
          {proposal && revisingProposal ? (
            <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950" role="status">A proposta anterior está preservada e só será substituída depois de uma nova geração válida.</p>
          ) : null}
          <dl className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm md:grid-cols-2">
            <div><dt className="font-black text-emerald-950">Objetivo da Corrida</dt><dd className="mt-1 text-emerald-900">{objective.trim() || "Não informado"}</dd></div>
            <div><dt className="font-black text-emerald-950">Corridas por semana</dt><dd className="mt-1 text-emerald-900">{frequency ? `${frequency}x por semana` : "Não informado"}</dd></div>
          </dl>
          <section aria-labelledby="running-reference-heading" className="mt-5 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950" id="running-reference-heading">Referências reais do aluno</h3>
                <p className="mt-1 text-sm text-slate-600">Confira e escolha o que fundamentará esta proposta. Nenhuma seleção salva ou altera prescrições.</p>
              </div>
              {referenceLoadState === "ERROR" ? (
                <Button onClick={() => setReferenceReloadKey((current) => current + 1)} type="button" variant="outline">Tentar novamente</Button>
              ) : null}
            </div>
            {referenceLoadState === "LOADING" || referenceLoadState === "IDLE" ? (
              <p aria-live="polite" className="mt-3 text-sm font-bold text-slate-700">Consultando execuções, avaliações e referências manuais no servidor…</p>
            ) : null}
            {referenceLoadState === "ERROR" ? (
              <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-900" role="alert">{referenceLoadError} A ausência de relógio não impede a geração: a proposta será identificada para revisão profissional.</p>
            ) : null}
            {referenceLoadState === "READY" && effectiveReferenceSet?.references.length === 0 ? (
              <p className="mt-3 text-sm text-slate-700">Nenhuma referência de relógio ou avaliação foi encontrada. A geração continua disponível e a limitação ficará explícita na proposta.</p>
            ) : null}
            {referenceLoadState === "READY" && effectiveReferenceSet?.references.length ? (
              <div className="mt-4 space-y-3">
                {effectiveReferenceSet.references.map((reference) => (
                  <label className={`block rounded-xl border p-4 ${reference.selectable ? "cursor-pointer border-slate-200" : "border-slate-200 bg-slate-50 text-slate-600"}`} key={reference.id}>
                    <span className="flex items-start gap-3">
                      <input
                        checked={selectedReferenceIds.includes(reference.id)}
                        className="mt-1"
                        disabled={!reference.selectable || disabled}
                        onChange={() => toggleReference(reference.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-slate-950">{reference.title} · {referenceKindLabel(reference.kind)}</span>
                        <span className="mt-1 block text-sm">{reference.recordedAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(reference.recordedAt)) : "Data não disponível"} · {reference.origin} · ambiente {reference.environment ?? "não disponível"}</span>
                        <span className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <span><strong>Duração:</strong> {formatReferenceDuration(reference.durationSeconds)}</span>
                          <span><strong>Distância:</strong> {formatReferenceDistance(reference.distanceMeters)}</span>
                          <span><strong>Ritmo médio calculado:</strong> {formatReferencePace(reference.averagePaceSecondsPerKilometer)}</span>
                          <span><strong>Velocidade média calculada:</strong> {reference.averageSpeedKilometersPerHour ? `${reference.averageSpeedKilometersPerHour.toFixed(2)} km/h` : "Não disponível"}</span>
                        </span>
                        <span className="mt-2 block text-sm"><strong>Influência permitida:</strong> {reference.planningInfluence}</span>
                        <span className="mt-1 block text-xs"><strong>Limitações:</strong> {reference.limitations.join(" · ")}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {generationScope === "WEEK" ? (
              <FormField help="Obrigatório para a geração semanal. Escolha qual semana receberá a proposta; nenhuma sessão existente é alterada antes de aplicar." id="assisted-running-week" label="Semana que receberá a proposta">
                <Select aria-describedby="assisted-running-week-description" disabled={disabled} id="assisted-running-week" onChange={(event) => setTargetWeekId(event.target.value)} value={targetWeekId}>
                  {value.weeks.map((week) => <option key={week.id} value={week.id}>Semana {week.weekNumber} · {week.startDate}</option>)}
                </Select>
              </FormField>
            ) : (
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                <strong>Período configurado:</strong> início em {value.configuration.startDate} · {value.configuration.cycleDurationWeeks} semana(s). Semanas parciais serão incluídas.
              </p>
            )}
            {!inheritedExperience ? (
              <FormField help="Contexto atual. Selecione a experiência conhecida; ela não define duração, ritmo ou zona automaticamente." id="assisted-running-experience" label="Experiência atual">
                <Select aria-describedby="assisted-running-experience-description" disabled={disabled} id="assisted-running-experience" onChange={(event) => setExperience(event.target.value as RunningExperience)} value={experience}>
                  <option value="BEGINNER">Iniciante</option>
                  <option value="INTERMEDIATE">Intermediária</option>
                  <option value="ADVANCED">Avançada</option>
                </Select>
              </FormField>
            ) : (
              <p className="rounded-xl border border-slate-200 px-4 py-3 text-sm"><strong>Experiência registrada:</strong> {contextExperience}</p>
            )}
            {contextSessionDurationMinutes === undefined ? (
              <FormField help="Obrigatório quando não vier do atendimento. Informe o teto em minutos; o gerador pode prescrever menos e nunca precisa consumir todo o tempo." id="assisted-running-duration" label="Tempo máximo por sessão (min)">
                <NumberInput aria-describedby="assisted-running-duration-description" disabled={disabled} id="assisted-running-duration" min={15} onChange={(event) => setSessionDurationMinutes(Number(event.target.value))} step={5} value={sessionDurationMinutes} />
              </FormField>
            ) : (
              <p className="rounded-xl border border-slate-200 px-4 py-3 text-sm"><strong>Tempo registrado:</strong> {contextSessionDurationMinutes} min</p>
            )}
          </div>
          <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-labelledby="running-found-summary">
            <h3 className="font-black text-emerald-950" id="running-found-summary">Resumo do que foi encontrado</h3>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div><strong className="block text-emerald-950">Fatos reais</strong><span>{selectedReferences.length} referência(s) selecionada(s); {comfortableContinuousMinutes || value.configuration.athleteReferenceData?.comfortableContinuousDurationSeconds ? "capacidade contínua disponível" : "capacidade contínua não informada"}.</span></div>
              <div><strong className="block text-emerald-950">Cálculos derivados</strong><span>{selectedReferences.some((reference) => reference.averagePaceSecondsPerKilometer) ? "Há ritmo médio calculado, mantido apenas como contexto." : "Nenhum ritmo calculado disponível."}</span></div>
              <div><strong className="block text-emerald-950">Motor da sugestão</strong><span>Regras fixas, sem IA. Usa configuração e tetos disponíveis; qualquer parte sugerida será marcada para revisão.</span></div>
            </div>
          </section>
          {generationPendingInformation.length ? (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
              <p className="font-black">Ainda falta: {generationPendingInformation.join(" · ")}.</p>
              <p className="mt-1">Complete apenas a configuração básica indicada. A estratégia manual abaixo é opcional e uma proposta anterior não será substituída por uma tentativa inválida.</p>
              <Button className="mt-3" onClick={() => enterManualMode("CONTINUE_MANUALLY")} type="button" variant="outline">Continuar manualmente</Button>
            </div>
          ) : null}
          <fieldset className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <legend className="px-1 font-black text-sky-950">Ajustes profissionais opcionais</legend>
            <p className="mt-1 text-sm text-sky-900"><strong>Você pode gerar sem preencher esta seção.</strong> Nesse caso, formato, duração e orientação serão apresentados como proposta para revisão, nunca como desempenho histórico.</p>
            <details className="mt-3 rounded-xl border border-sky-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-black text-sky-950">O que pode ou não fundamentar a estratégia</summary>
              <p className="mt-2 text-sm text-sky-900">Prática regular e tempo contínuo confortável, quando ambos informados, podem tornar elegível o modelo contínuo e limitar sua duração. Execuções comuns e distância isolada permanecem contexto e não são convertidas em duração, ritmo, zona ou intensidade.</p>
            </details>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField help="Informe somente a situação atual. Isso escolhe entre modelos elegíveis; não define ritmo, zona ou progressão." id="assisted-running-current-practice" label="Prática atual de Corrida">
                <Select aria-describedby="assisted-running-current-practice-description" disabled={disabled} id="assisted-running-current-practice" onChange={(event) => setCurrentPractice(event.target.value as RunningCurrentPractice | "")} value={currentPractice}>
                  <option value="">Não informada</option>
                  <option value="NO_CURRENT_RUNNING">Não corre atualmente</option>
                  <option value="IRREGULAR">Prática irregular</option>
                  <option value="REGULAR">Prática regular</option>
                </Select>
              </FormField>
              <FormField help="Dado atual opcional. Com prática regular, torna o modelo contínuo elegível e funciona como teto; continua identificado separadamente da dose sugerida. Se não souber, deixe vazio." id="assisted-running-comfortable-continuous-time" label="Tempo contínuo confortável atual (min)">
                <NumberInput aria-describedby="assisted-running-comfortable-continuous-time-description" disabled={disabled} id="assisted-running-comfortable-continuous-time" min={1} onChange={(event) => setComfortableContinuousMinutes(event.target.value === "" ? "" : Number(event.target.value))} placeholder="Não informado" step={1} value={comfortableContinuousMinutes} />
              </FormField>
              <label className="flex items-start gap-2 rounded-xl border border-sky-200 bg-white p-3 text-sm font-bold text-sky-950">
                <input aria-describedby="assisted-running-recent-return-help" checked={recentReturn} className="mt-1" disabled={disabled} onChange={(event) => setRecentReturn(event.target.checked)} type="checkbox" /><span><span className="block">Retorno recente à Corrida (opcional)</span><span className="mt-1 block font-normal" id="assisted-running-recent-return-help">Marque quando houve interrupção recente relevante. Isso não presume lesão nem seleciona protocolo de reabilitação automaticamente.</span></span>
              </label>
              {recentReturn ? (
                <FormField help="Escolha somente quando o motivo for conhecido. Motivo desconhecido permanece desconhecido e usa retomada geral." id="assisted-running-return-context" label="Contexto da interrupção">
                  <Select aria-describedby="assisted-running-return-context-description" disabled={disabled} id="assisted-running-return-context" onChange={(event) => {
                    setReturnContext(event.target.value as RunningReturnContext);
                    setRehabilitationProtocolIndicated(false);
                  }} value={returnContext}>
                    <option value="UNKNOWN">Motivo desconhecido</option>
                    <option value="PAUSE_WITHOUT_INJURY">Pausa sem lesão</option>
                    <option value="INJURY_REHABILITATION">Lesão / reabilitação</option>
                  </Select>
                </FormField>
              ) : null}
              {recentReturn && returnContext === "INJURY_REHABILITATION" ? (
                <label className="md:col-span-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  <input checked={rehabilitationProtocolIndicated} className="mt-1" disabled={disabled} onChange={(event) => setRehabilitationProtocolIndicated(event.target.checked)} type="checkbox" />Indico explicitamente o protocolo de reabilitação Harris-Hayes para esta proposta. O contexto de lesão, sozinho, não autoriza sua seleção.
                </label>
              ) : null}
              <FormField help="Opcional. Registre apenas restrições já confirmadas, uma por linha. Se não houver informação, deixe vazio." id="assisted-running-restrictions" label="Restrições registradas">
                <AutoGrowTextarea aria-describedby="assisted-running-restrictions-description" disabled={disabled} id="assisted-running-restrictions" onChange={(event) => setRunningRestrictions(event.target.value)} placeholder="Exemplo: evitar subida nesta fase." rows={3} value={runningRestrictions} />
              </FormField>
              {(recentReturn || runningRestrictions.trim()) ? (
                <label className="md:col-span-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  <input checked={safetyContextReviewed} className="mt-1" disabled={disabled} onChange={(event) => setSafetyContextReviewed(event.target.checked)} type="checkbox" />Revisei o retorno recente e as restrições registradas para esta estratégia. Esta confirmação não cria intensidade, recuperação ou progressão.
                </label>
              ) : null}
            </div>
            {!detailedStrategyOpen ? (
              <div className="mt-5 rounded-xl border border-sky-300 bg-white p-4">
                <h3 className="font-black text-sky-950">Personalizar a sugestão (opcional)</h3>
                <p className="mt-1 text-sm text-slate-600">Se preenchida por completo, uma resposta comum será reutilizada nos dias selecionados. Se ficar vazia ou incompleta, o sistema gera uma proposta marcada para revisão.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField help="Escolha uma organização ou marque Não sei. Os dados atuais não determinam o formato sozinhos." id="assisted-running-shared-format" label="Como você quer organizar os treinos?">
                    <Select aria-describedby="assisted-running-shared-format-description" disabled={disabled} id="assisted-running-shared-format" onChange={(event) => setSharedFormat(event.target.value as AssistedRunningSessionFormat | "UNKNOWN" | "")} value={sharedFormat}>
                      <option value="">Selecione</option><option value="CONTINUOUS">Corrida contínua</option><option value="WALK_RUN">Alternância caminhada/corrida</option><option value="INTERVAL">Intervalado definido pelo profissional</option><option value="UNKNOWN">Não sei</option>
                    </Select>
                  </FormField>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <FormField help="Informe uma única dose de trabalho para os dias. Ela não é copiada da capacidade atual." id="assisted-running-shared-work" label={sharedWorkUnit === "TIME" ? "Trabalho por treino (min)" : "Trabalho por treino (m)"}>
                      <NumberInput disabled={disabled} id="assisted-running-shared-work" min={1} onChange={(event) => setSharedWorkValue(event.target.value === "" ? "" : Number(event.target.value))} value={sharedWorkValue} />
                    </FormField>
                    <Button onClick={() => setSharedWorkValue("")} type="button" variant="outline">Não sei</Button>
                  </div>
                  <FormField help="Escolha se a dose comum termina por tempo ou distância." id="assisted-running-shared-work-unit" label="Trabalho termina por">
                    <Select disabled={disabled} id="assisted-running-shared-work-unit" onChange={(event) => { setSharedWorkUnit(event.target.value as DoseUnit); setSharedWorkValue(""); }} value={sharedWorkUnit}><option value="TIME">Tempo</option><option value="DISTANCE">Distância</option></Select>
                  </FormField>
                  {sharedFormat && sharedFormat !== "UNKNOWN" && sharedFormat !== "CONTINUOUS" ? (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <FormField help="Quantidade comum de repetições; o sistema não escolhe esse número." id="assisted-running-shared-repetitions" label="Repetições">
                          <NumberInput disabled={disabled} id="assisted-running-shared-repetitions" min={1} onChange={(event) => setSharedRepetitions(event.target.value === "" ? "" : Number(event.target.value))} value={sharedRepetitions} />
                        </FormField>
                        <Button onClick={() => setSharedRepetitions("")} type="button" variant="outline">Não sei</Button>
                      </div>
                      <FormField help="Escolha como termina cada recuperação entre repetições." id="assisted-running-shared-recovery-unit" label="Recuperação termina por">
                        <Select disabled={disabled} id="assisted-running-shared-recovery-unit" onChange={(event) => { setSharedRecoveryUnit(event.target.value as DoseUnit); setSharedRecoveryValue(""); }} value={sharedRecoveryUnit}><option value="TIME">Tempo</option><option value="DISTANCE">Distância</option></Select>
                      </FormField>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <FormField help="Recuperação comum inserida somente entre repetições." id="assisted-running-shared-recovery" label={sharedRecoveryUnit === "TIME" ? "Recuperação (min)" : "Recuperação (m)"}>
                          <NumberInput disabled={disabled} id="assisted-running-shared-recovery" min={1} onChange={(event) => setSharedRecoveryValue(event.target.value === "" ? "" : Number(event.target.value))} value={sharedRecoveryValue} />
                        </FormField>
                        <Button onClick={() => setSharedRecoveryValue("")} type="button" variant="outline">Não sei</Button>
                      </div>
                    </>
                  ) : null}
                  <FormField className="md:col-span-2" help="Descreva o esforço sem transformar médias anteriores em zona ou teste." id="assisted-running-shared-intensity" label="Como deve ser o esforço?">
                    <AutoGrowTextarea disabled={disabled || sharedIntensityUnknown} id="assisted-running-shared-intensity" onChange={(event) => setSharedIntensity(event.target.value)} placeholder="Exemplo: esforço controlado, mantendo a técnica." rows={2} value={sharedIntensity} />
                  </FormField>
                  <label className="md:col-span-2 flex items-center gap-2 text-sm font-bold"><input checked={sharedIntensityUnknown} disabled={disabled} onChange={(event) => { setSharedIntensityUnknown(event.target.checked); if (event.target.checked) setSharedIntensity(""); }} type="checkbox" />Não sei definir a intensidade</label>
                </div>
                {essentialQuestions.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">{essentialQuestions.map((question) => <li key={question.id}><strong>Informação essencial ainda ausente:</strong> {question.question}. {question.reason} É possível gerar um modelo conservador identificado para revisão.</li>)}</ul> : <p className="mt-4 text-sm font-bold text-emerald-800">Os critérios necessários para selecionar um modelo estão disponíveis. A proposta ainda poderá ser editada antes de aplicar.</p>}
              </div>
            ) : null}
            <div className="mt-4">
              <Button onClick={() => setDetailedStrategyOpen((current) => !current)} type="button" variant="outline">{detailedStrategyOpen ? "Recolher definição detalhada" : "Definição detalhada por treino (opcional)"}</Button>
            </div>
            {detailedStrategyOpen ? <div className="mt-5 space-y-4">
              {plannedDays.map((weekday) => {
                const draft = dayStrategies[weekday] ?? emptyDayStrategy();
                const dayLabel = weekdays.find(([id]) => id === weekday)?.[1] ?? weekday;
                const repeated = draft.format !== "CONTINUOUS";
                const prefix = `assisted-running-${weekday.toLocaleLowerCase()}`;
                return (
                  <fieldset className="rounded-xl border border-sky-300 bg-white p-4" key={weekday}>
                    <legend className="px-1 font-black text-sky-950">{dayLabel} · Como será o treino</legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField help="Obrigatório. Escolha a organização profissional desta sessão; isso não é inferido pelo histórico." id={`${prefix}-format`} label="Formato da sessão">
                        <Select disabled={disabled} id={`${prefix}-format`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, format: event.target.value as AssistedRunningSessionFormat }))} value={draft.format}>
                          <option value="CONTINUOUS">Corrida contínua</option>
                          <option value="WALK_RUN">Alternância caminhada/corrida</option>
                          <option value="INTERVAL">Intervalado definido pelo profissional</option>
                        </Select>
                      </FormField>
                      <FormField help="Obrigatório. Descreva a finalidade desta sessão, separada da meta geral da Corrida." id={`${prefix}-objective`} label="Finalidade da sessão">
                        <AutoGrowTextarea aria-describedby={`${prefix}-objective-description`} disabled={disabled} id={`${prefix}-objective`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, objective: event.target.value }))} placeholder="Exemplo: praticar alternância com execução controlada." rows={2} value={draft.objective} />
                      </FormField>
                      <FormField help="Opcional. Deixe vazio quando não houver aquecimento prescrito." id={`${prefix}-warmup`} label="Aquecimento (min, opcional)">
                        <NumberInput disabled={disabled} id={`${prefix}-warmup`} min={1} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, warmUpMinutes: event.target.value === "" ? "" : Number(event.target.value) }))} placeholder="Não prescrito" value={draft.warmUpMinutes} />
                      </FormField>
                      <FormField help="Opcional. Deixe vazio quando não houver volta à calma prescrita." id={`${prefix}-cooldown`} label="Volta à calma (min, opcional)">
                        <NumberInput disabled={disabled} id={`${prefix}-cooldown`} min={1} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, coolDownMinutes: event.target.value === "" ? "" : Number(event.target.value) }))} placeholder="Não prescrita" value={draft.coolDownMinutes} />
                      </FormField>
                      <FormField help="Obrigatório. Escolha como termina cada bloco de trabalho." id={`${prefix}-work-unit`} label="Trabalho termina por">
                        <Select disabled={disabled} id={`${prefix}-work-unit`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, workUnit: event.target.value as DoseUnit, workValue: "" }))} value={draft.workUnit}>
                          <option value="TIME">Tempo (min)</option><option value="DISTANCE">Distância (m)</option>
                        </Select>
                      </FormField>
                      <FormField help={`Obrigatório. Informe ${draft.workUnit === "TIME" ? "minutos" : "metros"} de trabalho${repeated ? " em cada repetição" : ""}.`} id={`${prefix}-work-value`} label={draft.workUnit === "TIME" ? "Duração do trabalho (min)" : "Distância do trabalho (m)"}>
                        <NumberInput disabled={disabled} id={`${prefix}-work-value`} min={1} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, workValue: event.target.value === "" ? "" : Number(event.target.value) }))} value={draft.workValue} />
                      </FormField>
                      {repeated ? (
                        <>
                          <FormField help="Obrigatório. A recuperação será inserida somente entre as repetições, nunca depois da última." id={`${prefix}-repetitions`} label="Repetições">
                            <NumberInput disabled={disabled} id={`${prefix}-repetitions`} min={1} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, repetitions: event.target.value === "" ? "" : Number(event.target.value) }))} step={1} value={draft.repetitions} />
                          </FormField>
                          <FormField help="Obrigatório. Escolha como termina a recuperação entre repetições." id={`${prefix}-recovery-unit`} label="Recuperação termina por">
                            <Select disabled={disabled} id={`${prefix}-recovery-unit`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, recoveryUnit: event.target.value as DoseUnit, recoveryValue: "" }))} value={draft.recoveryUnit}>
                              <option value="TIME">Tempo (min)</option><option value="DISTANCE">Distância (m)</option>
                            </Select>
                          </FormField>
                          <FormField help={`Obrigatório. Informe ${draft.recoveryUnit === "TIME" ? "minutos" : "metros"} por recuperação entre repetições.`} id={`${prefix}-recovery-value`} label={draft.recoveryUnit === "TIME" ? "Duração da recuperação (min)" : "Distância da recuperação (m)"}>
                            <NumberInput disabled={disabled} id={`${prefix}-recovery-value`} min={1} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, recoveryValue: event.target.value === "" ? "" : Number(event.target.value) }))} value={draft.recoveryValue} />
                          </FormField>
                        </>
                      ) : null}
                      <FormField help="Obrigatório. Use orientação qualitativa ou um alvo estruturado já suportado; nenhuma média histórica é convertida automaticamente." id={`${prefix}-intensity-kind`} label="Intensidade">
                        <Select disabled={disabled} id={`${prefix}-intensity-kind`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, intensityKind: event.target.value as IntensityKind, intensityValue: "" }))} value={draft.intensityKind}>
                          <option value="FREE_GUIDANCE">Orientação qualitativa</option><option value="RPE">RPE</option><option value="HEART_RATE">Frequência cardíaca (bpm)</option><option value="PACE">Ritmo (min/km)</option>
                        </Select>
                      </FormField>
                      <FormField help={draft.intensityKind === "FREE_GUIDANCE" ? "Descreva sensação, respiração ou execução esperada." : draft.intensityKind === "PACE" ? "Use o formato mm:ss por quilômetro." : "Informe o alvo numérico explicitamente definido."} id={`${prefix}-intensity-value`} label={draft.intensityKind === "FREE_GUIDANCE" ? "Orientação de intensidade" : draft.intensityKind === "PACE" ? "Ritmo alvo (mm:ss/km)" : draft.intensityKind === "RPE" ? "RPE alvo" : "FC alvo (bpm)"}>
                        <input className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" disabled={disabled} id={`${prefix}-intensity-value`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, intensityValue: event.target.value }))} placeholder={draft.intensityKind === "FREE_GUIDANCE" ? "Exemplo: esforço controlado, mantendo a técnica." : draft.intensityKind === "PACE" ? "Exemplo: 06:30" : ""} value={draft.intensityValue} />
                      </FormField>
                      <FormField className="md:col-span-2" help="Opcional. Registre por que esta dose e este formato foram escolhidos; exemplos não preenchem valores." id={`${prefix}-rationale`} label="Justificativa da estratégia">
                        <AutoGrowTextarea aria-describedby={`${prefix}-rationale-description`} disabled={disabled} id={`${prefix}-rationale`} onChange={(event) => updateDayStrategy(weekday, (current) => ({ ...current, rationale: event.target.value }))} placeholder="Exemplo: dose definida após revisão da capacidade atual e dos tetos registrados." rows={2} value={draft.rationale} />
                      </FormField>
                    </div>
                  </fieldset>
                );
              })}
            </div> : null}
          </fieldset>
          {!inheritedDays.length ? (
            <fieldset className="mt-5">
              <legend className="text-sm font-black text-slate-950">Dias disponíveis</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekdays.map(([weekday, label]) => (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold" key={weekday}>
                    <input checked={availableWeekdays.includes(weekday)} disabled={disabled} onChange={() => toggleDay(weekday)} type="checkbox" />{label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="mt-5 text-sm text-slate-700"><strong>Dias já registrados:</strong> {inheritedDays.map((day) => weekdays.find(([id]) => id === day)?.[1]).join(" · ")}</p>
          )}
          {error ? <p className="mt-4 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
          <Button className="mt-5" disabled={disabled || referenceLoadState === "LOADING" || referenceLoadState === "IDLE" || generationPendingInformation.length > 0 || (generationScope === "WEEK" && !targetWeekId)} onClick={generate} type="button">{generationScope === "PERIOD" ? "Gerar planejamento editável" : "Gerar proposta editável"}</Button>
        </Card>
      ) : null}

      {mode === "ASSISTED" && proposal && proposalEditorValue && !revisingProposal ? (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-black text-amber-950">{proposal.scope === "PERIOD" ? "Proposta do período — não aplicada" : "Proposta da semana — não aplicada"}</h2>
              <Button onClick={previewActiveProposal} type="button" variant="secondary">{proposal.scope === "PERIOD" ? "Visualizar proposta do período" : "Visualizar proposta da semana"}</Button>
            </div>
            <p className="mt-1 text-sm text-amber-900">Editar, pré-visualizar, imprimir ou cancelar não altera o rascunho.</p>
            <p className="mt-2 text-sm font-black text-amber-950">Período afetado ao aplicar: {proposalPeriod}</p>
            {usesDeterministicFallback ? (
              <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950" role="status">
                <p className="font-black">Origem da repetição automática</p>
                <p className="mt-1">Com a definição detalhada vazia, o motor seleciona um modelo por critérios explícitos de prática atual, capacidade contínua conhecida, retorno recente e tetos disponíveis. Capacidade desconhecida nunca equivale a 30 minutos contínuos.</p>
                <p className="mt-1">O mesmo treino pode se repetir quando não existe fundamento para diferenciá-lo. Isso é uma proposta, não uma individualização comprovada por desempenho do aluno. Modelo, fonte técnica, fatos que influenciaram a escolha e limitações estão em “Ver fundamentos detalhados”; não há variação ou progressão inventada.</p>
              </div>
            ) : null}
            {proposal.readiness.status === "REVIEW_REQUIRED" ? (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-950" role="alert">
                <p className="font-black">Planejamento assistido com pendências.</p>
                <p className="mt-1">Pendências: {proposal.readiness.missingInformation.join(" · ")}.</p>
                <p className="mt-1">Você pode preencher as referências e gerar novamente ou revisar manualmente todos os blocos e confirmar a limitação antes de aplicar. A montagem manual da planilha permanece disponível.</p>
              </div>
            ) : null}
            <p className="mt-3 text-sm font-black text-amber-950">Notas internas de revisão — não exibidas ao aluno</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-950">
              {proposal.reviewNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </Card>
          <Card className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-slate-950">Dados usados neste planejamento</h2>
                <p className="mt-1 text-sm text-slate-600">Fatos históricos, cálculos, estimativas e alvos prescritos permanecem identificados separadamente.</p>
              </div>
              <Button onClick={() => setRevisingProposal(true)} type="button" variant="outline">Conferir ou trocar referências</Button>
            </div>
            {proposal.dataUsed?.length ? (
              <div className="mt-4 space-y-4">
                {(proposal.dataUsed ?? []).map((reference) => (
                  <article className="rounded-xl border border-slate-200 p-4" key={reference.id}>
                    <h3 className="font-black text-slate-950">{reference.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{reference.recordedAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(reference.recordedAt)) : "Data não disponível"} · {reference.origin}</p>
                    <p className="mt-2 text-sm font-black text-slate-950">
                      Uso na proposta: {reference.planningUse === "DECISION" ? "alterou uma decisão" : "somente contexto"}
                    </p>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <p className="font-black text-slate-950">Fatos históricos</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {reference.historicalFacts.map((fact) => <li key={fact}>{fact}</li>)}
                          {reference.durationSeconds ? <li>Duração registrada: {formatReferenceDuration(reference.durationSeconds)}</li> : null}
                          {reference.distanceMeters ? <li>Distância registrada: {formatReferenceDistance(reference.distanceMeters)}</li> : null}
                        </ul>
                      </div>
                      <div>
                        <p className="font-black text-slate-950">Cálculos</p>
                        <p className="mt-1">Ritmo médio: {formatReferencePace(reference.averagePaceSecondsPerKilometer)} · velocidade média: {reference.averageSpeedKilometersPerHour ? `${reference.averageSpeedKilometersPerHour.toFixed(2)} km/h` : "Não disponível"}.</p>
                      </div>
                      <div>
                        <p className="font-black text-slate-950">Influência permitida</p>
                        <p className="mt-1">{reference.planningInfluence}</p>
                        {reference.influencedDecisions?.length ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {reference.influencedDecisions.map((decision) => <li key={decision}>{decision}</li>)}
                          </ul>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-black text-slate-950">Limitações</p>
                        <p className="mt-1">{reference.limitations.join(" · ")}</p>
                      </div>
                    </div>
                  </article>
                ))}
                <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><strong>Alvos prescritos:</strong> permanecem na proposta editável abaixo. As médias históricas não foram convertidas em ritmo máximo, zona ou intensidade obrigatória.</p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">Nenhuma referência persistida foi usada. A proposta está identificada para revisão e nenhuma métrica histórica foi inventada.</p>
            )}
            <details className="mt-5 rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-black text-slate-950">Ver fundamentos detalhados</summary>
              <div className="mt-4 space-y-3">
                {(proposal.decisionBasis ?? []).map((basis) => (
                  <article className="rounded-xl border border-slate-200 p-4 text-sm" key={basis.decision}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-slate-950">{basis.label}</h3>
                      {basis.contextualOnly ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">Somente contextual</span> : null}
                    </div>
                    <p className="mt-2"><strong>Referência:</strong> {basis.source}</p>
                    <p className="mt-1"><strong>Origem:</strong> {basis.origin}</p>
                    <p className="mt-1"><strong>Dado que sustentou a decisão:</strong> {basis.evidence}</p>
                    <p className="mt-1"><strong>Influência exata:</strong> {basis.influence}</p>
                  </article>
                ))}
              </div>
            </details>
          </Card>
          <Card className="p-5 md:p-6">
            <h2 className="font-black text-slate-950">Objetivos e orientações semanais</h2>
            <div className="mt-4 space-y-4">
              {proposal.weeks.map((week) => (
                <fieldset className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-2" key={week.id}>
                  <legend className="px-1 text-sm font-black text-slate-950">Semana {week.weekNumber} · {week.startDate} a {week.endDate}</legend>
                  <FormField help="Decisão profissional editável. Descreva a finalidade desta semana; não copie a meta futura como se fosse capacidade atual." id={`${week.id}-objective`} label="Finalidade da semana">
                    <AutoGrowTextarea aria-describedby={`${week.id}-objective-description`} disabled={disabled} id={`${week.id}-objective`} onChange={(event) => onProposalChange({
                      ...proposal,
                      readiness: { ...proposal.readiness, reviewConfirmed: false },
                      weeks: proposal.weeks.map((candidate) => candidate.id === week.id ? { ...candidate, objective: event.target.value } : candidate),
                    })} rows={3} value={week.objective} />
                  </FormField>
                  <FormField help="Opcional. Orientação geral que acompanha as sessões desta semana." id={`${week.id}-guidance`} label="Orientação da semana">
                    <AutoGrowTextarea aria-describedby={`${week.id}-guidance-description`} disabled={disabled} id={`${week.id}-guidance`} onChange={(event) => onProposalChange({
                      ...proposal,
                      readiness: { ...proposal.readiness, reviewConfirmed: false },
                      weeks: proposal.weeks.map((candidate) => candidate.id === week.id ? { ...candidate, weeklyGuidance: event.target.value } : candidate),
                    })} rows={3} value={week.weeklyGuidance} />
                  </FormField>
                </fieldset>
              ))}
            </div>
          </Card>
          <RunningSessionEditor
            disabled={disabled}
            onChange={(edited) => {
              onProposalChange({
                ...proposal,
                readiness: { ...proposal.readiness, reviewConfirmed: false },
                weeks: edited.weeks,
              });
            }}
            runningWeeklyFrequency={value.configuration.weeklyFrequency}
            value={proposalEditorValue}
          />
          <Card className="p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <FormField help="Escolha se a proposta será acrescentada ou substituirá somente as sessões de Corrida no período indicado." id="assisted-running-application-mode" label="Como aplicar ao rascunho">
                <Select aria-describedby="assisted-running-application-mode-description" disabled={disabled} id="assisted-running-application-mode" onChange={(event) => {
                  onApplicationModeChange(event.target.value as RunningProposalApplicationMode);
                  setReplaceConfirmed(false);
                }} value={applicationMode}>
                  <option value="APPEND">Acrescentar Corrida no período afetado</option>
                  <option value="REPLACE">Substituir Corrida no período afetado</option>
                </Select>
              </FormField>
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-950" role="status">O período ficará com {resultingCount} sessão(ões) de Corrida.</p>
            </div>
            {applicationMode === "REPLACE" ? (
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-950">
                <input checked={replaceConfirmed} className="mt-1" onChange={(event) => setReplaceConfirmed(event.target.checked)} type="checkbox" />Confirmo a substituição somente das sessões de Corrida de {proposalPeriod}. Outras modalidades e sessões fora desse período serão preservadas.
              </label>
            ) : null}
            {proposal.readiness.status === "REVIEW_REQUIRED" ? (
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                <input
                  checked={proposal.readiness.reviewConfirmed ?? false}
                  className="mt-1"
                  disabled={disabled}
                  onChange={(event) => onProposalChange({
                    ...proposal,
                    readiness: {
                      ...proposal.readiness,
                      reviewConfirmed: event.target.checked,
                    },
                  })}
                  type="checkbox"
                />
                Revisei explicitamente objetivo, blocos, duração, intensidade e recuperação; aceito aplicar esta proposta mesmo com as pendências listadas, sem transformar dados ausentes em estimativas.
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled={disabled || (proposal.readiness.status === "REVIEW_REQUIRED" && !proposal.readiness.reviewConfirmed) || (applicationMode === "REPLACE" && !replaceConfirmed)} onClick={onApply} type="button">Aplicar ao rascunho</Button>
              <Button onClick={() => { onProposalChange(undefined); setRevisingProposal(false); }} type="button" variant="outline">Cancelar proposta</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

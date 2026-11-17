"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Card,
  FormField,
  Input,
  NumberInput,
  SectionHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { RunningExecutionHistory } from "@/components/performance-endurance/running-execution-history";
import type {
  EnduranceAthleteReferenceData,
  EndurancePlanConfiguration,
  EnduranceRecentPerformanceReference,
} from "@/features/performance-endurance/endurance-workout-contracts";

export type RunningPlanConfiguration = EndurancePlanConfiguration<"RUNNING">;

export type RunningPlanConfigurationFormErrors = Readonly<
  Record<string, string | undefined>
>;

export interface RunningPlanConfigurationFormProps {
  readonly value: RunningPlanConfiguration;
  readonly onChange: (value: RunningPlanConfiguration) => void;
  readonly errors?: RunningPlanConfigurationFormErrors;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly masterRecordId?: string;
}

const objectiveOptions = [
  "Iniciação à corrida",
  "Saúde e condicionamento",
  "Emagrecimento",
  "Melhorar resistência",
  "Melhorar velocidade",
  "Retorno à corrida",
  "Preparação para TAF",
  "Prova de corrida",
  "Preparação para 3 km",
  "Preparação para 5 km",
  "Preparação para 10 km",
  "Preparação para 15 km",
  "Meia maratona",
  "Outro objetivo",
] as const;

const levelOptions = [
  "Sedentário/Iniciação",
  "Iniciante",
  "Intermediário",
  "Avançado",
  "Retorno após interrupção",
] as const;

const weekdayOptions = [
  ["MONDAY", "Seg", "Segunda-feira"],
  ["TUESDAY", "Ter", "Terça-feira"],
  ["WEDNESDAY", "Qua", "Quarta-feira"],
  ["THURSDAY", "Qui", "Quinta-feira"],
  ["FRIDAY", "Sex", "Sexta-feira"],
  ["SATURDAY", "Sáb", "Sábado"],
  ["SUNDAY", "Dom", "Domingo"],
] as const satisfies ReadonlyArray<
  readonly [
    RunningPlanConfiguration["availableWeekdays"][number],
    string,
    string,
  ]
>;

const environmentOptions = [
  ["ROAD", "Rua"],
  ["TRACK", "Pista"],
  ["TREADMILL", "Esteira"],
  ["TRAIL", "Trilha"],
  ["MIXED", "Misto"],
  ["OTHER", "Outro"],
] as const satisfies ReadonlyArray<
  readonly [RunningPlanConfiguration["environment"], string]
>;

const legacyEnvironmentCodes: Readonly<
  Record<string, RunningPlanConfiguration["environment"]>
> = {
  rua: "ROAD",
  pista: "TRACK",
  esteira: "TREADMILL",
  trilha: "TRAIL",
  misto: "MIXED",
  outro: "OTHER",
};

function normalizedRunningEnvironment(environment: unknown) {
  if (typeof environment !== "string") {
    return environment as RunningPlanConfiguration["environment"];
  }
  return (
    legacyEnvironmentCodes[
      environment.trim().toLocaleLowerCase("pt-BR")
    ] ?? (environment as RunningPlanConfiguration["environment"])
  );
}

export function normalizeRunningPlanConfiguration(
  configuration: RunningPlanConfiguration,
) {
  const environment = normalizedRunningEnvironment(configuration.environment);
  const visibleEnvironment = environment || "ROAD";
  const visiblePrimaryUnit = configuration.primaryUnit || "TIME";
  const visibleIntensityMethod =
    configuration.primaryIntensityMethod || "RPE";
  const generalObservation = configuration.generalObservation?.trim()
    ? configuration.generalObservation
    : undefined;

  if (
    visibleEnvironment === configuration.environment &&
    visiblePrimaryUnit === configuration.primaryUnit &&
    visibleIntensityMethod === configuration.primaryIntensityMethod &&
    generalObservation === configuration.generalObservation
  ) {
    return configuration;
  }

  return {
    ...configuration,
    environment: visibleEnvironment,
    primaryUnit: visiblePrimaryUnit,
    primaryIntensityMethod: visibleIntensityMethod,
    generalObservation,
  };
}

export function runningConfigurationWithExecutionReference(
  configuration: RunningPlanConfiguration,
  reference: EnduranceRecentPerformanceReference,
): RunningPlanConfiguration {
  return normalizeRunningPlanConfiguration({
    ...configuration,
    athleteReferenceData: {
      ...configuration.athleteReferenceData,
      recentPerformance: reference,
    },
  });
}

const intensityMethodOptions = [
  ["RPE", "RPE"],
  ["HEART_RATE", "Frequência cardíaca"],
  ["PACE", "Ritmo"],
  ["SPEED", "Velocidade"],
  ["NONE", "Sem valor numérico de intensidade"],
] as const satisfies ReadonlyArray<
  readonly [RunningPlanConfiguration["primaryIntensityMethod"], string]
>;

type AthleteReferenceField = keyof EnduranceAthleteReferenceData;

interface ConvertedReferenceInputDraft {
  readonly currentContinuousDistance: string;
  readonly longestRecentDistance: string;
  readonly recentPerformanceDistance: string;
  readonly recentPerformanceDuration: string;
  readonly comfortablePace: string;
  readonly weeklyVolumeTime: string;
  readonly weeklyVolumeDistance: string;
}

interface RunningTestGoalInputDraft {
  readonly requiredDistanceMeters: string;
  readonly targetDuration: string;
  readonly testDate: string;
}

interface ParsedConvertedInput {
  readonly value?: number;
  readonly error?: string;
  readonly normalized?: string;
}

const kilometerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 6,
  useGrouping: false,
});

function kilometersFromMeters(value: number | undefined) {
  return value === undefined ? "" : kilometerFormatter.format(value / 1_000);
}

function clockPart(value: number) {
  return Math.trunc(value).toString().padStart(2, "0");
}

function durationFromSeconds(value: number | undefined) {
  if (value === undefined) return "";
  const totalSeconds = Math.round(value);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${clockPart(hours)}:${clockPart(minutes)}:${clockPart(seconds)}`;
}

function paceFromSeconds(value: number | undefined) {
  if (value === undefined) return "";
  const totalSeconds = Math.round(value);
  return `${clockPart(Math.floor(totalSeconds / 60))}:${clockPart(
    totalSeconds % 60,
  )}`;
}

function weeklyTimeFromSeconds(value: number | undefined) {
  if (value === undefined) return "";
  const totalMinutes = Math.round(value / 60);
  return `${clockPart(Math.floor(totalMinutes / 60))}:${clockPart(
    totalMinutes % 60,
  )}`;
}

function convertedReferenceInputDraft(
  reference: EnduranceAthleteReferenceData | undefined,
): ConvertedReferenceInputDraft {
  const weeklyVolume = reference?.currentWeeklyVolume;
  return {
    currentContinuousDistance: kilometersFromMeters(
      reference?.currentContinuousDistanceMeters,
    ),
    longestRecentDistance: kilometersFromMeters(
      reference?.longestRecentDistanceMeters,
    ),
    recentPerformanceDistance: kilometersFromMeters(
      reference?.recentPerformance?.distanceMeters,
    ),
    recentPerformanceDuration: durationFromSeconds(
      reference?.recentPerformance?.durationSeconds,
    ),
    comfortablePace: paceFromSeconds(
      reference?.comfortablePaceSecondsPerKilometer,
    ),
    weeklyVolumeTime:
      weeklyVolume?.unit === "TIME"
        ? weeklyTimeFromSeconds(weeklyVolume.durationSeconds)
        : "",
    weeklyVolumeDistance:
      weeklyVolume?.unit === "DISTANCE"
        ? kilometersFromMeters(weeklyVolume.distanceMeters)
        : "",
  };
}

function parseKilometers(value: string): ParsedConvertedInput {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return {};
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    return { error: "Informe a distância em km, usando vírgula ou ponto." };
  }
  const kilometers = Number(normalized);
  if (!Number.isFinite(kilometers) || kilometers <= 0) {
    return { error: "Informe uma distância maior que zero." };
  }
  return { value: Number((kilometers * 1_000).toFixed(6)) };
}

function parsePerformanceDuration(value: string): ParsedConvertedInput {
  const normalized = value.trim();
  if (!normalized) return {};
  let parts: readonly string[];
  if (/^\d{4,6}$/.test(normalized)) {
    const compact = normalized.padStart(6, "0");
    parts = [compact.slice(0, 2), compact.slice(2, 4), compact.slice(4)];
  } else {
    const colonParts = normalized.split(":");
    if (
      (colonParts.length !== 2 && colonParts.length !== 3) ||
      colonParts.some((part) => !/^\d{1,2}$/.test(part))
    ) {
      return { error: "Use hh:mm:ss, mm:ss ou 4 a 6 números." };
    }
    parts = colonParts.length === 2 ? ["0", ...colonParts] : colonParts;
  }
  const [hours, minutes, seconds] = parts.map(Number);
  if (minutes > 59 || seconds > 59) {
    return { error: "Use minutos e segundos entre 00 e 59." };
  }
  const totalSeconds = hours * 3_600 + minutes * 60 + seconds;
  return totalSeconds > 0
    ? {
        normalized: `${clockPart(hours)}:${clockPart(minutes)}:${clockPart(
          seconds,
        )}`,
        value: totalSeconds,
      }
    : { error: "Informe um tempo maior que zero." };
}

function parsePace(value: string): ParsedConvertedInput {
  const normalized = value.trim();
  if (!normalized) return {};
  let parts: readonly string[];
  if (/^\d{3,4}$/.test(normalized)) {
    parts = [normalized.slice(0, -2), normalized.slice(-2)];
  } else {
    const colonParts = normalized.split(":");
    if (
      colonParts.length !== 2 ||
      colonParts.some((part) => !/^\d{1,2}$/.test(part))
    ) {
      return { error: "Use mm:ss ou 3 a 4 números." };
    }
    parts = colonParts;
  }
  const [minutes, seconds] = parts.map(Number);
  if (minutes > 59 || seconds > 59) {
    return { error: "Use minutos e segundos entre 00 e 59." };
  }
  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds > 0
    ? {
        normalized: `${clockPart(minutes)}:${clockPart(seconds)}`,
        value: totalSeconds,
      }
    : { error: "Informe um ritmo maior que zero." };
}

function parseWeeklyTime(value: string): ParsedConvertedInput {
  const normalized = value.trim();
  if (!normalized) return {};
  let parts: readonly string[];
  if (/^\d{3,4}$/.test(normalized)) {
    parts = [normalized.slice(0, -2), normalized.slice(-2)];
  } else {
    const colonParts = normalized.split(":");
    if (
      colonParts.length !== 2 ||
      colonParts.some((part) => !/^\d{1,2}$/.test(part))
    ) {
      return { error: "Use hh:mm ou 3 a 4 números." };
    }
    parts = colonParts;
  }
  const [hours, minutes] = parts.map(Number);
  if (minutes > 59) {
    return { error: "Use minutos entre 00 e 59." };
  }
  const totalSeconds = (hours * 60 + minutes) * 60;
  return totalSeconds > 0
    ? {
        normalized: `${clockPart(hours)}:${clockPart(minutes)}`,
        value: totalSeconds,
      }
    : { error: "Informe um tempo maior que zero." };
}

function timeCharactersOnly(value: string) {
  return value.replace(/[^\d:]/g, "");
}

function finiteNumberFromInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateTimeLocalValue(value: string | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTimeFromInput(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function referenceHasValue(reference: EnduranceAthleteReferenceData) {
  return Object.values(reference).some((entry) => entry !== undefined);
}

export function RunningPlanConfigurationForm({
  value,
  onChange,
  errors,
  disabled = false,
  readOnly = false,
  masterRecordId,
}: RunningPlanConfigurationFormProps) {
  const interactionLocked = disabled || readOnly;
  const isTaf = value.primaryObjective === "Preparação para TAF";
  const recentPerformance = value.athleteReferenceData?.recentPerformance;
  const [referenceInputDraft, setReferenceInputDraft] =
    useState<ConvertedReferenceInputDraft>(() =>
      convertedReferenceInputDraft(value.athleteReferenceData),
    );
  const [testGoalInputDraft, setTestGoalInputDraft] =
    useState<RunningTestGoalInputDraft>(() => ({
      requiredDistanceMeters:
        value.testGoal?.requiredDistanceMeters?.toString() ?? "",
      targetDuration: durationFromSeconds(
        value.testGoal?.targetDurationSeconds,
      ),
      testDate: value.testGoal?.testDate ?? "",
    }));
  const currentContinuousDistanceResult = parseKilometers(
    referenceInputDraft.currentContinuousDistance,
  );
  const longestRecentDistanceResult = parseKilometers(
    referenceInputDraft.longestRecentDistance,
  );
  const recentPerformanceDistanceResult = parseKilometers(
    referenceInputDraft.recentPerformanceDistance,
  );
  const recentPerformanceDurationResult = parsePerformanceDuration(
    referenceInputDraft.recentPerformanceDuration,
  );
  const testGoalDurationResult = parsePerformanceDuration(
    testGoalInputDraft.targetDuration,
  );
  const comfortablePaceResult = parsePace(
    referenceInputDraft.comfortablePace,
  );
  const weeklyVolumeTimeResult = parseWeeklyTime(
    referenceInputDraft.weeklyVolumeTime,
  );
  const weeklyVolumeDistanceResult = parseKilometers(
    referenceInputDraft.weeklyVolumeDistance,
  );

  useEffect(() => {
    const normalizedValue = normalizeRunningPlanConfiguration(value);
    if (normalizedValue !== value) onChange(normalizedValue);
  }, [onChange, value]);

  function updateConfiguration(change: Partial<RunningPlanConfiguration>) {
    onChange(
      normalizeRunningPlanConfiguration({
        ...value,
        ...change,
        modality: "RUNNING",
      }),
    );
  }

  function updateReferenceField<Field extends AthleteReferenceField>(
    field: Field,
    fieldValue: EnduranceAthleteReferenceData[Field] | undefined,
  ) {
    const nextReference: EnduranceAthleteReferenceData = {
      ...value.athleteReferenceData,
      [field]: fieldValue,
    };

    updateConfiguration({
      athleteReferenceData: referenceHasValue(nextReference)
        ? nextReference
        : undefined,
    });
  }

  function updateOptionalReferenceNumber(
    field: Exclude<
      AthleteReferenceField,
      "recentPerformance" | "currentWeeklyVolume" | "recentHistory" | "updatedAt"
    >,
    rawValue: string,
  ) {
    updateReferenceField(field, finiteNumberFromInput(rawValue));
  }

  function updateRequiredNumber(
    field: "cycleDurationWeeks" | "weeklyFrequency",
    rawValue: string,
  ) {
    const nextValue = finiteNumberFromInput(rawValue);
    updateConfiguration({
      [field]: nextValue as RunningPlanConfiguration[typeof field],
    });
  }

  function updateTestGoal(next: RunningTestGoalInputDraft) {
    setTestGoalInputDraft(next);
    const requiredDistanceMeters = finiteNumberFromInput(
      next.requiredDistanceMeters,
    );
    const targetDuration = parsePerformanceDuration(next.targetDuration);
    updateConfiguration({
      testGoal: {
        requiredDistanceMeters:
          requiredDistanceMeters as RunningPlanConfiguration["testGoal"] extends infer Goal
            ? Goal extends { requiredDistanceMeters: infer Distance }
              ? Distance
              : never
            : never,
        targetDurationSeconds:
          targetDuration.value as RunningPlanConfiguration["testGoal"] extends infer Goal
            ? Goal extends { targetDurationSeconds: infer Duration }
              ? Duration
              : never
            : never,
        testDate: next.testDate,
      },
    });
  }

  function toggleWeekday(
    weekday: RunningPlanConfiguration["availableWeekdays"][number],
  ) {
    const selected = value.availableWeekdays.includes(weekday);
    updateConfiguration({
      availableWeekdays: selected
        ? value.availableWeekdays.filter((item) => item !== weekday)
        : weekdayOptions
            .map(([option]) => option)
            .filter(
              (option) =>
                value.availableWeekdays.includes(option) || option === weekday,
            ),
    });
  }

  function updateRecentPerformance(nextDistance: string, nextDuration: string) {
    const distance = parseKilometers(nextDistance);
    const duration = parsePerformanceDuration(nextDuration);

    if (!nextDistance.trim() || !nextDuration.trim()) {
      updateReferenceField("recentPerformance", undefined);
      return;
    }
    if (distance.value === undefined || duration.value === undefined) return;

    updateReferenceField("recentPerformance", {
      distanceMeters: distance.value,
      durationSeconds: duration.value,
    });
  }

  function useExecutionReference(
    reference: EnduranceRecentPerformanceReference,
  ) {
    const nextConfiguration = runningConfigurationWithExecutionReference(
      value,
      reference,
    );
    setReferenceInputDraft(
      convertedReferenceInputDraft(nextConfiguration.athleteReferenceData),
    );
    onChange(nextConfiguration);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-6">
        <SectionHeader
          description="Defina a meta futura e a organização do ciclo. Os dados atuais do aluno ficam separados e são opcionais."
          eyebrow="Corrida"
          title="Configuração do Plano de Corrida"
        />

        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-900">Como os dados de Corrida são usados</summary>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div><dt className="font-black text-slate-950">Dados atuais do aluno</dt><dd className="mt-1 text-slate-700">Capacidade, histórico e execuções já realizadas. Se não houver informação confirmada, deixe em branco.</dd></div>
            <div><dt className="font-black text-slate-950">Meta futura</dt><dd className="mt-1 text-slate-700">Resultado que se deseja alcançar, como um TAF. Não representa o desempenho atual.</dd></div>
            <div><dt className="font-black text-slate-950">Decisão profissional</dt><dd className="mt-1 text-slate-700">Organização e prescrição do treino. É revisada no painel assistido ou no editor manual.</dd></div>
          </dl>
        </details>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            className="md:col-span-2"
            error={errors?.primaryObjective}
            help="Obrigatório. Descreva a meta geral do ciclo; não informe aqui uma marca atual."
            id="running-primary-objective"
            label="Objetivo principal"
            required
          >
            <Input
              aria-describedby="running-primary-objective-description"
              disabled={disabled}
              id="running-primary-objective"
              list="running-objective-options"
              onChange={(event) =>
                updateConfiguration({ primaryObjective: event.target.value })
              }
              readOnly={readOnly}
              value={value.primaryObjective ?? ""}
            />
            <datalist id="running-objective-options">
              {objectiveOptions.map((objective) => (
                <option key={objective} value={objective} />
              ))}
            </datalist>
          </FormField>

          <FormField
            error={errors?.currentLevel}
            help="Obrigatório. Selecione a situação atual conhecida; o rótulo não cria ritmo, duração ou intensidade."
            id="running-current-level"
            label="Nível atual"
            required
          >
            <Select
              aria-describedby="running-current-level-description"
              disabled={interactionLocked}
              id="running-current-level"
              onChange={(event) =>
                updateConfiguration({ currentLevel: event.target.value })
              }
              value={value.currentLevel ?? ""}
            >
              <option value="">Selecione</option>
              {levelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            error={errors?.startDate}
            help="Obrigatório. Data prevista para iniciar o ciclo de Corrida."
            id="running-start-date"
            label="Data de início"
            required
          >
            <Input
              aria-describedby="running-start-date-description"
              disabled={disabled}
              id="running-start-date"
              onChange={(event) =>
                updateConfiguration({ startDate: event.target.value })
              }
              readOnly={readOnly}
              type="date"
              value={value.startDate ?? ""}
            />
          </FormField>

          <FormField
            error={errors?.cycleDurationWeeks}
            help="Obrigatório. Informe um número inteiro de semanas, maior que zero."
            id="running-cycle-duration"
            label="Duração do ciclo (semanas)"
            required
          >
            <NumberInput
              aria-describedby="running-cycle-duration-description"
              disabled={disabled}
              id="running-cycle-duration"
              min={1}
              onChange={(event) =>
                updateRequiredNumber("cycleDurationWeeks", event.target.value)
              }
              readOnly={readOnly}
              step={1}
              value={value.cycleDurationWeeks ?? ""}
            />
          </FormField>

          <FormField
            error={errors?.weeklyFrequency}
            help="Obrigatório nesta tela. Informe de 1 a 7 sessões de Corrida por semana."
            id="running-weekly-frequency"
            label="Corridas por semana"
            required
          >
            <NumberInput
              aria-describedby="running-weekly-frequency-description"
              disabled={disabled}
              id="running-weekly-frequency"
              max={7}
              min={1}
              onChange={(event) =>
                updateRequiredNumber("weeklyFrequency", event.target.value)
              }
              readOnly={readOnly}
              step={1}
              value={value.weeklyFrequency ?? ""}
            />
            <p className="mt-1 text-xs text-slate-500">
              Valor exclusivo da Corrida; não altera a frequência da Musculação.
            </p>
          </FormField>

          <FormField
            error={errors?.environment}
            help="Obrigatório. Escolha onde o treino normalmente será prescrito; pode ser ajustado por sessão."
            id="running-environment"
            label="Ambiente de corrida"
            required
          >
            <Select
              aria-describedby="running-environment-description"
              disabled={interactionLocked}
              id="running-environment"
              onChange={(event) =>
                updateConfiguration({
                  environment: event.target
                    .value as RunningPlanConfiguration["environment"],
                })
              }
              value={normalizedRunningEnvironment(value.environment) ?? ""}
            >
              {environmentOptions.map(([environment, label]) => (
                <option key={environment} value={environment}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            error={errors?.primaryUnit}
            help="Obrigatório. Indica se o planejamento será organizado principalmente por tempo ou distância."
            id="running-primary-unit"
            label="Unidade principal"
            required
          >
            <Select
              aria-describedby="running-primary-unit-description"
              disabled={interactionLocked}
              id="running-primary-unit"
              onChange={(event) =>
                updateConfiguration({
                  primaryUnit: event.target
                    .value as RunningPlanConfiguration["primaryUnit"],
                })
              }
              value={value.primaryUnit ?? ""}
            >
              <option value="TIME">Tempo</option>
              <option value="DISTANCE">Distância</option>
            </Select>
          </FormField>

          <FormField
            className="md:col-span-2 xl:col-span-1"
            error={errors?.primaryIntensityMethod}
            help="Obrigatório. Escolha como a intensidade será comunicada; os valores de cada bloco continuam sendo definidos no editor. RPE é percepção de esforço de 0 a 10."
            id="running-intensity-method"
            label="Método principal de intensidade"
            required
          >
            <Select
              aria-describedby="running-intensity-method-description"
              disabled={interactionLocked}
              id="running-intensity-method"
              onChange={(event) =>
                updateConfiguration({
                  primaryIntensityMethod: event.target
                    .value as RunningPlanConfiguration["primaryIntensityMethod"],
                })
              }
              value={value.primaryIntensityMethod ?? ""}
            >
              {intensityMethodOptions.map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {isTaf ? (
          <section className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 md:p-5">
            <h3 className="font-black text-sky-950">Meta do TAF</h3>
            <p className="mt-1 text-sm text-sky-900">
              A meta orienta a revisão profissional; ela não é tratada como
              desempenho atual nem impõe ritmo automaticamente.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <FormField
                error={errors?.["testGoal.requiredDistanceMeters"]}
                help="Obrigatório para TAF. Distância da meta futura em metros; não é a capacidade atual."
                id="running-test-distance"
                label="Distância exigida (m)"
                required
              >
                <NumberInput
                  aria-describedby="running-test-distance-description"
                  disabled={disabled}
                  id="running-test-distance"
                  min={1}
                  onChange={(event) =>
                    updateTestGoal({
                      ...testGoalInputDraft,
                      requiredDistanceMeters: event.target.value,
                    })
                  }
                  readOnly={readOnly}
                  step={1}
                  value={testGoalInputDraft.requiredDistanceMeters}
                />
              </FormField>
              <FormField
                error={
                  testGoalDurationResult.error ??
                  errors?.["testGoal.targetDurationSeconds"]
                }
                help="Obrigatório para TAF. Tempo desejado da meta futura; use hh:mm:ss, mm:ss ou somente números. Exemplo: 12:00."
                id="running-test-target-duration"
                label="Tempo-alvo"
                required
              >
                <Input
                  disabled={disabled}
                  id="running-test-target-duration"
                  inputMode="numeric"
                  onBlur={() => {
                    if (
                      interactionLocked ||
                      !testGoalDurationResult.normalized
                    ) {
                      return;
                    }
                    updateTestGoal({
                      ...testGoalInputDraft,
                      targetDuration: testGoalDurationResult.normalized,
                    });
                  }}
                  onChange={(event) =>
                    updateTestGoal({
                      ...testGoalInputDraft,
                      targetDuration: timeCharactersOnly(event.target.value),
                    })
                  }
                  placeholder="Exemplo: 12:00"
                  readOnly={readOnly}
                  value={testGoalInputDraft.targetDuration}
                />
              </FormField>
              <FormField
                error={errors?.["testGoal.testDate"]}
                help="Obrigatório para TAF. Informe a data prevista da meta futura."
                id="running-test-date"
                label="Data do teste"
                required
              >
                <Input
                  aria-describedby="running-test-date-description"
                  disabled={disabled}
                  id="running-test-date"
                  onChange={(event) =>
                    updateTestGoal({
                      ...testGoalInputDraft,
                      testDate: event.target.value,
                    })
                  }
                  readOnly={readOnly}
                  type="date"
                  value={testGoalInputDraft.testDate}
                />
              </FormField>
            </div>
            <p className="mt-3 text-xs font-bold text-sky-900">
              A marca atual é opcional e fica disponível logo abaixo, em Dados
              de referência do corredor.
            </p>
          </section>
        ) : null}

        <fieldset className="mt-5" disabled={interactionLocked}>
          <legend className="text-sm font-bold text-[var(--text-secondary)]">
            Dias disponíveis
          </legend>
          <p className="mt-1 text-xs text-slate-600" id="running-available-weekdays-help">Opcional no rascunho. Marque os dias em que uma sessão pode ser prescrita; a geração assistida exigirá dias suficientes para a frequência escolhida.</p>
          <div
            aria-describedby={errors?.availableWeekdays ? "running-available-weekdays-help running-available-weekdays-description" : "running-available-weekdays-help"}
            className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7"
          >
            {weekdayOptions.map(([weekday, shortLabel, fullLabel]) => {
              const selected = value.availableWeekdays.includes(weekday);
              return (
                <button
                  aria-label={fullLabel}
                  aria-pressed={selected}
                  className={`min-h-11 rounded-xl border px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 ${
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                      : "border-[var(--line-strong)] bg-white text-[var(--text-secondary)] hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                  key={weekday}
                  onClick={() => toggleWeekday(weekday)}
                  type="button"
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
          {errors?.availableWeekdays ? (
            <p
              className="mt-1.5 text-xs leading-5 text-[var(--danger)]"
              id="running-available-weekdays-description"
              role="alert"
            >
              {errors.availableWeekdays}
            </p>
          ) : null}
        </fieldset>

        <FormField
          className="mt-5"
          error={errors?.generalObservation}
          help="Opcional. Registre uma orientação geral do ciclo. Se não houver, deixe em branco."
          id="running-general-observation"
          label="Observação geral"
        >
          <Textarea
            aria-describedby="running-general-observation-description"
            disabled={disabled}
            id="running-general-observation"
            onChange={(event) =>
              updateConfiguration({
                generalObservation: event.target.value || undefined,
              })
            }
            readOnly={readOnly}
            value={value.generalObservation ?? ""}
          />
        </FormField>
      </Card>

      <Card className="overflow-hidden" variant="outlined">
        <details className="group" open={isTaf ? true : undefined}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)] md:px-6 [&::-webkit-details-marker]:hidden">
            <span>
              Dados de referência do corredor
              <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                Informações opcionais, sem cálculos automáticos
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--primary)] transition group-open:rotate-180"
            />
          </summary>

          <div className="border-t border-[var(--line)] p-5 md:p-6">
            <p className="mb-4 text-sm text-slate-700"><strong>Dados atuais do aluno · opcionais.</strong> Preencha somente informações confirmadas. Se algo não estiver disponível, deixe o campo vazio; o sistema não transforma ausência em zero.</p>
            <details className="mb-5 rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-900">Entenda as medidas usadas</summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li><strong>Ritmo:</strong> tempo gasto para percorrer 1 km, no formato minutos:segundos por km.</li>
                <li><strong>FC:</strong> frequência cardíaca, medida em batimentos por minuto (bpm). Informe apenas valores medidos ou avaliados.</li>
                <li><strong>RPE:</strong> percepção de esforço de 0 a 10, em que valores maiores representam maior esforço percebido.</li>
                <li><strong>Execução recente:</strong> corrida efetivamente registrada; distância e duração precisam ser informadas juntas.</li>
              </ul>
            </details>
            {masterRecordId ? (
              <div className="mb-5">
                <RunningExecutionHistory
                  compact
                  masterRecordId={masterRecordId}
                  onUseReference={
                    interactionLocked ? undefined : useExecutionReference
                  }
                />
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  “Usar como referência” atualiza somente este rascunho de configuração. A meta futura e as sessões existentes permanecem inalteradas.
                </p>
              </div>
            ) : null}

            {recentPerformance ? (
              <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">
                  Desempenho registrado atual
                </p>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-bold text-slate-600">Data</dt>
                    <dd className="font-black text-slate-950">
                      {recentPerformance.recordedAt
                        ? new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Sao_Paulo",
                          }).format(new Date(recentPerformance.recordedAt))
                        : "Não disponível"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-600">Origem</dt>
                    <dd className="font-black text-slate-950">
                      {recentPerformance.sourceProvider === "APPLE_HEALTH"
                        ? "Apple Health · arquivo importado"
                        : recentPerformance.source ?? "Não disponível"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-600">Duração</dt>
                    <dd className="font-black text-slate-950">
                      {durationFromSeconds(recentPerformance.durationSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-600">Distância</dt>
                    <dd className="font-black text-slate-950">
                      {kilometersFromMeters(recentPerformance.distanceMeters)} km
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                error={
                  currentContinuousDistanceResult.error ??
                  errors?.[
                    "athleteReferenceData.currentContinuousDistanceMeters"
                  ]
                }
                id="running-current-continuous-distance"
                help="Opcional. Maior distância que o aluno consegue correr continuamente hoje, em km. Sem medida confirmada, deixe em branco."
                label="Distância contínua atual (km)"
              >
                <Input
                  aria-describedby="running-current-continuous-distance-description"
                  aria-invalid={Boolean(
                    currentContinuousDistanceResult.error ||
                      errors?.[
                        "athleteReferenceData.currentContinuousDistanceMeters"
                      ],
                  )}
                  disabled={disabled}
                  id="running-current-continuous-distance"
                  inputMode="decimal"
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    setReferenceInputDraft((current) => ({
                      ...current,
                      currentContinuousDistance: rawValue,
                    }));
                    const result = parseKilometers(rawValue);
                    if (!result.error) {
                      updateReferenceField(
                      "currentContinuousDistanceMeters",
                        result.value,
                      );
                    }
                  }}
                  placeholder="Exemplo: 5,0"
                  readOnly={readOnly}
                  value={referenceInputDraft.currentContinuousDistance}
                />
              </FormField>

              <FormField
                error={
                  longestRecentDistanceResult.error ??
                  errors?.["athleteReferenceData.longestRecentDistanceMeters"]
                }
                id="running-longest-recent-distance"
                help="Opcional. Maior distância realmente concluída no período recente, em km."
                label="Maior distância concluída recentemente (km)"
              >
                <Input
                  aria-describedby="running-longest-recent-distance-description"
                  aria-invalid={Boolean(
                    longestRecentDistanceResult.error ||
                      errors?.[
                        "athleteReferenceData.longestRecentDistanceMeters"
                      ],
                  )}
                  disabled={disabled}
                  id="running-longest-recent-distance"
                  inputMode="decimal"
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    setReferenceInputDraft((current) => ({
                      ...current,
                      longestRecentDistance: rawValue,
                    }));
                    const result = parseKilometers(rawValue);
                    if (!result.error) {
                      updateReferenceField(
                        "longestRecentDistanceMeters",
                        result.value,
                      );
                    }
                  }}
                  placeholder="Exemplo: 10,5"
                  readOnly={readOnly}
                  value={referenceInputDraft.longestRecentDistance}
                />
              </FormField>

              <FormField
                error={
                  recentPerformanceDistanceResult.error ??
                  errors?.[
                    "athleteReferenceData.recentPerformance.distanceMeters"
                  ]
                }
                id="running-recent-mark-distance"
                help="Opcional, mas usado junto com a duração da mesma execução. Informe km; se faltar um dos dois dados, deixe ambos em branco."
                label="Distância da execução recente (km)"
              >
                <Input
                  aria-describedby="running-recent-mark-distance-description"
                  aria-invalid={Boolean(
                    recentPerformanceDistanceResult.error ||
                      errors?.[
                        "athleteReferenceData.recentPerformance.distanceMeters"
                      ],
                  )}
                  disabled={disabled}
                  id="running-recent-mark-distance"
                  inputMode="decimal"
                  onChange={(event) => {
                    const nextDistance = event.target.value;
                    setReferenceInputDraft((current) => ({
                      ...current,
                      recentPerformanceDistance: nextDistance,
                    }));
                    updateRecentPerformance(
                      nextDistance,
                      referenceInputDraft.recentPerformanceDuration,
                    );
                  }}
                  placeholder="Exemplo: 5,0"
                  readOnly={readOnly}
                  value={referenceInputDraft.recentPerformanceDistance}
                />
              </FormField>

              <FormField
                error={
                  recentPerformanceDurationResult.error ??
                  errors?.[
                    "athleteReferenceData.recentPerformance.durationSeconds"
                  ]
                }
                help="Opcional, mas usado junto com a distância da mesma execução. Use hh:mm:ss ou mm:ss. Exemplo: 28:30."
                id="running-recent-mark-duration"
                label="Duração da execução recente"
              >
                <Input
                  aria-describedby="running-recent-mark-duration-description"
                  aria-invalid={Boolean(
                    recentPerformanceDurationResult.error ||
                      errors?.[
                        "athleteReferenceData.recentPerformance.durationSeconds"
                      ],
                  )}
                  disabled={disabled}
                  id="running-recent-mark-duration"
                  inputMode="numeric"
                  onBlur={() => {
                    if (
                      interactionLocked ||
                      !recentPerformanceDurationResult.normalized
                    ) {
                      return;
                    }
                    setReferenceInputDraft((current) => ({
                      ...current,
                      recentPerformanceDuration:
                        recentPerformanceDurationResult.normalized ??
                        current.recentPerformanceDuration,
                    }));
                    updateRecentPerformance(
                      referenceInputDraft.recentPerformanceDistance,
                      recentPerformanceDurationResult.normalized,
                    );
                  }}
                  onChange={(event) => {
                    const nextDuration = timeCharactersOnly(event.target.value);
                    setReferenceInputDraft((current) => ({
                      ...current,
                      recentPerformanceDuration: nextDuration,
                    }));
                    updateRecentPerformance(
                      referenceInputDraft.recentPerformanceDistance,
                      nextDuration,
                    );
                  }}
                  placeholder="Exemplo: 00:28:30"
                  readOnly={readOnly}
                  value={referenceInputDraft.recentPerformanceDuration}
                />
              </FormField>

              <FormField
                error={
                  comfortablePaceResult.error ??
                  errors?.[
                    "athleteReferenceData.comfortablePaceSecondsPerKilometer"
                  ]
                }
                help="Opcional. Ritmo que o aluno reconhece como confortável, no formato mm:ss por km. Não use a média de uma corrida comum como substituto."
                id="running-comfortable-pace"
                label="Ritmo confortável (min/km)"
              >
                <Input
                  aria-describedby="running-comfortable-pace-description"
                  aria-invalid={Boolean(
                    comfortablePaceResult.error ||
                      errors?.[
                        "athleteReferenceData.comfortablePaceSecondsPerKilometer"
                      ],
                  )}
                  disabled={disabled}
                  id="running-comfortable-pace"
                  inputMode="numeric"
                  onBlur={() => {
                    if (interactionLocked || !comfortablePaceResult.normalized) {
                      return;
                    }
                    setReferenceInputDraft((current) => ({
                      ...current,
                      comfortablePace:
                        comfortablePaceResult.normalized ??
                        current.comfortablePace,
                    }));
                    updateReferenceField(
                      "comfortablePaceSecondsPerKilometer",
                      comfortablePaceResult.value,
                    );
                  }}
                  onChange={(event) => {
                    const rawValue = timeCharactersOnly(event.target.value);
                    setReferenceInputDraft((current) => ({
                      ...current,
                      comfortablePace: rawValue,
                    }));
                    const result = parsePace(rawValue);
                    if (!result.error) {
                      updateReferenceField(
                        "comfortablePaceSecondsPerKilometer",
                        result.value,
                      );
                    }
                  }}
                  placeholder="Exemplo: 06:00"
                  readOnly={readOnly}
                  value={referenceInputDraft.comfortablePace}
                />
              </FormField>

              <FormField
                error={errors?.["athleteReferenceData.restingHeartRateBpm"]}
                id="running-resting-heart-rate"
                help="Opcional. FC medida em repouso, em batimentos por minuto. Sem medição, deixe em branco."
                label="FC de repouso (bpm)"
              >
                <NumberInput
                  aria-describedby="running-resting-heart-rate-description"
                  disabled={disabled}
                  id="running-resting-heart-rate"
                  min={0.01}
                  onChange={(event) =>
                    updateOptionalReferenceNumber(
                      "restingHeartRateBpm",
                      event.target.value,
                    )
                  }
                  placeholder="Exemplo: 60"
                  readOnly={readOnly}
                  value={value.athleteReferenceData?.restingHeartRateBpm ?? ""}
                />
              </FormField>

              <FormField
                error={errors?.["athleteReferenceData.knownMaximumHeartRateBpm"]}
                id="running-maximum-heart-rate"
                help="Opcional. FC máxima conhecida por medição ou avaliação; não estime neste campo."
                label="FC máxima conhecida (bpm)"
              >
                <NumberInput
                  aria-describedby="running-maximum-heart-rate-description"
                  disabled={disabled}
                  id="running-maximum-heart-rate"
                  min={0.01}
                  onChange={(event) =>
                    updateOptionalReferenceNumber(
                      "knownMaximumHeartRateBpm",
                      event.target.value,
                    )
                  }
                  placeholder="Exemplo: 185"
                  readOnly={readOnly}
                  value={
                    value.athleteReferenceData?.knownMaximumHeartRateBpm ?? ""
                  }
                />
              </FormField>

              <FormField
                error={errors?.["athleteReferenceData.thresholdHeartRateBpm"]}
                id="running-threshold-heart-rate"
                help="Opcional. FC de limiar somente quando determinada por avaliação compatível; não deduza de texto livre."
                label="FC de limiar (bpm)"
              >
                <NumberInput
                  aria-describedby="running-threshold-heart-rate-description"
                  disabled={disabled}
                  id="running-threshold-heart-rate"
                  min={0.01}
                  onChange={(event) =>
                    updateOptionalReferenceNumber(
                      "thresholdHeartRateBpm",
                      event.target.value,
                    )
                  }
                  placeholder="Exemplo: 165"
                  readOnly={readOnly}
                  value={
                    value.athleteReferenceData?.thresholdHeartRateBpm ?? ""
                  }
                />
              </FormField>

              <FormField
                error={errors?.["athleteReferenceData.habitualRpe"]}
                id="running-habitual-rpe"
                help="Opcional. Esforço que o aluno costuma perceber nas corridas, de 0 a 10. Sem relato, deixe em branco."
                label="RPE habitual (0–10)"
              >
                <NumberInput
                  aria-describedby="running-habitual-rpe-description"
                  disabled={disabled}
                  id="running-habitual-rpe"
                  max={10}
                  min={0}
                  onChange={(event) =>
                    updateOptionalReferenceNumber(
                      "habitualRpe",
                      event.target.value,
                    )
                  }
                  placeholder="Exemplo: 5"
                  readOnly={readOnly}
                  value={value.athleteReferenceData?.habitualRpe ?? ""}
                />
              </FormField>

              <FormField
                error={
                  weeklyVolumeTimeResult.error ??
                  errors?.[
                    "athleteReferenceData.currentWeeklyVolume.durationSeconds"
                  ]
                }
                help="Opcional. Soma do tempo corrido em uma semana atual, no formato hh:mm. Preencha tempo ou distância; o último campo alterado define a unidade."
                id="running-weekly-volume-time"
                label="Volume semanal atual — tempo"
              >
                <Input
                  aria-describedby="running-weekly-volume-time-description"
                  aria-invalid={Boolean(
                    weeklyVolumeTimeResult.error ||
                      errors?.[
                        "athleteReferenceData.currentWeeklyVolume.durationSeconds"
                      ],
                  )}
                  disabled={disabled}
                  id="running-weekly-volume-time"
                  inputMode="numeric"
                  onBlur={() => {
                    if (interactionLocked || !weeklyVolumeTimeResult.normalized) {
                      return;
                    }
                    setReferenceInputDraft((current) => ({
                      ...current,
                      weeklyVolumeTime:
                        weeklyVolumeTimeResult.normalized ??
                        current.weeklyVolumeTime,
                    }));
                    updateReferenceField(
                      "currentWeeklyVolume",
                      weeklyVolumeTimeResult.value === undefined
                        ? undefined
                        : {
                            unit: "TIME",
                            durationSeconds: weeklyVolumeTimeResult.value,
                          },
                    );
                  }}
                  onChange={(event) => {
                    const rawValue = timeCharactersOnly(event.target.value);
                    setReferenceInputDraft((current) => ({
                      ...current,
                      weeklyVolumeTime: rawValue,
                      weeklyVolumeDistance: "",
                    }));
                    const result = parseWeeklyTime(rawValue);
                    if (!result.error) {
                      updateReferenceField(
                        "currentWeeklyVolume",
                        result.value === undefined
                          ? undefined
                          : { unit: "TIME", durationSeconds: result.value },
                      );
                    }
                  }}
                  placeholder="Exemplo: 03:30"
                  readOnly={readOnly}
                  value={referenceInputDraft.weeklyVolumeTime}
                />
              </FormField>

              <FormField
                error={
                  weeklyVolumeDistanceResult.error ??
                  errors?.[
                    "athleteReferenceData.currentWeeklyVolume.distanceMeters"
                  ]
                }
                help="Opcional. Soma da distância corrida em uma semana atual, em km. Preencha tempo ou distância; o último campo alterado define a unidade."
                id="running-weekly-volume-distance"
                label="Volume semanal atual — distância (km)"
              >
                <Input
                  aria-describedby="running-weekly-volume-distance-description"
                  aria-invalid={Boolean(
                    weeklyVolumeDistanceResult.error ||
                      errors?.[
                        "athleteReferenceData.currentWeeklyVolume.distanceMeters"
                      ],
                  )}
                  disabled={disabled}
                  id="running-weekly-volume-distance"
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    setReferenceInputDraft((current) => ({
                      ...current,
                      weeklyVolumeTime: "",
                      weeklyVolumeDistance: rawValue,
                    }));
                    const result = parseKilometers(rawValue);
                    if (!result.error) {
                      updateReferenceField(
                        "currentWeeklyVolume",
                        result.value === undefined
                          ? undefined
                          : { unit: "DISTANCE", distanceMeters: result.value },
                      );
                    }
                  }}
                  inputMode="decimal"
                  placeholder="Exemplo: 25,0"
                  readOnly={readOnly}
                  value={referenceInputDraft.weeklyVolumeDistance}
                />
              </FormField>

              <FormField
                className="md:col-span-2"
                error={errors?.["athleteReferenceData.updatedAt"]}
                id="running-reference-updated-at"
                help="Opcional. Data e hora em que estes dados atuais foram confirmados."
                label="Data da última atualização"
              >
                <Input
                  aria-describedby="running-reference-updated-at-description"
                  disabled={disabled}
                  id="running-reference-updated-at"
                  onChange={(event) =>
                    updateReferenceField(
                      "updatedAt",
                      isoDateTimeFromInput(event.target.value),
                    )
                  }
                  readOnly={readOnly}
                  type="datetime-local"
                  value={dateTimeLocalValue(
                    value.athleteReferenceData?.updatedAt,
                  )}
                />
              </FormField>

              <FormField
                className="md:col-span-2 xl:col-span-4"
                error={errors?.["athleteReferenceData.recentHistory"]}
                id="running-recent-history"
                help="Opcional. Resuma frequência, continuidade, interrupções e contexto recente sem classificar fisiologia."
                label="Histórico recente"
              >
                <Textarea
                  aria-describedby="running-recent-history-description"
                  disabled={disabled}
                  id="running-recent-history"
                  onChange={(event) =>
                    updateReferenceField(
                      "recentHistory",
                      event.target.value || undefined,
                    )
                  }
                  placeholder="Exemplo: corre 3 vezes por semana há 6 meses, sem interrupções recentes."
                  readOnly={readOnly}
                  value={value.athleteReferenceData?.recentHistory ?? ""}
                />
              </FormField>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
}

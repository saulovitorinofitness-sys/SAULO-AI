import type { ReactNode } from "react";

import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import { RunningWeekGrid } from "@/components/performance-endurance/running-week-grid";
import { CLINIC_INSTITUTIONAL_CONFIG } from "@/config/institution";
import type {
  PerformanceWorkoutView,
  WorkoutExercise,
  WorkoutPlanEnduranceModality,
  WorkoutProgramStrategy,
} from "@/features/performance-endurance/workout-contracts";
import type {
  EnduranceIntensityTarget,
  EnduranceSessionBlock,
  EnduranceSessionStage,
  StructuredEnduranceSession,
} from "@/features/performance-endurance/endurance-workout-contracts";
import {
  formatRunningDuration,
  runningPrescriptionTotals,
  speedKilometersPerHourFromPace,
} from "@/features/performance-endurance/running-session-editor";
import { buildWorkoutMethodGlossary } from "@/features/performance-endurance/workout-record";
import type { PhysicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";

import { DeliverableDocumentHeader } from "./deliverable-document-header";
import { DocumentPrintActions } from "./document-print-actions";

const NOT_INFORMED = "Não informado";

function dateLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? undefined
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function runningDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

function dateAfterDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function runningPeriodLabel(
  startDate: string,
  cycleDurationWeeks: number,
) {
  const endDate = dateAfterDays(startDate, cycleDurationWeeks * 7 - 1);
  const start = dateLabel(startDate);
  const end = dateLabel(endDate);
  if (!start || !end) return undefined;
  return `${start} a ${end} · ${cycleDurationWeeks} semana(s)`;
}

function runningGoalLabel(
  goal: {
    readonly requiredDistanceMeters: number;
    readonly targetDurationSeconds: number;
    readonly testDate: string;
  } | undefined,
) {
  if (!goal) return undefined;
  const distance = goal.requiredDistanceMeters >= 1_000
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(goal.requiredDistanceMeters / 1_000)} km`
    : `${goal.requiredDistanceMeters} m`;
  return `${distance} em ${formatRunningDuration(goal.targetDurationSeconds)} · teste em ${dateLabel(goal.testDate) ?? goal.testDate}`;
}

function hasText(value?: string): value is string {
  return Boolean(value?.trim());
}

function deliverableText(value?: string) {
  if (!hasText(value) || value.trim() === NOT_INFORMED) return undefined;
  return value.trim();
}

function validityLabel(strategy: WorkoutProgramStrategy) {
  const start = dateLabel(strategy.startDate);
  const duration = deliverableText(strategy.expectedDuration);

  if (start && duration) {
    return `A partir de ${start} · duração prevista: ${duration}`;
  }
  if (start) return `A partir de ${start}`;
  return duration;
}

function journeyValue(value?: string) {
  return deliverableText(value) ?? NOT_INFORMED;
}

function Field({
  className = "",
  label,
  value,
}: {
  readonly className?: string;
  readonly label: string;
  readonly value?: ReactNode;
}) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#567066]">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-5 text-[#20312b]">
        {value}
      </dd>
    </div>
  );
}

function Section({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <section className="performance-report-section border-t border-[#d9e3de] px-5 py-5 sm:px-7">
      <SectionHeading title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SectionHeading({ title }: { readonly title: string }) {
  return (
    <h2 className="performance-section-heading flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-[#173c30]">
      <span
        aria-hidden="true"
        className="h-4 w-1 rounded-full bg-[#b38b35]"
      />
      {title}
    </h2>
  );
}

function exerciseIntensity(exercise: WorkoutExercise) {
  const type =
    exercise.intensityType === "PERCENT_1RM"
      ? "% de 1RM"
      : deliverableText(exercise.intensityType);
  const value = deliverableText(exercise.intensityValue);

  if (!type && !value) return undefined;
  return [type, value].filter(Boolean).join(" · ");
}

function effortTarget(exercise: WorkoutExercise) {
  const rir = deliverableText(exercise.rir);
  const rpe = deliverableText(exercise.rpe);

  return [rir ? `RIR ${rir}` : undefined, rpe ? `RPE-alvo ${rpe}` : undefined]
    .filter(Boolean)
    .join(" · ");
}

function ExerciseTable({
  exercises,
  methodNames,
}: {
  readonly exercises: readonly WorkoutExercise[];
  readonly methodNames: ReadonlyMap<string, string>;
}) {
  return (
    <div className="performance-table-frame w-full max-w-full overflow-x-auto rounded-xl border border-[#cbd9d3]">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-[11px] leading-4 text-[#263b33] print:min-w-0 sm:text-xs">
        <colgroup>
          <col className="w-[29%]" />
          <col className="w-[8%]" />
          <col className="w-[15%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead className="performance-table-heading bg-[#edf3f0] text-[#173c30]">
          <tr>
            <th className="p-2 font-black">Exercício</th>
            <th className="p-2 text-center font-black">Séries</th>
            <th className="p-2 font-black">Repetições/faixa</th>
            <th className="p-2 font-black">Carga</th>
            <th className="p-2 font-black">Descanso</th>
            <th className="p-2 font-black">RIR/RPE-alvo</th>
          </tr>
        </thead>
        {exercises.map((exercise) => {
          const load = [
            deliverableText(exercise.load),
            deliverableText(exercise.loadUnit),
          ]
            .filter(Boolean)
            .join(" ");
          const methodName = deliverableText(
            methodNames.get(exercise.methodId),
          );
          const details: Array<[string, string | undefined]> = [
            ["Prescrição livre", deliverableText(exercise.prescription)],
            ["Cadência", deliverableText(exercise.cadence)],
            ["Amplitude", deliverableText(exercise.rangeOfMotion)],
            ["Intensidade adicional", exerciseIntensity(exercise)],
            ["Método", methodName],
            [
              "Exercício substituto",
              deliverableText(exercise.substituteExercise),
            ],
            [
              "Instrução ao aluno",
              deliverableText(exercise.patientInstructions),
            ],
          ];
          const visibleDetails = details.filter(
            (detail): detail is [string, string] => hasText(detail[1]),
          );

          return (
            <tbody className="performance-exercise-group" key={exercise.id}>
              <tr className="performance-primary-row border-t border-[#dfe7e3] align-top text-[13px] font-semibold leading-[1.4] sm:text-sm print:text-[11pt] print:leading-[1.35]">
                <td className="p-2 font-black text-[#172b24] print:p-1.5">
                  {exercise.order}. {deliverableText(exercise.name) ?? "—"}
                </td>
                <td className="p-2 text-center print:p-1.5">
                  {deliverableText(exercise.sets) ?? "—"}
                </td>
                <td className="p-2 print:p-1.5">
                  {deliverableText(exercise.repetitions) ?? "—"}
                </td>
                <td className="p-2 print:p-1.5">{load || "—"}</td>
                <td className="p-2 print:p-1.5">
                  {deliverableText(exercise.restInterval) ?? "—"}
                </td>
                <td className="p-2 print:p-1.5">
                  {effortTarget(exercise) || "—"}
                </td>
              </tr>
              {visibleDetails.length ? (
                <tr className="border-t border-[#e8eeeb] bg-[#fafcfb]">
                  <td className="px-2 py-2" colSpan={6}>
                    <dl className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
                      {visibleDetails.map(([label, value]) => (
                        <div className="min-w-0 break-words" key={label}>
                          <dt className="inline font-black text-[#6f5520]">
                            {label}:{" "}
                          </dt>
                          <dd className="inline whitespace-pre-wrap text-[#40584f]">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

const runningEnvironmentLabels = {
  ROAD: "Rua",
  TRACK: "Pista",
  TREADMILL: "Esteira",
  TRAIL: "Trilha",
  MIXED: "Misto",
  OTHER: "Outro",
} as const;

function runningCompletion(stage: EnduranceSessionStage) {
  if (stage.completion.type === "TIME") {
    return formatRunningDuration(stage.completion.durationSeconds);
  }
  if (stage.completion.type === "DISTANCE") {
    return stage.completion.distanceMeters >= 1_000
      ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(stage.completion.distanceMeters / 1_000)} km`
      : `${stage.completion.distanceMeters} m`;
  }
  return "Comando manual";
}

function numericIntensity(target: EnduranceIntensityTarget) {
  if (!("target" in target)) return undefined;
  return target.target.valueType === "SINGLE"
    ? target.target.value
    : `${target.target.minimum}–${target.target.maximum}`;
}

function runningIntensity(
  target: EnduranceIntensityTarget | undefined,
  preserveLegacyPresentation = false,
) {
  if (!target || target.type === "NONE") {
    return preserveLegacyPresentation ? undefined : "Intensidade a definir";
  }
  if (target.type === "FREE_GUIDANCE") {
    return preserveLegacyPresentation
      ? target.guidance
      : "Esforço por orientação";
  }
  const value = numericIntensity(target);
  if (target.type === "RPE") return `RPE ${value}`;
  if (target.type === "HEART_RATE") return `${value} bpm`;
  if (target.type === "POWER") return `${value} W`;
  if (target.type === "CADENCE") return `${value} passos/min`;
  if (target.type === "PACE") {
    if (target.target.valueType !== "SINGLE") return `${value} s/km`;
    if (target.preferredDisplay === "SPEED") {
      const speed = speedKilometersPerHourFromPace(target.target.value);
      return speed
        ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(speed)} km/h`
        : undefined;
    }
    const minutes = Math.floor(target.target.value / 60);
    return `${minutes}:${String(Math.round(target.target.value % 60)).padStart(2, "0")} min/km`;
  }
  return undefined;
}

function runningIntensityDetail(
  stage: EnduranceSessionStage,
  preserveLegacyPresentation = false,
) {
  const label = runningIntensity(stage.intensityTarget, preserveLegacyPresentation);
  if (!label) return undefined;
  if (preserveLegacyPresentation) {
    return label === stage.studentInstruction ? undefined : label;
  }
  if (
    stage.intensityTarget?.type === "FREE_GUIDANCE" &&
    stage.intensityTarget.guidance !== stage.studentInstruction
  ) {
    return `${label}: ${stage.intensityTarget.guidance}`;
  }
  return label;
}

function runningStudentGuidance(value: string) {
  const guidance = deliverableText(value);
  if (guidance?.startsWith("Proposta assistida de Corrida.")) return undefined;
  return guidance;
}

function RunningSessionBlockPrint({
  block,
  preserveLegacyPresentation,
}: {
  readonly block: EnduranceSessionBlock;
  readonly preserveLegacyPresentation: boolean;
}) {
  if (block.blockType === "STAGE") {
    const stage = block.stage;
    const intensity = runningIntensityDetail(stage, preserveLegacyPresentation);
    return (
      <article className="performance-session-block performance-session-stage grid min-w-0 gap-1 border-b border-[#d8e2de] px-1 py-2 text-sm md:grid-cols-[minmax(7rem,0.6fr)_minmax(9rem,0.8fr)_minmax(0,2fr)] md:items-baseline">
        <h4 className="font-black text-[#173c30]">{stage.name}</h4>
        <p className="font-semibold text-[#40584f]">{runningCompletion(stage)}{intensity ? ` · ${intensity}` : ""}</p>
        <p className="whitespace-pre-wrap break-words text-xs text-[#52675f]">{stage.studentInstruction}</p>
      </article>
    );
  }
  const recoveryCount = block.stages.some((stage) => stage.type === "RECOVERY")
    ? Math.max(0, block.repetitions - (block.includeRecoveryAfterLast ? 0 : 1))
    : 0;
  return (
    <article className="performance-session-block rounded-lg border border-[#d8e2de] p-3">
      <p className="mb-2 text-sm font-black text-[#173c30]">
        {block.repetitions} repetições · {recoveryCount} recuperações
        {block.includeRecoveryAfterLast ? " (inclusive após a última)" : " (somente entre os tiros)"}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {block.stages.map((stage) => {
          const intensity = runningIntensityDetail(stage, preserveLegacyPresentation);
          return (
            <div className="rounded-md bg-[#fafcfb] p-2 text-sm" key={stage.id}>
              <dt className="font-black text-[#173c30]">{stage.name}</dt>
              <dd className="mt-1 text-[#40584f]">{runningCompletion(stage)}{intensity ? ` · ${intensity}` : ""}</dd>
              <dd className="mt-1 whitespace-pre-wrap break-words text-xs text-[#52675f]">{stage.studentInstruction}</dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

function RunningSessionPrint({
  preserveLegacyPresentation = false,
  sectionTitle,
  session,
}: {
  readonly preserveLegacyPresentation?: boolean;
  readonly sectionTitle?: string;
  readonly session: StructuredEnduranceSession;
}) {
  const totals = runningPrescriptionTotals(session);
  const studentGuidance = runningStudentGuidance(session.professionalGuidance);
  const printableTextLength = [
    session.title,
    session.objective,
    studentGuidance,
    ...session.blocks.flatMap((block) =>
      (block.blockType === "STAGE" ? [block.stage] : block.stages)
        .flatMap((stage) => [stage.name, stage.studentInstruction]),
    ),
  ].filter(Boolean).join(" ").length;
  const keepSessionTogether = printableTextLength <= 1_200;
  const [firstBlock, ...remainingBlocks] = session.blocks;
  return (
    <section
      className={`performance-session ${keepSessionTogether ? "performance-session-keep-together" : "performance-session-can-split"}`}
      key={session.id}
    >
      <div className="performance-session-opening">
      <div className="performance-session-heading mb-3 rounded-lg border-l-4 border-[#b38b35] bg-[#edf3f0] px-3 py-2.5">
        {sectionTitle ? (
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#6f5520]">
            {sectionTitle}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="min-w-0 whitespace-pre-wrap break-words text-lg font-black text-[#173c30]">{session.title}</h3>
          <p className="shrink-0 text-sm font-bold text-[#40584f]">
            {runningDateLabel(session.scheduledDate)} · {runningEnvironmentLabels[session.environment]}
          </p>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-[#40584f]"><span className="font-black">Objetivo:</span> {session.objective}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[#52675f]">
          {totals.durationSeconds !== undefined ? (
            <span>
              Tempo {totals.durationCompleteness === "PARTIAL" ? "parcial" : "prescrito"}: <span className="whitespace-nowrap">{formatRunningDuration(totals.durationSeconds)}</span>
            </span>
          ) : totals.durationCompleteness === "PARTIAL" ? (
            <span>Tempo parcial: não calculável sem ritmo ou velocidade</span>
          ) : null}
          {totals.distanceMeters !== undefined ? (
            <span>
              · Distância {totals.distanceCompleteness === "PARTIAL" ? "parcial" : "prescrita"}: <span className="whitespace-nowrap">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(totals.distanceMeters / 1_000)} km</span>
            </span>
          ) : null}
          {session.estimatedDurationSeconds !== undefined ? <span>· duração originalmente planejada: <span className="whitespace-nowrap">{formatRunningDuration(session.estimatedDurationSeconds)}</span></span> : null}
          {session.estimatedDistanceMeters !== undefined ? <span>· distância originalmente planejada: <span className="whitespace-nowrap">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(session.estimatedDistanceMeters / 1_000)} km</span></span> : null}
        </div>
      </div>
      {firstBlock ? (
        <div className="performance-session-blocks">
          <RunningSessionBlockPrint block={firstBlock} preserveLegacyPresentation={preserveLegacyPresentation} />
        </div>
      ) : null}
      </div>
      <div className="performance-session-blocks space-y-2">
        {remainingBlocks.map((block) => (
          <RunningSessionBlockPrint
            block={block}
            key={block.id}
            preserveLegacyPresentation={preserveLegacyPresentation}
          />
        ))}
      </div>
      {studentGuidance ? (
        <p className="performance-session-guidance mt-3 text-sm leading-6 text-[#40584f]"><span className="font-black">Orientação:</span> {studentGuidance}</p>
      ) : null}
    </section>
  );
}

function RunningCyclePrint({
  preserveLegacyPresentation = false,
  running,
  showConfigurationSummary = false,
  title,
}: {
  readonly preserveLegacyPresentation?: boolean;
  readonly running: WorkoutPlanEnduranceModality<"RUNNING">;
  readonly showConfigurationSummary?: boolean;
  readonly title: string;
}) {
  const configuration = running.configuration;
  return (
    <Section title={title}>
      {showConfigurationSummary ? (
        <dl className="mb-4 grid gap-3 rounded-xl border border-[#d8e2de] bg-[#fafcfb] p-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Objetivo da Corrida"
            value={deliverableText(configuration.primaryObjective)}
          />
          <Field
            label="Meta"
            value={runningGoalLabel(configuration.testGoal)}
          />
          <Field
            label="Período"
            value={runningPeriodLabel(
              configuration.startDate,
              configuration.cycleDurationWeeks,
            )}
          />
        </dl>
      ) : null}
      <div className="running-cycle-reading-guide mb-4 grid gap-3 text-xs leading-5 sm:grid-cols-2">
        <article className="border-l-4 border-sky-700 bg-sky-50 p-3">
          <h3 className="font-black text-slate-950">Como ler sua planilha</h3>
          <p className="mt-1 text-slate-700">
            Encontre a semana e a data, siga a sequência dos blocos e use somente a intensidade escrita. “A planejar” não significa descanso prescrito.
          </p>
        </article>
        <article className="border-l-4 border-emerald-700 bg-emerald-50 p-3">
          <h3 className="font-black text-slate-950">Orientações do ciclo</h3>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">
            {deliverableText(running.configuration.generalObservation) ?? "Nenhuma orientação adicional registrada."}
          </p>
        </article>
      </div>
      <RunningWeekGrid
        preserveLegacyQualitativePresentation={preserveLegacyPresentation}
        printMode
        running={running}
      />
    </Section>
  );
}

export function PerformanceDeliverablePreview({
  contentScope = "FULL",
  documentStatus,
  hidePrintActions = false,
  printMode = false,
  professional,
  view,
}: {
  readonly contentScope?: "FULL" | "RUNNING";
  readonly documentStatus?: string;
  readonly hidePrintActions?: boolean;
  readonly printMode?: boolean;
  readonly professional: PhysicalDocumentProfessionalIdentity;
  readonly view: PerformanceWorkoutView;
}) {
  const { draft } = view;
  const runningOnly = contentScope === "RUNNING";
  const running = draft.endurance?.running;
  const runningConfiguration = running?.configuration;
  const strengthSessions = draft.sessions.filter(
    (session) => session.exercises.length > 0,
  );
  const runningSessions = running?.weeks
    .flatMap((week) => week.sessions)
    .flatMap((session) =>
      session.sessionKind === "STRUCTURED" ? [session] : [],
    ) ?? [];
  const isGeneralDraftPreview =
    contentScope === "FULL" && view.status === "DRAFT" && Boolean(documentStatus);
  const hasStrengthPrescription = strengthSessions.length > 0;
  const hasRunningPrescription = runningSessions.length > 0;
  const generalPreviewRunningOnly =
    isGeneralDraftPreview && hasRunningPrescription && !hasStrengthPrescription;
  const mixedGeneralPreview =
    isGeneralDraftPreview && hasRunningPrescription && hasStrengthPrescription;
  const runningIdentity = runningOnly || generalPreviewRunningOnly;
  const documentTitle = runningOnly
    ? "Planejamento de Corrida"
    : generalPreviewRunningOnly
      ? "Plano de Corrida"
      : "Plano de Treino";
  const strategy = draft.strategy;
  const methods = buildWorkoutMethodGlossary(draft);
  const methodNames = new Map(
    methods.map((method) => [method.methodId, method.name]),
  );
  const clinic = CLINIC_INSTITUTIONAL_CONFIG;
  const objective = runningIdentity
    ? deliverableText(runningConfiguration?.primaryObjective)
    : deliverableText(draft.service.trainingObjective);
  const validity = runningIdentity && runningConfiguration
    ? runningPeriodLabel(
        runningConfiguration.startDate,
        runningConfiguration.cycleDurationWeeks,
      )
    : validityLabel(strategy);
  const runningGoal = runningGoalLabel(runningConfiguration?.testGoal);
  const issuedAt = documentStatus ? undefined : dateLabel(view.updatedAt);
  const runningForFullDocument =
    !runningOnly && running && (!isGeneralDraftPreview || hasRunningPrescription)
      ? running
      : undefined;
  const preserveFinalizedPresentation = view.status !== "DRAFT";

  return (
    <div className="space-y-4">
      {!hidePrintActions ? (
        <div className="flex flex-wrap justify-end gap-3 print:hidden">
          <DocumentPrintActions autoPrint={printMode} documentTitle={`${documentTitle} - ${view.patient.name}`} targetId="performance-deliverable-report" />
        </div>
      ) : null}
      <article
        className={`mx-auto w-full ${hasRunningPrescription ? "max-w-[297mm]" : "max-w-[210mm]"} rounded-2xl border border-[#c8d6d0] bg-white text-[#20312b] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none`}
        id="performance-deliverable-report"
      >
        <style>{`
          #performance-deliverable-report,
          #performance-deliverable-report * { box-sizing: border-box; }
          #performance-deliverable-report,
          #performance-deliverable-report table { width: 100%; max-width: 100%; overflow: visible; }
          #performance-deliverable-report th,
          #performance-deliverable-report td { overflow-wrap: break-word; word-break: normal; }
          #performance-deliverable-report p,
          #performance-deliverable-report li,
          #performance-deliverable-report dd,
          #performance-deliverable-report dt,
          #performance-deliverable-report h1,
          #performance-deliverable-report h2,
          #performance-deliverable-report h3,
          #performance-deliverable-report h4 { overflow-wrap: anywhere; word-break: normal; }
          #performance-deliverable-report .performance-primary-row td { overflow-wrap: anywhere; }
          #performance-deliverable-report .performance-document-header > div > div:first-child > svg {
            width: 2.75rem;
            height: 2.75rem;
          }
          #performance-deliverable-report .performance-document-header > div > div:nth-child(2) { margin-top: 0.625rem; }
          #performance-deliverable-report .performance-document-header > div > div:nth-child(2) h1 { margin-top: 0.25rem; }
          @media print {
            @page { size: ${hasRunningPrescription ? "A4 landscape" : "A4 portrait"}; margin: 10mm; }
            #performance-deliverable-report {
              width: 100% !important;
              max-width: none !important;
              min-height: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #performance-deliverable-report table {
              width: 100% !important;
              max-width: 100% !important;
              table-layout: fixed !important;
              overflow: visible !important;
              break-inside: auto !important;
              page-break-inside: auto !important;
            }
            #performance-deliverable-report .performance-primary-row {
              font-size: 11pt !important;
              line-height: 1.35 !important;
            }
            #performance-deliverable-report .performance-primary-row td {
              padding: 1.5mm !important;
              overflow-wrap: anywhere !important;
            }
            #performance-deliverable-report .performance-report-section {
              overflow: visible !important;
              break-inside: auto !important;
              page-break-inside: auto !important;
            }
            #performance-deliverable-report .performance-report-section {
              padding: 5mm 7mm !important;
            }
            #performance-deliverable-report .performance-session {
              overflow: visible !important;
            }
            #performance-deliverable-report .performance-session-keep-together {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .performance-session-block,
            #performance-deliverable-report .performance-session-guidance {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .performance-exercise-group,
            #performance-deliverable-report .performance-method-card,
            #performance-deliverable-report .performance-signature {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .performance-section-heading,
            #performance-deliverable-report .performance-session-heading,
            #performance-deliverable-report .performance-table-heading {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
            #performance-deliverable-report thead { display: table-header-group; }
            #performance-deliverable-report .performance-table-frame {
              overflow: visible !important;
            }
            #performance-deliverable-report .running-week-row {
              grid-template-columns: 17mm repeat(7, minmax(0, 1fr)) !important;
              min-height: 0 !important;
            }
            #performance-deliverable-report .running-week-row-has-sessions {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .running-week-header {
              grid-template-columns: 17mm repeat(7, minmax(0, 1fr)) !important;
            }
            #performance-deliverable-report .running-week-row > div {
              min-width: 0 !important;
              min-height: 0 !important;
            }
            #performance-deliverable-report .running-session-summary {
              padding: 1.5mm !important;
            }
            #performance-deliverable-report .running-cycle-reading-guide {
              margin-bottom: 2mm !important;
              gap: 2mm !important;
            }
            #performance-deliverable-report .running-week-grid > * + * {
              margin-top: 2mm !important;
            }
            #performance-deliverable-report .running-week-grid > div:first-child {
              padding-top: 1mm !important;
              padding-bottom: 1mm !important;
            }
            #performance-deliverable-report .running-session-sequence,
            #performance-deliverable-report .running-session-intensity,
            #performance-deliverable-report .running-session-totals {
              margin-top: 1mm !important;
            }
            #performance-deliverable-report .running-session-sequence {
              row-gap: 0 !important;
            }
            #performance-deliverable-report .running-session-intensity {
              padding: 0.5mm 1mm !important;
            }
            #performance-deliverable-report .performance-session-stage {
              display: grid !important;
              grid-template-columns: 26mm 40mm minmax(0, 1fr) !important;
              align-items: start !important;
              column-gap: 3mm !important;
              padding-top: 1mm !important;
              padding-bottom: 1mm !important;
            }
            #performance-deliverable-report .performance-session-heading > div:first-child {
              flex-direction: row !important;
              align-items: baseline !important;
              justify-content: space-between !important;
            }
            #performance-deliverable-report .performance-session-heading {
              margin-bottom: 2mm !important;
              padding: 2mm 3mm !important;
            }
            #performance-deliverable-report .performance-session-blocks > * + * {
              margin-top: 1mm !important;
            }
            #performance-deliverable-report .performance-session-guidance {
              margin-top: 2mm !important;
            }
            #performance-deliverable-report .performance-session-opening {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .performance-document-footer {
              padding: 3mm 7mm !important;
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            #performance-deliverable-report .performance-signature {
              padding-top: 0 !important;
            }
            #performance-deliverable-report .performance-document-footer > div {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
              align-items: end !important;
              gap: 8mm !important;
            }
            #performance-deliverable-report [class*="running-intensity-"] {
              background: white !important;
              color: black !important;
            }
            #performance-deliverable-report .running-intensity-Z1 { border-style: dotted !important; }
            #performance-deliverable-report .running-intensity-Z2 { border-style: dashed !important; }
            #performance-deliverable-report .running-intensity-Z3 { border-style: solid !important; }
            #performance-deliverable-report .running-intensity-Z4 { border-style: double !important; }
            #performance-deliverable-report .running-intensity-Z5 { border-width: 2px !important; }
          }
        `}</style>
        <header className="performance-document-header bg-[#173c30] px-5 py-4 text-white sm:px-7">
          <DeliverableDocumentHeader
            eyebrow={clinic.documentSubtitle}
            performanceModality={runningIdentity ? "running" : undefined}
            theme="performance"
            title={documentTitle}
          />
          {documentStatus ? (
            <p className="mt-2 w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-amber-950">
              {documentStatus}
            </p>
          ) : null}
          {issuedAt ? (
            <p className="mt-2 text-right text-xs text-[#dce7e2]">
              <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#a9c1b8]">
                Data de emissão
              </span>
              {issuedAt}
            </p>
          ) : null}

          <dl className="mt-3 grid gap-x-7 gap-y-2 border-t border-white/20 pt-3 sm:grid-cols-2">
            <Field
              className="[&_dd]:text-white [&_dt]:text-[#a9c1b8]"
              label="Aluno"
              value={deliverableText(view.patient.name)}
            />
            <Field
              className="[&_dd]:text-white [&_dt]:text-[#a9c1b8]"
              label="Código do aluno"
              value={deliverableText(view.patient.code)}
            />
            <Field
              className="sm:col-span-2 [&_dd]:text-white [&_dt]:text-[#a9c1b8]"
              label={runningIdentity ? "Objetivo da Corrida" : "Objetivo geral"}
              value={generalPreviewRunningOnly ? objective ?? NOT_INFORMED : objective}
            />
            {runningIdentity ? (
              <Field
                className="sm:col-span-2 [&_dd]:text-white [&_dt]:text-[#a9c1b8]"
                label="Meta"
                value={generalPreviewRunningOnly ? runningGoal ?? NOT_INFORMED : runningGoal}
              />
            ) : null}
            <Field
              className="[&_dd]:text-white [&_dt]:text-[#a9c1b8]"
              label="Período de validade"
              value={validity}
            />
            <Field
              className="[&_dd]:text-white [&_dt]:text-[#a9c1b8]"
              label="Profissional responsável"
              value={
                <>
                  {professional.fullName}
                  {professional.registrations.length
                    ? ` · ${professional.registrations.join(" · ")}`
                    : ""}
                </>
              }
            />
          </dl>
        </header>

        {runningOnly && running ? (
          <RunningCyclePrint
            preserveLegacyPresentation={preserveFinalizedPresentation}
            running={running}
            title="Planejamento do ciclo"
          />
        ) : null}

        {!runningOnly && !generalPreviewRunningOnly ? <Section title={mixedGeneralPreview ? "Musculação · percurso no treino" : "Seu percurso no treino"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-[#d8e2de] bg-[#fafcfb] p-4 sm:col-span-3">
              <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#173c30]">
                Percurso registrado
              </h3>
              {strategy.transitions?.length ? (
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {strategy.transitions.map((transition, index) => (
                    <li
                      className="rounded-lg border border-[#e2e9e6] bg-white p-3 text-xs leading-5"
                      key={`${transition.effectiveDate}-${transition.recordedAt}-${index}`}
                    >
                      <p className="font-black text-[#173c30]">
                        {dateLabel(transition.effectiveDate) ?? NOT_INFORMED}
                      </p>
                      <p className="mt-1">
                        Fase: {journeyValue(transition.phaseBefore)} →{" "}
                        {journeyValue(transition.phaseAfter)}
                      </p>
                      <p>
                        Foco: {journeyValue(transition.focusBefore)} →{" "}
                        {journeyValue(transition.focusAfter)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-[#52675f]">
                  Nenhuma mudança de fase registrada
                </p>
              )}
            </article>

            <article className="rounded-xl border border-[#d8e2de] bg-[#fafcfb] p-4">
              <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#173c30]">
                Agora
              </h3>
              <p className="mt-2 text-xs leading-5">
                <span className="font-black">Fase:</span>{" "}
                {journeyValue(strategy.currentPhase)}
              </p>
              <p className="text-xs leading-5">
                <span className="font-black">Foco:</span>{" "}
                {journeyValue(strategy.currentFocus)}
              </p>
            </article>

            <article className="rounded-xl border border-[#d8e2de] bg-[#fafcfb] p-4 sm:col-span-2">
              <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#173c30]">
                Próximo passo
              </h3>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6f5520]">
                Planejamento
              </p>
              <p className="mt-2 text-xs leading-5">
                <span className="font-black">Fase:</span>{" "}
                {journeyValue(strategy.nextPhase)}
              </p>
              <p className="text-xs leading-5">
                <span className="font-black">Foco:</span>{" "}
                {journeyValue(strategy.nextFocus)}
              </p>
            </article>
          </div>
        </Section> : null}

        {!runningOnly && strengthSessions.length ? (
          <Section title={mixedGeneralPreview ? "Musculação · sessões de treino" : "Sessões de treino"}>
            <div className="space-y-7">
              {strengthSessions.map((session) => {
                const sessionName =
                  deliverableText(session.name) ?? "Sessão de treino";
                const sessionObjective = deliverableText(session.objective);
                const duration = deliverableText(session.estimatedDuration);

                return (
                  <section className="performance-session" key={session.id}>
                    <div className="performance-session-heading mb-3 rounded-lg border-l-4 border-[#b38b35] bg-[#edf3f0] px-3 py-2.5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        <h3 className="min-w-0 text-lg font-black text-[#173c30]">
                          {sessionName}
                        </h3>
                        {duration ? (
                          <p className="shrink-0 text-xs font-bold text-[#52675f]">
                            Duração estimada: {duration}
                          </p>
                        ) : null}
                      </div>
                      {sessionObjective ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#40584f]">
                          <span className="font-black">Objetivo:</span>{" "}
                          {sessionObjective}
                        </p>
                      ) : null}
                    </div>
                    {session.exercises.length ? (
                      <ExerciseTable
                        exercises={session.exercises}
                        methodNames={methodNames}
                      />
                    ) : null}
                  </section>
                );
              })}
            </div>
          </Section>
        ) : null}

        {runningForFullDocument ? (
          <RunningCyclePrint
            preserveLegacyPresentation={preserveFinalizedPresentation}
            running={runningForFullDocument}
            showConfigurationSummary={mixedGeneralPreview}
            title={mixedGeneralPreview ? "Corrida · planejamento do ciclo" : "Planejamento da Corrida"}
          />
        ) : null}

        {runningSessions.length ? (
          <div className={runningIdentity ? "performance-running-details" : ""}>
          <section className="performance-report-section border-t border-[#d9e3de] px-5 py-5 sm:px-7">
            <div className="performance-running-first-session">
              <div>
                <RunningSessionPrint
                  preserveLegacyPresentation={preserveFinalizedPresentation}
                  sectionTitle={runningIdentity ? "Detalhes das sessões" : mixedGeneralPreview ? "Corrida · detalhes das sessões" : "Planilha de corrida"}
                  session={runningSessions[0]}
                />
              </div>
            </div>
            {runningSessions.length > 1 ? (
              <div className="mt-7 space-y-7">
                {runningSessions.slice(1).map((session) => (
                  <RunningSessionPrint
                    key={session.id}
                    preserveLegacyPresentation={preserveFinalizedPresentation}
                    session={session}
                  />
                ))}
              </div>
            ) : null}
          </section>
          </div>
        ) : null}

        {!runningOnly && methods.length ? (
          <Section title="Métodos de treinamento utilizados">
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.map((method) => {
                const studentExplanation = deliverableText(
                  method.studentExplanation,
                );
                const executionInstruction = deliverableText(
                  method.executionInstruction,
                );
                const methodObjective = deliverableText(method.objective);

                return (
                  <article
                    className="performance-method-card rounded-xl border border-[#d8e2de] bg-[#fafcfb] p-4"
                    key={method.methodId}
                  >
                    <h3 className="font-black text-[#173c30]">
                      <span className="mr-2 text-[#b38b35]">●</span>
                      {method.name}
                    </h3>
                    {studentExplanation ? (
                      <p className="mt-2 text-xs leading-5">
                        <span className="font-black">Para o aluno:</span>{" "}
                        {studentExplanation}
                      </p>
                    ) : null}
                    {executionInstruction ? (
                      <p className="mt-2 text-xs leading-5">
                        <span className="font-black">Execução:</span>{" "}
                        {executionInstruction}
                      </p>
                    ) : null}
                    {methodObjective ? (
                      <p className="mt-2 text-xs leading-5">
                        <span className="font-black">Objetivo:</span>{" "}
                        {methodObjective}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Section>
        ) : null}

        <footer className="performance-document-footer border-t border-[#cbd9d3] bg-[#f4f7f5] px-5 py-7 sm:px-7">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="performance-signature w-full max-w-sm pt-10">
              <div className="border-t border-[#40584f] pt-2 text-xs leading-5">
                <p className="font-black text-[#173c30]">
                  {professional.fullName}
                </p>
                {professional.title ? <p>{professional.title}</p> : null}
                {professional.registrations.length ? (
                  <p>{professional.registrations.join(" · ")}</p>
                ) : null}
                <p className="text-[#5d7069]">
                  Responsável pela prescrição de Performance
                </p>
              </div>
            </div>
            <div>
              <InstitutionalDocumentIdentity className="max-w-[118mm]" compact />
              {issuedAt ? <p className="mt-2 text-xs leading-5 text-[#5d7069] sm:text-right">Emitido em {issuedAt}</p> : null}
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

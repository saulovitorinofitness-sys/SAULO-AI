import type { ReactNode } from "react";

import { DeliverableDocumentHeader } from "@/components/deliverables/deliverable-document-header";
import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import type {
  PosturalAnnotationLayer,
  PosturalAssessmentData,
  PosturalReferenceLines,
  PosturalSegmentAssessment,
  PosturalViewKey,
} from "@/features/clinical-collection";
import type { SavedPosturalEvolutionComparison } from "@/features/clinical-collection/postural-evolution";
import type { PosturalHistoryItem } from "@/features/clinical-collection/postural-history";
import { posturalSegmentsByView } from "@/features/clinical-collection/postural-segments";
import type { PhysicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";

import { DocumentPrintActions } from "./document-print-actions";

const viewLabels: Readonly<Record<PosturalViewKey, string>> = {
  ANTERIOR: "Anterior / frontal",
  POSTERIOR: "Posterior",
  RIGHT_LATERAL: "Lateral direita",
  LEFT_LATERAL: "Lateral esquerda",
};
const gradeLabels = {
  DISCREET: "Discreto",
  MODERATE: "Moderado",
  ACCENTUATED: "Acentuado",
} as const;
const relevanceLabels = {
  NONE: "Sem relevância registrada",
  LOW: "Relevância baixa",
  MODERATE: "Relevância moderada",
  HIGH: "Relevância alta",
} as const;
const priorityLabels = { LOW: "Baixa", MODERATE: "Moderada", HIGH: "Alta" } as const;
const followUpLabels = {
  REGISTER_ONLY: "Somente registrar",
  MONITOR_EVOLUTION: "Monitorar evolução",
  REASSESS_LATER: "Reavaliar posteriormente",
  CONSIDER_IN_TRAINING: "Considerar no treinamento",
  SUGGEST_COMPLEMENTARY_INVESTIGATION: "Sugerir investigação complementar",
  SUGGEST_QUALIFIED_REFERRAL: "Sugerir encaminhamento qualificado",
  OTHER: "Outra conduta",
} as const;
const precautionLabels = {
  AVOID: "Evitar",
  RESTRICTION: "Restrição",
  COMPENSATION: "Compensação",
  ATTENTION: "Atenção",
  OTHER: "Outra",
} as const;

function dateLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? undefined
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

function findingDetails(finding: PosturalSegmentAssessment) {
  return [
    finding.selectedOption?.trim(),
    finding.grade ? `Grau: ${gradeLabels[finding.grade]}` : undefined,
    finding.relevance
      ? relevanceLabels[finding.relevance]
      : undefined,
    finding.observation?.trim()
      ? `Observação: ${finding.observation.trim()}`
      : undefined,
    finding.investigationSuggestions?.length
      ? `Investigação registrada: ${finding.investigationSuggestions.join(", ")}`
      : undefined,
    finding.otherInvestigation?.trim()
      ? `Outra investigação: ${finding.otherInvestigation.trim()}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
}

function Annotation({ layer }: { readonly layer: PosturalAnnotationLayer }) {
  if (layer.visible === false) return null;
  const color = layer.color || "#0ea5e9";
  const opacity = layer.opacity ?? 1;
  const strokeWidth = (layer.thicknessPx ?? 2) * 2;
  const point = (value: number | undefined) => (value ?? 0) * 1000;

  if (layer.type === "ARROW" && layer.start && layer.end) {
    return (
      <line
        markerEnd="url(#postural-arrow)"
        opacity={opacity}
        stroke={color}
        strokeWidth={strokeWidth}
        x1={point(layer.start.x)}
        x2={point(layer.end.x)}
        y1={point(layer.start.y)}
        y2={point(layer.end.y)}
      />
    );
  }
  if (layer.type === "CIRCLE" && layer.center && layer.radius) {
    return (
      <circle
        cx={point(layer.center.x)}
        cy={point(layer.center.y)}
        fill="none"
        opacity={opacity}
        r={layer.radius * 1000}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (layer.type === "TEXT" && layer.center && layer.text?.trim()) {
    return (
      <text
        fill={color}
        fontSize={Math.max(22, 30 * (layer.scale ?? 1))}
        fontWeight="700"
        opacity={opacity}
        textAnchor="middle"
        transform={`rotate(${layer.rotationDeg ?? 0} ${point(layer.center.x)} ${point(layer.center.y)})`}
        x={point(layer.center.x)}
        y={point(layer.center.y)}
      >
        {layer.text}
      </text>
    );
  }
  if (layer.type === "FREEHAND" && layer.points?.length) {
    return (
      <polyline
        fill="none"
        opacity={opacity}
        points={layer.points.map((item) => `${point(item.x)},${point(item.y)}`).join(" ")}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    );
  }
  return null;
}

function PosturalImage({
  annotations,
  data,
  label,
  referenceLines,
}: {
  readonly annotations: readonly PosturalAnnotationLayer[];
  readonly data: NonNullable<PosturalAssessmentData["views"][PosturalViewKey]["image"]>;
  readonly label: string;
  readonly referenceLines?: PosturalReferenceLines;
}) {
  const visibleLines = referenceLines?.enabled
    ? [...referenceLines.horizontal, ...referenceLines.vertical].filter(
        (line) => line.visible !== false,
      )
    : [];

  return (
    <figure className="overflow-hidden rounded-xl border border-sky-200 bg-slate-950">
      <div className="relative">
        {/* O conteúdo é uma imagem real persistida na avaliação. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`Registro postural — ${label}`} className="block h-auto w-full" src={data.dataUrl} />
        {annotations.length || visibleLines.length ? (
          <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 1000 1000">
            <defs>
              <marker id="postural-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
              </marker>
            </defs>
            {visibleLines.map((line) =>
              line.orientation === "HORIZONTAL" ? (
                <line key={line.id} opacity={line.opacity ?? 1} stroke={line.color} strokeWidth={(line.thicknessPx ?? 1) * 2} x1="0" x2="1000" y1={line.position * 1000} y2={line.position * 1000} />
              ) : (
                <line key={line.id} opacity={line.opacity ?? 1} stroke={line.color} strokeWidth={(line.thicknessPx ?? 1) * 2} x1={line.position * 1000} x2={line.position * 1000} y1="0" y2="1000" />
              ),
            )}
            {annotations.map((layer) => <Annotation key={layer.id} layer={layer} />)}
          </svg>
        ) : null}
      </div>
      <figcaption className="bg-sky-950 px-3 py-2 text-xs font-bold text-white">{label}</figcaption>
    </figure>
  );
}

function TextSection({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return (
    <section className="border-t border-sky-100 px-6 py-5 sm:px-8 print:px-0 print:py-3">
      <h2 className="text-base font-black text-sky-950 print:break-after-avoid">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-700 print:mt-2">{children}</div>
    </section>
  );
}

function correctiveItems(data: PosturalAssessmentData) {
  const plan = data.correctivePlan;
  if (!plan) return [];
  return [
    ...(plan.objectives ?? []).map((item) => ({
      group: "Objetivo corretivo",
      name: item.title,
      detail: [item.description, item.priority ? `Prioridade ${priorityLabels[item.priority]}` : undefined, item.expectedTimeframe].filter(Boolean).join(" · "),
    })),
    ...(plan.stretching ?? []).map((item) => ({
      group: "Alongamento",
      name: item.exerciseName,
      detail: [item.region, item.sets ? `${item.sets} séries` : undefined, item.durationSeconds ? `${item.durationSeconds}s` : undefined, item.frequency, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.activation ?? []).map((item) => ({
      group: "Ativação / fortalecimento",
      name: item.exerciseName,
      detail: [item.muscleOrRegion, item.sets ? `${item.sets} séries` : undefined, item.repetitions ? `${item.repetitions} repetições` : undefined, item.durationSeconds ? `${item.durationSeconds}s` : undefined, item.frequency, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.stability ?? []).map((item) => ({
      group: "Estabilidade",
      name: item.exerciseName,
      detail: [item.objective, item.sets ? `${item.sets} séries` : undefined, item.repetitions ? `${item.repetitions} repetições` : undefined, item.durationSeconds ? `${item.durationSeconds}s` : undefined, item.frequency, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.mobility ?? []).map((item) => ({
      group: "Mobilidade",
      name: item.exerciseName,
      detail: [item.objective, item.sets ? `${item.sets} séries` : undefined, item.repetitions ? `${item.repetitions} repetições` : undefined, item.frequency, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.motorControl ?? []).map((item) => ({
      group: "Controle motor",
      name: item.exerciseName,
      detail: [item.objective, item.progression, item.sets ? `${item.sets} séries` : undefined, item.repetitions ? `${item.repetitions} repetições` : undefined, item.durationSeconds ? `${item.durationSeconds}s` : undefined, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.correctiveExercises ?? []).map((item) => ({
      group: "Exercício corretivo",
      name: item.exerciseName,
      detail: [item.objective, item.load, item.sets ? `${item.sets} séries` : undefined, item.repetitions ? `${item.repetitions} repetições` : undefined, item.durationSeconds ? `${item.durationSeconds}s` : undefined, item.intervalSeconds ? `${item.intervalSeconds}s de intervalo` : undefined, item.frequency, item.observation].filter(Boolean).join(" · "),
    })),
    ...(plan.precautions ?? []).map((item) => ({
      group: "Precaução",
      name: item.description,
      detail: [item.type ? precautionLabels[item.type] : undefined, item.observation].filter(Boolean).join(" · "),
    })),
  ].filter((item) => item.name.trim());
}

export function PosturalDeliverablePreview({
  comparison,
  history,
  patient,
  printMode = false,
  professional,
}: {
  readonly comparison?: SavedPosturalEvolutionComparison;
  readonly history: readonly PosturalHistoryItem[];
  readonly patient: { readonly name: string; readonly code: string; readonly age?: number };
  readonly printMode?: boolean;
  readonly professional: PhysicalDocumentProfessionalIdentity;
}) {
  const current = history.at(-1);
  if (!current) return null;
  const data = current.data;
  const corrective = correctiveItems(data);
  const views = (Object.keys(viewLabels) as PosturalViewKey[]).map((key) => ({
    key,
    data: data.views[key],
    findings: posturalSegmentsByView[key].flatMap((segment) => {
      const finding = data.views[key].segments?.[segment.key];
      const details = finding ? findingDetails(finding) : [];
      return details.length ? [{ name: segment.name, details }] : [];
    }),
  }));
  const hasFindings = views.some((view) => view.findings.length || view.data.observation?.trim());
  const technicalSummary = data.technicalSummary?.editedSummary?.trim() || data.technicalSummary?.generatedOriginal?.trim();
  const evolutionText = comparison?.editedSummary?.trim() || comparison?.generatedSummary?.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3 print:hidden">
        <DocumentPrintActions autoPrint={printMode} documentTitle={`Relatório Postural - ${patient.name}`} targetId="postural-deliverable-report" />
      </div>
      <article className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none" id="postural-deliverable-report">
        <style>{`@media print {
          #postural-deliverable-report,
          #postural-deliverable-report section { break-inside: auto !important; page-break-inside: auto !important; }
          #postural-deliverable-report { font-size: 12.5pt; line-height: 1.5; }
          #postural-deliverable-report > header { padding: 8mm 3mm 7mm !important; }
          #postural-deliverable-report > header h1 { font-size: 29pt; line-height: 1.15; }
          #postural-deliverable-report > header .text-xs { font-size: 10.5pt; }
          #postural-deliverable-report > header > div:last-child { font-size: 12pt; line-height: 1.4; }
          #postural-deliverable-report > section { padding: 5.5mm 3mm 6mm !important; }
          #postural-deliverable-report > section > h2 { font-size: 16pt; line-height: 1.25; }
          #postural-deliverable-report > section > div { margin-top: 3.5mm; font-size: 12.5pt; line-height: 1.5; }
          #postural-deliverable-report section h3 { font-size: 13pt; line-height: 1.3; }
          #postural-deliverable-report figcaption { font-size: 10.5pt; }
          #postural-deliverable-report > footer { padding: 6mm 3mm !important; }
          #postural-deliverable-report > footer > div { width: 100%; max-width: none !important; font-size: 12pt; line-height: 1.45; }
          #postural-deliverable-report > footer > div > p:first-child { font-size: 15pt; line-height: 1.25; }
          #postural-deliverable-report > footer .text-xs { font-size: 10.5pt; line-height: 1.35; text-wrap: balance; }
          #postural-deliverable-report h2,
          #postural-deliverable-report h3 { break-after: avoid !important; page-break-after: avoid !important; }
          #postural-deliverable-report figure { break-inside: avoid !important; page-break-inside: avoid !important; }
          #postural-deliverable-report li { break-inside: avoid; page-break-inside: avoid; }
        }`}</style>
        <header className="relative overflow-hidden bg-gradient-to-br from-sky-950 to-sky-700 px-5 py-8 text-white sm:px-8 print:px-0 print:py-5">
          <DeliverableDocumentHeader
            description="Análise postural, identificação de assimetrias, observações por vista e orientação profissional integradas."
            eyebrow="Avaliação Postural"
            theme="assessments"
            title="Relatório Postural"
          />
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="font-black">Paciente:</span> {patient.name}</p>
            <p><span className="font-black">Prontuário:</span> {patient.code}</p>
            {patient.age !== undefined ? <p><span className="font-black">Idade:</span> {patient.age} anos</p> : null}
            <p><span className="font-black">Data da avaliação:</span> {dateLabel(current.assessedAt) ?? "Não informado"}</p>
          </div>
        </header>

        {views.some((view) => view.data.image) ? (
          <TextSection title="Registros fotográficos">
            <div className="grid gap-4 sm:grid-cols-2">
              {views.map((view) => view.data.image ? (
                <PosturalImage annotations={data.annotationLayers?.[view.key] ?? []} data={view.data.image} key={view.key} label={viewLabels[view.key]} referenceLines={data.referenceLines?.[view.key]} />
              ) : null)}
            </div>
          </TextSection>
        ) : null}

        {hasFindings ? (
          <TextSection title="Achados e observações por vista">
            <div className="space-y-5">
              {views.map((view) => view.findings.length || view.data.observation?.trim() ? (
                <section key={view.key}>
                  <h3 className="font-black text-sky-800">{viewLabels[view.key]}</h3>
                  {view.data.observation?.trim() ? <p className="mt-1 whitespace-pre-wrap">{view.data.observation.trim()}</p> : null}
                  {view.findings.length ? <ul className="mt-2 space-y-2 pl-5">{view.findings.map((finding) => <li className="list-disc" key={finding.name}><span className="font-bold">{finding.name}:</span> {finding.details.join(" · ")}</li>)}</ul> : null}
                </section>
              ) : null)}
            </div>
          </TextSection>
        ) : null}

        {data.identifiedChangesNotes?.trim() || data.functionalLimitationsNotes?.trim() ? (
          <TextSection title="Síntese dos registros">
            <dl className="grid gap-4 sm:grid-cols-2">
              {data.identifiedChangesNotes?.trim() ? <div><dt className="font-black text-sky-800">Alterações posturais registradas</dt><dd className="mt-1 whitespace-pre-wrap">{data.identifiedChangesNotes.trim()}</dd></div> : null}
              {data.functionalLimitationsNotes?.trim() ? <div><dt className="font-black text-sky-800">Limitações funcionais</dt><dd className="mt-1 whitespace-pre-wrap">{data.functionalLimitationsNotes.trim()}</dd></div> : null}
            </dl>
          </TextSection>
        ) : null}

        {technicalSummary || data.notes?.trim() ? (
          <TextSection title="Resumo técnico e observações">
            {technicalSummary ? <p className="whitespace-pre-wrap">{technicalSummary}</p> : null}
            {data.notes?.trim() ? <p className="mt-3 whitespace-pre-wrap">{data.notes.trim()}</p> : null}
          </TextSection>
        ) : null}

        {corrective.length || data.futureCorrectiveExercisesNote?.trim() || data.correctivePlan?.generalNotes?.trim() ? (
          <TextSection title="Fortalecimento, alongamento e condutas registradas">
            {data.futureCorrectiveExercisesNote?.trim() ? <p className="whitespace-pre-wrap">{data.futureCorrectiveExercisesNote.trim()}</p> : null}
            {corrective.length ? <ul className="mt-3 space-y-2 pl-5">{corrective.map((item, index) => <li className="list-disc" key={`${item.group}-${item.name}-${index}`}><span className="font-bold">{item.group} — {item.name}</span>{item.detail ? `: ${item.detail}` : ""}</li>)}</ul> : null}
            {data.correctivePlan?.generalNotes?.trim() ? <p className="mt-3 whitespace-pre-wrap">{data.correctivePlan.generalNotes.trim()}</p> : null}
          </TextSection>
        ) : null}

        {history.length > 1 ? (
          <TextSection title="Histórico e comparação evolutiva">
            <ol className="space-y-2 pl-5">{history.map((item) => <li className="list-decimal" key={item.assessmentId}>{dateLabel(item.assessedAt) ?? "Data não informada"} · {item.audit.professionalName}</li>)}</ol>
            {evolutionText ? <p className="mt-4 whitespace-pre-wrap">{evolutionText}</p> : null}
            {comparison?.evaluatorConclusion?.trim() ? <p className="mt-4 whitespace-pre-wrap"><span className="font-black">Conclusão evolutiva:</span> {comparison.evaluatorConclusion.trim()}</p> : null}
          </TextSection>
        ) : null}

        {data.evaluatorConclusion?.trim() ? <TextSection title="Conclusão da avaliação"><p className="whitespace-pre-wrap">{data.evaluatorConclusion.trim()}</p></TextSection> : null}

        {data.overallRelevance || data.followUp?.conduct || data.followUp?.observation?.trim() || data.followUp?.suggestedReassessmentDate || data.followUp?.reassessmentObservation?.trim() ? (
          <TextSection title="Relevância e acompanhamento">
            <dl className="grid gap-4 sm:grid-cols-2">
              {data.overallRelevance ? <div><dt className="font-black text-sky-800">Relevância geral registrada</dt><dd>{priorityLabels[data.overallRelevance]}</dd></div> : null}
              {data.followUp?.conduct ? <div><dt className="font-black text-sky-800">Conduta registrada</dt><dd>{followUpLabels[data.followUp.conduct]}</dd></div> : null}
              {data.followUp?.suggestedReassessmentDate ? <div><dt className="font-black text-sky-800">Reavaliação sugerida</dt><dd>{dateLabel(data.followUp.suggestedReassessmentDate) ?? data.followUp.suggestedReassessmentDate}</dd></div> : null}
              {data.followUp?.observation?.trim() ? <div><dt className="font-black text-sky-800">Observação de acompanhamento</dt><dd className="whitespace-pre-wrap">{data.followUp.observation.trim()}</dd></div> : null}
              {data.followUp?.reassessmentObservation?.trim() ? <div><dt className="font-black text-sky-800">Observação para reavaliação</dt><dd className="whitespace-pre-wrap">{data.followUp.reassessmentObservation.trim()}</dd></div> : null}
            </dl>
          </TextSection>
        ) : null}

        <footer className="border-t border-sky-200 bg-sky-50 px-6 py-8 sm:px-8 print:px-0 print:py-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md border-t border-sky-900 pt-3 text-sm">
              <p className="font-black text-sky-950">{professional.fullName}</p>
              {professional.title ? <p>{professional.title}</p> : null}
              {professional.registrations.length ? <p>{professional.registrations.join(" · ")}</p> : null}
              <p className="mt-2 text-xs text-slate-600">Responsável pela Avaliação Postural · registro atualizado em {dateLabel(current.audit.updatedAt) ?? "data não informada"}</p>
            </div>
            <InstitutionalDocumentIdentity className="max-w-[118mm]" compact />
          </div>
        </footer>
      </article>
    </div>
  );
}

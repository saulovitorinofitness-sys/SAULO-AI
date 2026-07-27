import type {
  PosturalAssessmentData,
  PosturalSegmentAssessment,
  PosturalSegmentGrade,
  PosturalViewKey,
} from "./contracts";
import type { PosturalHistoryItem } from "./postural-history";
import { posturalSegmentsByView } from "./postural-segments";

export type PosturalEvolutionClassification =
  | "PROGRESS"
  | "PARTIAL_PROGRESS"
  | "STABLE"
  | "REGRESSION"
  | "NOT_COMPARABLE"
  | "NOT_INFORMED";

export type PosturalEvolutionSituation =
  | "RESOLVED"
  | "IMPROVED"
  | "UNCHANGED"
  | "WORSENED"
  | "NEW"
  | "CHANGED"
  | "NOT_COMPARABLE"
  | "NOT_INFORMED";

export interface PosturalFindingComparison {
  readonly key: string;
  readonly view: PosturalViewKey;
  readonly segmentKey: string;
  readonly segmentName: string;
  readonly previous?: PosturalSegmentAssessment;
  readonly current?: PosturalSegmentAssessment;
  readonly situation: PosturalEvolutionSituation;
  readonly suggestedClassification: PosturalEvolutionClassification;
}

export interface PosturalEvolutionIndicators {
  readonly firstAssessmentAt?: string;
  readonly latestAssessmentAt?: string;
  readonly assessmentCount: number;
  readonly activeFindings: number;
  readonly resolvedFindings: number;
  readonly newFindings: number;
}

export interface SavedPosturalEvolutionComparison {
  readonly id: string;
  readonly previousAssessmentId: string;
  readonly currentAssessmentId: string;
  readonly classifications: Readonly<
    Record<string, PosturalEvolutionClassification>
  >;
  readonly visualSettings?: {
    readonly synchronized: boolean;
  };
  readonly generatedSummary?: string;
  readonly editedSummary?: string;
  readonly evaluatorConclusion?: string;
  readonly generatedAt?: string;
  readonly comparedAt: string;
  readonly updatedAt: string;
  readonly professionalName: string;
  readonly professionalTitle?: string;
  readonly professionalRegistration?: string;
  readonly professionalPhone?: string;
  readonly professionalInstagram?: string;
  readonly version: number;
}

export interface SavePosturalEvolutionComparisonInput {
  readonly previousAssessmentId: string;
  readonly currentAssessmentId: string;
  readonly classifications: Readonly<
    Record<string, PosturalEvolutionClassification>
  >;
  readonly visualSettings?: {
    readonly synchronized: boolean;
  };
  readonly generatedSummary?: string;
  readonly editedSummary?: string;
  readonly evaluatorConclusion?: string;
  readonly generatedAt?: string;
}

export type PosturalHistoryFilter =
  | "ALL"
  | "COMPLETED"
  | "LAST_30_DAYS"
  | "LAST_90_DAYS"
  | "LAST_YEAR"
  | "CUSTOM";

const viewLabels: Readonly<Record<PosturalViewKey, string>> = {
  ANTERIOR: "Vista Anterior",
  POSTERIOR: "Vista Posterior",
  RIGHT_LATERAL: "Vista Lateral Direita",
  LEFT_LATERAL: "Vista Lateral Esquerda",
};

const gradeWeight: Readonly<Record<PosturalSegmentGrade, number>> = {
  DISCREET: 1,
  MODERATE: 2,
  ACCENTUATED: 3,
};

const normalFinding = (value?: string) =>
  value?.trim().toLocaleLowerCase("pt-BR") ===
  "sem alteração aparente";

function isRecorded(assessment?: PosturalSegmentAssessment) {
  return Boolean(
    assessment?.selectedOption?.trim() ||
      assessment?.observation?.trim(),
  );
}

function isActive(assessment?: PosturalSegmentAssessment) {
  return (
    isRecorded(assessment) &&
    !normalFinding(assessment?.selectedOption)
  );
}

function situation(
  previous?: PosturalSegmentAssessment,
  current?: PosturalSegmentAssessment,
): Pick<
  PosturalFindingComparison,
  "situation" | "suggestedClassification"
> {
  const previousActive = isActive(previous);
  const currentActive = isActive(current);
  if (
    !previous ||
    !current ||
    !isRecorded(previous) ||
    !isRecorded(current)
  ) {
    return {
      situation: "NOT_INFORMED",
      suggestedClassification: "NOT_INFORMED",
    };
  }

  if (previousActive && !currentActive && isRecorded(current)) {
    return {
      situation: "RESOLVED",
      suggestedClassification: "PROGRESS",
    };
  }
  if (!previousActive && currentActive) {
    return {
      situation: "NEW",
      suggestedClassification: "NOT_COMPARABLE",
    };
  }
  if (!previousActive || !currentActive) {
    return {
      situation: "NOT_COMPARABLE",
      suggestedClassification: "NOT_COMPARABLE",
    };
  }

  if (previous.selectedOption === current.selectedOption) {
    const previousGrade = previous.grade
      ? gradeWeight[previous.grade]
      : undefined;
    const currentGrade = current.grade
      ? gradeWeight[current.grade]
      : undefined;

    if (
      previousGrade !== undefined &&
      currentGrade !== undefined &&
      currentGrade < previousGrade
    ) {
      return {
        situation: "IMPROVED",
        suggestedClassification: "PARTIAL_PROGRESS",
      };
    }
    if (
      previousGrade !== undefined &&
      currentGrade !== undefined &&
      currentGrade > previousGrade
    ) {
      return {
        situation: "WORSENED",
        suggestedClassification: "REGRESSION",
      };
    }
    return {
      situation: "UNCHANGED",
      suggestedClassification: "STABLE",
    };
  }

  return {
    situation: "CHANGED",
    suggestedClassification: "NOT_COMPARABLE",
  };
}

export function comparePosturalFindings(
  previous: PosturalAssessmentData,
  current: PosturalAssessmentData,
): readonly PosturalFindingComparison[] {
  return (
    Object.keys(posturalSegmentsByView) as PosturalViewKey[]
  ).flatMap((view) =>
    posturalSegmentsByView[view].flatMap((definition) => {
      const previousFinding =
        previous.views[view].segments?.[definition.key];
      const currentFinding =
        current.views[view].segments?.[definition.key];
      if (!isRecorded(previousFinding) && !isRecorded(currentFinding)) {
        return [];
      }

      return [
        {
          key: `${view}:${definition.key}`,
          view,
          segmentKey: definition.key,
          segmentName: definition.name,
          previous: previousFinding,
          current: currentFinding,
          ...situation(previousFinding, currentFinding),
        },
      ];
    }),
  );
}

export function generatePosturalEvolutionSummary(
  comparisons: readonly PosturalFindingComparison[],
  classifications: Readonly<
    Record<string, PosturalEvolutionClassification>
  > = {},
  context: {
    readonly previousAssessedAt?: string;
    readonly currentAssessedAt?: string;
  } = {},
) {
  if (!comparisons.length) return undefined;

  const lines = comparisons.map((comparison) => {
    const classification =
      classifications[comparison.key] ??
      comparison.suggestedClassification;
    const previous =
      comparison.previous?.selectedOption ??
      comparison.previous?.observation ??
      "sem registro comparável";
    const current =
      comparison.current?.selectedOption ??
      comparison.current?.observation ??
      "sem registro comparável";
    const label: Readonly<
      Record<PosturalEvolutionClassification, string>
    > = {
      PROGRESS: "melhora observada",
      PARTIAL_PROGRESS: "melhora parcial observada",
      STABLE: "sem alteração observada",
      REGRESSION: "piora aparente",
      NOT_COMPARABLE: "não comparável",
      NOT_INFORMED: "não informado",
    };
    return `- ${comparison.segmentName}: anteriormente foi registrado "${previous}" e, na avaliação atual, "${current}". Classificação profissional: ${label[classification]}.`;
  });

  const grouped = (
    Object.keys(viewLabels) as PosturalViewKey[]
  ).flatMap((view) => {
    const viewLines = comparisons
      .map((comparison, index) =>
        comparison.view === view ? lines[index] : undefined,
      )
      .filter((line): line is string => Boolean(line));
    return viewLines.length
      ? [`${viewLabels[view]}\n\n${viewLines.join("\n")}`]
      : [];
  });

  return [
    "RESUMO EVOLUTIVO POSTURAL",
    context.previousAssessedAt && context.currentAssessedAt
      ? `Na comparação entre as avaliações realizadas em ${new Intl.DateTimeFormat("pt-BR").format(new Date(context.previousAssessedAt))} e ${new Intl.DateTimeFormat("pt-BR").format(new Date(context.currentAssessedAt))}, foram considerados exclusivamente os achados registrados pela profissional. A classificação apresentada é observacional, editável e requer interpretação no contexto físico e funcional do paciente.`
      : "Síntese observacional baseada exclusivamente nos registros selecionados pela profissional.",
    ...grouped,
  ].join("\n\n");
}

export function filterPosturalHistory(
  history: readonly PosturalHistoryItem[],
  filter: PosturalHistoryFilter,
  now = new Date(),
  custom?: { readonly from?: string; readonly to?: string },
) {
  if (filter === "ALL") return history;
  if (filter === "COMPLETED") {
    return history.filter(
      (item) =>
        item.status === "FINALIZED" ||
        item.data.completionStatus === "COMPLETED",
    );
  }

  const from =
    filter === "CUSTOM"
      ? custom?.from
        ? new Date(`${custom.from}T00:00:00`)
        : undefined
      : new Date(
          now.getTime() -
            (filter === "LAST_30_DAYS"
              ? 30
              : filter === "LAST_90_DAYS"
                ? 90
                : 365) *
              86_400_000,
        );
  const to =
    filter === "CUSTOM" && custom?.to
      ? new Date(`${custom.to}T23:59:59.999`)
      : now;

  return history.filter((item) => {
    const assessedAt = new Date(item.assessedAt);
    return (
      (!from || assessedAt >= from) &&
      (!to || assessedAt <= to)
    );
  });
}

export function calculatePosturalEvolutionIndicators(
  history: readonly PosturalHistoryItem[],
): PosturalEvolutionIndicators {
  const first = history[0];
  const latest = history.at(-1);
  if (!first || !latest) return { assessmentCount: 0, activeFindings: 0, resolvedFindings: 0, newFindings: 0 };

  const comparison = comparePosturalFindings(first.data, latest.data);
  return {
    firstAssessmentAt: first.assessedAt,
    latestAssessmentAt: latest.assessedAt,
    assessmentCount: history.length,
    activeFindings: comparison.filter((item) => isActive(item.current)).length,
    resolvedFindings: comparison.filter((item) => item.situation === "RESOLVED").length,
    newFindings: comparison.filter((item) => item.situation === "NEW").length,
  };
}

export const POSTURAL_EVOLUTION_DELIVERABLE_CONTRACT = {
  sections: [
    "identificação do paciente",
    "datas das avaliações selecionadas",
    "profissional responsável e usuário executor",
    "histórico",
    "timeline",
    "fotografias por vista",
    "comparação de achados",
    "indicadores observacionais",
    "resumo evolutivo",
    "conclusão evolutiva",
    "assinatura profissional",
    "registro e contatos profissionais",
  ],
  comparisonReference: "assessment-pair",
  qrTarget: "patient-postural-history",
} as const;

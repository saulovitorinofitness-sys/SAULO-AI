import type {
  PosturalAssessmentData,
  PosturalSegmentAssessment,
  PosturalSegmentGrade,
  PosturalSegmentRelevance,
  PosturalViewKey,
} from "./contracts";
import { posturalSegmentsByView } from "./postural-segments";

const viewLabels: Readonly<Record<PosturalViewKey, string>> = {
  ANTERIOR: "Vista Anterior",
  POSTERIOR: "Vista Posterior",
  RIGHT_LATERAL: "Vista Lateral Direita",
  LEFT_LATERAL: "Vista Lateral Esquerda",
};

const gradeLabels: Readonly<Record<PosturalSegmentGrade, string>> = {
  DISCREET: "discreto",
  MODERATE: "moderado",
  ACCENTUATED: "acentuado",
};

const relevanceLabels: Readonly<
  Record<PosturalSegmentRelevance, string>
> = {
  NONE: "sem relevância registrada",
  LOW: "relevância baixa",
  MODERATE: "relevância moderada",
  HIGH: "relevância alta",
};

function sentenceCase(value: string) {
  return value
    ? `${value.charAt(0).toLocaleLowerCase("pt-BR")}${value.slice(1)}`
    : value;
}

function withoutFinalPeriod(value: string) {
  return value.trim().replace(/[.\s]+$/u, "");
}

function segmentSentence(
  name: string,
  assessment: PosturalSegmentAssessment,
) {
  if (
    !assessment.selectedOption?.trim() &&
    !assessment.observation?.trim()
  ) {
    return undefined;
  }

  const clauses: string[] = [];
  if (assessment.selectedOption?.trim()) {
    clauses.push(sentenceCase(withoutFinalPeriod(assessment.selectedOption)));
  }
  if (assessment.grade) {
    clauses.push(`grau ${gradeLabels[assessment.grade]}`);
  }
  if (assessment.relevance) {
    clauses.push(relevanceLabels[assessment.relevance]);
  }

  let sentence = clauses.length
    ? `- ${name}: ${clauses.join(", ")}.`
    : `- ${name}: observação registrada durante a avaliação.`;

  if (assessment.observation?.trim()) {
    sentence += ` Observação do avaliador: ${withoutFinalPeriod(assessment.observation)}.`;
  }

  const investigations = [
    ...(assessment.investigationSuggestions ?? []),
    ...(assessment.otherInvestigation?.trim()
      ? [assessment.otherInvestigation.trim()]
      : []),
  ];
  if (investigations.length) {
    sentence += ` Sugere investigar: ${investigations.join(", ")}.`;
  }

  return sentence;
}

export interface GeneratePosturalSummaryContext {
  readonly assessedAt?: string;
  readonly evaluatorName?: string;
}

export interface GeneratedPosturalSummary {
  readonly content?: string;
  readonly findingCount: number;
  readonly includedViews: readonly PosturalViewKey[];
}

export function generatePosturalTechnicalSummary(
  data: PosturalAssessmentData,
  context: GeneratePosturalSummaryContext = {},
): GeneratedPosturalSummary {
  const sections: string[] = [];
  const includedViews: PosturalViewKey[] = [];
  let findingCount = 0;

  for (const viewKey of [
    "ANTERIOR",
    "POSTERIOR",
    "RIGHT_LATERAL",
    "LEFT_LATERAL",
  ] as const) {
    const view = data.views[viewKey];
    const lines = posturalSegmentsByView[viewKey].flatMap(
      (definition) => {
        const assessment = view.segments?.[definition.key];
        if (!assessment) return [];
        const sentence = segmentSentence(
          definition.name,
          assessment,
        );
        return sentence ? [sentence] : [];
      },
    );

    if (view.observation?.trim()) {
      lines.push(
        `- Observações gerais da vista: ${withoutFinalPeriod(view.observation)}.`,
      );
    }

    if (!lines.length) continue;
    includedViews.push(viewKey);
    findingCount += lines.length;
    sections.push(`${viewLabels[viewKey]}\n\n${lines.join("\n")}`);
  }

  if (!sections.length) {
    return { findingCount: 0, includedViews: [] };
  }

  const metadata: string[] = [];
  if (context.assessedAt) {
    const assessedAt = new Date(context.assessedAt);
    if (!Number.isNaN(assessedAt.getTime())) {
      metadata.push(
        `Data da avaliação: ${new Intl.DateTimeFormat("pt-BR").format(assessedAt)}`,
      );
    }
  }
  if (context.evaluatorName?.trim()) {
    metadata.push(
      `Avaliador responsável: ${context.evaluatorName.trim()}`,
    );
  }

  return {
    content: [
      "RESUMO DOS ACHADOS",
      metadata.length ? metadata.join("\n") : undefined,
      ...sections,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n\n"),
    findingCount,
    includedViews,
  };
}

import type {
  PosturalAssessmentData,
  ProfessionalAudit,
} from "./contracts";

export type PosturalAssessmentStatus =
  | "DRAFT"
  | "FINALIZED"
  | "SUPERSEDED"
  | "VOIDED";

export interface PosturalHistorySource {
  readonly assessmentId: string;
  readonly versionId?: string;
  readonly masterRecordId: string;
  readonly patientId: string;
  readonly attendanceId?: string;
  readonly assessedAt: string;
  readonly status: PosturalAssessmentStatus;
  readonly data: PosturalAssessmentData;
  readonly audit: ProfessionalAudit;
}

export interface PosturalEvolutionPosition {
  readonly initial: boolean;
  readonly intermediate: boolean;
  readonly currentOrFinal: boolean;
}

export interface PosturalHistoryItem
  extends PosturalHistorySource {
  readonly evolutionPosition: PosturalEvolutionPosition;
}

export const POSTURAL_DELIVERABLE_ARCHITECTURE = {
  before: [
    "dados da avaliação inicial",
    "fotografias iniciais",
    "achados iniciais",
    "graus registrados",
    "observações iniciais",
  ],
  during: [
    "reavaliações intermediárias",
    "mudanças observadas",
    "manutenção, melhora ou piora",
    "condutas ou estratégias aplicadas",
    "observações do acompanhamento",
  ],
  after: [
    "avaliação mais recente ou final",
    "fotografias finais",
    "comparação com a avaliação inicial",
    "evolução de cada achado",
    "conclusão do avaliador",
    "próximos passos",
  ],
  comparisonModes: [
    "lado a lado",
    "por vista",
    "por data",
    "antes × durante × depois",
  ],
} as const;

export function buildPosturalEvolutionTimeline(
  sources: readonly PosturalHistorySource[],
): readonly PosturalHistoryItem[] {
  const activeSources = sources
    .filter((source) => source.status !== "VOIDED")
    .toSorted(
      (first, second) =>
        new Date(first.assessedAt).getTime() -
        new Date(second.assessedAt).getTime(),
    );

  return activeSources.map((source, index) => {
    const initial = index === 0;
    const currentOrFinal = index === activeSources.length - 1;

    return {
      ...source,
      evolutionPosition: {
        initial,
        intermediate: !initial && !currentOrFinal,
        currentOrFinal,
      },
    };
  });
}

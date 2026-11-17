import type {
  PosturalAssessmentData,
  PosturalViewKey,
  StructuredFindingState,
} from "./contracts";
import { isValidPosturalViewImage } from "./postural-media";
import { posturalSegmentsByView } from "./postural-segments";

const viewKeys = [
  "ANTERIOR",
  "POSTERIOR",
  "RIGHT_LATERAL",
  "LEFT_LATERAL",
] as const satisfies readonly PosturalViewKey[];

const viewLabels: Readonly<Record<PosturalViewKey, string>> = {
  ANTERIOR: "vista anterior",
  POSTERIOR: "vista posterior",
  RIGHT_LATERAL: "vista lateral direita",
  LEFT_LATERAL: "vista lateral esquerda",
};

const findingStates = new Set<StructuredFindingState>([
  "NOT_ASSESSED",
  "NO_FINDING_RECORDED",
  "FINDING_RECORDED",
]);
const grades = new Set(["DISCREET", "MODERATE", "ACCENTUATED"]);
const relevances = new Set(["NONE", "LOW", "MODERATE", "HIGH"]);
const overallRelevances = new Set(["LOW", "MODERATE", "HIGH"]);
const completionStatuses = new Set(["IN_PROGRESS", "COMPLETED"]);
const followUpConducts = new Set([
  "REGISTER_ONLY",
  "MONITOR_EVOLUTION",
  "REASSESS_LATER",
  "CONSIDER_IN_TRAINING",
  "SUGGEST_COMPLEMENTARY_INVESTIGATION",
  "SUGGEST_QUALIFIED_REFERRAL",
  "OTHER",
]);

const assessmentKeys = new Set([
  "views",
  "identifiedChanges",
  "identifiedChangesNotes",
  "functionalLimitations",
  "functionalLimitationsNotes",
  "notes",
  "futureCorrectiveExercisesNote",
  "referenceLines",
  "annotationLayers",
  "technicalSummary",
  "evaluatorConclusion",
  "overallRelevance",
  "followUp",
  "completionStatus",
]);
const viewDataKeys = new Set([
  "state",
  "observation",
  "image",
  "symmetrograph",
  "segments",
]);
const segmentKeys = new Set([
  "selectedOption",
  "grade",
  "observation",
  "investigationSuggestions",
  "otherInvestigation",
  "relevance",
]);
const summaryKeys = new Set([
  "generatedOriginal",
  "editedSummary",
  "generatedAt",
  "lastEditedAt",
  "generationHistory",
]);
const followUpKeys = new Set([
  "conduct",
  "observation",
  "suggestedReassessmentDate",
  "reassessmentObservation",
]);

export type PosturalValidationResult =
  | { readonly valid: true; readonly data: PosturalAssessmentData }
  | { readonly valid: false; readonly message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function validOptionalText(value: unknown, maximum = 4_000) {
  return value === undefined || (typeof value === "string" && value.length <= maximum);
}

function validOptionalDateTime(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && !Number.isNaN(Date.parse(value)))
  );
}

function invalid(message: string): PosturalValidationResult {
  return { valid: false, message };
}

function validateSegments(
  value: unknown,
  viewKey: PosturalViewKey,
): string | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) return `Revise os achados da ${viewLabels[viewKey]}.`;

  const definitions = new Map(
    posturalSegmentsByView[viewKey].map((definition) => [
      definition.key,
      definition,
    ]),
  );

  for (const [segmentKey, candidate] of Object.entries(value)) {
    const definition = definitions.get(segmentKey);
    if (!definition || !isObject(candidate) || !hasOnlyKeys(candidate, segmentKeys)) {
      return `Revise os achados da ${viewLabels[viewKey]}.`;
    }
    if (
      (candidate.selectedOption !== undefined &&
        (typeof candidate.selectedOption !== "string" ||
          !definition.options.includes(candidate.selectedOption))) ||
      (candidate.grade !== undefined && !grades.has(String(candidate.grade))) ||
      !validOptionalText(candidate.observation) ||
      !validOptionalText(candidate.otherInvestigation) ||
      (candidate.relevance !== undefined &&
        !relevances.has(String(candidate.relevance)))
    ) {
      return `Revise o achado “${definition.name}” da ${viewLabels[viewKey]}.`;
    }

    if (candidate.investigationSuggestions !== undefined) {
      if (
        !Array.isArray(candidate.investigationSuggestions) ||
        candidate.investigationSuggestions.some(
          (suggestion) =>
            typeof suggestion !== "string" ||
            !definition.investigationSuggestions.includes(suggestion),
        )
      ) {
        return `Revise as sugestões de investigação de “${definition.name}”.`;
      }
    }
  }

  return undefined;
}


function validateReferenceLines(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    return "Revise as linhas de referência da Avaliação Postural.";
  }

  const allowedViewKeys = new Set<string>(viewKeys);

  if (!Object.keys(value).every((key) => allowedViewKeys.has(key))) {
    return "Revise as linhas de referência da Avaliação Postural.";
  }

  for (const viewKey of viewKeys) {
    const candidate = value[viewKey];
    if (candidate === undefined) continue;

    if (
      !isObject(candidate) ||
      !hasOnlyKeys(candidate, new Set(["enabled", "horizontal", "vertical"])) ||
      typeof candidate.enabled !== "boolean" ||
      !Array.isArray(candidate.horizontal) ||
      !Array.isArray(candidate.vertical) ||
      candidate.horizontal.length !== 2 ||
      candidate.vertical.length !== 2
    ) {
      return `Revise as linhas de referência da ${viewLabels[viewKey]}.`;
    }
  }

  return undefined;
}

function validateAnnotationLayers(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    return "Revise as anotações da Avaliação Postural.";
  }

  const allowedViewKeys = new Set<string>(viewKeys);

  if (!Object.keys(value).every((key) => allowedViewKeys.has(key))) {
    return "Revise as anotações da Avaliação Postural.";
  }

  for (const viewKey of viewKeys) {
    const annotations = value[viewKey];
    if (annotations === undefined) continue;

    if (!Array.isArray(annotations)) {
      return `Revise as anotações da ${viewLabels[viewKey]}.`;
    }
  }

  return undefined;
}

function validateTechnicalSummary(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || !hasOnlyKeys(value, summaryKeys)) {
    return "Revise o resumo técnico da Avaliação Postural.";
  }
  if (
    !validOptionalText(value.generatedOriginal, 20_000) ||
    !validOptionalText(value.editedSummary, 20_000) ||
    !validOptionalDateTime(value.generatedAt) ||
    !validOptionalDateTime(value.lastEditedAt)
  ) {
    return "Revise o conteúdo e as datas do resumo técnico.";
  }
  if (value.generationHistory !== undefined) {
    if (!Array.isArray(value.generationHistory) || value.generationHistory.length > 100) {
      return "Revise o histórico do resumo técnico.";
    }
    const historyValid = value.generationHistory.every(
      (item) =>
        isObject(item) &&
        hasOnlyKeys(item, new Set(["content", "generatedAt"])) &&
        typeof item.content === "string" &&
        item.content.length <= 20_000 &&
        typeof item.generatedAt === "string" &&
        !Number.isNaN(Date.parse(item.generatedAt)),
    );
    if (!historyValid) return "Revise o histórico do resumo técnico.";
  }
  return undefined;
}

function validateFollowUp(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || !hasOnlyKeys(value, followUpKeys)) {
    return "Revise os dados de acompanhamento postural.";
  }
  if (
    (value.conduct !== undefined && !followUpConducts.has(String(value.conduct))) ||
    !validOptionalText(value.observation) ||
    !validOptionalText(value.reassessmentObservation) ||
    (value.suggestedReassessmentDate !== undefined &&
      (typeof value.suggestedReassessmentDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.suggestedReassessmentDate) ||
        Number.isNaN(Date.parse(`${value.suggestedReassessmentDate}T00:00:00Z`))))
  ) {
    return "Revise a conduta, as observações e a data de reavaliação.";
  }
  return undefined;
}

export function validatePosturalAssessmentData(
  value: unknown,
): PosturalValidationResult {
  if (!isObject(value) || !hasOnlyKeys(value, assessmentKeys)) {
    return invalid("Dados da Avaliação Postural inválidos.");
  }
  if (!isObject(value.views)) {
    return invalid("As vistas da Avaliação Postural não foram informadas corretamente.");
  }
  const views = value.views;
  if (
    Object.keys(views).length !== viewKeys.length ||
    !viewKeys.every((viewKey) => viewKey in views)
  ) {
    return invalid("Informe somente as quatro vistas posturais existentes no sistema.");
  }

  for (const viewKey of viewKeys) {
    const view = views[viewKey];
    if (!isObject(view) || !hasOnlyKeys(view, viewDataKeys)) {
      return invalid(`Revise os dados da ${viewLabels[viewKey]}.`);
    }
    if (!findingStates.has(view.state as StructuredFindingState)) {
      return invalid(`Selecione uma situação válida para a ${viewLabels[viewKey]}.`);
    }
    if (!validOptionalText(view.observation)) {
      return invalid(`A observação da ${viewLabels[viewKey]} excede o limite permitido.`);
    }
    if (view.image !== undefined && !isValidPosturalViewImage(view.image)) {
      return invalid(`A imagem da ${viewLabels[viewKey]} é inválida ou excede 5 MB.`);
    }
    if (view.symmetrograph !== undefined) {
      if (
        !isObject(view.symmetrograph) ||
        !hasOnlyKeys(view.symmetrograph, new Set(["enabled", "opacity"])) ||
        typeof view.symmetrograph.enabled !== "boolean" ||
        typeof view.symmetrograph.opacity !== "number" ||
        !Number.isFinite(view.symmetrograph.opacity) ||
        view.symmetrograph.opacity < 0.1 ||
        view.symmetrograph.opacity > 1
      ) {
        return invalid(`Revise a grade da ${viewLabels[viewKey]}.`);
      }
    }
    const segmentsError = validateSegments(view.segments, viewKey);
    if (segmentsError) return invalid(segmentsError);
  }

  if (
    !findingStates.has(value.identifiedChanges as StructuredFindingState) ||
    !findingStates.has(value.functionalLimitations as StructuredFindingState)
  ) {
    return invalid("Revise as situações de alterações e limitações funcionais.");
  }
  for (const [field, label] of [
    ["identifiedChangesNotes", "descrição das alterações"],
    ["functionalLimitationsNotes", "descrição das limitações funcionais"],
    ["notes", "observações gerais"],
    ["futureCorrectiveExercisesNote", "exercícios corretivos"],
  ] as const) {
    if (!validOptionalText(value[field])) {
      return invalid(`Revise o campo ${label}.`);
    }
  }
  if (!validOptionalText(value.evaluatorConclusion, 20_000)) {
    return invalid("Revise a conclusão do avaliador.");
  }
  if (
    value.overallRelevance !== undefined &&
    !overallRelevances.has(String(value.overallRelevance))
  ) {
    return invalid("Selecione uma relevância geral válida.");
  }
  if (
    value.completionStatus !== undefined &&
    !completionStatuses.has(String(value.completionStatus))
  ) {
    return invalid("Selecione um status válido para a Avaliação Postural.");
  }

  const referenceLinesError = validateReferenceLines(
    value.referenceLines,
  );
  if (referenceLinesError) return invalid(referenceLinesError);

  const annotationLayersError = validateAnnotationLayers(
    value.annotationLayers,
  );
  if (annotationLayersError) return invalid(annotationLayersError);

  const summaryError = validateTechnicalSummary(value.technicalSummary);
  if (summaryError) return invalid(summaryError);
  const followUpError = validateFollowUp(value.followUp);
  if (followUpError) return invalid(followUpError);

  return { valid: true, data: value as unknown as PosturalAssessmentData };
}

export function assertValidPosturalAssessmentData(
  value: unknown,
): asserts value is PosturalAssessmentData {
  const validation = validatePosturalAssessmentData(value);
  if (!validation.valid) {
    throw new Error(`INVALID_POSTURAL:${validation.message}`);
  }
}

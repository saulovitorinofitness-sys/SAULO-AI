import { NUTRITION_OBJECTIVES } from "./decision-engine";

interface RecordedClinicalObjective {
  readonly type: "PRIMARY" | "SECONDARY";
  readonly title: string;
}

interface RecordedStrategyObjective {
  readonly payload: unknown;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strategyObjectiveLabel(payload: unknown) {
  const objective = objectValue(payload).objective;
  return typeof objective === "string" && objective in NUTRITION_OBJECTIVES
    ? NUTRITION_OBJECTIVES[
        objective as keyof typeof NUTRITION_OBJECTIVES
      ]
    : undefined;
}

/**
 * Resolve os objetivos sem duplicar dados do paciente.
 *
 * A decisão clínica da consulta é a fonte prioritária. Quando ela ainda não
 * possui objetivos próprios, reutiliza o objetivo já persistido pela
 * Estratégia Nutricional do mesmo atendimento.
 */
export function resolvePatientObjectives(input: {
  readonly clinicalObjectives: readonly RecordedClinicalObjective[];
  readonly strategyEntries: readonly RecordedStrategyObjective[];
}) {
  const clinicalPrimary = input.clinicalObjectives.find(
    (objective) => objective.type === "PRIMARY",
  )?.title;
  const primaryObjective =
    clinicalPrimary ??
    [...input.strategyEntries]
      .reverse()
      .map((entry) => strategyObjectiveLabel(entry.payload))
      .find((objective) => objective !== undefined);

  return {
    primaryObjective,
    secondaryObjectives: input.clinicalObjectives
      .filter((objective) => objective.type === "SECONDARY")
      .map((objective) => objective.title),
  };
}

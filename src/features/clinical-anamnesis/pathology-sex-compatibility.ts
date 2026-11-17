import type { PatientSex } from "@/modules/patients";

export type PathologySexCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "SEX_REQUIRED";

export interface PathologySexCompatibility {
  readonly status: PathologySexCompatibilityStatus;
  readonly condition: string;
  readonly requiredSex?: Extract<PatientSex, "FEMALE" | "MALE">;
  readonly message?: string;
}

const exclusivelyFemalePatterns = [
  /\bendometriose\b/,
  /\badenomiose\b/,
  /\bsindrome (?:dos? )?ovarios? policisticos?\b/,
  /\bcondicao ginecologic/,
  /\bdoenca ginecologic/,
  /\balteracao ginecologic/,
  /\b(?:cancer|carcinoma) (?:de |do )?(?:ovario|utero|endometrio|colo do utero)\b/,
  /\bmioma uterino\b/,
] as const;

const exclusivelyMalePatterns = [
  /\bprostat/,
  /\b(?:cancer|carcinoma) (?:de |do )?testiculo\b/,
] as const;

export function normalizePathologyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function requiredSexForCondition(
  condition: string,
): Extract<PatientSex, "FEMALE" | "MALE"> | undefined {
  const normalized = normalizePathologyName(condition);

  if (exclusivelyFemalePatterns.some((pattern) => pattern.test(normalized))) {
    return "FEMALE";
  }

  if (exclusivelyMalePatterns.some((pattern) => pattern.test(normalized))) {
    return "MALE";
  }

  return undefined;
}

export function getPathologySexCompatibility(
  condition: string,
  patientSex: PatientSex,
): PathologySexCompatibility {
  const requiredSex = requiredSexForCondition(condition);

  if (!requiredSex) {
    return { status: "COMPATIBLE", condition };
  }

  if (patientSex === "NOT_INFORMED" || patientSex === "INTERSEX") {
    return {
      status: "SEX_REQUIRED",
      condition,
      requiredSex,
      message:
        "Registre o sexo do paciente no cadastro para validar esta condição específica.",
    };
  }

  if (patientSex === requiredSex) {
    return { status: "COMPATIBLE", condition, requiredSex };
  }

  return {
    status: "INCOMPATIBLE",
    condition,
    requiredSex,
    message: `A condição "${condition}" é incompatível com o sexo registrado no cadastro do paciente.`,
  };
}

export function additionalDiagnoses(value: string) {
  return value
    .split("\n")
    .map((condition) => condition.trim())
    .filter(Boolean);
}

export function incompatiblePathologies(
  conditions: readonly string[],
  patientSex: PatientSex,
) {
  return conditions
    .map((condition) => getPathologySexCompatibility(condition, patientSex))
    .filter(
      (result): result is PathologySexCompatibility & {
        readonly status: "INCOMPATIBLE";
      } => result.status === "INCOMPATIBLE",
    );
}

export class PathologySexCompatibilityError extends Error {
  readonly conditions: readonly string[];

  constructor(conditions: readonly string[]) {
    super(
      conditions.length === 1
        ? `A condição "${conditions[0]}" é incompatível com o sexo registrado no cadastro do paciente.`
        : `As condições ${conditions.map((condition) => `"${condition}"`).join(", ")} são incompatíveis com o sexo registrado no cadastro do paciente.`,
    );
    this.name = "PathologySexCompatibilityError";
    this.conditions = conditions;
  }
}

export function assertNewPathologiesCompatible({
  currentConditions,
  patientSex,
  previousConditions = [],
}: {
  readonly currentConditions: readonly string[];
  readonly patientSex: PatientSex;
  readonly previousConditions?: readonly string[];
}) {
  const previous = new Set(previousConditions.map(normalizePathologyName));
  const newlyAdded = currentConditions.filter(
    (condition) => !previous.has(normalizePathologyName(condition)),
  );
  const incompatible = incompatiblePathologies(newlyAdded, patientSex);

  if (incompatible.length) {
    throw new PathologySexCompatibilityError(
      incompatible.map((result) => result.condition),
    );
  }
}

export function filterPathologyOptionsBySex<T extends string>(
  options: readonly (readonly [T, string])[],
  patientSex: PatientSex,
) {
  return options.filter(
    ([value, label]) =>
      getPathologySexCompatibility(`${value} ${label}`, patientSex).status !==
      "INCOMPATIBLE",
  );
}

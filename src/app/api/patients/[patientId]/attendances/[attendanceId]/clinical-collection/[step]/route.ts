import { NextResponse } from "next/server";

import {
  bioimpedanceGroups,
  perimetryGroups,
  validatePosturalAssessmentData,
  type BioimpedanceAvanutriData,
  type EditableClinicalData,
  type EditableClinicalStepKey,
  type PerimetryData,
} from "@/features/clinical-collection";
import { validateAnthropometryMeasurements } from "@/features/clinical-collection/anthropometry-calculations";
import { validateBioimpedanceMeasurements } from "@/features/clinical-collection/bioimpedance-measurements";
import { validatePerimetryMeasurements } from "@/features/clinical-collection/perimetry-measurements";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import type { ModuleKey } from "@/modules/shared";
import { canOperatePosturalAssessment } from "@/features/professional-responsibility";

const editableSteps = new Set<EditableClinicalStepKey>([
  "ANTHROPOMETRY",
  "BIOIMPEDANCE",
  "PERIMETRY",
  "POSTURAL_ASSESSMENT",
]);
const moduleByStep: Readonly<
  Record<EditableClinicalStepKey, ModuleKey>
> = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  PERIMETRY: "PERIMETRY",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
};
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validNumber(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function validText(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && value.length <= 4000)
  );
}

function validNumericFields(
  data: Record<string, unknown>,
  fields: readonly string[],
  allowNotes = false,
) {
  const allowed = new Set([...fields, ...(allowNotes ? ["notes"] : [])]);

  return (
    Object.keys(data).every((key) => allowed.has(key)) &&
    fields.every((key) => validNumber(data[key])) &&
    (!allowNotes || validText(data.notes))
  );
}

function validData(step: EditableClinicalStepKey, value: unknown) {
  if (!isObject(value)) return false;

  if (step === "ANTHROPOMETRY") {
    return validNumericFields(value, ["weightKg", "heightCm", "bmi"], true);
  }

  if (step === "BIOIMPEDANCE") {
    const numericFieldsValid = validNumericFields(
      value,
      bioimpedanceGroups.flatMap((group) =>
        group.fields.map((field) => String(field.key)),
      ),
    );
    const metabolicAge = value.metabolicAgeYears;

    return (
      numericFieldsValid &&
      (metabolicAge === undefined ||
        (typeof metabolicAge === "number" &&
          Number.isInteger(metabolicAge) &&
          metabolicAge > 0))
    );
  }

  if (step === "PERIMETRY") {
    return validNumericFields(
      value,
      perimetryGroups.flatMap((group) =>
        group.fields.map((field) => String(field.key)),
      ),
      true,
    );
  }

  return validatePosturalAssessmentData(value).valid;
}

function anthropometryValidationMessage(value: unknown) {
  if (!isObject(value)) return "Dados da Antropometria inválidos.";

  const allowed = new Set(["weightKg", "heightCm", "bmi", "notes"]);
  if (
    !Object.keys(value).every((key) => allowed.has(key)) ||
    !validNumber(value.bmi) ||
    !validText(value.notes)
  ) {
    return "Revise os campos da Antropometria.";
  }

  const errors = validateAnthropometryMeasurements({
    weightKg:
      value.weightKg === undefined
        ? undefined
        : typeof value.weightKg === "number"
          ? value.weightKg
          : Number.NaN,
    heightCm:
      value.heightCm === undefined
        ? undefined
        : typeof value.heightCm === "number"
          ? value.heightCm
          : Number.NaN,
  });

  return Object.values(errors)[0];
}

function perimetryValidationMessage(value: unknown) {
  if (!isObject(value)) return "Dados da Perimetria inválidos.";

  const allowed = new Set([
    ...perimetryGroups.flatMap((group) =>
      group.fields.map((field) => String(field.key)),
    ),
    "notes",
  ]);
  if (
    !Object.keys(value).every((key) => allowed.has(key)) ||
    !validText(value.notes)
  ) {
    return "Revise os campos da Perimetria.";
  }

  const errors = validatePerimetryMeasurements(value as PerimetryData);
  return Object.values(errors)[0];
}

function bioimpedanceValidationMessage(value: unknown) {
  if (!isObject(value)) return "Dados da Bioimpedância inválidos.";

  const allowed = new Set(
    bioimpedanceGroups.flatMap((group) =>
      group.fields.map((field) => String(field.key)),
    ),
  );
  if (!Object.keys(value).every((key) => allowed.has(key))) {
    return "Revise os campos da Bioimpedância.";
  }

  const errors = validateBioimpedanceMeasurements(
    value as BioimpedanceAvanutriData,
  );
  return Object.values(errors)[0];
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      patientId: string;
      attendanceId: string;
      step: string;
    }>;
  },
) {
  const [{ patientId, attendanceId, step: rawStep }, access] =
    await Promise.all([params, mvpService.getSession()]);
  const activeAccess = resolveDevelopmentAccess(request, access);

  const candidateStep = rawStep as EditableClinicalStepKey;
  if (
    editableSteps.has(candidateStep) &&
    (!canAccess(activeAccess, moduleByStep[candidateStep], "UPDATE") ||
      (candidateStep === "POSTURAL_ASSESSMENT" &&
        !canOperatePosturalAssessment(activeAccess.user.id)))
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite editar esta avaliação." },
      { status: 403 },
    );
  }

  if (!editableSteps.has(candidateStep)) {
    return NextResponse.json(
      { message: "Etapa de avaliação inválida." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Dados da avaliação inválidos." },
      { status: 400 },
    );
  }

  const step = candidateStep;
  const data = isObject(body) ? body.data : undefined;
  const saveMode = isObject(body) && body.autosave === true
    ? "AUTOSAVE"
    : "MANUAL";

  if (step === "ANTHROPOMETRY") {
    const validationMessage = anthropometryValidationMessage(data);
    if (validationMessage) {
      return NextResponse.json(
        { message: validationMessage },
        { status: 400 },
      );
    }
  }

  if (step === "PERIMETRY") {
    const validationMessage = perimetryValidationMessage(data);
    if (validationMessage) {
      return NextResponse.json(
        { message: validationMessage },
        { status: 400 },
      );
    }
  }

  if (step === "BIOIMPEDANCE") {
    const validationMessage = bioimpedanceValidationMessage(data);
    if (validationMessage) {
      return NextResponse.json(
        { message: validationMessage },
        { status: 400 },
      );
    }
  }

  if (step === "POSTURAL_ASSESSMENT") {
    const validation = validatePosturalAssessmentData(data);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message },
        { status: 400 },
      );
    }
  }

  if (!validData(step, data)) {
    return NextResponse.json(
      { message: "Revise os campos da avaliação." },
      { status: 400 },
    );
  }

  try {
    const result = await clinicalCollectionRepository.saveStep(
      {
        patientId,
        attendanceId,
        scenario: "complete",
        step,
        data: data as EditableClinicalData,
        saveMode,
      },
      activeAccess.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_ANTHROPOMETRY:")
    ) {
      return NextResponse.json(
        { message: error.message.slice("INVALID_ANTHROPOMETRY:".length) },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_PERIMETRY:")
    ) {
      return NextResponse.json(
        { message: error.message.slice("INVALID_PERIMETRY:".length) },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_BIOIMPEDANCE:")
    ) {
      return NextResponse.json(
        { message: error.message.slice("INVALID_BIOIMPEDANCE:".length) },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_POSTURAL:")
    ) {
      return NextResponse.json(
        { message: error.message.slice("INVALID_POSTURAL:".length) },
        { status: 400 },
      );
    }

    console.error("Falha ao salvar avaliação.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a avaliação." },
      { status: 503 },
    );
  }
}

import { NextResponse } from "next/server";

import {
  bioimpedanceGroups,
  isPosturalImageMimeType,
  perimetryGroups,
  POSTURAL_IMAGE_MAX_DATA_URL_LENGTH,
  POSTURAL_IMAGE_MAX_SIZE_BYTES,
  type EditableClinicalData,
  type EditableClinicalStepKey,
} from "@/features/clinical-collection";
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
const findingStates = new Set([
  "NOT_ASSESSED",
  "NO_FINDING_RECORDED",
  "FINDING_RECORDED",
]);

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

function validPostural(data: Record<string, unknown>) {
  if (!isObject(data.views)) return false;
  const views = data.views;

  const viewKeys = [
    "ANTERIOR",
    "POSTERIOR",
    "RIGHT_LATERAL",
    "LEFT_LATERAL",
  ];
  const viewsValid = viewKeys.every((key) => {
    const view = views[key];
    const image = isObject(view) ? view.image : undefined;
    const symmetrograph = isObject(view)
      ? view.symmetrograph
      : undefined;
    const imageValid =
      image === undefined ||
      (isObject(image) &&
        typeof image.dataUrl === "string" &&
        image.dataUrl.length <=
          POSTURAL_IMAGE_MAX_DATA_URL_LENGTH &&
        /^data:image\/(jpeg|png|webp);base64,/.test(image.dataUrl) &&
        typeof image.fileName === "string" &&
        image.fileName.length > 0 &&
        image.fileName.length <= 255 &&
        isPosturalImageMimeType(image.mimeType) &&
        typeof image.sizeBytes === "number" &&
        Number.isInteger(image.sizeBytes) &&
        image.sizeBytes > 0 &&
        image.sizeBytes <= POSTURAL_IMAGE_MAX_SIZE_BYTES &&
        typeof image.uploadedAt === "string" &&
        !Number.isNaN(Date.parse(image.uploadedAt)));
    const symmetrographValid =
      symmetrograph === undefined ||
      (isObject(symmetrograph) &&
        typeof symmetrograph.enabled === "boolean" &&
        typeof symmetrograph.opacity === "number" &&
        Number.isFinite(symmetrograph.opacity) &&
        symmetrograph.opacity >= 0.1 &&
        symmetrograph.opacity <= 1);
    return (
      isObject(view) &&
      findingStates.has(String(view.state)) &&
      validText(view.observation) &&
      imageValid &&
      symmetrographValid
    );
  });

  return (
    viewsValid &&
    findingStates.has(String(data.identifiedChanges)) &&
    findingStates.has(String(data.functionalLimitations)) &&
    validText(data.identifiedChangesNotes) &&
    validText(data.functionalLimitationsNotes) &&
    validText(data.notes) &&
    validText(data.futureCorrectiveExercisesNote)
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

  return validPostural(value);
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
      },
      activeAccess.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Falha ao salvar avaliação.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a avaliação." },
      { status: 503 },
    );
  }
}

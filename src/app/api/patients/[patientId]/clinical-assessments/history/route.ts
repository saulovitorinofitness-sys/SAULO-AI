import { NextResponse } from "next/server";
import { z } from "zod";

import {
  bioimpedanceGroups,
  perimetryGroups,
  type BioimpedanceAvanutriData,
  type CreateHistoricalClinicalAssessmentInput,
  type PerimetryData,
} from "@/features/clinical-collection";
import { validateAnthropometryMeasurements } from "@/features/clinical-collection/anthropometry-calculations";
import { validateBioimpedanceMeasurements } from "@/features/clinical-collection/bioimpedance-measurements";
import { validatePerimetryMeasurements } from "@/features/clinical-collection/perimetry-measurements";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";

const authenticationErrors = new Set([
  "Autenticação obrigatória.",
  "Sessão inválida, expirada ou revogada.",
]);

const patientIdSchema = z.uuid();
const assessmentDateSchema = z.iso.date();
const bodySchema = z
  .object({
    assessmentDate: z.unknown(),
    records: z.unknown(),
  })
  .strict();

const recordKeys = [
  "anthropometry",
  "perimetry",
  "bioimpedance",
] as const;
type HistoricalRecordKey = (typeof recordKeys)[number];

const moduleByRecord = {
  anthropometry: "PHYSICAL_ASSESSMENT",
  perimetry: "PERIMETRY",
  bioimpedance: "BIOIMPEDANCE",
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHistoricalRecordKey(value: string): value is HistoricalRecordKey {
  return recordKeys.includes(value as HistoricalRecordKey);
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

function unauthorizedResponse() {
  return NextResponse.json(
    { message: "Sessão ausente ou inválida." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  let access: Awaited<ReturnType<typeof mvpService.getSession>>;

  try {
    access = await mvpService.getSession();
  } catch (error) {
    if (error instanceof Error && authenticationErrors.has(error.message)) {
      return unauthorizedResponse();
    }

    console.error("Falha ao consultar a sessão atual.", error);
    return NextResponse.json(
      { message: "Não foi possível consultar a sessão atual." },
      { status: 503 },
    );
  }

  const { patientId: rawPatientId } = await params;
  const parsedPatientId = patientIdSchema.safeParse(rawPatientId);
  if (!parsedPatientId.success) {
    return NextResponse.json(
      { message: "Identificador do paciente inválido." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Não foi possível interpretar os dados enviados." },
      { status: 400 },
    );
  }

  const parsedBody = bodySchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Payload da avaliação histórica inválido." },
      { status: 400 },
    );
  }

  const parsedDate = assessmentDateSchema.safeParse(
    parsedBody.data.assessmentDate,
  );
  if (!parsedDate.success) {
    return NextResponse.json(
      { message: "Data da avaliação inválida. Use o formato YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const assessmentDate = new Date(`${parsedDate.data}T00:00:00.000Z`);
  if (assessmentDate > new Date()) {
    return NextResponse.json(
      { message: "A data da avaliação não pode ser futura." },
      { status: 400 },
    );
  }

  if (!isObject(parsedBody.data.records)) {
    return NextResponse.json(
      { message: "Modalidade de avaliação inválida." },
      { status: 400 },
    );
  }

  const records = parsedBody.data.records;
  const suppliedModalities = Object.keys(records);
  if (
    suppliedModalities.length === 0 ||
    suppliedModalities.some((key) => !isHistoricalRecordKey(key))
  ) {
    return NextResponse.json(
      { message: "Modalidade de avaliação inválida." },
      { status: 400 },
    );
  }

  const activeAccess = resolveDevelopmentAccess(request, access);
  if (
    suppliedModalities.some(
      (key) =>
        !canAccess(
          activeAccess,
          moduleByRecord[key as HistoricalRecordKey],
          "UPDATE",
        ),
    )
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite registrar esta avaliação." },
      { status: 403 },
    );
  }

  const validationMessage =
    (records.anthropometry !== undefined
      ? anthropometryValidationMessage(records.anthropometry)
      : undefined) ??
    (records.perimetry !== undefined
      ? perimetryValidationMessage(records.perimetry)
      : undefined) ??
    (records.bioimpedance !== undefined
      ? bioimpedanceValidationMessage(records.bioimpedance)
      : undefined);

  if (validationMessage) {
    return NextResponse.json(
      { message: validationMessage },
      { status: 400 },
    );
  }

  const command: CreateHistoricalClinicalAssessmentInput = {
    patientId: parsedPatientId.data,
    assessmentDate: parsedDate.data,
    records:
      records as CreateHistoricalClinicalAssessmentInput["records"],
  };

  try {
    const result =
      await clinicalCollectionRepository.createHistoricalClinicalAssessment(
        command,
        activeAccess.user.id,
      );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MASTER_RECORD_NOT_FOUND"
    ) {
      return NextResponse.json(
        { message: "Paciente não encontrado." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_HISTORICAL_ASSESSMENT_DATE"
    ) {
      return NextResponse.json(
        { message: "Data da avaliação inválida. Use o formato YYYY-MM-DD." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "HISTORICAL_ASSESSMENT_REQUIRES_RECORD"
    ) {
      return NextResponse.json(
        { message: "Modalidade de avaliação inválida." },
        { status: 400 },
      );
    }

    for (const prefix of [
      "INVALID_ANTHROPOMETRY:",
      "INVALID_PERIMETRY:",
      "INVALID_BIOIMPEDANCE:",
    ]) {
      if (error instanceof Error && error.message.startsWith(prefix)) {
        return NextResponse.json(
          { message: error.message.slice(prefix.length) },
          { status: 400 },
        );
      }
    }

    console.error("Falha ao criar avaliação clínica histórica.", error);
    return NextResponse.json(
      { message: "Não foi possível criar a avaliação histórica." },
      { status: 503 },
    );
  }
}

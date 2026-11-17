import { NextResponse } from "next/server";

import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import {
  PathologySexCompatibilityError,
} from "@/features/clinical-anamnesis";
import { clinicalAnamnesisObjectivesRepository } from "@/features/clinical-anamnesis/objectives-repository";
import {
  ClinicalAnamnesisValidationError,
  validateClinicalAnamnesisData,
} from "@/features/clinical-anamnesis/validation";
import { canAccess, mvpService } from "@/features/mvp";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function scenarioFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("scenario");
  return CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    value as ClinicalCollectionScenarioKey,
  )
    ? (value as ClinicalCollectionScenarioKey)
    : "complete";
}

function attendanceIdFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("attendanceId")?.trim();
  return value && uuidPattern.test(value) ? value : undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const [{ patientId }, access] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }
  const view = await clinicalAnamnesisObjectivesRepository.getView(
    patientId,
    scenarioFrom(request),
    attendanceIdFrom(request),
  );
  return view
    ? NextResponse.json({ view })
    : NextResponse.json({ message: "Paciente não encontrado." }, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const [{ patientId }, access] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  if (!canAccess(access, "MASTER_RECORD", "UPDATE")) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    data?: unknown;
    saveMode?: unknown;
  } | null;
  const attendanceId = attendanceIdFrom(request);

  if (!attendanceId) {
    return NextResponse.json(
      { message: "Informe um atendimento válido para alterar a anamnese." },
      { status: 400 },
    );
  }

  if (
    body?.saveMode !== "AUTOSAVE" &&
    body?.saveMode !== "DRAFT" &&
    body?.saveMode !== "COMPLETE"
  ) {
    return NextResponse.json(
      { message: "Informe uma ação válida para a anamnese." },
      { status: 400 },
    );
  }

  const validation = validateClinicalAnamnesisData(body?.data);
  if (!validation.success) {
    return NextResponse.json(
      { message: validation.message },
      { status: 400 },
    );
  }

  try {
    await clinicalAnamnesisObjectivesRepository.save({
      patientId,
      attendanceId,
      data: validation.data,
      professionalUserId: access.user.id,
      saveMode: body.saveMode,
    });
  } catch (error) {
    if (error instanceof PathologySexCompatibilityError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof ClinicalAnamnesisValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error && error.message === "OBJECTIVE_CONTEXT_NOT_FOUND"
        ? "Não foi encontrado atendimento ativo para este paciente."
        : "Não foi possível salvar a anamnese clínica.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const view = await clinicalAnamnesisObjectivesRepository.getView(
    patientId,
    scenarioFrom(request),
    attendanceId,
  );
  return NextResponse.json({ view });
}

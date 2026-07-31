import { NextResponse } from "next/server";

import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import type { ClinicalAnamnesisData } from "@/features/clinical-anamnesis";
import { clinicalAnamnesisObjectivesRepository } from "@/features/clinical-anamnesis/objectives-repository";
import { canAccess, mvpService } from "@/features/mvp";

function scenarioFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("scenario");
  return CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    value as ClinicalCollectionScenarioKey,
  )
    ? (value as ClinicalCollectionScenarioKey)
    : "complete";
}

function isClinicalAnamnesisData(value: unknown): value is ClinicalAnamnesisData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ClinicalAnamnesisData>;
  return (
    typeof data.chiefComplaint === "string" &&
    typeof data.currentIllness === "object" &&
    typeof data.primaryObjective === "string" &&
    Array.isArray(data.secondaryObjectives) &&
    Array.isArray(data.clinicalHistory) &&
    Array.isArray(data.familyHistory) &&
    Array.isArray(data.surgeries) &&
    Array.isArray(data.injuries) &&
    Array.isArray(data.medications) &&
    Array.isArray(data.supplements) &&
    Array.isArray(data.allergies) &&
    typeof data.sleep === "object" &&
    typeof data.stressLevel === "number" &&
    typeof data.physicalActivity === "object" &&
    typeof data.habits === "object" &&
    typeof data.nutrition === "object" &&
    typeof data.generalNotes === "string"
  );
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
  } | null;

  if (!body || !isClinicalAnamnesisData(body.data)) {
    return NextResponse.json(
      { message: "Informe dados válidos para a anamnese clínica." },
      { status: 400 },
    );
  }

  try {
    await clinicalAnamnesisObjectivesRepository.save({
      patientId,
      data: body.data,
      professionalUserId: access.user.id,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "OBJECTIVE_CONTEXT_NOT_FOUND"
        ? "Não foi encontrado atendimento ativo para este paciente."
        : "Não foi possível salvar a anamnese clínica.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const view = await clinicalAnamnesisObjectivesRepository.getView(
    patientId,
    scenarioFrom(request),
  );
  return NextResponse.json({ view });
}

import { NextResponse } from "next/server";

import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import {
  objectiveOptions,
  type AnamnesisObjective,
} from "@/features/clinical-anamnesis";
import { clinicalAnamnesisObjectivesRepository } from "@/features/clinical-anamnesis/objectives-repository";
import { canAccess, mvpService } from "@/features/mvp";

const validObjectives = new Set(
  objectiveOptions.map(([value]) => value),
);

function scenarioFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("scenario");
  return CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    value as ClinicalCollectionScenarioKey,
  )
    ? (value as ClinicalCollectionScenarioKey)
    : "complete";
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
    primaryObjective?: unknown;
    secondaryObjectives?: unknown;
  } | null;
  if (
    !body ||
    typeof body.primaryObjective !== "string" ||
    !validObjectives.has(body.primaryObjective as AnamnesisObjective) ||
    !Array.isArray(body.secondaryObjectives) ||
    !body.secondaryObjectives.every(
      (value) =>
        typeof value === "string" &&
        validObjectives.has(value as AnamnesisObjective),
    )
  ) {
    return NextResponse.json(
      { message: "Informe objetivos válidos." },
      { status: 400 },
    );
  }

  await clinicalAnamnesisObjectivesRepository.save({
    patientId,
    primaryObjective: body.primaryObjective as AnamnesisObjective,
    secondaryObjectives:
      body.secondaryObjectives as AnamnesisObjective[],
    professionalUserId: access.user.id,
  });
  const view = await clinicalAnamnesisObjectivesRepository.getView(
    patientId,
    scenarioFrom(request),
  );
  return NextResponse.json({ view });
}

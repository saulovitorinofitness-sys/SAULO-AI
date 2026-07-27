import { NextResponse } from "next/server";

import type {
  PosturalEvolutionClassification,
  SavePosturalEvolutionComparisonInput,
} from "@/features/clinical-collection";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import { canOperatePosturalAssessment } from "@/features/professional-responsibility";

const classifications = new Set<PosturalEvolutionClassification>([
  "PROGRESS",
  "PARTIAL_PROGRESS",
  "STABLE",
  "REGRESSION",
  "NOT_COMPARABLE",
  "NOT_INFORMED",
]);

function optionalText(value: unknown) {
  return value === undefined ||
    (typeof value === "string" && value.length <= 20_000);
}

function validBody(
  value: unknown,
): value is SavePosturalEvolutionComparisonInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const body = value as Record<string, unknown>;
  const classificationValues =
    body.classifications &&
    typeof body.classifications === "object" &&
    !Array.isArray(body.classifications)
      ? Object.values(body.classifications)
      : undefined;
  const visualSettings =
    body.visualSettings &&
    typeof body.visualSettings === "object" &&
    !Array.isArray(body.visualSettings)
      ? (body.visualSettings as Record<string, unknown>)
      : undefined;

  return (
    typeof body.previousAssessmentId === "string" &&
    typeof body.currentAssessmentId === "string" &&
    Boolean(classificationValues) &&
    classificationValues!.every((classification) =>
      classifications.has(
        classification as PosturalEvolutionClassification,
      ),
    ) &&
    optionalText(body.generatedSummary) &&
    optionalText(body.editedSummary) &&
    optionalText(body.evaluatorConclusion) &&
    (visualSettings === undefined ||
      typeof visualSettings.synchronized === "boolean") &&
    (body.generatedAt === undefined ||
      (typeof body.generatedAt === "string" &&
        !Number.isNaN(Date.parse(body.generatedAt))))
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
  const activeAccess = resolveDevelopmentAccess(request, access);
  if (!canAccess(activeAccess, "POSTURAL_ASSESSMENT", "READ")) {
    return NextResponse.json(
      { message: "Seu perfil não permite visualizar esta evolução." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    await clinicalCollectionRepository.getPosturalEvolution(patientId),
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const [{ patientId }, access, body] = await Promise.all([
    params,
    mvpService.getSession(),
    request.json().catch(() => undefined),
  ]);
  const activeAccess = resolveDevelopmentAccess(request, access);
  if (
    !canAccess(activeAccess, "POSTURAL_ASSESSMENT", "UPDATE") ||
    !canOperatePosturalAssessment(activeAccess.user.id)
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite editar esta evolução." },
      { status: 403 },
    );
  }
  if (!validBody(body)) {
    return NextResponse.json(
      { message: "Dados da comparação inválidos." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await clinicalCollectionRepository.savePosturalEvolutionComparison(
        patientId,
        body,
        activeAccess.user.id,
      ),
    );
  } catch (error) {
    console.error("Falha ao salvar comparação postural.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a comparação." },
      { status: 503 },
    );
  }
}

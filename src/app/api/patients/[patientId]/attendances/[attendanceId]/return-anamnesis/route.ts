import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionReturnAnamnesisRepository } from "@/features/nutrition-return-anamnesis/repository";
import {
  hasUnconfirmedPreviousPlanFoods,
  parseNutritionReturnAnamnesisData,
} from "@/features/nutrition-return-anamnesis/validation";
import { BUILT_IN_IDS } from "@/modules/permissions";

const routeParamsSchema = z.object({
  patientId: z.string().uuid(),
  attendanceId: z.string().uuid(),
});

async function requestContext(
  request: Request,
  params: Promise<{ patientId: string; attendanceId: string }>,
) {
  const [rawParams, session] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const parsedParams = routeParamsSchema.safeParse(rawParams);
  return {
    params: parsedParams.success ? parsedParams.data : null,
    access: resolveDevelopmentAccess(request, session),
  };
}

function canReadReturnAnamnesis(
  access: Awaited<ReturnType<typeof mvpService.getSession>>,
) {
  return (
    access.user.id !== BUILT_IN_IDS.users.mariaDeLourdesGomes &&
    canAccess(access, "MASTER_RECORD", "READ") &&
    canAccess(access, "NUTRITION_STRATEGY", "READ")
  );
}

function canUpdateReturnAnamnesis(
  access: Awaited<ReturnType<typeof mvpService.getSession>>,
) {
  return (
    access.user.id !== BUILT_IN_IDS.users.mariaDeLourdesGomes &&
    canAccess(access, "MASTER_RECORD", "UPDATE") &&
    canAccess(access, "NUTRITION_STRATEGY", "UPDATE")
  );
}

function errorResponse(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "RETURN_RECALL_FOOD_NOT_FOUND" ||
      error.message === "RETURN_RECALL_MEASURE_NOT_FOUND")
  ) {
    return NextResponse.json(
      {
        message:
          "Revise os alimentos selecionados: um item ou medida não pertence mais à base local ativa.",
      },
      { status: 409 },
    );
  }
  if (
    error instanceof Error &&
    error.message === "RETURN_ANAMNESIS_COMPLETED"
  ) {
    return NextResponse.json(
      { message: "A Anamnese de retorno já foi concluída." },
      { status: 409 },
    );
  }
  if (
    error instanceof Error &&
    error.message === "RETURN_ANAMNESIS_CONTEXT_NOT_FOUND"
  ) {
    return NextResponse.json(
      {
        message:
          "O atendimento de retorno em andamento não foi encontrado.",
      },
      { status: 409 },
    );
  }
  console.error("Falha ao salvar a Anamnese de retorno.", error);
  return NextResponse.json(
    { message: "Não foi possível salvar a Anamnese de retorno." },
    { status: 503 },
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const context = await requestContext(request, params);
  if (!context.params) {
    return NextResponse.json(
      { message: "Identificação do atendimento inválida." },
      { status: 400 },
    );
  }
  if (!canReadReturnAnamnesis(context.access)) {
    return NextResponse.json(
      { message: "Acesso não permitido." },
      { status: 403 },
    );
  }

  const view = await nutritionReturnAnamnesisRepository.getView(
    context.params.patientId,
    context.params.attendanceId,
  );
  return view
    ? NextResponse.json(
        { view },
        { headers: { "Cache-Control": "no-store" } },
      )
    : NextResponse.json(
        { message: "Atendimento de retorno não encontrado." },
        { status: 404 },
      );
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const context = await requestContext(request, params);
  if (!context.params) {
    return NextResponse.json(
      { message: "Identificação do atendimento inválida." },
      { status: 400 },
    );
  }
  if (!canUpdateReturnAnamnesis(context.access)) {
    return NextResponse.json(
      { message: "Acesso não permitido." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    readonly data?: unknown;
  } | null;
  const data = parseNutritionReturnAnamnesisData(body?.data);
  if (!data) {
    return NextResponse.json(
      { message: "Revise os dados da Anamnese de retorno." },
      { status: 400 },
    );
  }
  try {
    const view = await nutritionReturnAnamnesisRepository.save({
      patientId: context.params.patientId,
      attendanceId: context.params.attendanceId,
      professionalUserId: context.access.user.id,
      data,
      saveMode: "DRAFT",
    });
    return NextResponse.json({ view });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const context = await requestContext(request, params);
  if (!context.params) {
    return NextResponse.json(
      { message: "Identificação do atendimento inválida." },
      { status: 400 },
    );
  }
  if (!canUpdateReturnAnamnesis(context.access)) {
    return NextResponse.json(
      { message: "Acesso não permitido." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    readonly action?: unknown;
    readonly data?: unknown;
  } | null;
  if (body?.action !== "COMPLETE") {
    return NextResponse.json(
      { message: "Confirme explicitamente a conclusão da etapa." },
      { status: 400 },
    );
  }
  const data = parseNutritionReturnAnamnesisData(body.data);
  if (!data) {
    return NextResponse.json(
      { message: "Revise os dados da Anamnese de retorno." },
      { status: 400 },
    );
  }
  if (hasUnconfirmedPreviousPlanFoods(data)) {
    return NextResponse.json(
      {
        message:
          "Confirme o consumo de cada alimento do plano anterior antes de concluir o retorno.",
      },
      { status: 400 },
    );
  }

  try {
    const view = await nutritionReturnAnamnesisRepository.save({
      patientId: context.params.patientId,
      attendanceId: context.params.attendanceId,
      professionalUserId: context.access.user.id,
      data,
      saveMode: "COMPLETE",
    });
    return NextResponse.json({ view });
  } catch (error) {
    return errorResponse(error);
  }
}

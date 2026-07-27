import { NextResponse } from "next/server";

import {
  parseNutritionStrategyDraft,
} from "@/features/nutrition-strategy";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import { canAccess, mvpService } from "@/features/mvp";

async function context(
  params: Promise<{ patientId: string; attendanceId: string }>,
  request: Request,
) {
  const [{ patientId, attendanceId }, access] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  return {
    patientId,
    attendanceId,
    access: resolveDevelopmentAccess(request, access),
  };
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const { patientId, attendanceId, access } = await context(params, request);
  if (!canAccess(access, "NUTRITION_STRATEGY", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite editar a estratégia nutricional." },
      { status: 403 },
    );
  }

  const strategy = parseNutritionStrategyDraft(
    await request.json().catch(() => null),
  );
  if (!strategy) {
    return NextResponse.json(
      { message: "Revise os dados da estratégia nutricional." },
      { status: 400 },
    );
  }

  try {
    const record = await nutritionStrategyRepository.save(
      patientId,
      attendanceId,
      strategy,
      access.user.id,
    );
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof Error && error.message === "STRATEGY_APPROVED") {
      return NextResponse.json(
        { message: "Reabra a estratégia antes de alterá-la." },
        { status: 409 },
      );
    }
    console.error("Falha ao salvar estratégia nutricional.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a estratégia nutricional." },
      { status: 503 },
    );
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
  const { patientId, attendanceId, access } = await context(params, request);
  if (!canAccess(access, "NUTRITION_STRATEGY", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite aprovar ou editar esta estratégia." },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Ação inválida para a estratégia nutricional." },
      { status: 400 },
    );
  }
  const action = (body as Record<string, unknown>).action;

  try {
    if (action === "EDIT") {
      const record = await nutritionStrategyRepository.reopen(
        patientId,
        attendanceId,
        access.user.id,
      );
      return NextResponse.json({ record });
    }

    if (action === "APPROVE") {
      const strategy = parseNutritionStrategyDraft(
        (body as Record<string, unknown>).strategy,
      );
      if (!strategy) {
        return NextResponse.json(
          { message: "Revise os dados obrigatórios antes da aprovação." },
          { status: 400 },
        );
      }
      const record = await nutritionStrategyRepository.approve(
        patientId,
        attendanceId,
        strategy,
        access.user.id,
      );
      return NextResponse.json({ record });
    }

    return NextResponse.json(
      { message: "Ação inválida para a estratégia nutricional." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "STRATEGY_INCOMPLETE") {
      return NextResponse.json(
        { message: "Preencha todos os campos obrigatórios antes da aprovação." },
        { status: 409 },
      );
    }
    console.error("Falha ao atualizar status da estratégia.", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o status da estratégia." },
      { status: 503 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  nutritionPatternAnalysisInputSchema,
  nutritionStrategyApprovalIssues,
  nutritionStrategyDraftValidationIssues,
  parseNutritionStrategyDraft,
  quantifyHabitualIntake,
  suggestPatternEnergyStrategy,
  type NutritionStrategyDraft,
} from "@/features/nutrition-strategy";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import { canAccess, mvpService } from "@/features/mvp";
import { foodRepository } from "@/features/food-database/repository";

async function analyzePattern(input: {
  readonly items: NonNullable<NutritionStrategyDraft["habitualIntake"]>["items"];
  readonly totalEnergyExpenditureKcal?: number;
  readonly objective?: NutritionStrategyDraft["objective"];
  readonly evolutionGoal?: NutritionStrategyDraft["evolutionGoal"];
}) {
  const foodIds = [...new Set(input.items.map((item) => item.foodId))];
  const foods = await foodRepository.findManyByIds(foodIds);
  if (foods.length !== foodIds.length) return null;
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const items = input.items.map((item) => ({
    ...item,
    foodName: foodsById.get(item.foodId)!.officialName,
  }));
  const estimate = quantifyHabitualIntake(items, foods);
  const suggestion = suggestPatternEnergyStrategy({
    estimate,
    totalEnergyExpenditureKcal: input.totalEnergyExpenditureKcal,
    objective: input.objective,
    goal: input.evolutionGoal,
  });
  return { items, estimate, suggestion };
}

async function canonicalizePattern(strategy: NutritionStrategyDraft) {
  if (!strategy.habitualIntake) return strategy;
  const analysis = await analyzePattern({
    items: strategy.habitualIntake.items,
    totalEnergyExpenditureKcal: strategy.totalEnergyExpenditureKcal,
    objective: strategy.objective,
    evolutionGoal: strategy.evolutionGoal,
  });
  if (!analysis) return null;
  return {
    ...strategy,
    habitualIntake: { items: analysis.items, estimate: analysis.estimate },
    patternEnergySuggestion: analysis.suggestion,
  } satisfies NutritionStrategyDraft;
}

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

const mealSchedulesSchema = z
  .array(
    z.object({
      mealNumber: z.number().int().positive().max(20),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    }),
  )
  .min(1)
  .max(20);

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

  const parsedStrategy = parseNutritionStrategyDraft(
    await request.json().catch(() => null),
  );
  if (!parsedStrategy) {
    return NextResponse.json(
      { message: "Revise os dados da estratégia nutricional." },
      { status: 400 },
    );
  }

  try {
    const strategy = await canonicalizePattern(parsedStrategy);
    if (!strategy) {
      return NextResponse.json(
        { message: "O recordat\u00f3rio cont\u00e9m alimento que n\u00e3o pertence ao Banco Mestre ativo." },
        { status: 409 },
      );
    }
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
    if (
      error instanceof Error &&
      error.message === "STRATEGY_EVALUATION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          message:
            "A avaliação informada não pertence a este atendimento.",
        },
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
    if (action === "QUANTIFY_RECALL") {
      const input = nutritionPatternAnalysisInputSchema.safeParse(
        (body as Record<string, unknown>).input,
      );
      if (!input.success) {
        return NextResponse.json(
          { message: "Revise os alimentos e quantidades do recordat\u00f3rio." },
          { status: 400 },
        );
      }
      const analysis = await analyzePattern(input.data);
      if (!analysis) {
        return NextResponse.json(
          { message: "Um alimento do recordat\u00f3rio n\u00e3o pertence ao Banco Mestre ativo." },
          { status: 409 },
        );
      }
      return NextResponse.json(analysis);
    }

    if (action === "EDIT") {
      const record = await nutritionStrategyRepository.prepareForEditing(
        patientId,
        attendanceId,
        access.user.id,
      );
      return NextResponse.json({ record });
    }

    if (action === "UPDATE_MEAL_SCHEDULES") {
      const schedules = mealSchedulesSchema.safeParse(
        (body as Record<string, unknown>).schedules,
      );
      if (!schedules.success) {
        return NextResponse.json(
          { message: "Informe um horário válido para todas as refeições." },
          { status: 400 },
        );
      }
      const record = await nutritionStrategyRepository.updateApprovedMealSchedules(
        patientId,
        attendanceId,
        schedules.data,
        access.user.id,
      );
      return NextResponse.json({ record });
    }

    if (action === "APPROVE") {
      const parsedStrategy = parseNutritionStrategyDraft(
        (body as Record<string, unknown>).strategy,
      );
      if (!parsedStrategy) {
        const validationIssues = nutritionStrategyDraftValidationIssues(
          (body as Record<string, unknown>).strategy,
        );
        return NextResponse.json(
          {
            message: `Não foi possível aprovar. Dados inválidos: ${validationIssues.join("; ") || "Estratégia Nutricional"}.`,
            issues: validationIssues,
          },
          { status: 400 },
        );
      }
      const canonicalStrategy = await canonicalizePattern(parsedStrategy);
      if (!canonicalStrategy) {
        return NextResponse.json(
          { message: "O recordat\u00f3rio cont\u00e9m alimento que n\u00e3o pertence ao Banco Mestre ativo." },
          { status: 409 },
        );
      }
      const strategy: NutritionStrategyDraft = {
        ...canonicalStrategy,
        vetDecisionState: "APPROVED",
      };
      const approvalIssues = nutritionStrategyApprovalIssues(strategy);
      if (approvalIssues.length) {
        return NextResponse.json(
          {
            message: `Não foi possível aprovar. Pendências: ${approvalIssues.join("; ")}.`,
            issues: approvalIssues,
          },
          { status: 409 },
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
    if (error instanceof Error && error.message === "STRATEGY_APPROVED") {
      return NextResponse.json(
        { message: "Reabra a estratégia antes de aprová-la novamente." },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "STRATEGY_EVALUATION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          message:
            "A avaliação informada não pertence a este atendimento.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "STRATEGY_INCOMPLETE") {
      return NextResponse.json(
        { message: "Preencha todos os campos obrigatórios antes da aprovação." },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "STRATEGY_MEAL_SCHEDULE_MISMATCH"
    ) {
      return NextResponse.json(
        {
          message:
            "Os horários não correspondem às refeições desta Estratégia Nutricional.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "STRATEGY_NOT_APPROVED"
    ) {
      return NextResponse.json(
        {
          message:
            "A correção de horários exige a Estratégia concluída deste atendimento.",
        },
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

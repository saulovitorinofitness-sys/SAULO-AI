import { NextResponse } from "next/server";

import { resolveDevelopmentAccess } from "@/features/development-session";
import {
  EXERCISE_CATEGORY_OPTIONS,
  type ExerciseCategory,
} from "@/features/performance-endurance";
import { exerciseCatalogRepository } from "@/features/performance-endurance/exercise-catalog-repository";
import { performanceEnduranceService } from "@/features/performance-endurance";
import { canAccess, mvpService } from "@/features/mvp";

async function accessFor(request: Request, action: "READ" | "UPDATE") {
  const access = resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );
  return performanceEnduranceService.canAccess(access.user) &&
    canAccess(access, "WORKOUT_PLAN", action)
    ? access
    : null;
}

export async function GET(request: Request) {
  const access = await accessFor(request, "READ");
  if (!access) {
    return NextResponse.json(
      { message: "Seu perfil não permite consultar a biblioteca de exercícios." },
      { status: 403 },
    );
  }
  const url = new URL(request.url);
  const categoryValue = url.searchParams.get("category");
  const category = EXERCISE_CATEGORY_OPTIONS.includes(
    categoryValue as ExerciseCategory,
  )
    ? (categoryValue as ExerciseCategory)
    : undefined;
  const status = url.searchParams.get("status");
  try {
    const result = await exerciseCatalogRepository.search({
      professionalUserId: access.user.id,
      query: url.searchParams.get("query") ?? undefined,
      category,
      active: status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Falha ao consultar a biblioteca de exercícios.", error);
    return NextResponse.json(
      { message: "Não foi possível consultar a biblioteca de exercícios." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const access = await accessFor(request, "UPDATE");
  if (!access) {
    return NextResponse.json(
      { message: "Seu perfil não permite alterar a biblioteca de exercícios." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    {
      message:
        "Cadastre novos exercícios na Biblioteca Científica, fonte mestre do catálogo profissional.",
    },
    { status: 405, headers: { Allow: "GET" } },
  );
}

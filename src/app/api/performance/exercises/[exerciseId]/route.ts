import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import {
  exerciseLibraryDraftSchema,
  performanceEnduranceService,
} from "@/features/performance-endurance";
import { legacyExerciseLibraryRepository } from "@/features/performance-endurance/exercise-library-repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ exerciseId: string }> },
) {
  const access = resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "UPDATE")
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite alterar a biblioteca de exercícios." },
      { status: 403 },
    );
  }
  const input = exerciseLibraryDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return NextResponse.json(
      { message: "Revise os dados obrigatórios do exercício.", issues: input.error.issues },
      { status: 400 },
    );
  }
  const { exerciseId } = await context.params;
  try {
    const exercise = await legacyExerciseLibraryRepository.update({
      id: exerciseId,
      professionalUserId: access.user.id,
      draft: input.data,
    });
    if (!exercise) {
      return NextResponse.json(
        { message: "Exercício não localizado na sua biblioteca." },
        { status: 404 },
      );
    }
    return NextResponse.json({ exercise });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Você já possui um exercício com este nome." },
        { status: 409 },
      );
    }
    console.error("Falha ao atualizar exercício da biblioteca.", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o exercício." },
      { status: 503 },
    );
  }
}

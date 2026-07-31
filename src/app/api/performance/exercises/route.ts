import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";
import { performanceWorkoutRepository } from "@/features/performance-endurance/workout-repository";

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const access = await mvpService.getSession();
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "UPDATE")
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite alterar a biblioteca de exercícios." },
      { status: 403 },
    );
  }
  const input = exerciseSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return NextResponse.json(
      { message: "Informe o nome do exercício." },
      { status: 400 },
    );
  }
  try {
    const exercise = await performanceWorkoutRepository.createExercise({
      name: input.data.name,
      professionalUserId: access.user.id,
    });
    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Falha ao salvar exercício na biblioteca.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar o exercício na biblioteca." },
      { status: 503 },
    );
  }
}

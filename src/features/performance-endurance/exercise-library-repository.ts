import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import {
  normalizeExerciseName,
  type ExerciseCategory,
  type ExerciseLibraryDraft,
  type ExerciseLibraryItemView,
  type ExerciseLibrarySearchResult,
} from "./exercise-library-contracts";

function nullable(value: string) {
  const cleaned = value.trim();
  return cleaned || null;
}

function toView(item: {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroup: string | null;
  equipment: string | null;
  description: string | null;
  executionInstructions: string | null;
  professionalNotes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ExerciseLibraryItemView {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    muscleGroup: item.muscleGroup ?? "",
    equipment: item.equipment ?? "",
    description: item.description ?? "",
    executionInstructions: item.executionInstructions ?? "",
    professionalNotes: item.professionalNotes ?? "",
    active: item.active,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

const selection = {
  id: true,
  name: true,
  category: true,
  muscleGroup: true,
  equipment: true,
  description: true,
  executionInstructions: true,
  professionalNotes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const legacyExerciseLibraryRepository = {
  async search(input: {
    professionalUserId: string;
    query?: string;
    category?: ExerciseCategory;
    active?: boolean;
  }): Promise<ExerciseLibrarySearchResult> {
    const query = input.query?.trim();
    const where: Prisma.ExerciseLibraryItemWhereInput = {
      createdByUserId: input.professionalUserId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(query
        ? {
            OR: [
              { normalizedName: { contains: normalizeExerciseName(query) } },
              { muscleGroup: { contains: query, mode: "insensitive" } },
              { equipment: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.exerciseLibraryItem.findMany({
        where,
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: selection,
      }),
      prisma.exerciseLibraryItem.count({ where }),
    ]);
    return { items: items.map(toView), total };
  },

  async update(input: {
    id: string;
    professionalUserId: string;
    draft: ExerciseLibraryDraft;
  }): Promise<ExerciseLibraryItemView | null> {
    const existing = await prisma.exerciseLibraryItem.findFirst({
      where: {
        id: input.id,
        createdByUserId: input.professionalUserId,
      },
      select: { id: true },
    });
    if (!existing) return null;
    const item = await prisma.exerciseLibraryItem.update({
      where: { id: existing.id },
      data: {
        updatedByUserId: input.professionalUserId,
        name: input.draft.name.trim(),
        normalizedName: normalizeExerciseName(input.draft.name),
        category: input.draft.category,
        muscleGroup: nullable(input.draft.muscleGroup),
        equipment: nullable(input.draft.equipment),
        description: nullable(input.draft.description),
        executionInstructions: nullable(input.draft.executionInstructions),
        professionalNotes: nullable(input.draft.professionalNotes),
        active: input.draft.active,
      },
      select: selection,
    });
    return toView(item);
  },
};

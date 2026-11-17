import { prisma } from "@/lib/database/prisma";
import { sharedDataMockItems } from "@/features/shared-data/mock-data";

import {
  normalizeExerciseName,
  type ExerciseCategory,
  type ExerciseLibraryItemView,
  type ExerciseLibrarySearchResult,
} from "./exercise-library-contracts";
import { legacyExerciseLibraryRepository } from "./exercise-library-repository";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function attributesFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const attributes = (value as { attributes?: unknown }).attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? (attributes as Record<string, unknown>)
    : {};
}

function textAttribute(attributes: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function listAttribute(attributes: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = attributes[key];
    if (Array.isArray(value)) return stringArray(value);
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function categoryFromModality(modality: string): ExerciseCategory {
  if (modality === "Corrida") return "RUNNING";
  if (modality === "Ciclismo") return "CYCLING";
  if (modality === "Mobilidade") return "MOBILITY";
  if (modality === "Flexibilidade" || modality === "Alongamento") return "STRETCHING";
  if (modality === "Exercício corretivo") return "CORRECTIVE";
  if (
    modality === "Musculação" ||
    modality === "Peso corporal" ||
    modality === "Treinamento funcional" ||
    modality === "Core"
  ) {
    return "STRENGTH";
  }
  return "OTHER";
}

function categoryFromSharedTags(tags: readonly string[]): ExerciseCategory {
  if (tags.includes("corrida")) return "RUNNING";
  if (tags.includes("ciclismo")) return "CYCLING";
  if (tags.includes("mobilidade")) return "MOBILITY";
  if (tags.includes("flexibilidade") || tags.includes("alongamento")) return "STRETCHING";
  if (tags.includes("corretivo")) return "CORRECTIVE";
  return "STRENGTH";
}

function normalizedSearchText(item: ExerciseLibraryItemView) {
  return normalizeExerciseName([
    item.name,
    item.modality ?? "",
    item.muscleGroup,
    item.equipment,
    item.movementPattern ?? "",
    ...(item.classifications ?? []),
    ...(item.tags ?? []),
  ].join(" "));
}

export const exerciseCatalogRepository = {
  async search(input: {
    professionalUserId: string;
    query?: string;
    category?: ExerciseCategory;
    active?: boolean;
  }): Promise<ExerciseLibrarySearchResult> {
    const scientificStatuses =
      input.active === true
        ? ["ACTIVE"]
        : input.active === false
          ? ["INACTIVE"]
          : ["ACTIVE", "INACTIVE"];
    const [scientificRecords, legacy] = await Promise.all([
      prisma.scientificLibraryRecord.findMany({
        where: {
          area: "PERFORMANCE",
          domain: "EXERCISE",
          status: { in: scientificStatuses },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          tags: true,
          professionalNotes: true,
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      legacyExerciseLibraryRepository.search({
        professionalUserId: input.professionalUserId,
        query: input.query,
        category: input.category,
        active: input.active,
      }),
    ]);
    const scientific = scientificRecords.map<ExerciseLibraryItemView>((record) => {
      const attributes = attributesFromMetadata(record.metadata);
      const modality = textAttribute(attributes, "Modalidade");
      return {
        id: record.id,
        sourceKind: "SCIENTIFIC_LIBRARY",
        name: record.name,
        category: categoryFromModality(modality),
        modality,
        muscleGroup: listAttribute(
          attributes,
          "Grupos musculares / regiões",
          "Grupo muscular",
          "Grupo muscular / região",
        ).join(", "),
        equipment: listAttribute(attributes, "Equipamentos", "Equipamento").join(", "),
        description: record.description ?? "",
        executionInstructions: textAttribute(
          attributes,
          "Execução técnica",
          "Execução",
          "Descrição de execução",
        ),
        professionalNotes: record.professionalNotes ?? "",
        movementPattern: textAttribute(attributes, "Padrão de movimento"),
        classifications: listAttribute(attributes, "Classificações"),
        tags: stringArray(record.tags),
        active: record.status === "ACTIVE",
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    });
    const sharedScientific = sharedDataMockItems.flatMap<ExerciseLibraryItemView>((item) => {
      if (
        item.domain !== "EXERCISE" ||
        !scientificStatuses.includes(item.status)
      ) {
        return [];
      }
      return [{
        id: `scientific-${item.id}`,
        sourceKind: "SCIENTIFIC_LIBRARY",
        name: item.name,
        category: categoryFromSharedTags(item.tags),
        muscleGroup: item.attributes.muscleGroup,
        equipment: item.attributes.equipment,
        description: item.description ?? "",
        executionInstructions: item.attributes.instructions,
        professionalNotes: item.attributes.professionalContraindications,
        tags: item.tags,
        active: item.status === "ACTIVE",
        createdAt: item.audit.createdAt,
        updatedAt: item.audit.updatedAt,
      }];
    });
    const normalizedQuery = input.query?.trim()
      ? normalizeExerciseName(input.query)
      : "";
    const filteredScientific = [...sharedScientific, ...scientific].filter(
      (item) =>
        (!input.category || item.category === input.category) &&
        (!normalizedQuery || normalizedSearchText(item).includes(normalizedQuery)),
    );
    const items = [
      ...filteredScientific,
      ...legacy.items.map((item) => ({
        ...item,
        sourceKind: "LEGACY_EXERCISE_LIBRARY" as const,
      })),
    ].sort((left, right) => {
      const byName = left.name.localeCompare(right.name, "pt-BR");
      if (byName) return byName;
      return left.sourceKind === "SCIENTIFIC_LIBRARY" ? -1 : 1;
    });
    return { items, total: items.length };
  },
};

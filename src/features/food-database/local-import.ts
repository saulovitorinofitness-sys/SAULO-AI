import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import { normalizeFoodSearchText } from "./normalization";

const nullableNutrient = z.number().finite().nonnegative().nullable().optional();
const nutrientFields = {
  energyKcal: nullableNutrient,
  proteinGrams: nullableNutrient,
  carbohydratesGrams: nullableNutrient,
  fatsGrams: nullableNutrient,
  fiberGrams: nullableNutrient,
  sugarsGrams: nullableNutrient,
  cholesterolMg: nullableNutrient,
  saturatedFatsGrams: nullableNutrient,
  monounsaturatedFatsGrams: nullableNutrient,
  polyunsaturatedFatsGrams: nullableNutrient,
  sodiumMg: nullableNutrient,
  calciumMg: nullableNutrient,
  ironMg: nullableNutrient,
  magnesiumMg: nullableNutrient,
  phosphorusMg: nullableNutrient,
  potassiumMg: nullableNutrient,
  zincMg: nullableNutrient,
  copperMg: nullableNutrient,
  manganeseMg: nullableNutrient,
  seleniumMcg: nullableNutrient,
  vitaminAMcg: nullableNutrient,
  vitaminCMg: nullableNutrient,
  vitaminDMcg: nullableNutrient,
  vitaminEMg: nullableNutrient,
  vitaminKMcg: nullableNutrient,
  thiamineMg: nullableNutrient,
  riboflavinMg: nullableNutrient,
  niacinMg: nullableNutrient,
  vitaminB6Mg: nullableNutrient,
  folateMcg: nullableNutrient,
  vitaminB12Mcg: nullableNutrient,
} as const;

const localFoodSchema = z.object({
  sourceCode: z.string().trim().min(1).max(100).optional(),
  officialName: z.string().trim().min(1).max(180),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(2).max(100),
  foodGroup: z.string().trim().min(2).max(100),
  preparationState: z.string().trim().max(80).optional(),
  presentation: z.string().trim().max(100).optional(),
  referenceServingGrams: z.number().finite().positive().default(100),
  referenceServingUnit: z.string().trim().min(1).max(20).optional(),
  nutrients: z.object(nutrientFields).strict(),
  householdMeasures: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        variation: z.string().trim().max(100).optional(),
        quantity: z.number().finite().positive(),
        grams: z.number().finite().positive(),
        isDefault: z.boolean().default(false),
      }),
    )
    .default([]),
  synonyms: z.array(z.string().trim().min(1).max(180)).default([]),
});

const localFoodPackageSchema = z.object({
  source: z.object({
    kind: z.enum(["TACO", "TBCA", "IBGE", "PHILIPS", "USDA", "CLINIC_SV"]),
    name: z.string().trim().min(2).max(120),
    version: z.string().trim().min(1).max(80).optional(),
    reference: z.string().trim().min(1).max(500).optional(),
    origin: z.enum(["OFFICIAL", "PROFESSIONAL"]),
  }),
  foods: z.array(localFoodSchema).min(1),
});

export type LocalFoodPackage = z.infer<typeof localFoodPackageSchema>;

export function parseLocalFoodPackages(value: unknown): readonly LocalFoodPackage[] {
  const packages = Array.isArray(value) ? value : [value];
  const parsed = z.array(localFoodPackageSchema).min(1).safeParse(packages);
  if (!parsed.success) {
    throw new Error(
      `Arquivo alimentar inválido: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "raiz"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  for (const item of parsed.data) {
    const keys = new Set<string>();
    for (const food of item.foods) {
      const key = food.sourceCode
        ? `code:${normalizeFoodSearchText(food.sourceCode)}`
        : `name:${normalizeFoodSearchText(food.officialName)}:${normalizeFoodSearchText(food.preparationState ?? "")}`;
      if (keys.has(key)) {
        throw new Error(
          `Alimento duplicado no arquivo ${item.source.name}: ${food.sourceCode ?? food.officialName}.`,
        );
      }
      keys.add(key);
    }
  }
  return parsed.data;
}

function nutrientData(
  nutrients: LocalFoodPackage["foods"][number]["nutrients"],
) {
  return Object.fromEntries(
    Object.entries(nutrientFields).map(([field]) => [
      field,
      nutrients[field as keyof typeof nutrients] ?? null,
    ]),
  );
}

export async function importLocalFoodPackages(
  packages: readonly LocalFoodPackage[],
) {
  return prisma.$transaction(async (transaction) => {
    let created = 0;
    let updated = 0;

    for (const item of packages) {
      const source =
        (await transaction.nutritionSource.findFirst({
          where: {
            kind: item.source.kind,
            name: item.source.name,
            version: item.source.version ?? null,
          },
        })) ??
        (await transaction.nutritionSource.create({
          data: {
            ...item.source,
            origin: item.source.origin,
            editable: item.source.origin === "PROFESSIONAL",
            active: true,
          },
        }));

      for (const food of item.foods) {
        const normalizedName = normalizeFoodSearchText(food.officialName);
        const category = await transaction.foodCategory.upsert({
          where: { normalizedName: normalizeFoodSearchText(food.category) },
          update: { name: food.category, active: true },
          create: {
            name: food.category,
            normalizedName: normalizeFoodSearchText(food.category),
          },
        });
        const existing = await transaction.food.findFirst({
          where: food.sourceCode
            ? { sourceId: source.id, sourceCode: food.sourceCode }
            : {
                sourceId: source.id,
                normalizedName,
                preparationState: food.preparationState ?? null,
                sourceCode: null,
              },
          select: { id: true },
        });
        const foodData = {
          officialName: food.officialName,
          normalizedName,
          description: food.description,
          categoryId: category.id,
          foodGroup: food.foodGroup,
          sourceId: source.id,
          sourceCode: food.sourceCode,
          preparationState: food.preparationState,
          presentation: food.presentation,
          referenceServingGrams: food.referenceServingGrams,
          referenceServingUnit: food.referenceServingUnit,
          status: "ACTIVE" as const,
        };
        const savedFood = existing
          ? await transaction.food.update({
              where: { id: existing.id },
              data: foodData,
              select: { id: true },
            })
          : await transaction.food.create({
              data: foodData,
              select: { id: true },
            });
        if (existing) updated++;
        else created++;

        await transaction.foodNutrients.upsert({
          where: { foodId: savedFood.id },
          update: nutrientData(food.nutrients),
          create: { foodId: savedFood.id, ...nutrientData(food.nutrients) },
        });
        await transaction.foodHouseholdMeasure.deleteMany({
          where: { foodId: savedFood.id },
        });
        if (food.householdMeasures.length) {
          await transaction.foodHouseholdMeasure.createMany({
            data: food.householdMeasures.map((measure) => ({
              foodId: savedFood.id,
              sourceId: source.id,
              name: measure.name,
              normalizedName: normalizeFoodSearchText(measure.name),
              variation: measure.variation,
              quantity: measure.quantity,
              grams: measure.grams,
              isDefault: measure.isDefault,
              active: true,
            })),
          });
        }
        await transaction.foodSynonym.deleteMany({
          where: { foodId: savedFood.id },
        });
        const synonyms = [
          ...new Map(
            food.synonyms.map((name) => [normalizeFoodSearchText(name), name]),
          ).entries(),
        ];
        if (synonyms.length) {
          await transaction.foodSynonym.createMany({
            data: synonyms.map(([normalizedName, name]) => ({
              foodId: savedFood.id,
              name,
              normalizedName,
            })),
          });
        }
      }
    }

    return { created, updated, total: created + updated };
  }, {
    isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel,
    maxWait: 10_000,
    timeout: 120_000,
  });
}

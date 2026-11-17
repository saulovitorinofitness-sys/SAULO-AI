import { z } from "zod";

const nullableTextSchema = z.string().trim().min(1).max(20_000).nullable();
const nullableQuantitySchema = z.number().finite().nonnegative().nullable();
const measurementUnitSchema = z.enum(["GRAM", "MILLILITER", "UNIT"]);

export const recipeContentSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(300),
  ingredients: z.array(
    z.object({
      ingredientId: z.string().min(1),
      foodId: z.string().min(1),
      foodName: z.string().trim().min(1).max(300),
      position: z.number().int().positive(),
      grossQuantity: nullableQuantitySchema,
      netQuantity: nullableQuantitySchema,
      quantityUnit: z.enum(["GRAM", "MILLILITER"]).nullable(),
      householdMeasureQuantity: nullableQuantitySchema,
      householdMeasureDescription: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .nullable(),
      notes: nullableTextSchema,
    }),
  ),
  preparationMethod: nullableTextSchema,
  preparationSteps: z.array(
    z.object({
      position: z.number().int().positive(),
      instruction: z.string().trim().min(1).max(20_000),
    }),
  ),
  yieldDescription: z.string().trim().min(1).max(1_000).nullable(),
  finalYield: z
    .object({
      amount: z.number().finite().nonnegative(),
      unit: measurementUnitSchema,
    })
    .nullable(),
  declaredYield: z
    .object({
      amount: z.number().finite().nonnegative(),
      unit: measurementUnitSchema,
    })
    .nullable(),
  servings: z.number().int().nonnegative().nullable(),
});

export type RecipeContentSnapshot = z.infer<
  typeof recipeContentSnapshotSchema
>;

export const RECIPE_CONTENT_PENDING_CODES = [
  "CONTENT_SNAPSHOT_MISSING",
  "INGREDIENTS_MISSING",
  "INGREDIENT_QUANTITIES_MISSING",
  "PREPARATION_MISSING",
  "TOTAL_YIELD_MISSING",
] as const;

export type RecipeContentPendingCode =
  (typeof RECIPE_CONTENT_PENDING_CODES)[number];

export function parseRecipeContentSnapshot(
  value: unknown,
): RecipeContentSnapshot | undefined {
  const parsed = recipeContentSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function recipeContentPendings(
  snapshot: RecipeContentSnapshot | undefined,
): readonly RecipeContentPendingCode[] {
  if (!snapshot) return ["CONTENT_SNAPSHOT_MISSING"];

  const pendings: RecipeContentPendingCode[] = [];
  if (!snapshot.ingredients.length) pendings.push("INGREDIENTS_MISSING");
  if (
    snapshot.ingredients.some(
      (ingredient) =>
        !(
          ingredient.grossQuantity !== null &&
          ingredient.quantityUnit !== null
        ) &&
        !(
          ingredient.householdMeasureQuantity !== null &&
          ingredient.householdMeasureDescription !== null
        ),
    )
  ) {
    pendings.push("INGREDIENT_QUANTITIES_MISSING");
  }
  if (
    snapshot.preparationMethod === null &&
    snapshot.preparationSteps.length === 0
  ) {
    pendings.push("PREPARATION_MISSING");
  }
  if (
    snapshot.yieldDescription === null &&
    snapshot.finalYield === null &&
    snapshot.declaredYield === null &&
    snapshot.servings === null
  ) {
    pendings.push("TOTAL_YIELD_MISSING");
  }
  return pendings;
}

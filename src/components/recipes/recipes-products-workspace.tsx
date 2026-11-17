"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  FormField,
  Input,
  NumberInput,
  PageHeading,
  PageState,
  Select,
  Textarea,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  FoodSearchResult,
  FoodSearchSourceOption,
  ProfessionalFood,
} from "@/features/food-database";
import type {
  RecipeNutritionCalculationResult,
  RecipeNutrientKey,
  RecipeNutrientValues,
  ScientificNutrientValue,
} from "@/features/recipes/nutrition-calculator";

type MeasurementUnit = "GRAM" | "MILLILITER" | "UNIT";
type IngredientUnit = Exclude<MeasurementUnit, "UNIT">;
type PhysicalType = "SOLID" | "SEMISOLID" | "LIQUID";
type WorkspaceTab = "recipes" | "commercial";
type Notice = { readonly tone: "success" | "error" | "info"; readonly text: string };

interface RecipeSnapshot { readonly id: string; readonly version: number }
interface RecipeStep { readonly id: string; readonly instruction: string; readonly position: number }
interface IngredientFood {
  readonly id: string;
  readonly officialName: string;
  readonly source: { readonly kind: string; readonly name: string };
  readonly referenceServingGrams?: number;
  readonly referenceServingUnit?: string | null;
  readonly householdMeasures?: ProfessionalFood["householdMeasures"];
}
interface RecipeIngredient {
  readonly id: string;
  readonly foodId: string;
  readonly position: number;
  readonly quantityGrams: unknown;
  readonly grossQuantity: unknown;
  readonly netQuantity: unknown;
  readonly quantityUnit: IngredientUnit | null;
  readonly householdMeasureId: string | null;
  readonly householdMeasureQuantity: unknown;
  readonly householdMeasureDescription: string | null;
  readonly correctionFactor: unknown;
  readonly cookingYieldFactor: unknown;
  readonly notes: string | null;
  readonly food: IngredientFood;
}
interface Recipe {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly category?: string | null;
  readonly notes?: string | null;
  readonly preparationMethod?: string | null;
  readonly preparationTimeMinutes?: number | null;
  readonly finalYieldAmount?: unknown;
  readonly finalYieldUnit?: MeasurementUnit | null;
  readonly servings?: number | null;
  readonly servingSize?: unknown;
  readonly servingSizeUnit?: MeasurementUnit | null;
  readonly servingHouseholdMeasure?: string | null;
  readonly physicalType?: PhysicalType | null;
  readonly status: string;
  readonly ingredients: readonly RecipeIngredient[];
  readonly preparationSteps: readonly RecipeStep[];
  readonly nutritionSnapshots: readonly RecipeSnapshot[];
}
interface ProductLabelSummary {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "VALIDATED" | "SUPERSEDED" | "ARCHIVED";
}
interface Product {
  readonly id: string;
  readonly recipeId: string;
  readonly recipeNutritionSnapshotId: string;
  readonly commercialName: string;
  readonly brand?: string | null;
  readonly description?: string | null;
  readonly category?: string | null;
  readonly physicalType: PhysicalType;
  readonly netContent: unknown;
  readonly netContentUnit: IngredientUnit;
  readonly servingsPerPackage: unknown;
  readonly servingSize: unknown;
  readonly servingSizeUnit: IngredientUnit;
  readonly servingHouseholdMeasure?: string | null;
  readonly sku?: string | null;
  readonly shelfLifeDays?: number | null;
  readonly storageInstructions?: string | null;
  readonly preparationOrConsumptionInstructions?: string | null;
  readonly nutritionLabels: readonly ProductLabelSummary[];
}
interface Pending {
  readonly code: string;
  readonly message: string;
  readonly blocking?: boolean;
  readonly blockingFor?: readonly string[];
  readonly nutrient?: string;
  readonly foodName?: string;
}
interface LabelNutrient {
  readonly unit: string;
  readonly raw: { readonly per100: number | null; readonly perServing: number | null; readonly dailyValuePercent: number | null };
  readonly presentation?: { readonly per100: { readonly text: string } | null; readonly perServing: { readonly text: string } | null; readonly dailyValuePercent: { readonly text: string } | null };
}
interface LabelCalculation {
  readonly calculationStatus: "UNAVAILABLE" | "PARTIAL" | "COMPLETE";
  readonly labelEmission: { readonly sufficientInformation: boolean; readonly regulatoryApproval: false };
  readonly nutrients: Readonly<Record<string, LabelNutrient>>;
  readonly pendings: readonly Pending[];
  readonly frontOfPack?: { readonly status: string; readonly reason: string | null };
}
interface LabelPreview {
  readonly productId: string;
  readonly proposedVersion: number;
  readonly calculation: LabelCalculation;
  readonly sourceState: { readonly readyForNewLabelVersion: boolean; readonly reason: string | null };
}
interface PreservedVersion {
  readonly status: "PRESERVED" | "LEGACY_UNVERIFIABLE" | "INVALID";
  readonly reason: string | null;
  readonly data: { readonly calculation: LabelCalculation; readonly pendings: readonly Pending[] } | null;
}
interface LabelVersion extends ProductLabelSummary {
  readonly createdAt: string;
  readonly validatedAt: string | null;
  readonly preservedVersion: PreservedVersion;
}
type RecipeCalculation = Omit<
  RecipeNutritionCalculationResult,
  "pendings" | "snapshotDraft"
> & { readonly pendings: readonly Pending[] };

interface ConfirmedHouseholdMeasureOption {
  readonly id: string;
  readonly measureId: string;
  readonly label: string;
  readonly measureName: string;
  readonly amountPerMeasure: number;
  readonly unit: "g" | "ml";
  readonly quantityValue: number;
  readonly quantityUnit: "g" | "ml";
  readonly confidence: "CONFIRMED";
}

interface RecipeForm {
  title: string; description: string; category: string; notes: string;
  preparationMethod: string; preparationTimeMinutes: string;
  finalYieldAmount: string; finalYieldUnit: MeasurementUnit;
  servings: string; servingSize: string; servingSizeUnit: MeasurementUnit;
  servingHouseholdMeasure: string; physicalType: PhysicalType;
}
interface IngredientForm {
  grossQuantity: string; netQuantity: string; quantityUnit: IngredientUnit;
  householdMeasureId: string; confirmedMeasureId: string;
  confirmedMeasureDescription: string; householdMeasureQuantity: string;
  correctionFactor: string; cookingYieldFactor: string; notes: string;
}
interface ProductForm {
  recipeNutritionSnapshotId: string; commercialName: string; brand: string;
  description: string; category: string; physicalType: PhysicalType;
  netContent: string; netContentUnit: IngredientUnit; servingsPerPackage: string;
  servingSize: string; servingSizeUnit: IngredientUnit; servingHouseholdMeasure: string;
  sku: string; shelfLifeDays: string; storageInstructions: string;
  preparationOrConsumptionInstructions: string;
}
interface RegulatoryForm {
  servingSource: "IN_75_ANNEX_V" | "RDC_429_ARTICLE_9";
  servingReference: string; servingConfirmed: boolean; additionalReviewed: boolean;
  missingInformation: string; tableContext: "AS_SOLD" | "PREPARED" | "SPECIAL";
  preparationIngredientsIncluded: boolean; specialReference: string;
  zeroCarbohydrates: boolean; zeroTotalSugars: boolean; zeroAddedSugars: boolean;
  zeroProtein: boolean; zeroTotalFats: boolean;
  frontApplicability: "STANDARD" | "PROHIBITED" | "OPTIONAL" | "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6";
  frontReason: string; frontBasis: "AS_SOLD" | "PREPARED";
  frontAddedSugars: string; frontSaturatedFats: string; frontSodium: string;
}

const emptyRecipe = (): RecipeForm => ({
  title: "", description: "", category: "", notes: "", preparationMethod: "",
  preparationTimeMinutes: "", finalYieldAmount: "", finalYieldUnit: "GRAM",
  servings: "", servingSize: "", servingSizeUnit: "GRAM",
  servingHouseholdMeasure: "", physicalType: "SOLID",
});
const emptyIngredient = (): IngredientForm => ({
  grossQuantity: "", netQuantity: "", quantityUnit: "GRAM", householdMeasureId: "",
  confirmedMeasureId: "", confirmedMeasureDescription: "",
  householdMeasureQuantity: "", correctionFactor: "", cookingYieldFactor: "", notes: "",
});
const emptyProduct = (): ProductForm => ({
  recipeNutritionSnapshotId: "", commercialName: "", brand: "", description: "", category: "",
  physicalType: "SOLID", netContent: "", netContentUnit: "GRAM", servingsPerPackage: "",
  servingSize: "", servingSizeUnit: "GRAM", servingHouseholdMeasure: "", sku: "",
  shelfLifeDays: "", storageInstructions: "", preparationOrConsumptionInstructions: "",
});
const emptyRegulatory = (): RegulatoryForm => ({
  servingSource: "IN_75_ANNEX_V", servingReference: "", servingConfirmed: false,
  additionalReviewed: false, missingInformation: "", tableContext: "AS_SOLD",
  preparationIngredientsIncluded: false, specialReference: "", zeroCarbohydrates: false,
  zeroTotalSugars: false, zeroAddedSugars: false, zeroProtein: false, zeroTotalFats: false,
  frontApplicability: "STANDARD", frontReason: "", frontBasis: "AS_SOLD",
  frontAddedSugars: "", frontSaturatedFats: "", frontSodium: "",
});

const nutrientLabels: Readonly<Record<string, string>> = {
  energyKcal: "Valor energético", energyKj: "Valor energético (kJ)", carbohydratesGrams: "Carboidratos",
  totalSugarsGrams: "Açúcares totais", addedSugarsGrams: "Açúcares adicionados", proteinGrams: "Proteínas",
  totalFatsGrams: "Gorduras totais", saturatedFatsGrams: "Gorduras saturadas",
  transFatsGrams: "Gorduras trans", cholesterolMg: "Colesterol",
  monounsaturatedFatsGrams: "Gorduras monoinsaturadas",
  polyunsaturatedFatsGrams: "Gorduras poli-insaturadas",
  fiberGrams: "Fibra alimentar", sodiumMg: "Sódio", calciumMg: "Cálcio",
  ironMg: "Ferro", magnesiumMg: "Magnésio", phosphorusMg: "Fósforo",
  potassiumMg: "Potássio", zincMg: "Zinco", copperMg: "Cobre",
  manganeseMg: "Manganês", seleniumMcg: "Selênio", vitaminAMcg: "Vitamina A",
  vitaminCMg: "Vitamina C", vitaminDMcg: "Vitamina D", vitaminEMg: "Vitamina E",
  vitaminKMcg: "Vitamina K", thiamineMg: "Tiamina", riboflavinMg: "Riboflavina",
  niacinMg: "Niacina", vitaminB6Mg: "Vitamina B6", folateMcg: "Folato",
  vitaminB12Mcg: "Vitamina B12",
};
const unitLabels: Readonly<Record<MeasurementUnit, string>> = { GRAM: "g", MILLILITER: "ml", UNIT: "unidade" };
const recipeNutrientKeys = Object.keys(nutrientLabels) as RecipeNutrientKey[];
const recipeNutrientUnitLabels: Readonly<Record<RecipeNutrientKey, string>> = {
  energyKcal: "kcal", energyKj: "kJ", carbohydratesGrams: "g", totalSugarsGrams: "g",
  addedSugarsGrams: "g", proteinGrams: "g", totalFatsGrams: "g", saturatedFatsGrams: "g",
  transFatsGrams: "g", cholesterolMg: "mg", monounsaturatedFatsGrams: "g",
  polyunsaturatedFatsGrams: "g", fiberGrams: "g", sodiumMg: "mg", calciumMg: "mg",
  ironMg: "mg", magnesiumMg: "mg", phosphorusMg: "mg", potassiumMg: "mg",
  zincMg: "mg", copperMg: "mg", manganeseMg: "mg", seleniumMcg: "mcg",
  vitaminAMcg: "mcg", vitaminCMg: "mg", vitaminDMcg: "mcg", vitaminEMg: "mg",
  vitaminKMcg: "mcg", thiamineMg: "mg", riboflavinMg: "mg", niacinMg: "mg",
  vitaminB6Mg: "mg", folateMcg: "mcg", vitaminB12Mcg: "mcg",
};
const calculationStatusLabels: Readonly<Record<string, string>> = {
  COMPLETE: "Completo", PARTIAL: "Parcial", INCOMPLETE: "Incompleto", UNAVAILABLE: "Indisponível",
};
const scientificStatusLabels: Readonly<Record<ScientificNutrientValue["status"], string>> = {
  VALUE: "Valor disponível", PARTIAL: "Subtotal dos valores disponíveis", TRACE: "Traço informado pela fonte", NOT_ANALYZED: "Não analisado pela fonte",
  NOT_APPLICABLE: "Não aplicável", MISSING: "Informação ausente",
};
const nutritionNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly payload: unknown) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function apiMessage(payload: unknown, fallback: string) { return record(payload) && typeof payload.message === "string" ? payload.message : fallback; }
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { ...developmentUserRequestHeaders(), ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok) throw new ApiError(apiMessage(payload, "Não foi possível concluir a operação."), response.status, payload);
  if (payload === null) throw new ApiError("A API retornou uma resposta vazia.", response.status, payload);
  return payload;
}
function numberText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}
function optionalText(value: string) { const result = value.trim(); return result || undefined; }
function requiredNumber(value: string) { return Number(value); }
function optionalNumber(value: string) { const result = value.trim(); return result ? Number(result) : undefined; }
function displayDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <Card className="min-w-0 p-4 sm:p-5" id={id}><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}
function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const classes = notice.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-sky-200 bg-sky-50 text-sky-900";
  return <p aria-live="polite" className={`rounded-xl border p-3 text-sm font-bold ${classes}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>;
}
function pendingDescription(pending: Pending) {
  if (pending.code === "MISSING_NUTRIENT" && pending.nutrient) {
    return `${nutrientLabels[pending.nutrient] ?? pending.nutrient}: informação ausente na fonte nutricional.`;
  }
  if (pending.code === "MISSING_FINAL_YIELD") {
    return "Informe o rendimento final positivo para calcular os valores por 100 g ou 100 ml.";
  }
  if (pending.code === "MISSING_SERVING") {
    return "Informe o número de porções e o tamanho da porção, ou um rendimento que permita determinar um deles.";
  }
  if (pending.code === "UNIT_MISMATCH") {
    return "A unidade do ingrediente não corresponde à unidade da base nutricional; nenhuma densidade foi presumida.";
  }
  return pending.message;
}
function PendingList({ pendings, empty }: { pendings: readonly Pending[]; empty: string }) {
  if (!pendings.length) return <p className="text-sm text-emerald-800">{empty}</p>;
  const groups = new Map<string, Pending[]>();
  for (const pending of pendings) {
    const key = pending.foodName ?? "Receita";
    groups.set(key, [...(groups.get(key) ?? []), pending]);
  }
  return <div className="grid gap-3">{[...groups.entries()].map(([group, items]) => <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" key={group}><h4 className="font-black">{group}</h4><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((pending, index) => <li key={`${pending.code}-${pending.nutrient ?? "general"}-${index}`}>{pendingDescription(pending)}</li>)}</ul></section>)}</div>;
}

function nutritionCell(values: RecipeNutrientValues | null, key: RecipeNutrientKey, dependency: "porção" | "rendimento") {
  if (!values) return <span className="text-xs font-bold text-amber-800">Depende da {dependency}</span>;
  const nutrient = values[key];
  if (nutrient.status === "VALUE") return <span className="font-black text-emerald-950">{nutritionNumber.format(nutrient.value)} {recipeNutrientUnitLabels[key]}</span>;
  if (nutrient.status === "PARTIAL") return <span className="text-xs font-bold text-amber-800">{nutritionNumber.format(nutrient.value)} {recipeNutrientUnitLabels[key]} (parcial)</span>;
  if (nutrient.status === "MISSING") return <span className="text-xs font-bold text-slate-600">Ausente</span>;
  return <span className="text-xs font-bold text-slate-600">{scientificStatusLabels[nutrient.status]}</span>;
}

function RecipeNutritionResults({ calculation, outdated }: { calculation: RecipeCalculation; outdated: boolean }) {
  const statusLabel = calculationStatusLabels[calculation.calculationStatus] ?? calculation.calculationStatus;
  const missingYield = calculation.pendings.some((pending) => pending.code === "MISSING_FINAL_YIELD");
  const missingServing = calculation.pendings.some((pending) => pending.code === "MISSING_SERVING");
  const per100Unit = calculation.per100Basis?.unit ?? "g/ml";
  return <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 lg:col-span-2" aria-labelledby="recipe-nutrition-results-title">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black" id="recipe-nutrition-results-title">Resultados nutricionais dos ingredientes</h3><p className="mt-1 text-xs text-sky-950">Os valores correspondem somente a {calculation.ingredients.length} {calculation.ingredients.length === 1 ? "ingrediente cadastrado" : "ingredientes cadastrados"}. Este resultado não declara a receita completa nem pronta para rótulo.</p></div><Badge tone={calculation.calculationStatus === "COMPLETE" ? "success" : "warning"}>{statusLabel}</Badge></div>
    {outdated ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">Resultado anterior: há alterações de composição ainda não incluídas. Salve e execute o cálculo novamente.</p> : null}
    <div className="mt-4 grid gap-2">
      {missingServing ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{calculation.perServing ? "O valor por porção usa o número de porções informado; complete também o tamanho da porção." : "Informe o número de porções para calcular os valores por porção."}</p> : null}
      {missingYield ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Informe o rendimento final em gramas ou mililitros para calcular os valores por 100.</p> : null}
    </div>
    <div aria-label="Tabela de resultados nutricionais" className="mt-4 max-w-full overflow-x-auto rounded-xl border border-sky-200 bg-white" tabIndex={0}>
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <caption className="sr-only">Nutrientes da receita inteira, por porção e por 100 {per100Unit}</caption>
        <thead className="bg-sky-100 text-sky-950"><tr><th className="sticky left-0 z-10 min-w-44 bg-sky-100 px-3 py-2 font-black" scope="col">Nutriente</th><th className="whitespace-nowrap px-3 py-2 font-black" scope="col">Receita inteira</th><th className="whitespace-nowrap px-3 py-2 font-black" scope="col">Por porção</th><th className="whitespace-nowrap px-3 py-2 font-black" scope="col">Por 100 {per100Unit}</th></tr></thead>
        <tbody>{recipeNutrientKeys.map((key) => <tr className="border-t border-sky-100" key={key}><th className="sticky left-0 z-10 bg-white px-3 py-2 font-bold" scope="row">{nutrientLabels[key]}</th><td className="whitespace-nowrap px-3 py-2">{nutritionCell(calculation.total, key, "rendimento")}</td><td className="whitespace-nowrap px-3 py-2">{nutritionCell(calculation.perServing, key, "porção")}</td><td className="whitespace-nowrap px-3 py-2">{nutritionCell(calculation.per100, key, "rendimento")}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-xs text-[var(--muted)]"><strong>Ausente:</strong> informação nutricional não disponível na base. <strong>Depende da porção ou do rendimento:</strong> resultado ainda não calculável.</p>
    {calculation.pendings.length ? <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><summary className="cursor-pointer font-black text-amber-950">Ver informações faltantes ({calculation.pendings.length})</summary><div className="mt-3"><PendingList empty="Nenhuma informação faltante." pendings={calculation.pendings} /></div></details> : <p className="mt-4 text-sm text-emerald-800">Nenhuma informação faltante.</p>}
  </section>;
}

function recipeForm(recipe: Recipe): RecipeForm {
  return { title: recipe.title, description: recipe.description ?? "", category: recipe.category ?? "", notes: recipe.notes ?? "", preparationMethod: recipe.preparationMethod ?? "", preparationTimeMinutes: numberText(recipe.preparationTimeMinutes), finalYieldAmount: numberText(recipe.finalYieldAmount), finalYieldUnit: recipe.finalYieldUnit ?? "GRAM", servings: numberText(recipe.servings), servingSize: numberText(recipe.servingSize), servingSizeUnit: recipe.servingSizeUnit ?? "GRAM", servingHouseholdMeasure: recipe.servingHouseholdMeasure ?? "", physicalType: recipe.physicalType ?? "SOLID" };
}
function productForm(product: Product): ProductForm {
  return { recipeNutritionSnapshotId: product.recipeNutritionSnapshotId, commercialName: product.commercialName, brand: product.brand ?? "", description: product.description ?? "", category: product.category ?? "", physicalType: product.physicalType, netContent: numberText(product.netContent), netContentUnit: product.netContentUnit, servingsPerPackage: numberText(product.servingsPerPackage), servingSize: numberText(product.servingSize), servingSizeUnit: product.servingSizeUnit, servingHouseholdMeasure: product.servingHouseholdMeasure ?? "", sku: product.sku ?? "", shelfLifeDays: numberText(product.shelfLifeDays), storageInstructions: product.storageInstructions ?? "", preparationOrConsumptionInstructions: product.preparationOrConsumptionInstructions ?? "" };
}

export function RecipesProductsWorkspace() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("recipes");
  const [recipes, setRecipes] = useState<readonly Recipe[]>([]);
  const [recipesLoadError, setRecipesLoadError] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeForm>(emptyRecipe);
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState<IngredientForm>(emptyIngredient);
  const [editingIngredientId, setEditingIngredientId] = useState("");
  const [selectedFood, setSelectedFood] = useState<IngredientFood | null>(null);
  const [stepInstruction, setStepInstruction] = useState("");
  const [editingStepId, setEditingStepId] = useState("");
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [productDraft, setProductDraft] = useState<ProductForm>(emptyProduct);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [labelVersions, setLabelVersions] = useState<readonly LabelVersion[]>([]);
  const [regulatory, setRegulatory] = useState<RegulatoryForm>(emptyRegulatory);
  const [labelPreview, setLabelPreview] = useState<LabelPreview | null>(null);
  const [recipeCalculation, setRecipeCalculation] = useState<RecipeCalculation | null>(null);
  const [recipeNeedsRecalculation, setRecipeNeedsRecalculation] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodSource, setFoodSource] = useState("ALL");
  const [foodSources, setFoodSources] = useState<readonly FoodSearchSourceOption[]>([]);
  const [foodResults, setFoodResults] = useState<readonly ProfessionalFood[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [confirmedMeasures, setConfirmedMeasures] = useState<readonly ConfirmedHouseholdMeasureOption[]>([]);
  const [confirmedMeasuresLoading, setConfirmedMeasuresLoading] = useState(false);
  const [confirmedMeasuresError, setConfirmedMeasuresError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"recipes" | "recipe" | "product" | null>("recipes");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recipePendingDeletion, setRecipePendingDeletion] = useState<{ readonly id: string; readonly title: string } | null>(null);
  const [deleteRecipeError, setDeleteRecipeError] = useState<string | null>(null);
  const [recipeDirty, setRecipeDirty] = useState(false);
  const [ingredientDirty, setIngredientDirty] = useState(false);
  const [stepDirty, setStepDirty] = useState(false);
  const [productDirty, setProductDirty] = useState(false);
  const [regulatoryDirty, setRegulatoryDirty] = useState(false);
  const deleteRecipeDialogRef = useRef<HTMLDialogElement>(null);
  const requestSequence = useRef({ recipes: 0, recipe: 0, product: 0, food: 0, measures: 0 });
  const dirty = recipeDirty || ingredientDirty || stepDirty || productDirty || regulatoryDirty;
  const selectedConfirmedMeasure = useMemo(
    () => confirmedMeasures.find((measure) => measure.id === ingredientDraft.confirmedMeasureId) ?? null,
    [confirmedMeasures, ingredientDraft.confirmedMeasureId],
  );
  const confirmedMeasureEquivalent = useMemo(() => {
    if (!selectedConfirmedMeasure) return null;
    const quantity = optionalNumber(ingredientDraft.householdMeasureQuantity);
    if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return null;
    const equivalent = selectedConfirmedMeasure.amountPerMeasure * quantity;
    return Number.isFinite(equivalent) && equivalent > 0 ? equivalent : null;
  }, [ingredientDraft.householdMeasureQuantity, selectedConfirmedMeasure]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const sequence = ++requestSequence.current.recipes;
    void api<{ recipes: readonly Recipe[] }>("/api/recipes?pageSize=100")
      .then((result) => {
        if (sequence !== requestSequence.current.recipes) return;
        setRecipes(result.recipes);
        setRecipesLoadError(null);
      })
      .catch((error: unknown) => {
        if (sequence !== requestSequence.current.recipes) return;
        const message = error instanceof Error ? error.message : "Não foi possível carregar as receitas.";
        setRecipesLoadError(message);
        setNotice({ tone: "error", text: message });
      })
      .finally(() => { if (sequence === requestSequence.current.recipes) setLoading(null); });
  }, []);

  useEffect(() => {
    if (!selectedRecipeId) return;
    const sequence = ++requestSequence.current.recipe;
    void Promise.all([
      api<{ recipe: Recipe }>(`/api/recipes?recipeId=${encodeURIComponent(selectedRecipeId)}`),
      api<{ products: readonly Product[] }>(`/api/products?recipeId=${encodeURIComponent(selectedRecipeId)}&pageSize=100`),
    ]).then(([recipeResult, productResult]) => {
      if (sequence !== requestSequence.current.recipe) return;
      setRecipe(recipeResult.recipe); setRecipeDraft(recipeForm(recipeResult.recipe)); setProducts(productResult.products); setRecipeNeedsRecalculation(recipeResult.recipe.status !== "CALCULATED");
      setCreatingRecipe(false); setRecipeDirty(false);
    }).catch((error: unknown) => { if (sequence === requestSequence.current.recipe) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível abrir a receita." }); })
      .finally(() => { if (sequence === requestSequence.current.recipe) setLoading(null); });
  }, [selectedRecipeId]);

  useEffect(() => {
    if (!selectedProductId) return;
    const sequence = ++requestSequence.current.product;
    void Promise.all([
      api<{ product: Product }>(`/api/products?productId=${encodeURIComponent(selectedProductId)}`),
      api<{ labelVersions: readonly LabelVersion[] }>(`/api/products?resource=label-versions&productId=${encodeURIComponent(selectedProductId)}`),
    ]).then(([productResult, versionResult]) => {
      if (sequence !== requestSequence.current.product) return;
      setProduct(productResult.product); setProductDraft(productForm(productResult.product)); setLabelVersions(versionResult.labelVersions);
      setCreatingProduct(false); setProductDirty(false); setLabelPreview(null);
    }).catch((error: unknown) => { if (sequence === requestSequence.current.product) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível abrir o produto." }); })
      .finally(() => { if (sequence === requestSequence.current.product) setLoading(null); });
  }, [selectedProductId]);

  useEffect(() => {
    const query = foodQuery.trim();
    if (query.length < 2) return;
    const sequence = ++requestSequence.current.food;
    const timer = window.setTimeout(() => {
      setFoodLoading(true);
      const parameters = new URLSearchParams({ query, pageSize: "12" });
      if (foodSource !== "ALL") parameters.set("sourceName", foodSource);
      void api<FoodSearchResult>(`/api/foods?${parameters}`)
        .then((result) => { if (sequence === requestSequence.current.food) { setFoodResults(result.items); if (result.sourceOptions) setFoodSources(result.sourceOptions); } })
        .catch((error: unknown) => { if (sequence === requestSequence.current.food) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível consultar os alimentos." }); })
        .finally(() => { if (sequence === requestSequence.current.food) setFoodLoading(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [foodQuery, foodSource]);

  useEffect(() => {
    const sequence = ++requestSequence.current.measures;
    if (!selectedFood) return;

    const controller = new AbortController();
    void api<{ options: readonly ConfirmedHouseholdMeasureOption[] }>(
      `/api/foods/${encodeURIComponent(selectedFood.id)}/household-measures`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (sequence !== requestSequence.current.measures) return;
        const options = result.options.filter(
          (option) =>
            option.confidence === "CONFIRMED" &&
            (option.unit === "g" || option.unit === "ml") &&
            Number.isFinite(option.amountPerMeasure) &&
            option.amountPerMeasure > 0,
        );
        setConfirmedMeasures(options);
        setIngredientDraft((current) => {
          if (
            current.householdMeasureId ||
            current.confirmedMeasureId ||
            !current.confirmedMeasureDescription
          ) return current;
          const savedMeasure = options.find(
            (option) =>
              option.label === current.confirmedMeasureDescription ||
              option.measureName === current.confirmedMeasureDescription,
          );
          return savedMeasure
            ? { ...current, confirmedMeasureId: savedMeasure.id }
            : current;
        });
      })
      .catch((error: unknown) => {
        if (sequence !== requestSequence.current.measures || controller.signal.aborted) return;
        setConfirmedMeasuresError(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar as medidas caseiras confirmadas.",
        );
      })
      .finally(() => {
        if (sequence === requestSequence.current.measures) setConfirmedMeasuresLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedFood]);

  function allowSelectionChange() {
    if (busy) {
      setNotice({ tone: "info", text: "Aguarde a operação em andamento antes de trocar a seleção." });
      return false;
    }
    return !dirty || window.confirm("Existem alterações não salvas. Deseja descartá-las e continuar?");
  }
  function clearDirty() { setRecipeDirty(false); setIngredientDirty(false); setStepDirty(false); setProductDirty(false); setRegulatoryDirty(false); }
  function chooseRecipe(id: string) {
    if (!allowSelectionChange()) return;
    requestSequence.current.recipe += 1; requestSequence.current.product += 1; clearDirty(); setSelectedRecipeId(id); setSelectedProductId(""); setRecipe(null); setProducts([]); setProduct(null); setLabelVersions([]); setRecipeCalculation(null); setRecipeNeedsRecalculation(false); setLoading(id ? "recipe" : null); setNotice(null);
  }
  function chooseProduct(id: string) {
    if (!allowSelectionChange()) return;
    requestSequence.current.product += 1; setProductDirty(false); setRegulatoryDirty(false); setSelectedProductId(id); setProduct(null); setLabelVersions([]); setLabelPreview(null); setLoading(id ? "product" : null); setNotice(null);
  }
  function exitWorkspace() { if (allowSelectionChange()) router.push("/clinica"); }
  function changeRecipe<K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) { setRecipeDraft((current) => ({ ...current, [key]: value })); setRecipeDirty(true); }
  function changeIngredient<K extends keyof IngredientForm>(key: K, value: IngredientForm[K]) { setIngredientDraft((current) => ({ ...current, [key]: value })); setIngredientDirty(true); }
  function selectIngredientFood(food: ProfessionalFood) {
    requestSequence.current.food += 1;
    requestSequence.current.measures += 1;
    setFoodLoading(false);
    setSelectedFood(food);
    setIngredientDraft(emptyIngredient());
    setConfirmedMeasures([]);
    setConfirmedMeasuresError(null);
    setConfirmedMeasuresLoading(true);
    setFoodQuery(food.officialName);
    setIngredientDirty(true);
  }
  function resetIngredientSelection(clearSearch: boolean) {
    requestSequence.current.measures += 1;
    setSelectedFood(null);
    setEditingIngredientId("");
    setIngredientDraft(emptyIngredient());
    setConfirmedMeasures([]);
    setConfirmedMeasuresLoading(false);
    setConfirmedMeasuresError(null);
    setIngredientDirty(false);
    if (clearSearch) {
      requestSequence.current.food += 1;
      setFoodQuery("");
      setFoodResults([]);
      setFoodLoading(false);
    }
  }
  function swapSelectedFood() {
    if (busy) {
      setNotice({ tone: "info", text: "Aguarde a operação em andamento antes de trocar o alimento." });
      return;
    }
    if (ingredientDirty && !window.confirm("Descartar a seleção e os dados ainda não salvos deste ingrediente? Os ingredientes já adicionados à receita não serão alterados.")) return;
    resetIngredientSelection(false);
  }
  function changeIngredientUnit(value: IngredientUnit) {
    setIngredientDraft((current) => ({
      ...current,
      quantityUnit: value,
      householdMeasureId: "",
      confirmedMeasureId: "",
      confirmedMeasureDescription: "",
      householdMeasureQuantity: "",
      netQuantity: "",
    }));
    setIngredientDirty(true);
  }
  function changeIngredientMeasure(value: string) {
    if (!value) {
      setIngredientDraft((current) => ({
        ...current,
        householdMeasureId: "",
        confirmedMeasureId: "",
        confirmedMeasureDescription: "",
        householdMeasureQuantity: "",
        netQuantity: "",
      }));
      setIngredientDirty(true);
      return;
    }
    const [kind, id] = value.split(":", 2);
    const confirmed = kind === "confirmed"
      ? confirmedMeasures.find((measure) => measure.id === id)
      : undefined;
    setIngredientDraft((current) => ({
      ...current,
      quantityUnit: confirmed?.unit === "ml" ? "MILLILITER" : "GRAM",
      householdMeasureId: kind === "registered" ? id : "",
      confirmedMeasureId: confirmed?.id ?? "",
      confirmedMeasureDescription: confirmed?.label ?? "",
      householdMeasureQuantity: "",
      netQuantity: "",
      correctionFactor: confirmed ? "" : current.correctionFactor,
    }));
    setIngredientDirty(true);
  }
  function changeProduct<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setProductDraft((current) => ({ ...current, [key]: value })); setProductDirty(true); }
  function changeRegulatory<K extends keyof RegulatoryForm>(key: K, value: RegulatoryForm[K]) { setRegulatory((current) => ({ ...current, [key]: value })); setRegulatoryDirty(true); }
  function changeFoodQuery(value: string) {
    requestSequence.current.food += 1;
    setFoodQuery(value);
    setFoodResults([]);
    if (value.trim().length < 2) {
      setFoodLoading(false);
    }
  }
  function changeFoodSource(value: string) {
    requestSequence.current.food += 1;
    setFoodSource(value);
    setFoodResults([]);
  }

  async function refreshRecipe(recipeId = selectedRecipeId) {
    const result = await api<{ recipe: Recipe }>(`/api/recipes?recipeId=${encodeURIComponent(recipeId)}`);
    setRecipe(result.recipe); setRecipeDraft(recipeForm(result.recipe)); return result.recipe;
  }
  async function refreshRecipes() {
    const result = await api<{ recipes: readonly Recipe[] }>("/api/recipes?pageSize=100"); setRecipes(result.recipes); setRecipesLoadError(null);
  }
  async function refreshProducts() {
    if (!selectedRecipeId) return;
    const result = await api<{ products: readonly Product[] }>(`/api/products?recipeId=${encodeURIComponent(selectedRecipeId)}&pageSize=100`); setProducts(result.products);
  }
  async function refreshLabels() {
    if (!selectedProductId) return;
    const result = await api<{ labelVersions: readonly LabelVersion[] }>(`/api/products?resource=label-versions&productId=${encodeURIComponent(selectedProductId)}`); setLabelVersions(result.labelVersions);
  }

  function recipePayload() {
    return { title: recipeDraft.title, description: optionalText(recipeDraft.description), category: optionalText(recipeDraft.category), notes: optionalText(recipeDraft.notes), preparationMethod: optionalText(recipeDraft.preparationMethod), preparationTimeMinutes: optionalNumber(recipeDraft.preparationTimeMinutes), finalYieldAmount: optionalNumber(recipeDraft.finalYieldAmount), finalYieldUnit: recipeDraft.finalYieldAmount ? recipeDraft.finalYieldUnit : undefined, servings: optionalNumber(recipeDraft.servings), servingSize: optionalNumber(recipeDraft.servingSize), servingSizeUnit: recipeDraft.servingSize ? recipeDraft.servingSizeUnit : undefined, servingHouseholdMeasure: optionalText(recipeDraft.servingHouseholdMeasure), physicalType: recipeDraft.physicalType };
  }
  async function saveRecipe(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy("recipe"); setNotice(null);
    try {
      const result = creatingRecipe
        ? await api<{ recipe: Recipe }>("/api/recipes", { method: "POST", body: JSON.stringify({ action: "CREATE_RECIPE", recipe: recipePayload() }) })
        : await api<{ recipe: Recipe }>("/api/recipes", { method: "PATCH", body: JSON.stringify({ action: "UPDATE_RECIPE", recipeId: selectedRecipeId, recipe: recipePayload() }) });
      setRecipe(result.recipe); setSelectedRecipeId(result.recipe.id); setCreatingRecipe(false); setRecipeDirty(false); setRecipeCalculation(null); setRecipeNeedsRecalculation(true); setLabelPreview(null); await refreshRecipes(); setNotice({ tone: "success", text: "Receita salva. Recalcule para persistir um snapshot vigente antes de gerar outro rótulo." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar a receita." }); } finally { setBusy(null); }
  }

  function openDeleteRecipeDialog() {
    if (busy || creatingRecipe || !recipe || recipe.id !== selectedRecipeId) return;
    setRecipePendingDeletion({ id: recipe.id, title: recipe.title });
    setDeleteRecipeError(null);
    deleteRecipeDialogRef.current?.showModal();
  }

  function closeDeleteRecipeDialog() {
    if (busy === "delete-recipe") return;
    deleteRecipeDialogRef.current?.close();
    setRecipePendingDeletion(null);
    setDeleteRecipeError(null);
  }

  async function deleteSelectedRecipe() {
    const target = recipePendingDeletion;
    if (!target || busy) return;

    setBusy("delete-recipe");
    setDeleteRecipeError(null);
    setNotice(null);
    requestSequence.current.recipe += 1;
    requestSequence.current.product += 1;

    try {
      const result = await api<{ recipe: { readonly id: string; readonly title: string } }>(
        `/api/recipes?recipeId=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
      );
      if (result.recipe.id !== target.id) {
        throw new Error("A API retornou uma receita diferente da solicitada para exclusão.");
      }

      requestSequence.current.recipes += 1;
      requestSequence.current.recipe += 1;
      requestSequence.current.product += 1;
      requestSequence.current.food += 1;
      requestSequence.current.measures += 1;
      setRecipes((current) => current.filter((item) => item.id !== target.id));
      setSelectedRecipeId("");
      setRecipe(null);
      setRecipeDraft(emptyRecipe());
      setCreatingRecipe(false);
      setIngredientDraft(emptyIngredient());
      setEditingIngredientId("");
      setSelectedFood(null);
      setFoodQuery("");
      setFoodResults([]);
      setFoodLoading(false);
      setConfirmedMeasures([]);
      setConfirmedMeasuresLoading(false);
      setConfirmedMeasuresError(null);
      setStepInstruction("");
      setEditingStepId("");
      setProducts([]);
      setSelectedProductId("");
      setProduct(null);
      setProductDraft(emptyProduct());
      setCreatingProduct(false);
      setLabelVersions([]);
      setRegulatory(emptyRegulatory());
      setLabelPreview(null);
      setRecipeCalculation(null);
      setRecipeNeedsRecalculation(false);
      setRecipesLoadError(null);
      setLoading(null);
      clearDirty();
      deleteRecipeDialogRef.current?.close();
      setRecipePendingDeletion(null);
      setNotice({ tone: "success", text: `Receita “${result.recipe.title}” excluída.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir a receita.";
      const text = error instanceof ApiError && error.status === 409
        ? `A receita não pode ser excluída porque há dados que precisam ser preservados. ${message}`
        : message;
      setDeleteRecipeError(text);
      setNotice({ tone: "error", text });
    } finally {
      setBusy(null);
    }
  }

  async function saveIngredient(event: FormEvent) {
    event.preventDefault(); if (busy || !recipe || !selectedFood) return;
    if (selectedConfirmedMeasure && confirmedMeasureEquivalent === null) { setNotice({ tone: "error", text: "Informe uma quantidade válida para calcular a equivalência da medida caseira." }); return; }
    if (ingredientDraft.quantityUnit === "MILLILITER" && ingredientDraft.householdMeasureId) { setNotice({ tone: "error", text: "Medidas caseiras cadastradas em gramas não podem ser convertidas em mililitros sem equivalência explícita." }); return; }
    const equivalentQuantity = confirmedMeasureEquivalent ?? undefined;
    const ingredient = {
      foodId: selectedFood.id,
      householdMeasureId: selectedConfirmedMeasure ? undefined : optionalText(ingredientDraft.householdMeasureId),
      householdMeasureQuantity: optionalNumber(ingredientDraft.householdMeasureQuantity),
      householdMeasureDescription: selectedConfirmedMeasure?.label,
      grossQuantity: equivalentQuantity ?? requiredNumber(ingredientDraft.grossQuantity),
      netQuantity: equivalentQuantity ?? optionalNumber(ingredientDraft.netQuantity),
      quantityUnit: selectedConfirmedMeasure
        ? selectedConfirmedMeasure.unit === "ml" ? "MILLILITER" as const : "GRAM" as const
        : ingredientDraft.quantityUnit,
      correctionFactor: selectedConfirmedMeasure ? undefined : optionalNumber(ingredientDraft.correctionFactor),
      cookingYieldFactor: optionalNumber(ingredientDraft.cookingYieldFactor),
      notes: optionalText(ingredientDraft.notes),
    };
    setBusy("ingredient"); setNotice(null);
    try {
      const result = editingIngredientId
        ? await api<{ recipe: Recipe }>("/api/recipes", { method: "PATCH", body: JSON.stringify({ action: "UPDATE_INGREDIENT", recipeId: recipe.id, ingredientId: editingIngredientId, ingredient }) })
        : await api<{ recipe: Recipe }>("/api/recipes", { method: "POST", body: JSON.stringify({ action: "ADD_INGREDIENT", recipeId: recipe.id, ingredient }) });
      setRecipe(result.recipe); setIngredientDraft(emptyIngredient()); setSelectedFood(null); setConfirmedMeasures([]); setConfirmedMeasuresLoading(false); setConfirmedMeasuresError(null); setEditingIngredientId(""); setFoodQuery(""); setIngredientDirty(false); setRecipeCalculation(null); setRecipeNeedsRecalculation(true); setLabelPreview(null); setNotice({ tone: "success", text: "Ingrediente salvo. Recalcule a receita para gerar um snapshot vigente." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar o ingrediente." }); } finally { setBusy(null); }
  }
  function editIngredient(item: RecipeIngredient) {
    requestSequence.current.measures += 1; setConfirmedMeasures([]); setConfirmedMeasuresError(null); setConfirmedMeasuresLoading(true); setEditingIngredientId(item.id); setSelectedFood(item.food); setFoodQuery(item.food.officialName);
    setIngredientDraft({ grossQuantity: numberText(item.grossQuantity), netQuantity: numberText(item.netQuantity ?? item.quantityGrams), quantityUnit: item.quantityUnit ?? "GRAM", householdMeasureId: item.householdMeasureId ?? "", confirmedMeasureId: "", confirmedMeasureDescription: item.householdMeasureId ? "" : item.householdMeasureDescription ?? "", householdMeasureQuantity: numberText(item.householdMeasureQuantity), correctionFactor: numberText(item.correctionFactor), cookingYieldFactor: numberText(item.cookingYieldFactor), notes: item.notes ?? "" }); setIngredientDirty(false);
  }
  async function removeIngredient(id: string) {
    if (!recipe || busy || !window.confirm("Remover este ingrediente da receita?")) return; setBusy("ingredient");
    try { await api<unknown>(`/api/recipes?recipeId=${encodeURIComponent(recipe.id)}&ingredientId=${encodeURIComponent(id)}`, { method: "DELETE" }); await refreshRecipe(); setRecipeCalculation(null); setRecipeNeedsRecalculation(true); setLabelPreview(null); setNotice({ tone: "success", text: "Ingrediente removido. Recalcule a receita." }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível remover." }); } finally { setBusy(null); }
  }

  async function saveStep(event: FormEvent) {
    event.preventDefault(); if (!recipe || busy) return; setBusy("step"); setNotice(null);
    try {
      const result = editingStepId
        ? await api<{ recipe: Recipe }>("/api/recipes", { method: "PATCH", body: JSON.stringify({ action: "UPDATE_PREPARATION_STEP", recipeId: recipe.id, stepId: editingStepId, step: { instruction: stepInstruction } }) })
        : await api<{ recipe: Recipe }>("/api/recipes", { method: "POST", body: JSON.stringify({ action: "ADD_PREPARATION_STEP", recipeId: recipe.id, step: { instruction: stepInstruction } }) });
      setRecipe(result.recipe); setStepInstruction(""); setEditingStepId(""); setStepDirty(false); setNotice({ tone: "success", text: "Etapa de preparo salva." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar a etapa." }); } finally { setBusy(null); }
  }
  async function removeStep(id: string) {
    if (!recipe || busy || !window.confirm("Remover esta etapa de preparo?")) return; setBusy("step");
    try { await api<unknown>(`/api/recipes?recipeId=${encodeURIComponent(recipe.id)}&stepId=${encodeURIComponent(id)}`, { method: "DELETE" }); await refreshRecipe(); setNotice({ tone: "success", text: "Etapa removida." }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível remover." }); } finally { setBusy(null); }
  }
  async function calculateRecipe() {
    if (!recipe || busy) return; setBusy("calculate"); setNotice(null);
    try {
      const result = await api<{ calculation: RecipeCalculation; pendings: readonly Pending[]; snapshot: { readonly version: number } | null }>("/api/recipes", { method: "POST", body: JSON.stringify({ action: "CALCULATE_NUTRITION", recipeId: recipe.id }) });
      setRecipeCalculation({ ...result.calculation, pendings: result.pendings }); await refreshRecipe(); setRecipeNeedsRecalculation(!result.snapshot);
      setNotice(result.snapshot
        ? result.calculation.calculationStatus === "PARTIAL"
          ? { tone: "success", text: `Snapshot nutricional v${result.snapshot.version} salvo com resultados parciais e disponível para prescrição por porções. As ausências indicadas permanecem pendentes.` }
          : { tone: "success", text: `Snapshot nutricional v${result.snapshot.version} salvo e disponível para prescrição por porções.` }
        : { tone: "info", text: "Cálculo executado sem snapshot prescritível. Corrija os bloqueios estruturais indicados e calcule novamente." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível calcular." }); } finally { setBusy(null); }
  }

  function productPayload(editing: boolean) {
    const base = { recipeNutritionSnapshotId: productDraft.recipeNutritionSnapshotId, commercialName: productDraft.commercialName, brand: editing ? productDraft.brand || null : optionalText(productDraft.brand), description: editing ? productDraft.description || null : optionalText(productDraft.description), category: editing ? productDraft.category || null : optionalText(productDraft.category), physicalType: productDraft.physicalType, netContent: requiredNumber(productDraft.netContent), netContentUnit: productDraft.netContentUnit, servingsPerPackage: requiredNumber(productDraft.servingsPerPackage), servingSize: requiredNumber(productDraft.servingSize), servingSizeUnit: productDraft.servingSizeUnit, servingHouseholdMeasure: editing ? productDraft.servingHouseholdMeasure || null : optionalText(productDraft.servingHouseholdMeasure), sku: editing ? productDraft.sku || null : optionalText(productDraft.sku), shelfLifeDays: editing ? optionalNumber(productDraft.shelfLifeDays) ?? null : optionalNumber(productDraft.shelfLifeDays), storageInstructions: editing ? productDraft.storageInstructions || null : optionalText(productDraft.storageInstructions), preparationOrConsumptionInstructions: editing ? productDraft.preparationOrConsumptionInstructions || null : optionalText(productDraft.preparationOrConsumptionInstructions) };
    return editing ? base : { ...base, recipeId: recipe?.id };
  }
  async function saveProduct(event: FormEvent) {
    event.preventDefault(); if (!recipe || busy) return; setBusy("product"); setNotice(null);
    try {
      const editing = !creatingProduct && Boolean(selectedProductId);
      let result: { product: Product };
      let requirement: { readonly required: boolean; readonly message: string | null } | undefined;
      if (editing) {
        const updated = await api<{ product: Product; newLabelVersionRequirement: { readonly required: boolean; readonly message: string | null } }>("/api/products", { method: "PATCH", body: JSON.stringify({ action: "UPDATE_PRODUCT", productId: selectedProductId, product: productPayload(true) }) });
        result = updated;
        requirement = updated.newLabelVersionRequirement;
      } else {
        result = await api<{ product: Product }>("/api/products", { method: "POST", body: JSON.stringify({ action: "CREATE_PRODUCT", product: productPayload(false) }) });
      }
      setProduct(result.product); setSelectedProductId(result.product.id); setProductDraft(productForm(result.product)); setCreatingProduct(false); setProductDirty(false); setLabelPreview(null); await refreshProducts(); await refreshLabels();
      setNotice(requirement?.required ? { tone: "info", text: requirement.message ?? "Gere uma nova versão do rótulo antes da revisão ou emissão." } : { tone: "success", text: "Produto salvo com sucesso." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar o produto." }); } finally { setBusy(null); }
  }

  function regulatoryPayload() {
    const preparedNutrients = { addedSugarsGrams: optionalNumber(regulatory.frontAddedSugars), saturatedFatsGrams: optionalNumber(regulatory.frontSaturatedFats), sodiumMg: optionalNumber(regulatory.frontSodium) };
    return {
      servingReference: regulatory.servingReference.trim() ? { source: regulatory.servingSource, reference: regulatory.servingReference.trim(), confirmed: regulatory.servingConfirmed } : null,
      additionalMandatoryNutrientsReview: { reviewed: regulatory.additionalReviewed, missingNutrientsOrInformation: regulatory.missingInformation.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) },
      nutritionTableContext: regulatory.tableContext === "SPECIAL" ? { kind: "SPECIAL_REGULATION", reference: regulatory.specialReference.trim() } : regulatory.tableContext === "PREPARED" ? { kind: "GENERAL_FOOD", calculationBasis: "PREPARED_AS_DIRECTED", snapshotIncludesAddedPreparationIngredients: regulatory.preparationIngredientsIncluded } : { kind: "GENERAL_FOOD", calculationBasis: "AS_SOLD" },
      nonSignificantZeroEligibility: { carbohydratesGrams: regulatory.zeroCarbohydrates, totalSugarsGrams: regulatory.zeroTotalSugars, addedSugarsGrams: regulatory.zeroAddedSugars, proteinGrams: regulatory.zeroProtein, totalFatsGrams: regulatory.zeroTotalFats },
      frontOfPack: { applicability: regulatory.frontApplicability, reason: regulatory.frontReason.trim(), basis: regulatory.frontBasis === "PREPARED" ? { kind: "PREPARED_AS_DIRECTED_EXCLUDING_ADDED_INGREDIENTS", nutrientsPer100: preparedNutrients } : { kind: "AS_SOLD" } },
    };
  }
  async function previewLabel() {
    if (!product || busy) return; setBusy("preview"); setNotice(null);
    try { const result = await api<{ preview: LabelPreview }>("/api/products", { method: "POST", body: JSON.stringify({ action: "CALCULATE_LABEL_PREVIEW", productId: product.id, regulatoryInput: regulatoryPayload() }) }); setLabelPreview(result.preview); setRegulatoryDirty(false); setNotice({ tone: "success", text: "Prévia recalculada. Ela ainda não é uma versão salva." }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível calcular a prévia." }); } finally { setBusy(null); }
  }
  async function generateLabel() {
    if (!product || busy) return; setBusy("generate"); setNotice(null);
    try {
      const result = await api<(LabelPreview & { readonly success: boolean; readonly message?: string; readonly label?: LabelVersion })>("/api/products", { method: "POST", body: JSON.stringify({ action: "GENERATE_LABEL_VERSION", productId: product.id, regulatoryInput: regulatoryPayload() }) });
      setLabelPreview(result); setRegulatoryDirty(false); await refreshLabels();
      setNotice(result.success ? { tone: "success", text: `Versão ${result.label?.version ?? result.proposedVersion} salva como rascunho para revisão humana.` } : { tone: "info", text: result.message ?? "A versão não pôde ser gerada." });
    } catch (error) {
      if (error instanceof ApiError && record(error.payload) && record(error.payload.calculation)) setLabelPreview(error.payload as unknown as LabelPreview);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível gerar a versão." });
    } finally { setBusy(null); }
  }
  function reviewReason(label: LabelVersion) {
    const currentSnapshot = recipe?.nutritionSnapshots.reduce<RecipeSnapshot | null>((latest, snapshot) => !latest || snapshot.version > latest.version ? snapshot : latest, null) ?? null;
    if (recipeNeedsRecalculation || recipe?.status !== "CALCULATED") return "A receita mudou. Recalcule e gere uma nova versão do rótulo antes da revisão.";
    if (currentSnapshot && product?.recipeNutritionSnapshotId !== currentSnapshot.id) return "O produto ainda está vinculado a um snapshot anterior. Atualize o produto e gere uma nova versão.";
    if (label.id !== labelVersions[0]?.id) return "Somente a versão mais recente pode ser revisada.";
    if (label.status !== "DRAFT") return label.status === "VALIDATED" ? "Esta versão já recebeu revisão humana." : "Esta versão não está vigente para revisão.";
    if (label.preservedVersion.status !== "PRESERVED" || !label.preservedVersion.data) return label.preservedVersion.reason ?? "A integridade histórica não pôde ser comprovada.";
    const calculation = label.preservedVersion.data.calculation;
    const blockers = calculation.pendings.filter((pending) => pending.blockingFor?.includes("LABEL_EMISSION"));
    if (blockers.length || calculation.calculationStatus !== "COMPLETE" || !calculation.labelEmission.sufficientInformation) return "Resolva as pendências bloqueantes e gere uma nova versão antes da revisão.";
    return null;
  }
  async function reviewLabel(label: LabelVersion) {
    const reason = reviewReason(label); if (!product || busy || reason) return;
    if (!window.confirm(`Registrar a revisão humana da versão ${label.version}? Esta ação não representa aprovação da Anvisa.`)) return;
    setBusy(`review-${label.id}`); setNotice(null);
    try { await api<{ labelVersion: LabelVersion }>("/api/products", { method: "PATCH", body: JSON.stringify({ action: "REVIEW_LABEL_VERSION", productId: product.id, labelId: label.id }) }); await refreshLabels(); setNotice({ tone: "success", text: `Revisão humana da versão ${label.version} registrada. Isso não representa aprovação da Anvisa.` }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível revisar a versão." }); } finally { setBusy(null); }
  }

  const latestSnapshot = useMemo(() => recipe?.nutritionSnapshots.reduce<RecipeSnapshot | null>((latest, current) => !latest || current.version > latest.version ? current : latest, null) ?? null, [recipe]);
  const labelCalculation = labelPreview?.calculation ?? null;

  return <div className="min-w-0 space-y-6 overflow-x-hidden">
    <PageHeading eyebrow="Nutrição" title="Receitas e Produtos" description="Cadastre receitas, calcule a composição nutricional e prepare rótulos dos seus produtos." action={<Button onClick={exitWorkspace} type="button" variant="outline">Voltar à Clínica</Button>} />
    <NoticeBox notice={notice} />
    {loading ? <p aria-live="polite" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900" role="status">{loading === "recipes" ? "Carregando receitas…" : loading === "recipe" ? "Abrindo receita…" : "Abrindo produto e histórico de rótulos…"}</p> : null}

    <div aria-label="Áreas de Receitas e Produtos" className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] bg-white p-2" role="tablist">
      <button
        aria-controls="recipes-tab-panel"
        aria-selected={activeTab === "recipes"}
        className={`rounded-xl px-3 py-3 text-sm font-black transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${activeTab === "recipes" ? "bg-[var(--primary)] text-white" : "text-[var(--primary)] hover:bg-slate-50"}`}
        id="recipes-tab"
        onClick={() => setActiveTab("recipes")}
        role="tab"
        type="button"
      >
        Receitas
      </button>
      <button
        aria-controls="commercial-tab-panel"
        aria-selected={activeTab === "commercial"}
        className={`rounded-xl px-3 py-3 text-sm font-black transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${activeTab === "commercial" ? "bg-[var(--primary)] text-white" : "text-[var(--primary)] hover:bg-slate-50"}`}
        id="commercial-tab"
        onClick={() => setActiveTab("commercial")}
        role="tab"
        type="button"
      >
        Produtos e rótulos
      </button>
    </div>

    <div aria-labelledby="recipes-tab" hidden={activeTab !== "recipes"} id="recipes-tab-panel" role="tabpanel">
      <Section id="recipes-section" title="Receitas" description="Liste, crie e edite a composição, o preparo e o rendimento antes de calcular.">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,2fr)]">
          <aside className="min-w-0"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-black">Receitas</h3><Button disabled={Boolean(busy)} onClick={() => { if (!allowSelectionChange()) return; setCreatingRecipe(true); setSelectedRecipeId(""); setRecipe(null); setRecipeDraft(emptyRecipe()); clearDirty(); }} size="small" type="button">Nova</Button></div>{loading === "recipes" ? <p className="text-sm">Carregando receitas…</p> : recipesLoadError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{recipesLoadError}</p> : recipes.length ? <div className="grid gap-2">{recipes.map((item) => <button className={`min-w-0 rounded-xl border p-3 text-left ${selectedRecipeId === item.id ? "border-emerald-600 bg-emerald-50" : "border-[var(--line)] bg-white"}`} key={item.id} onClick={() => chooseRecipe(item.id)} type="button"><span className="block truncate font-bold">{item.title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{item.status}</span></button>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-[var(--muted)]">Nenhuma receita cadastrada na Clínica SV.</p>}</aside>
          <div className="min-w-0">{creatingRecipe || recipe ? <form className="grid gap-4" onSubmit={saveRecipe}><h3 className="text-lg font-black">{creatingRecipe ? "Nova receita" : `Editar ${recipe?.title}`}</h3><div className="grid gap-4 md:grid-cols-2"><FormField id="recipe-title" label="Nome da receita" required><Input id="recipe-title" maxLength={180} onChange={(e) => changeRecipe("title", e.target.value)} required value={recipeDraft.title} /></FormField><FormField id="recipe-category" label="Categoria"><Input id="recipe-category" maxLength={120} onChange={(e) => changeRecipe("category", e.target.value)} value={recipeDraft.category} /></FormField><FormField id="recipe-physical" label="Tipo físico" required><Select id="recipe-physical" onChange={(e) => changeRecipe("physicalType", e.target.value as PhysicalType)} value={recipeDraft.physicalType}><option value="SOLID">Sólido</option><option value="SEMISOLID">Semissólido</option><option value="LIQUID">Líquido</option></Select></FormField><FormField id="recipe-time" label="Tempo de preparo (min)"><NumberInput id="recipe-time" min="1" onChange={(e) => changeRecipe("preparationTimeMinutes", e.target.value)} value={recipeDraft.preparationTimeMinutes} /></FormField><FormField id="recipe-yield" label="Rendimento final" help="Opcional ao salvar. Informe o peso ou volume final para calcular os valores por 100 g/ml e relacionar cada porção ao peso ou volume correspondente."><NumberInput id="recipe-yield" min="0" onChange={(e) => changeRecipe("finalYieldAmount", e.target.value)} value={recipeDraft.finalYieldAmount} /></FormField><FormField id="recipe-yield-unit" label="Unidade do rendimento"><Select id="recipe-yield-unit" onChange={(e) => changeRecipe("finalYieldUnit", e.target.value as MeasurementUnit)} value={recipeDraft.finalYieldUnit}><option value="GRAM">g</option><option value="MILLILITER">ml</option><option value="UNIT">unidade</option></Select></FormField><FormField id="recipe-servings" label="Número de porções" help="Em quantas partes iguais a receita será dividida, como fatias ou unidades."><NumberInput id="recipe-servings" min="1" onChange={(e) => changeRecipe("servings", e.target.value)} value={recipeDraft.servings} /></FormField><FormField id="recipe-serving-size" label="Tamanho da porção"><div className="grid grid-cols-[1fr_auto] gap-2"><NumberInput id="recipe-serving-size" min="0" onChange={(e) => changeRecipe("servingSize", e.target.value)} value={recipeDraft.servingSize} /><Select aria-label="Unidade da porção" onChange={(e) => changeRecipe("servingSizeUnit", e.target.value as MeasurementUnit)} value={recipeDraft.servingSizeUnit}><option value="GRAM">g</option><option value="MILLILITER">ml</option><option value="UNIT">unidade</option></Select></div></FormField><div className="md:col-span-2"><FormField id="recipe-household" label="Medida caseira da porção"><Input id="recipe-household" maxLength={180} onChange={(e) => changeRecipe("servingHouseholdMeasure", e.target.value)} value={recipeDraft.servingHouseholdMeasure} /></FormField></div><div className="md:col-span-2"><FormField id="recipe-description" label="Descrição"><Textarea id="recipe-description" maxLength={10000} onChange={(e) => changeRecipe("description", e.target.value)} value={recipeDraft.description} /></FormField></div><div className="md:col-span-2"><FormField id="recipe-method" label="Modo de preparo geral"><Textarea id="recipe-method" maxLength={20000} onChange={(e) => changeRecipe("preparationMethod", e.target.value)} value={recipeDraft.preparationMethod} /></FormField></div><div className="md:col-span-2"><FormField id="recipe-notes" label="Observações"><Textarea id="recipe-notes" maxLength={10000} onChange={(e) => changeRecipe("notes", e.target.value)} value={recipeDraft.notes} /></FormField></div></div><Button disabled={Boolean(busy)} loading={busy === "recipe"} type="submit">Salvar receita</Button></form> : <PageState title="Abra ou crie uma receita" description="Selecione uma receita na lista para editar sua estrutura." />}</div>
          {!creatingRecipe && recipe && recipe.id === selectedRecipeId ? <div className="flex justify-end xl:col-start-2"><Button disabled={Boolean(busy)} onClick={openDeleteRecipeDialog} type="button" variant="destructive">Excluir receita</Button></div> : null}
          </div>

        {recipe ? <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-black">Ingredientes</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">A busca consulta a base real. Massa e volume permanecem separados; nenhuma densidade é presumida.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <FormField id="food-search" label="Buscar alimento"><Input disabled={Boolean(selectedFood)} id="food-search" onChange={(e) => changeFoodQuery(e.target.value)} placeholder="Digite pelo menos 2 caracteres" type="search" value={foodQuery} /></FormField>
              <FormField id="food-source" label="Fonte"><Select disabled={Boolean(selectedFood)} id="food-source" onChange={(e) => changeFoodSource(e.target.value)} value={foodSource}><option value="ALL">Todas</option>{foodSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}</Select></FormField>
            </div>
            {!selectedFood && foodQuery.trim().length >= 2 ? <section className="mt-4" aria-labelledby="food-search-results-title"><h4 className="font-black" id="food-search-results-title">Resultados da busca</h4>{foodLoading ? <p className="mt-2 text-sm">Consultando alimentos…</p> : foodResults.length ? <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto">{foodResults.map((food) => <button className="rounded-xl border border-[var(--line)] p-3 text-left hover:border-emerald-500" key={food.id} onClick={() => selectIngredientFood(food)} type="button"><span className="block font-bold">{food.officialName}</span><span className="block text-xs text-[var(--muted)]">{food.source.name} · referência {food.referenceServingGrams} {food.referenceServingUnit ?? "g"}</span></button>)}</div> : <p className="mt-2 rounded-xl border border-dashed p-3 text-sm text-[var(--muted)]">Nenhum alimento encontrado para esta busca.</p>}</section> : null}
            {selectedFood ? <form className="mt-4 grid gap-3" onSubmit={saveIngredient}>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm"><p><strong>{selectedFood.officialName}</strong><br />{selectedFood.source.name} · unidade de referência: {selectedFood.referenceServingUnit ?? "g"}</p><Button disabled={Boolean(busy)} onClick={swapSelectedFood} size="small" type="button" variant="outline">Trocar alimento</Button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="ingredient-gross" label="Quantidade bruta" required><NumberInput disabled={Boolean(selectedConfirmedMeasure)} id="ingredient-gross" min="0" onChange={(e) => changeIngredient("grossQuantity", e.target.value)} required value={selectedConfirmedMeasure ? numberText(confirmedMeasureEquivalent) : ingredientDraft.grossQuantity} /></FormField>
                <FormField id="ingredient-unit" label="Unidade" required><Select id="ingredient-unit" onChange={(e) => changeIngredientUnit(e.target.value as IngredientUnit)} value={ingredientDraft.quantityUnit}><option value="GRAM">g (massa)</option><option value="MILLILITER">ml (volume)</option></Select></FormField>
                <FormField id="ingredient-net" label="Quantidade líquida"><NumberInput disabled={Boolean(selectedConfirmedMeasure)} id="ingredient-net" min="0" onChange={(e) => changeIngredient("netQuantity", e.target.value)} value={selectedConfirmedMeasure ? numberText(confirmedMeasureEquivalent) : ingredientDraft.netQuantity} /></FormField>
                <FormField id="ingredient-correction" label="Fator de correção"><NumberInput disabled={Boolean(selectedConfirmedMeasure)} id="ingredient-correction" min="0" onChange={(e) => changeIngredient("correctionFactor", e.target.value)} value={ingredientDraft.correctionFactor} /></FormField>
                <FormField id="ingredient-measure" label="Medida caseira" help="Use somente equivalências confirmadas. A unidade informada pela referência é preservada sem converter massa e volume.">
                  <Select disabled={confirmedMeasuresLoading} id="ingredient-measure" onChange={(e) => changeIngredientMeasure(e.target.value)} value={ingredientDraft.confirmedMeasureId ? `confirmed:${ingredientDraft.confirmedMeasureId}` : ingredientDraft.householdMeasureId ? `registered:${ingredientDraft.householdMeasureId}` : ""}>
                    <option value="">Não usar</option>
                    {(selectedFood.householdMeasures ?? []).filter((measure) => measure.active).map((measure) => <option key={measure.id} value={`registered:${measure.id}`}>{measure.name} · {measure.grams} g</option>)}
                    {confirmedMeasures.map((measure) => <option key={measure.id} value={`confirmed:${measure.id}`}>{measure.label}</option>)}
                  </Select>
                  {confirmedMeasuresLoading ? <p className="mt-1 text-xs text-[var(--muted)]" role="status">Carregando medidas confirmadas…</p> : confirmedMeasuresError ? <p className="mt-1 text-xs font-bold text-rose-700" role="alert">{confirmedMeasuresError}</p> : !confirmedMeasures.length && !(selectedFood.householdMeasures ?? []).some((measure) => measure.active) ? <p className="mt-1 text-xs text-[var(--muted)]">Nenhuma medida caseira confirmada disponível para este alimento.</p> : null}
                </FormField>
                <FormField id="ingredient-measure-quantity" label="Quantidade da medida"><NumberInput disabled={!ingredientDraft.householdMeasureId && !ingredientDraft.confirmedMeasureId} id="ingredient-measure-quantity" min="0" onChange={(e) => changeIngredient("householdMeasureQuantity", e.target.value)} value={ingredientDraft.householdMeasureQuantity} /></FormField>
                <FormField id="ingredient-cooking" label="Fator de cocção"><NumberInput id="ingredient-cooking" min="0" onChange={(e) => changeIngredient("cookingYieldFactor", e.target.value)} value={ingredientDraft.cookingYieldFactor} /></FormField>
                <FormField id="ingredient-notes" label="Observações"><Input id="ingredient-notes" onChange={(e) => changeIngredient("notes", e.target.value)} value={ingredientDraft.notes} /></FormField>
              </div>
              {selectedConfirmedMeasure && confirmedMeasureEquivalent !== null ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950" role="status"><strong>Equivalência calculada:</strong> {ingredientDraft.householdMeasureQuantity} × {selectedConfirmedMeasure.label} = <strong>{confirmedMeasureEquivalent} {selectedConfirmedMeasure.unit}</strong>. Esse valor será usado uma única vez como quantidade bruta e líquida do ingrediente.</p> : null}
              <div className="flex flex-wrap gap-2"><Button disabled={Boolean(busy)} loading={busy === "ingredient"} size="small" type="submit">{editingIngredientId ? "Atualizar ingrediente" : "Adicionar ingrediente"}</Button><Button disabled={Boolean(busy)} onClick={() => resetIngredientSelection(true)} size="small" type="button" variant="outline">Cancelar</Button></div>
            </form> : null}
            <section className="mt-5" aria-labelledby="recipe-ingredients-title"><h4 className="mb-2 font-black" id="recipe-ingredients-title">Ingredientes da receita</h4><div className="grid gap-2">{recipe.ingredients.length ? recipe.ingredients.map((item) => <article className="rounded-xl border border-[var(--line)] p-3" key={item.id}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold">{item.food.officialName}</p><p className="text-xs text-[var(--muted)]">{numberText(item.netQuantity ?? item.quantityGrams) || "Quantidade não resolvida"} {item.quantityUnit ? unitLabels[item.quantityUnit] : ""} · {item.food.source.name}</p>{item.householdMeasureDescription && item.householdMeasureQuantity ? <p className="text-xs text-[var(--muted)]">{numberText(item.householdMeasureQuantity)} × {item.householdMeasureDescription}</p> : null}</div><div className="flex gap-2"><Button onClick={() => editIngredient(item)} size="small" type="button" variant="outline">Editar</Button><Button onClick={() => void removeIngredient(item.id)} size="small" type="button" variant="ghost">Remover</Button></div></div></article>) : <p className="text-sm text-[var(--muted)]">Nenhum ingrediente adicionado.</p>}</div></section>
          </div>
          <div className="min-w-0 rounded-2xl border border-[var(--line)] p-4"><h3 className="font-black">Etapas de preparo</h3><form className="mt-4 grid gap-3" onSubmit={saveStep}><FormField id="step-instruction" label="Instrução" required><Textarea id="step-instruction" onChange={(e) => { setStepInstruction(e.target.value); setStepDirty(true); }} required value={stepInstruction} /></FormField><div className="flex gap-2"><Button disabled={Boolean(busy)} loading={busy === "step"} size="small" type="submit">{editingStepId ? "Atualizar etapa" : "Adicionar etapa"}</Button>{editingStepId ? <Button onClick={() => { setEditingStepId(""); setStepInstruction(""); setStepDirty(false); }} size="small" type="button" variant="outline">Cancelar</Button> : null}</div></form><ol className="mt-4 grid gap-2">{recipe.preparationSteps.length ? recipe.preparationSteps.map((step) => <li className="rounded-xl border border-[var(--line)] p-3" key={step.id}><p className="text-sm"><strong>{step.position}.</strong> {step.instruction}</p><div className="mt-2 flex gap-2"><Button onClick={() => { setEditingStepId(step.id); setStepInstruction(step.instruction); setStepDirty(false); }} size="small" type="button" variant="outline">Editar</Button><Button onClick={() => void removeStep(step.id)} size="small" type="button" variant="ghost">Remover</Button></div></li>) : <li className="text-sm text-[var(--muted)]">Nenhuma etapa estruturada.</li>}</ol><div className="mt-5 border-t border-[var(--line)] pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Cálculo nutricional</h3><p className="text-xs text-[var(--muted)]">Execute o cálculo para atualizar os valores dos ingredientes cadastrados.</p></div><Button disabled={Boolean(busy) || recipeDirty || ingredientDirty || stepDirty} loading={busy === "calculate"} onClick={() => void calculateRecipe()} type="button">Calcular receita</Button></div>{recipeDirty || ingredientDirty || stepDirty ? <p className="mt-3 text-sm font-bold text-amber-800">Salve ou descarte as alterações antes de calcular.</p> : null}{recipeCalculation ? <div className="mt-4"><Badge tone={recipeCalculation.calculationStatus === "COMPLETE" ? "success" : "warning"}>{calculationStatusLabels[recipeCalculation.calculationStatus] ?? recipeCalculation.calculationStatus}</Badge><p className="mt-2 text-xs text-[var(--muted)]">Os valores disponíveis e as pendências agrupadas aparecem abaixo.</p></div> : null}</div></div>
          {recipeCalculation ? <RecipeNutritionResults calculation={recipeCalculation} outdated={recipeDirty || ingredientDirty} /> : null}
        </div> : null}
      </Section>
    </div>

    <div aria-labelledby="commercial-tab" className="space-y-6" hidden={activeTab !== "commercial"} id="commercial-tab-panel" role="tabpanel">
      <Section id="products-section" title="Produtos" description="Cadastre o produto comercial vinculado à receita e a um snapshot persistido.">
        {!recipe ? <PageState title="Abra uma receita" description="O produto precisa estar vinculado a uma receita acessível." /> : !recipe.nutritionSnapshots.length ? <PageState title="Snapshot necessário" description="Calcule a receita sem bloqueios para persistir um snapshot antes de cadastrar o produto." tone="blocked" /> : <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,2fr)]"><aside><div className="mb-3 flex items-center justify-between"><h3 className="font-black">Produtos</h3><Button disabled={Boolean(busy)} onClick={() => { if (!allowSelectionChange()) return; setCreatingProduct(true); setSelectedProductId(""); setProduct(null); setProductDraft(emptyProduct()); setProductDirty(false); setLabelVersions([]); }} size="small" type="button">Novo</Button></div>{products.length ? <div className="grid gap-2">{products.map((item) => <button className={`rounded-xl border p-3 text-left ${selectedProductId === item.id ? "border-emerald-600 bg-emerald-50" : "border-[var(--line)]"}`} key={item.id} onClick={() => chooseProduct(item.id)} type="button"><span className="block truncate font-bold">{item.commercialName}</span><span className="text-xs text-[var(--muted)]">{item.brand || "Sem marca"}</span></button>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-[var(--muted)]">Nenhum produto vinculado.</p>}</aside><div>{creatingProduct || product ? <form className="grid gap-4" onSubmit={saveProduct}><h3 className="text-lg font-black">{creatingProduct ? "Novo produto" : `Editar ${product?.commercialName}`}</h3><div className="grid gap-4 md:grid-cols-2"><FormField id="product-snapshot" label="Snapshot da receita" required><Select id="product-snapshot" onChange={(e) => changeProduct("recipeNutritionSnapshotId", e.target.value)} required value={productDraft.recipeNutritionSnapshotId}><option value="">Selecione a versão calculada</option>{[...recipe.nutritionSnapshots].sort((a, b) => b.version - a.version).map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Snapshot v{snapshot.version}{snapshot.id === latestSnapshot?.id ? " · mais recente" : ""}</option>)}</Select></FormField><FormField id="product-name" label="Nome comercial" required><Input id="product-name" maxLength={180} onChange={(e) => changeProduct("commercialName", e.target.value)} required value={productDraft.commercialName} /></FormField><FormField id="product-brand" label="Marca"><Input id="product-brand" onChange={(e) => changeProduct("brand", e.target.value)} value={productDraft.brand} /></FormField><FormField id="product-category" label="Categoria"><Input id="product-category" onChange={(e) => changeProduct("category", e.target.value)} value={productDraft.category} /></FormField><FormField id="product-physical" label="Tipo físico" required><Select id="product-physical" onChange={(e) => changeProduct("physicalType", e.target.value as PhysicalType)} value={productDraft.physicalType}><option value="SOLID">Sólido</option><option value="SEMISOLID">Semissólido</option><option value="LIQUID">Líquido</option></Select></FormField><FormField id="product-net" label="Conteúdo líquido" required><div className="grid grid-cols-[1fr_auto] gap-2"><NumberInput id="product-net" min="0" onChange={(e) => changeProduct("netContent", e.target.value)} required value={productDraft.netContent} /><Select aria-label="Unidade do conteúdo" onChange={(e) => changeProduct("netContentUnit", e.target.value as IngredientUnit)} value={productDraft.netContentUnit}><option value="GRAM">g</option><option value="MILLILITER">ml</option></Select></div></FormField><FormField id="product-servings" label="Porções por embalagem" required><NumberInput id="product-servings" min="0" onChange={(e) => changeProduct("servingsPerPackage", e.target.value)} required value={productDraft.servingsPerPackage} /></FormField><FormField id="product-serving" label="Tamanho da porção" required><div className="grid grid-cols-[1fr_auto] gap-2"><NumberInput id="product-serving" min="0" onChange={(e) => changeProduct("servingSize", e.target.value)} required value={productDraft.servingSize} /><Select aria-label="Unidade da porção" onChange={(e) => changeProduct("servingSizeUnit", e.target.value as IngredientUnit)} value={productDraft.servingSizeUnit}><option value="GRAM">g</option><option value="MILLILITER">ml</option></Select></div></FormField><FormField id="product-household" label="Medida caseira"><Input id="product-household" onChange={(e) => changeProduct("servingHouseholdMeasure", e.target.value)} value={productDraft.servingHouseholdMeasure} /></FormField><FormField id="product-sku" label="SKU"><Input id="product-sku" onChange={(e) => changeProduct("sku", e.target.value)} value={productDraft.sku} /></FormField><FormField id="product-shelf" label="Validade (dias)"><NumberInput id="product-shelf" min="1" onChange={(e) => changeProduct("shelfLifeDays", e.target.value)} value={productDraft.shelfLifeDays} /></FormField><div className="md:col-span-2"><FormField id="product-description" label="Descrição"><Textarea id="product-description" onChange={(e) => changeProduct("description", e.target.value)} value={productDraft.description} /></FormField></div><FormField id="product-storage" label="Armazenamento"><Textarea id="product-storage" onChange={(e) => changeProduct("storageInstructions", e.target.value)} value={productDraft.storageInstructions} /></FormField><FormField id="product-use" label="Preparo ou consumo"><Textarea id="product-use" onChange={(e) => changeProduct("preparationOrConsumptionInstructions", e.target.value)} value={productDraft.preparationOrConsumptionInstructions} /></FormField></div>{((productDraft.physicalType === "LIQUID" && (productDraft.netContentUnit !== "MILLILITER" || productDraft.servingSizeUnit !== "MILLILITER")) || (productDraft.physicalType !== "LIQUID" && (productDraft.netContentUnit !== "GRAM" || productDraft.servingSizeUnit !== "GRAM"))) ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">A unidade não é compatível com o tipo físico. Selecione explicitamente a unidade correta; o sistema não converterá massa em volume.</p> : null}<Button disabled={Boolean(busy)} loading={busy === "product"} type="submit">Salvar produto</Button></form> : <PageState title="Abra ou crie um produto" description="Selecione um produto para editar e gerenciar seus rótulos." />}</div></div>}
      </Section>

      <Section id="labels-section" title="Rótulos" description="Calcule uma prévia, salve versões imutáveis e registre revisão humana explícita. Revisão não significa aprovação da Anvisa.">
        {!product ? <PageState title="Abra um produto" description="A prévia e o histórico pertencem a um produto específico." /> : <div className="grid min-w-0 gap-6">
          {recipeNeedsRecalculation ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">A receita mudou. Recalcule, vincule o produto ao novo snapshot e gere uma nova versão antes da revisão ou emissão.</p> : null}<form className="grid gap-5" onSubmit={(event) => event.preventDefault()}><div className="grid gap-4 md:grid-cols-2"><FormField id="reg-serving-source" label="Referência da porção"><Select id="reg-serving-source" onChange={(e) => changeRegulatory("servingSource", e.target.value as RegulatoryForm["servingSource"])} value={regulatory.servingSource}><option value="IN_75_ANNEX_V">Anexo V da IN 75</option><option value="RDC_429_ARTICLE_9">Artigo 9º da RDC 429</option></Select></FormField><FormField id="reg-serving-reference" label="Descrição da referência" help="Descreva a categoria e a porção aplicável; nenhum identificador técnico é necessário."><Input id="reg-serving-reference" onChange={(e) => changeRegulatory("servingReference", e.target.value)} placeholder="Ex.: categoria e porção consultadas" value={regulatory.servingReference} /></FormField><label className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"><Checkbox checked={regulatory.servingConfirmed} onChange={(e) => changeRegulatory("servingConfirmed", e.target.checked)} /><span><strong>Referência de porção conferida</strong><span className="block text-xs text-[var(--muted)]">Confirma a consulta profissional à referência selecionada.</span></span></label><label className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"><Checkbox checked={regulatory.additionalReviewed} onChange={(e) => changeRegulatory("additionalReviewed", e.target.checked)} /><span><strong>Nutrientes obrigatórios adicionais revisados</strong><span className="block text-xs text-[var(--muted)]">Registre abaixo qualquer informação ainda ausente.</span></span></label><div className="md:col-span-2"><FormField id="reg-missing" label="Informações adicionais ausentes" help="Separe itens por vírgula ou por linha."><Textarea id="reg-missing" onChange={(e) => changeRegulatory("missingInformation", e.target.value)} value={regulatory.missingInformation} /></FormField></div><FormField id="reg-context" label="Contexto da tabela"><Select id="reg-context" onChange={(e) => changeRegulatory("tableContext", e.target.value as RegulatoryForm["tableContext"])} value={regulatory.tableContext}><option value="AS_SOLD">Alimento tal como exposto à venda</option><option value="PREPARED">Preparado conforme instruções</option><option value="SPECIAL">Regulamentação especial</option></Select></FormField>{regulatory.tableContext === "PREPARED" ? <label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><Checkbox checked={regulatory.preparationIngredientsIncluded} onChange={(e) => changeRegulatory("preparationIngredientsIncluded", e.target.checked)} />O snapshot inclui os ingredientes adicionados no preparo</label> : regulatory.tableContext === "SPECIAL" ? <FormField id="reg-special" label="Referência da regra especial"><Input id="reg-special" onChange={(e) => changeRegulatory("specialReference", e.target.value)} value={regulatory.specialReference} /></FormField> : <div />}</div>
            <fieldset className="rounded-xl border border-[var(--line)] p-4"><legend className="px-2 text-sm font-black">Condições para declarar valores não significativos como zero</legend><p className="mb-3 text-xs text-[var(--muted)]">Marque somente condições efetivamente verificadas.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{([["zeroCarbohydrates", "Carboidratos"], ["zeroTotalSugars", "Açúcares totais"], ["zeroAddedSugars", "Açúcares adicionados"], ["zeroProtein", "Proteínas"], ["zeroTotalFats", "Gorduras totais"]] as const).map(([key, label]) => <label className="flex items-center gap-2 text-sm" key={key}><Checkbox checked={regulatory[key]} onChange={(e) => changeRegulatory(key, e.target.checked)} />{label}</label>)}</div></fieldset>
            <fieldset className="rounded-xl border border-[var(--line)] p-4"><legend className="px-2 text-sm font-black">Rotulagem nutricional frontal</legend><div className="grid gap-4 md:grid-cols-2"><FormField id="reg-front-app" label="Aplicabilidade"><Select id="reg-front-app" onChange={(e) => changeRegulatory("frontApplicability", e.target.value as RegulatoryForm["frontApplicability"])} value={regulatory.frontApplicability}><option value="STANDARD">Regra padrão</option><option value="PROHIBITED">Declaração proibida</option><option value="OPTIONAL">Declaração opcional</option><option value="CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6">Aplicação condicional</option></Select></FormField><FormField id="reg-front-basis" label="Base avaliada"><Select id="reg-front-basis" onChange={(e) => changeRegulatory("frontBasis", e.target.value as RegulatoryForm["frontBasis"])} value={regulatory.frontBasis}><option value="AS_SOLD">Como vendido</option><option value="PREPARED">Preparado, excluindo ingredientes adicionados</option></Select></FormField><div className="md:col-span-2"><FormField id="reg-front-reason" label="Justificativa"><Textarea id="reg-front-reason" onChange={(e) => changeRegulatory("frontReason", e.target.value)} value={regulatory.frontReason} /></FormField></div>{regulatory.frontBasis === "PREPARED" ? <><FormField id="reg-front-sugar" label="Açúcares adicionados por 100"><NumberInput id="reg-front-sugar" min="0" onChange={(e) => changeRegulatory("frontAddedSugars", e.target.value)} value={regulatory.frontAddedSugars} /></FormField><FormField id="reg-front-fat" label="Gorduras saturadas por 100"><NumberInput id="reg-front-fat" min="0" onChange={(e) => changeRegulatory("frontSaturatedFats", e.target.value)} value={regulatory.frontSaturatedFats} /></FormField><FormField id="reg-front-sodium" label="Sódio por 100"><NumberInput id="reg-front-sodium" min="0" onChange={(e) => changeRegulatory("frontSodium", e.target.value)} value={regulatory.frontSodium} /></FormField></> : null}</div></fieldset>
            <div className="flex flex-wrap gap-3"><Button disabled={Boolean(busy)} loading={busy === "preview"} onClick={() => void previewLabel()} type="button" variant="outline">Calcular prévia</Button><Button disabled={Boolean(busy) || regulatoryDirty || recipeNeedsRecalculation || !labelPreview?.sourceState.readyForNewLabelVersion} loading={busy === "generate"} onClick={() => void generateLabel()} type="button">Gerar e salvar nova versão</Button></div>{regulatoryDirty && labelPreview ? <p className="text-sm font-bold text-amber-800">Os campos regulatórios mudaram. Recalcule a prévia antes de gerar uma versão.</p> : null}{labelPreview?.sourceState.reason ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{labelPreview.sourceState.reason}</p> : null}
          </form>

          <div className="grid gap-5 lg:grid-cols-2"><div className="min-w-0 rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">Prévia não salva</h3>{labelCalculation ? <Badge tone={labelCalculation.calculationStatus === "COMPLETE" ? "success" : "warning"}>{labelCalculation.calculationStatus}</Badge> : null}</div>{labelCalculation ? <><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(labelCalculation.nutrients).map(([key, nutrient]) => <div className="rounded-xl bg-white p-3" key={key}><p className="text-xs font-bold text-[var(--muted)]">{nutrientLabels[key] ?? key}</p><p className="mt-1 font-black">{nutrient.presentation?.perServing?.text ?? (nutrient.raw.perServing === null ? "Ausente" : `${nutrient.raw.perServing} ${nutrient.unit}`)}</p><p className="text-xs text-[var(--muted)]">por porção · {nutrient.presentation?.per100?.text ?? (nutrient.raw.per100 === null ? "ausente por 100" : `${nutrient.raw.per100} ${nutrient.unit}/100`)}</p></div>)}</div><div className="mt-4"><PendingList empty="Nenhuma pendência na prévia." pendings={labelCalculation.pendings} /></div></> : <p className="mt-3 text-sm text-sky-900">Preencha os campos regulatórios e calcule para visualizar nutrientes e pendências.</p>}</div>
            <div className="min-w-0 rounded-2xl border border-[var(--line)] p-4"><h3 className="font-black">Histórico de versões</h3><p className="mt-1 text-xs text-[var(--muted)]">Versões salvas permanecem históricas. “Revisada” significa revisão humana interna, não aprovação da Anvisa.</p><div className="mt-4 grid gap-3">{labelVersions.length ? labelVersions.map((label) => { const reason = reviewReason(label); const tone = label.status === "VALIDATED" ? "success" : label.status === "SUPERSEDED" ? "warning" : label.status === "DRAFT" ? "info" : "neutral"; const status = label.status === "VALIDATED" ? "Revisada" : label.status === "SUPERSEDED" ? "Superada" : label.status === "DRAFT" ? "Versão salva · rascunho" : "Arquivada"; return <article className="rounded-xl border border-[var(--line)] bg-white p-3" key={label.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">Versão {label.version}</p><p className="text-xs text-[var(--muted)]">Criada em {displayDate(label.createdAt)}</p></div><Badge tone={tone}>{status}</Badge></div>{label.preservedVersion.status !== "PRESERVED" ? <p className="mt-2 text-xs text-rose-800">{label.preservedVersion.reason}</p> : null}<div className="mt-3"><Button disabled={Boolean(busy) || Boolean(reason)} loading={busy === `review-${label.id}`} onClick={() => void reviewLabel(label)} size="small" type="button" variant="outline">Registrar revisão humana</Button>{reason ? <p className="mt-2 text-xs text-[var(--muted)]">{reason}</p> : <p className="mt-2 text-xs text-emerald-800">Versão apta à revisão humana explícita.</p>}</div></article>; }) : <p className="text-sm text-[var(--muted)]">Nenhuma versão salva. Uma prévia não aparece no histórico.</p>}</div></div></div>
        </div>}
      </Section>
    </div>
      <dialog
        aria-labelledby="delete-recipe-title"
        className="w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-[var(--line)] bg-white p-0 shadow-2xl backdrop:bg-slate-950/50"
        onCancel={(event) => {
          if (busy === "delete-recipe") event.preventDefault();
        }}
        onClose={() => {
          if (busy !== "delete-recipe") {
            setRecipePendingDeletion(null);
            setDeleteRecipeError(null);
          }
        }}
        ref={deleteRecipeDialogRef}
      >
        <div className="grid gap-4 p-6">
          <div>
            <h2 className="text-lg font-black" id="delete-recipe-title">Excluir receita</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Confirme a exclusão de <strong className="text-[var(--foreground)]">{recipePendingDeletion?.title}</strong>. Os ingredientes e as etapas de preparo desta receita também serão excluídos.
            </p>
          </div>
          {deleteRecipeError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">{deleteRecipeError}</p> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button disabled={busy === "delete-recipe"} onClick={closeDeleteRecipeDialog} type="button" variant="outline">Cancelar</Button>
            <Button disabled={Boolean(busy)} loading={busy === "delete-recipe"} onClick={() => void deleteSelectedRecipe()} type="button" variant="destructive">Excluir receita</Button>
          </div>
        </div>
      </dialog>
  </div>;
}

export default RecipesProductsWorkspace;

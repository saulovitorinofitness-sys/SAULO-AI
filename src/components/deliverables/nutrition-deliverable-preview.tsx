"use client";

import {
  Activity,
  Apple,
  ClipboardList,
  Download,
  FileHeart,
  HeartPulse,
  Leaf,
  LoaderCircle,
  Printer,
  Ruler,
  Save,
  ShoppingCart,
  Stethoscope,
  Target,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeliverableDocumentHeader } from "@/components/deliverables/deliverable-document-header";
import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import {
  type DeliverableMeal,
  type DeliverableMealItem,
  type DeliverableMealPlan,
  type DeliverableOptionalSection,
  type DeliverablePlanRecipe,
  type NutritionDeliverableDraft,
} from "@/features/nutrition-deliverables/contracts";
import { nutritionDeliverableDraftStorage } from "@/features/nutrition-deliverables/draft-storage";
import type {
  RecipeContentSnapshot,
} from "@/features/recipes/recipe-content-snapshot";


const DEFAULT_OPTIONAL_SECTION_ORDER: readonly DeliverableOptionalSection[] = [
  "findings",
  "substitutions",
  "shoppingList",
  "supplements",
  "herbalMedicines",
  "exams",
  "guidance",
  "goals",
  "finalMessage",
];

const OPTIONAL_SECTION_LABELS: Record<
  DeliverableOptionalSection,
  string
> = {
  findings: "Avaliação Corporal",
  substitutions: "Substituições",
  shoppingList: "Lista de Compras",
  supplements: "Suplementação",
  herbalMedicines: "Fitoterápicos",
  exams: "Exames",
  guidance: "Análise Nutricional",
  goals: "Metas",
  finalMessage: "Mensagem Final",
};

const REQUIRED_REPORT_SECTIONS = [
  "Estratégia Nutricional",
  "Plano Alimentar",
] as const;


type InterpretiveGuidanceGroup = {
  id: string;
  title: string;
  items: NutritionDeliverableDraft["guidance"];
};

const INTERPRETIVE_GUIDANCE_ORDER = [
  {
    id: "objectiveAndStrategy",
    title: "Objetivo e estratégia aprovados",
    terms: ["objetivo e estrategia aprovados"],
  },
  {
    id: "nutritionConduct",
    title: "Conduta nutricional registrada",
    terms: ["conduta nutricional registrada"],
  },
  {
    id: "plannedValues",
    title: "Metas e valores planejados",
    terms: ["metas e valores planejados", "analise nutricional", "analise do plano"],
  },
  {
    id: "fiberAndHydration",
    title: "Fibras e hidratação",
    terms: ["fibras e hidratacao"],
  },
  {
    id: "positivePoints",
    title: "Pontos positivos identificados",
    terms: ["pontos positivos", "positivo", "acertos", "habitos adequados"],
  },
  {
    id: "corrections",
    title: "Pontos que necessitam correção",
    terms: ["correcao", "corrigir", "pontos negativos", "ajustes necessarios"],
  },
  {
    id: "reduceOrRemove",
    title: "Alimentos que devem ser reduzidos ou retirados",
    terms: ["reduzir", "retirar", "evitar", "limitar", "alimentos prejudiciais"],
  },
  {
    id: "prioritize",
    title: "Alimentos que devem ser priorizados",
    terms: ["priorizar", "aumentar", "incluir", "preferir", "alimentos recomendados"],
  },
  {
    id: "behavior",
    title: "Orientações profissionais registradas",
    terms: ["orientacoes profissionais registradas"],
  },
  {
    id: "clinicalExpectation",
    title: "Acompanhamento e reavaliação",
    terms: ["acompanhamento", "reavaliacao"],
  },
  {
    id: "returnGoals",
    title: "Metas até o retorno",
    terms: ["metas", "retorno", "objetivos ate o retorno"],
  },
] as const;

function getDiagnosisSections(
  diagnosis: NutritionDeliverableDraft["clinicalDiagnosis"],
) {
  return diagnosis.sections ?? [];
}

function restoreDraftWithGeneratedDiagnosis(
  saved: NutritionDeliverableDraft,
  generated: NutritionDeliverableDraft,
) {
  return normalizeDraft({
    ...generated,
    status: saved.status,
    savedAt: saved.savedAt,
    approvedAt: saved.approvedAt,
    professionalNotes:
      saved.professionalNotes ?? generated.professionalNotes,
    includeClinicalDiagnosis:
      saved.includeClinicalDiagnosis ?? generated.includeClinicalDiagnosis,
    clinicalDiagnosis: {
      ...generated.clinicalDiagnosis,
      state:
        saved.status === "APPROVED" ||
        saved.clinicalDiagnosis.state === "APPROVED"
          ? "APPROVED"
          : generated.clinicalDiagnosis.state,
    },
  });
}

function format(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function deliverableMealItems(
  meal: DeliverableMeal,
): readonly DeliverableMealItem[] {
  return meal.items ?? meal.foods;
}

function recipeUnit(unit: "GRAM" | "MILLILITER" | "UNIT") {
  if (unit === "GRAM") return "g";
  if (unit === "MILLILITER") return "ml";
  return "unidade(s)";
}

function recipeIngredientQuantity(
  ingredient: RecipeContentSnapshot["ingredients"][number],
) {
  const quantities: string[] = [];
  if (
    ingredient.householdMeasureQuantity !== null &&
    ingredient.householdMeasureDescription !== null
  ) {
    quantities.push(
      `${format(ingredient.householdMeasureQuantity, 3)} ${ingredient.householdMeasureDescription}`,
    );
  }
  if (ingredient.grossQuantity !== null && ingredient.quantityUnit !== null) {
    quantities.push(
      `bruto: ${format(ingredient.grossQuantity, 3)} ${recipeUnit(ingredient.quantityUnit)}`,
    );
  }
  if (ingredient.netQuantity !== null && ingredient.quantityUnit !== null) {
    quantities.push(
      `líquido: ${format(ingredient.netQuantity, 3)} ${recipeUnit(ingredient.quantityUnit)}`,
    );
  }
  return quantities;
}

function normalizedPlanRecipes(
  plan: DeliverableMealPlan,
): readonly DeliverablePlanRecipe[] {
  if (plan.recipes) return plan.recipes;
  const recipes = new Map<string, DeliverablePlanRecipe>();
  for (const meal of plan.meals) {
    for (const item of deliverableMealItems(meal)) {
      if (item.itemType !== "RECIPE") continue;
      const key = `${item.recipeId}:${item.recipeNutritionSnapshotId}`;
      if (recipes.has(key)) continue;
      recipes.set(key, {
        recipeId: item.recipeId,
        recipeTitle: item.recipeTitle,
        recipeNutritionSnapshotId: item.recipeNutritionSnapshotId,
        recipeNutritionSnapshotVersion: item.recipeNutritionSnapshotVersion,
        contentPendings: ["CONTENT_SNAPSHOT_MISSING"],
      });
    }
  }
  return [...recipes.values()];
}

export function missingNutrientLabel(nutrient: string) {
  const labels: Readonly<Record<string, string>> = {
    energyKcal: "energia",
    proteinGrams: "proteínas",
    carbohydratesGrams: "carboidratos",
    fatsGrams: "gorduras",
    fiberGrams: "fibras",
    sugarsGrams: "açúcares",
    cholesterolMg: "colesterol",
    saturatedFatsGrams: "gorduras saturadas",
    transFatsGrams: "gorduras trans",
    monounsaturatedFatsGrams: "gorduras monoinsaturadas",
    polyunsaturatedFatsGrams: "gorduras poli-insaturadas",
    sodiumMg: "sódio",
    calciumMg: "cálcio",
    ironMg: "ferro",
    magnesiumMg: "magnésio",
    phosphorusMg: "fósforo",
    potassiumMg: "potássio",
    zincMg: "zinco",
    copperMg: "cobre",
    manganeseMg: "manganês",
    seleniumMcg: "selênio",
    vitaminAMcg: "vitamina A",
    vitaminCMg: "vitamina C",
    vitaminDMcg: "vitamina D",
    vitaminEMg: "vitamina E",
    vitaminKMcg: "vitamina K",
    thiamineMg: "tiamina",
    riboflavinMg: "riboflavina",
    niacinMg: "niacina",
    vitaminB6Mg: "vitamina B6",
    folateMcg: "folato",
    vitaminB12Mcg: "vitamina B12",
  };
  return labels[nutrient] ?? nutrient;
}

function deliverableRecipeTitle(
  meals: readonly DeliverableMeal[],
  itemId: string,
) {
  for (const meal of meals) {
    const item = deliverableMealItems(meal).find(
      (candidate) => candidate.id === itemId,
    );
    if (item?.itemType === "RECIPE") return item.recipeTitle;
  }
  return "Receita registrada";
}


function isDirectTechnicalMeasure(measure: string) {
  const normalized = normalizeClinicalText(measure);
  return (
    ["g", "grama", "gramas", "ml", "mililitro", "mililitros"].includes(
      normalized,
    ) || /^\d+(?:[.,]\d+)?\s*(?:g|ml)$/.test(normalized)
  );
}

const KNOWN_HOUSEHOLD_MEASURE_FORMS: Readonly<
  Record<string, { readonly singular: string; readonly plural: string }>
> = {
  colher: { singular: "colher", plural: "colheres" },
  colheres: { singular: "colher", plural: "colheres" },
  concha: { singular: "concha", plural: "conchas" },
  conchas: { singular: "concha", plural: "conchas" },
  pedaço: { singular: "pedaço", plural: "pedaços" },
  pedaços: { singular: "pedaço", plural: "pedaços" },
  porção: { singular: "porção", plural: "porções" },
  porções: { singular: "porção", plural: "porções" },
};

function householdMeasureForQuantity(measure: string, quantity: number) {
  const trimmed = measure.trim();
  const match = /^(colher(?:es)?|conchas?|pedaç(?:o|os)|porç(?:ão|ões))(?=\s|$)(.*)$/iu.exec(
    trimmed,
  );
  if (!match) return trimmed;

  const sourceHead = match[1];
  const forms = KNOWN_HOUSEHOLD_MEASURE_FORMS[
    sourceHead.toLocaleLowerCase("pt-BR")
  ];
  if (!forms) return trimmed;

  const inflected = quantity === 1 ? forms.singular : forms.plural;
  const head = sourceHead[0] === sourceHead[0].toLocaleUpperCase("pt-BR")
    ? `${inflected[0].toLocaleUpperCase("pt-BR")}${inflected.slice(1)}`
    : inflected;
  return `${head}${match[2]}`;
}

function formatHouseholdMeasureQuantity(quantity: number, measure: string) {
  const trimmedMeasure = measure.trim();
  if (/^\d+(?:[.,]\d+)?(?=\s|$)/u.test(trimmedMeasure)) {
    return `${format(quantity, 2)} × ${trimmedMeasure}`;
  }
  return `${format(quantity, 2)} ${householdMeasureForQuantity(trimmedMeasure, quantity)}`;
}

function formatFoodQuantity(
  food: Extract<DeliverableMealItem, { readonly itemType?: "FOOD" }>,
) {
  if (food.selectedMeasure) {
    return formatHouseholdMeasureQuantity(
      food.quantity,
      food.selectedMeasure.label,
    );
  }
  const householdMeasure = food.householdMeasure.trim();
  if (householdMeasure && !isDirectTechnicalMeasure(householdMeasure)) {
    return formatHouseholdMeasureQuantity(food.quantity, householdMeasure);
  }
  return `${format(food.prescribedAmount, 2)} ${food.prescribedUnit}`;
}

function formatSubstitutionQuantity(
  substitution: NonNullable<
    Extract<DeliverableMealItem, { readonly itemType?: "FOOD" }>["substitutions"]
  >[number],
) {
  const direct = substitution.prescribedAmount !== undefined &&
    substitution.prescribedUnit
    ? `${format(substitution.prescribedAmount, 2)} ${substitution.prescribedUnit}`
    : undefined;
  const household = substitution.quantity !== undefined &&
    substitution.householdMeasure?.trim()
    ? formatHouseholdMeasureQuantity(
        substitution.quantity,
        substitution.householdMeasure,
      )
    : undefined;
  if (household && direct) return `${household} — ${direct}`;
  return household ?? direct ?? "quantidade não documentada";
}

function recipePreparationParagraphs(value: string | null) {
  return value
    ? value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
    : [];
}

export function recipeServingsLabel(servings: number) {
  return `${format(servings, 0)} ${servings === 1 ? "porção" : "porções"}`;
}

export function yieldDescriptionIncludesServings(
  description: string | null,
  servings: number,
) {
  if (!description) return false;
  const normalized = normalizeClinicalText(description);
  return normalized.includes(
    normalizeClinicalText(recipeServingsLabel(servings)),
  );
}

function formatFoodReference(
  food: Extract<DeliverableMealItem, { readonly itemType?: "FOOD" }>,
) {
  const values: string[] = [];
  if (food.selectedMeasure) {
    values.push(`Total: ${format(food.prescribedAmount, 2)} ${food.prescribedUnit}`);
  }
  if (food.nutritionReferenceMeasure?.trim()) {
    values.push(
      `Base ${food.nutritionSourceName?.trim() || "nutricional"}: ${food.nutritionReferenceMeasure.trim()}`,
    );
  }
  return values.length ? values.join(" · ") : "Prescrição direta";
}

function formatFoodTechnicalDetails(
  food: Extract<DeliverableMealItem, { readonly itemType?: "FOOD" }>,
) {
  const values = [formatFoodReference(food)];
  if (food.selectedMeasure) {
    values.push(`Medida cadastrada: ${food.selectedMeasure.label}`);
    if (food.selectedMeasure.preparationName) {
      values.push(`Preparação: ${food.selectedMeasure.preparationName}`);
    }
  }
  return values.join(" · ");
}

function date(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? `${value}T12:00:00`
    : value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(normalized),
  );
}


function normalizeClinicalText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}


function groupInterpretiveGuidance(
  guidance: NutritionDeliverableDraft["guidance"],
): InterpretiveGuidanceGroup[] {
  const approvedItems = guidance.filter(
    (item) => item.approved && item.content.trim(),
  );

  const assigned = new Set<string>();
  const groups: InterpretiveGuidanceGroup[] = INTERPRETIVE_GUIDANCE_ORDER.map((group) => {
    const items = approvedItems.filter((item) => {
      if (assigned.has(item.id)) return false;
      const category = normalizeClinicalText(item.category);
      const matches = group.terms.some((term) =>
        category.includes(normalizeClinicalText(term)),
      );

      if (matches) assigned.add(item.id);
      return matches;
    });

    return {
      id: group.id,
      title: group.title,
      items,
    };
  }).filter((group) => group.items.length);

  const remaining = approvedItems.filter((item) => !assigned.has(item.id));

  if (remaining.length) {
    groups.push({
      id: "additionalGuidance",
      title: "Orientações clínicas complementares",
      items: remaining,
    });
  }

  return groups;
}

function isAdministrativeFinding(description: string) {
  const normalized = normalizeClinicalText(description);

  return [
    "avaliacao antropometrica disponivel",
    "registro de bioimpedancia vinculado",
    "bioimpedancia vinculada",
    "dados antropometricos disponiveis",
    "avaliacao disponivel no prontuario",
  ].some((fragment) => normalized.includes(fragment));
}

function normalizeDraft(
  value: NutritionDeliverableDraft,
): NutritionDeliverableDraft {
  const order: DeliverableOptionalSection[] = [];
  for (const section of [
    ...(value.optionalSectionOrder ?? []),
    ...DEFAULT_OPTIONAL_SECTION_ORDER,
  ]) {
    if (!order.includes(section)) order.push(section);
  }

  return {
    ...value,
    includeClinicalDiagnosis:
      value.includeClinicalDiagnosis ??
      Boolean(value.clinicalDiagnosis.content.trim()),
    mealPlan: value.mealPlan
      ? {
          ...value.mealPlan,
          recipes: normalizedPlanRecipes(value.mealPlan),
        }
      : undefined,
    supplements: value.supplements ?? [],
    herbalMedicines: value.herbalMedicines ?? [],
    exams: value.exams ?? [],
    finalMessage: value.finalMessage ?? {
      content: "",
      approved: false,
      state: "PENDING_REVIEW",
    },
    professionalNotes: value.professionalNotes ?? {
      considerations: "",
      orientations: "",
    },
    enabledSections: {
      findings: true,
      substitutions: false,
      shoppingList: true,
      supplements: false,
      herbalMedicines: false,
      exams: false,
      guidance: false,
      goals: false,
      finalMessage: false,
      ...value.enabledSections,
    },
    optionalSectionOrder: order,
  };
}

function sectionIcon(title: string) {
  const iconClass = "size-5";

  if (title.includes("Diagnóstico")) return <Stethoscope className={iconClass} />;
  if (title.includes("antropométrica")) return <Ruler className={iconClass} />;
  if (title.includes("Estratégia")) return <Target className={iconClass} />;
  if (title.includes("Plano Alimentar")) return <Utensils className={iconClass} />;
  if (title.includes("Receitas do seu plano")) return <Apple className={iconClass} />;
  if (title.includes("Lista de compras")) return <ShoppingCart className={iconClass} />;
  if (title.includes("Suplementação")) return <Activity className={iconClass} />;
  if (title.includes("Fitoterápicos")) return <Leaf className={iconClass} />;
  if (title.includes("Exames")) return <HeartPulse className={iconClass} />;
  if (title.includes("Análise Nutricional")) return <FileHeart className={iconClass} />;
  if (title.includes("Metas")) return <Target className={iconClass} />;
  if (title.includes("Mensagem")) return <Apple className={iconClass} />;

  return <ClipboardList className={iconClass} />;
}

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="report-section bg-[#fffefb] px-5 py-7 sm:px-8 sm:py-8">
      <div className="report-section-title flex items-center gap-3 border-b border-[#dce7df] pb-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#dfeadf] text-[#234d3b]">
          {sectionIcon(title)}
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-[#183f31]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#677a71]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="report-section-content mt-5">{children}</div>
    </section>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-[#f7faf8] p-4 text-sm text-slate-500">
      {children}
    </p>
  );
}

function NutritionTotalCard({
  label,
  partial,
  unit,
  value,
}: {
  readonly label: string;
  readonly partial: boolean;
  readonly unit: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-lg bg-white p-2">
      <dt className="text-[10px] font-bold text-slate-500">{label}</dt>
      <dd className="font-black text-[#40564e]">
        {format(value, 2)} {unit}{partial ? " · parcial" : ""}
      </dd>
    </div>
  );
}

function DeliverableNutritionTotals({ plan }: { readonly plan: DeliverableMealPlan }) {
  const totals = plan.nutritionTotals;
  const isPartial = (nutrient: string) =>
    totals.missingNutrients.some((missing) => missing === nutrient) ||
    totals.partialNutrients.some((partial) => partial === nutrient);
  const hasIncompleteNutritionData =
    totals.nutritionCompleteness !== "COMPLETE" ||
    totals.missingContributions.length > 0 ||
    totals.partialContributions.length > 0;

  return (
    <section className="pdf-avoid-break rounded-xl border border-[#cbded3] bg-[#f1f5ec] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-[#183f31]">Totais nutricionais do plano</h3>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
          totals.nutritionCompleteness === "COMPLETE"
            ? "bg-emerald-100 text-emerald-900"
            : "bg-amber-100 text-amber-900"
        }`}>
          {totals.nutritionCompleteness === "COMPLETE" ? "Dados completos" : "Valores conhecidos"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <NutritionTotalCard label="Energia" partial={isPartial("energyKcal")} unit="kcal" value={totals.values.energyKcal} />
        <NutritionTotalCard label="Proteínas" partial={isPartial("proteinGrams")} unit="g" value={totals.values.proteinGrams} />
        <NutritionTotalCard label="Carboidratos" partial={isPartial("carbohydratesGrams")} unit="g" value={totals.values.carbohydratesGrams} />
        <NutritionTotalCard label="Gorduras" partial={isPartial("fatsGrams")} unit="g" value={totals.values.fatsGrams} />
        <NutritionTotalCard label="Fibras" partial={isPartial("fiberGrams")} unit="g" value={totals.values.fiberGrams} />
      </dl>
      {hasIncompleteNutritionData ? (
        <p className="mt-3 text-xs leading-5 text-amber-800">
          Alguns alimentos não possuem dados completos de composição nutricional. Os valores
          identificados como “parcial” consideram apenas as informações disponíveis.
        </p>
      ) : null}
    </section>
  );
}

function NutritionCompletenessDetails({ plan }: { readonly plan: DeliverableMealPlan }) {
  const totals = plan.nutritionTotals;

  if (!totals.missingContributions.length && !totals.partialContributions.length) {
    return null;
  }

  return (
    <section>
      <h3 className="font-black text-[#183029]">Integridade dos dados nutricionais</h3>
      {totals.missingContributions.length ? (
        <p className="mt-2 text-slate-600">
          Não há informação disponível para: {totals.missingContributions.map((contribution) =>
            `${missingNutrientLabel(contribution.nutrient)} — ${deliverableRecipeTitle(plan.meals, contribution.itemId)}`,
          ).join("; ")}.
        </p>
      ) : null}
      {totals.partialContributions.length ? (
        <p className="mt-2 text-slate-600">
          Valores conhecidos parcialmente para: {totals.partialContributions.map((contribution) =>
            `${missingNutrientLabel(contribution.nutrient)} — ${deliverableRecipeTitle(plan.meals, contribution.itemId)}`,
          ).join("; ")}. Os totais apresentados não representam composição integral nesses nutrientes.
        </p>
      ) : null}
    </section>
  );
}

function DeliverableRecipeCard({
  recipe,
}: {
  readonly recipe: DeliverablePlanRecipe;
}) {
  const snapshot = recipe.contentSnapshot;
  const preparationParagraphs = recipePreparationParagraphs(
    snapshot?.preparationMethod ?? null,
  );
  return (
    <article className="recipe-appendix-card rounded-2xl border border-[#d8e4dc] bg-white p-4 shadow-[0_7px_20px_rgba(23,60,48,0.05)] sm:p-5">
      <div className="recipe-detail-heading flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#a17d2e]">
            Receita do plano
          </p>
          <h3 className="mt-1 text-lg font-black text-[#183f31]">
            {recipe.recipeTitle}
          </h3>
        </div>
      </div>

      {recipe.contentPendings.length ? (
        <div className="pdf-avoid-break mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Alguns detalhes desta receita não estavam disponíveis no plano aprovado.
        </div>
      ) : null}

      {snapshot ? (
        <div className="mt-5 space-y-5">
          <div>
            <h4 className="recipe-detail-heading text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
              Ingredientes
            </h4>
            <div className="mt-3 divide-y divide-[#edf2ef] rounded-xl border border-[#e5ece8]">
              {snapshot.ingredients.map((ingredient) => {
                const quantities = recipeIngredientQuantity(ingredient);
                return (
                  <div
                    className="recipe-detail-row grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
                    key={ingredient.ingredientId}
                  >
                    <div>
                      <p className="font-bold text-[#40564e]">
                        {ingredient.foodName}
                      </p>
                      {ingredient.notes ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {ingredient.notes}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-slate-500 sm:text-right">
                      {quantities.length
                        ? quantities.join(" · ")
                        : "Quantidade não congelada"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="recipe-detail-heading text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
              Modo de preparo
            </h4>
            {preparationParagraphs.length ? (
              <div className="mt-2 space-y-1.5">
                {preparationParagraphs.map((paragraph, index) => (
                  <p
                    className="recipe-preparation-step text-sm leading-6 text-[#40564e]"
                    key={`${index}:${paragraph}`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {snapshot.preparationSteps.length ? (
              <ol className="mt-3 space-y-2">
                {snapshot.preparationSteps.map((step) => (
                  <li
                    className="recipe-detail-row flex gap-3 rounded-lg bg-[#f7faf8] px-3 py-2 text-sm leading-6 text-[#40564e]"
                    key={`${step.position}:${step.instruction}`}
                  >
                    <span className="font-black text-[#a17d2e]">
                      {step.position}.
                    </span>
                    <span>{step.instruction}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div className="recipe-detail-row rounded-xl bg-[#f1f6ed] p-4">
            <h4 className="recipe-detail-heading text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
              Rendimento total
            </h4>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold text-[#40564e]">
              {snapshot.yieldDescription ? <span>{snapshot.yieldDescription}</span> : null}
              {snapshot.finalYield ? (
                <span>
                  Rendimento final registrado: {format(snapshot.finalYield.amount, 3)} {recipeUnit(snapshot.finalYield.unit)}
                </span>
              ) : null}
              {snapshot.declaredYield ? (
                <span>
                  Rendimento informado: {format(snapshot.declaredYield.amount, 3)} {recipeUnit(snapshot.declaredYield.unit)}
                </span>
              ) : null}
              {snapshot.servings !== null &&
              !yieldDescriptionIncludesServings(
                snapshot.yieldDescription,
                snapshot.servings,
              ) ? (
                <span>{recipeServingsLabel(snapshot.servings)}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function NutritionDeliverablePreview({
  initialDraft,
  focused = false,
  documentType = "nutrition-report",
  officialDocumentId,
  officialVersion: initialOfficialVersion,
  sourceEntryId,
  sourceVersionId,
  sourcePlanDraftPreview = false,
  printMode = false,
}: {
  initialDraft: NutritionDeliverableDraft;
  focused?: boolean;
  documentType?: "nutrition-report" | "meal-plan";
  officialDocumentId?: string;
  officialVersion?: number;
  sourceEntryId?: string;
  sourceVersionId?: string;
  sourcePlanDraftPreview?: boolean;
  printMode?: boolean;
}) {
  const [draft, setDraft] = useState(() => normalizeDraft(initialDraft));
  const [professionalNotesDirty, setProfessionalNotesDirty] = useState(false);
  const isFinalizedMealPlan = documentType === "meal-plan";
  const [officialVersion, setOfficialVersion] = useState(
    initialOfficialVersion,
  );
  const isOfficialReport =
    documentType === "nutrition-report" &&
    officialVersion !== undefined &&
    !sourcePlanDraftPreview;
  const isReadOnly = isFinalizedMealPlan || isOfficialReport || sourcePlanDraftPreview;
  const [message, setMessage] = useState(
    sourcePlanDraftPreview
      ? "Prévia somente leitura do rascunho salvo e reaberto. Imprimir ou baixar não finaliza nem publica o plano."
      : isFinalizedMealPlan || initialOfficialVersion !== undefined
      ? "Visualização da versão oficial congelada. Imprimir ou baixar não grava alterações."
      : "Prévia completa para conferência. Este relatório ainda não foi publicado.",
  );
  const [exportState, setExportState] = useState<
    "IDLE" | "GENERATING" | "ERROR"
  >("IDLE");
  useEffect(() => {
    if (isReadOnly) return;
    const hydrationTimer = window.setTimeout(() => {
      const saved = nutritionDeliverableDraftStorage.read(
        initialDraft.patientId,
        initialDraft.attendanceId,
      );

      if (
        saved &&
        saved.mealPlan?.planId === initialDraft.mealPlan?.planId
      ) {
        setDraft(restoreDraftWithGeneratedDiagnosis(saved, initialDraft));
        setProfessionalNotesDirty(false);
        setMessage("Dados atuais do atendimento carregados; estado da conferência restaurado.");
      }
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, [initialDraft, isReadOnly]);

  useEffect(() => {
    if (!printMode || !isReadOnly) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [isReadOnly, printMode]);

  const diagnosisSections = getDiagnosisSections(draft.clinicalDiagnosis);
  const visibleShoppingItems = draft.shoppingList.items.filter(
    (item) => !item.excluded,
  );
  const hasClinicalDiagnosis = diagnosisSections.length
    ? diagnosisSections.some((section) => section.id === "clinical-conditions")
    : Boolean(draft.clinicalDiagnosis.content.trim());
  const canSaveOfficial =
    Boolean(draft.nutritionStrategy) && Boolean(draft.mealPlan);
  const documentPendings = [
    ...(!draft.nutritionStrategy ? ["Estratégia Nutricional não localizada"] : []),
    ...(!draft.mealPlan ? ["Plano Alimentar finalizado não localizado"] : []),
  ];

  const backHref = `/pacientes/${encodeURIComponent(
    draft.patientId,
  )}/plano-alimentar?attendanceId=${encodeURIComponent(draft.attendanceId)}`;
  function toggleOptionalSection(section: DeliverableOptionalSection) {
    setDraft((current) => {
      const next = {
        ...current,
        savedAt: new Date().toISOString(),
        enabledSections: {
          ...current.enabledSections,
          [section]: !current.enabledSections[section],
        },
      } satisfies NutritionDeliverableDraft;

      nutritionDeliverableDraftStorage.save(next);
      return next;
    });

    setMessage("Conteúdo do relatório atualizado.");
  }

  function toggleClinicalDiagnosis() {
    if (!hasClinicalDiagnosis) return;

    setDraft((current) => {
      const next = {
        ...current,
        savedAt: new Date().toISOString(),
        includeClinicalDiagnosis: !current.includeClinicalDiagnosis,
      } satisfies NutritionDeliverableDraft;

      nutritionDeliverableDraftStorage.save(next);
      return next;
    });
    setMessage("Decisão documental sobre o diagnóstico atualizada.");
  }

  function updateProfessionalNote(
    field: "considerations" | "orientations",
    content: string,
  ) {
    setDraft((current) => ({
      ...current,
      professionalNotes: {
        considerations: current.professionalNotes?.considerations ?? "",
        orientations: current.professionalNotes?.orientations ?? "",
        [field]: content,
      },
    }));
    setProfessionalNotesDirty(true);
    setMessage(
      "Considerações ou orientações alteradas na prévia. Salve a conferência ou publique o relatório para persistir o texto.",
    );
  }

  function saveProfessionalNotesForReview() {
    const next = {
      ...draft,
      savedAt: new Date().toISOString(),
    } satisfies NutritionDeliverableDraft;
    setDraft(next);
    nutritionDeliverableDraftStorage.save(next);
    setProfessionalNotesDirty(false);
    setMessage(
      "Considerações e orientações salvas nesta conferência. Elas só se tornam parte do documento oficial ao salvar o relatório.",
    );
  }

  function readOnlyDocumentHref(intent: "PRINT" | "SAVE_PDF") {
    const params = new URLSearchParams({
      patientId: draft.patientId,
      attendanceId: draft.attendanceId,
      intent,
    });
    if (sourcePlanDraftPreview && sourceEntryId) {
      params.set("entryId", sourceEntryId);
      params.set("documentType", "meal-plan-draft");
    } else if (isFinalizedMealPlan && sourceEntryId && sourceVersionId) {
      params.set("entryId", sourceEntryId);
      params.set("versionId", sourceVersionId);
      params.set("documentType", "meal-plan");
    } else if (officialDocumentId) {
      params.set("deliverableId", officialDocumentId);
      params.set("documentType", "nutrition-report");
    }
    return `/clinica/plano-alimentar/entregavel/imprimir?${params.toString()}`;
  }

  function openReadOnlyDocument(intent: "PRINT" | "SAVE_PDF") {
    if (exportState === "GENERATING") return;
    if (
      (sourcePlanDraftPreview && !sourceEntryId) ||
      (isFinalizedMealPlan && (!sourceEntryId || !sourceVersionId)) ||
      (isOfficialReport && !officialDocumentId)
    ) {
      setExportState("ERROR");
      setMessage(
        "A versão oficial não possui identificação suficiente para ser reaberta com segurança.",
      );
      return;
    }
    setMessage(sourcePlanDraftPreview
      ? "Abrindo a página de impressão do rascunho, sem finalizar nem publicar."
      : "Abrindo a página da versão oficial, sem salvar novamente.");
    window.location.assign(readOnlyDocumentHref(intent));
  }

  async function persistOfficialReport() {
    if (!canSaveOfficial || exportState === "GENERATING") {
      if (!canSaveOfficial) {
        setMessage(
          `Não é possível gerar um documento fiel: ${documentPendings.join("; ")}. O diagnóstico clínico é opcional e não causa este bloqueio.`,
        );
      }
      return;
    }

    setExportState("GENERATING");
    setMessage("Salvando o relatório oficial...");
    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(draft.patientId)}/attendances/${encodeURIComponent(draft.attendanceId)}/nutrition-deliverables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SAVE_OFFICIAL_REPORT", draft }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        readonly message?: string;
        readonly document?: {
          readonly id: string;
          readonly version: number;
          readonly snapshot: NutritionDeliverableDraft;
        };
      } | null;

      if (!response.ok || !payload?.document) {
        setExportState("ERROR");
        setMessage(
          payload?.message ??
            `O serviço de Entregáveis respondeu com erro ${response.status}. Nenhum documento foi criado.`,
        );
        return;
      }

      setDraft(normalizeDraft(payload.document.snapshot));
      setOfficialVersion(payload.document.version);
      setExportState("IDLE");
      setMessage("Relatório oficial salvo. Abrindo o documento persistido.");
      window.setTimeout(() => {
        const params = new URLSearchParams({
          patientId: draft.patientId,
          attendanceId: draft.attendanceId,
          view: "nutrition",
          deliverableId: payload.document!.id,
        });
        window.location.assign(
          `/clinica/plano-alimentar/entregavel?${params.toString()}`,
        );
      }, 0);
    } catch {
      setExportState("ERROR");
      setMessage(
        "A requisição ao serviço de Entregáveis falhou antes de receber uma resposta. Consulte a Central antes de tentar novamente.",
      );
    }
  }

  function renderOptionalSection(section: DeliverableOptionalSection) {
    if (!draft.enabledSections[section]) return null;

    if (section === "findings") {
      const diagnosisContent = normalizeClinicalText(
        diagnosisSections.map((item) => item.content).join(" "),
      );

      const items = draft.findings.filter((finding) => {
        if (isAdministrativeFinding(finding.description)) return false;

        const description = normalizeClinicalText(finding.description);
        if (!description) return false;

        return !diagnosisContent.includes(description);
      });

      if (!items.length) return null;

      return (
        <Section
          key={section}
          description="Dados objetivos da avaliação atual, herdados do Prontuário Mestre. Informações já exibidas no diagnóstico não são repetidas."
          title="Avaliação antropométrica e composição corporal"
        >
          <div className="report-card-rows space-y-3">
            {Array.from(
              { length: Math.ceil(items.length / 2) },
              (_, rowIndex) => items.slice(rowIndex * 2, rowIndex * 2 + 2),
            ).map((row) => (
              <div
                className="report-card-row grid gap-3 sm:grid-cols-2"
                key={row.map((finding) => finding.id).join("-")}
              >
                {row.map((finding) => (
                  <article
                    className="report-card rounded-xl border border-[#dfe7e3] bg-[#fbfdfc] p-4"
                    key={finding.id}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#a17d2e]">
                      {finding.category}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#40564e]">
                      {finding.description}
                    </p>
                    <p className="source-reference mt-2 text-[10px] text-slate-400">
                      Fonte: {finding.sourceReference}
                    </p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "substitutions") {
      if (!draft.mealPlan || !draft.substitutions.length) return null;

      return (
        <Section key={section} title="Substituições aprovadas">
          <div className="space-y-3">
            {draft.substitutions.map((item) => (
              <article
                className="report-card rounded-xl border border-[#dfe7e3] bg-[#f7faf8] p-4"
                key={item.id}
              >
                <p className="text-xs font-bold text-slate-500">
                  {item.mealName}
                </p>
                <p className="mt-1 font-black text-[#173c30]">
                  {item.prescribedFood}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#40564e]">
                  Opções aprovadas: {item.approvedOptions.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "shoppingList") {
      if (!draft.mealPlan || !visibleShoppingItems.length) return null;

      const grouped: Record<string, typeof visibleShoppingItems> = {};
      for (const item of visibleShoppingItems) {
        const category = item.category || "Outros";
        grouped[category] = [...(grouped[category] ?? []), item];
      }

      return (
        <Section
          key={section}
          description={`Quantidades calculadas para ${draft.shoppingList.days} dias na mesma unidade e forma registradas no plano. Alimentos preparados não são convertidos em ingredientes crus sem fator documentado.`}
          title="Lista de compras"
        >
          <div className="shopping-list-grid grid gap-4 sm:grid-cols-2">
            {Object.entries(grouped).map(([category, items]) => (
              <article
                className="report-card shopping-list-card rounded-xl border border-[#dfe7e3] p-4"
                key={category}
              >
                <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
                  {category}
                </h3>
                <div className="mt-3 divide-y divide-[#edf2ef]">
                  {items.map((item) => (
                    <div
                      className="flex items-start justify-between gap-3 py-2 text-sm"
                      key={item.id}
                    >
                      <span className="font-bold text-[#40564e]">
                        {item.name}
                        {item.preparationName ? (
                          <span className="block text-[10px] font-medium text-slate-500">
                            Forma prescrita: {item.preparationName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {item.displayQuantity}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "supplements") {
      const items = (draft.supplements ?? []).filter((item) => item.approved);
      if (!items.length) return null;

      return (
        <Section key={section} title="Suplementação">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <article
                className="report-card rounded-xl border border-[#dfe7e3] p-4"
                key={item.id}
              >
                <p className="font-black text-[#173c30]">{item.name}</p>
                {item.activeIngredient ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.activeIngredient}
                  </p>
                ) : null}
                <dl className="mt-3 space-y-2 text-sm text-[#40564e]">
                  {item.dose ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Dose
                      </dt>
                      <dd>{item.dose}</dd>
                    </div>
                  ) : null}
                  {item.schedule ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Horário e frequência
                      </dt>
                      <dd>{item.schedule}</dd>
                    </div>
                  ) : null}
                  {item.duration ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Duração
                      </dt>
                      <dd>{item.duration}</dd>
                    </div>
                  ) : null}
                  {item.observations ?? item.purpose ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Observações
                      </dt>
                      <dd>{item.observations ?? item.purpose}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "herbalMedicines") {
      const items = (draft.herbalMedicines ?? []).filter(
        (item) => item.approved,
      );
      if (!items.length) return null;

      return (
        <Section key={section} title="Fitoterápicos">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <article
                className="report-card rounded-xl border border-[#dfe7e3] p-4"
                key={item.id}
              >
                <p className="font-black text-[#173c30]">
                  {item.popularName}
                </p>
                {item.scientificName ? (
                  <p className="mt-1 text-xs italic text-slate-500">
                    {item.scientificName}
                  </p>
                ) : null}
                <dl className="mt-3 space-y-2 text-sm text-[#40564e]">
                  {item.dose ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Dose
                      </dt>
                      <dd>{item.dose}</dd>
                    </div>
                  ) : null}
                  {item.schedule ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Horário e frequência
                      </dt>
                      <dd>{item.schedule}</dd>
                    </div>
                  ) : null}
                  {item.duration ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Tempo de uso
                      </dt>
                      <dd>{item.duration}</dd>
                    </div>
                  ) : null}
                  {item.purpose ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Objetivo
                      </dt>
                      <dd>{item.purpose}</dd>
                    </div>
                  ) : null}
                  {item.observations ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Observações
                      </dt>
                      <dd>{item.observations}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "exams") {
      const items = (draft.exams ?? []).filter((item) => item.approved);
      if (!items.length) return null;

      const evaluated = items.filter((item) => item.kind === "EVALUATED");
      const requested = items.filter((item) => item.kind === "REQUESTED");
      const monitoring = items.filter((item) => item.kind === "MONITORING");

      const examGroup = (
        title: string,
        group: typeof items,
      ) =>
        group.length ? (
          <article className="report-card rounded-xl border border-[#dfe7e3] p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
              {title}
            </h3>
            <div className="mt-3 space-y-3">
              {group.map((item) => (
                <div
                  className="rounded-lg bg-[#f7faf8] p-3"
                  key={item.id}
                >
                  <p className="font-bold text-[#173c30]">{item.name}</p>
                  {item.result ? (
                    <p className="mt-1 text-sm text-[#40564e]">
                      Resultado: {item.result}
                      {item.referenceRange
                        ? ` · Referência: ${item.referenceRange}`
                        : ""}
                    </p>
                  ) : null}
                  {item.nutritionalInterpretation ??
                  item.reasonForRequest ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.nutritionalInterpretation ??
                        item.reasonForRequest}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ) : null;

      return (
        <Section key={section} title="Exames">
          <div className="grid gap-4 lg:grid-cols-2">
            {examGroup("Exames avaliados", evaluated)}
            {examGroup("Exames solicitados para o retorno", requested)}
            {examGroup("Exames em monitoramento", monitoring)}
          </div>
        </Section>
      );
    }

    if (section === "guidance") {
      const groups = groupInterpretiveGuidance(draft.guidance);
      const professionalNotes = [
        {
          id: "professional-considerations",
          title: "Considerações do profissional",
          content: draft.professionalNotes?.considerations.trim() ?? "",
        },
        {
          id: "professional-orientations",
          title: "Orientações profissionais registradas",
          content: draft.professionalNotes?.orientations.trim() ?? "",
        },
      ].filter((item) => item.content);
      if (!groups.length && !professionalNotes.length) return null;

      return (
        <Section
          key={section}
          description="Análise individualizada construída somente com orientações clínicas aprovadas e registradas no atendimento."
          title="Análise Nutricional Interpretativa"
        >
          <div className="space-y-4">
            {groups.map((group) => (
              <article
                className="guidance-card report-card rounded-2xl border border-[#dfe7e3] bg-[#fbfdfc] p-4 sm:p-5"
                key={group.id}
              >
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
                  {group.title}
                </p>

                <div className="mt-4 space-y-4">
                  {group.items.map((guidance) => (
                    <div key={guidance.id}>
                      {group.items.length > 1 ? (
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          {guidance.category}
                        </p>
                      ) : null}
                      <div className="mt-1 space-y-3 text-sm leading-7 text-[#40564e]">
                        {guidance.content
                          .split(/\n{2,}/)
                          .map((paragraph) => paragraph.trim())
                          .filter(Boolean)
                          .map((paragraph, paragraphIndex) => (
                            <p
                              className="guidance-paragraph"
                              key={`${guidance.id}:paragraph:${paragraphIndex}`}
                            >
                              {paragraph}
                            </p>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {professionalNotes.map((note) => (
              <article
                className="guidance-card report-card rounded-2xl border border-[#dfe7e3] bg-[#fbfdfc] p-4 sm:p-5"
                key={note.id}
              >
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#a17d2e]">
                  {note.title}
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[#40564e]">
                  {note.content
                    .split(/\n{2,}/)
                    .map((paragraph) => paragraph.trim())
                    .filter(Boolean)
                    .map((paragraph, paragraphIndex) => (
                      <p key={`${note.id}:paragraph:${paragraphIndex}`}>
                        {paragraph}
                      </p>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "goals") {
      if (!draft.goals.length) return null;

      return (
        <Section key={section} title="Metas até o retorno">
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.goals.map((goal) => (
              <article
                className="report-card rounded-xl border border-[#dfe7e3] p-4"
                key={goal.id}
              >
                <p className="font-black text-[#173c30]">
                  {goal.description}
                </p>
                <dl className="mt-3 space-y-2 text-sm text-[#40564e]">
                  {goal.indicator ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Indicador
                      </dt>
                      <dd>{goal.indicator}</dd>
                    </div>
                  ) : null}
                  {goal.deadline ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Prazo
                      </dt>
                      <dd>{goal.deadline}</dd>
                    </div>
                  ) : null}
                  {goal.observation ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Observação
                      </dt>
                      <dd>{goal.observation}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </Section>
      );
    }

    if (section === "finalMessage") {
      const finalMessage = draft.finalMessage;
      if (!finalMessage?.approved || !finalMessage.content.trim()) return null;

      return (
        <Section key={section} title="Mensagem final">
          <div className="rounded-2xl bg-[#f7faf8] p-5">
            <p className="whitespace-pre-line text-sm leading-7 text-[#40564e]">
              {finalMessage.content}
            </p>
          </div>
        </Section>
      );
    }

    return null;
  }

  return (
    <div className="min-w-0">
      <div
        aria-live="polite"
        className={`${focused && isReadOnly && !printMode && exportState === "IDLE" ? "sr-only" : "mb-4 rounded-2xl border border-[#d6e4de] bg-[#f5f9f7] px-4 py-3 text-sm font-medium text-[#31584b] shadow-sm print:hidden"}`}
      >
        {message}
      </div>

      <div className={focused && isReadOnly && !printMode
        ? "mb-4 flex justify-end print:hidden"
        : "sticky top-16 z-20 mb-5 flex flex-col gap-4 rounded-2xl border border-[#dce5e0] bg-white/95 p-4 shadow-md backdrop-blur print:hidden lg:top-[4.5rem] lg:flex-row lg:items-center lg:justify-between"}>
        {!focused || !isReadOnly || printMode ? (
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList
              aria-hidden="true"
              className="text-[#17644c]"
              size={19}
            />
            <p className="text-base font-black text-[#183029]">
              {sourcePlanDraftPreview
                ? `Prévia do rascunho do Plano Alimentar · revisão ${officialVersion}`
                : isReadOnly
                ? `${isFinalizedMealPlan ? "Plano Alimentar" : "Relatório Nutricional"} oficial · versão ${officialVersion}`
                : "Conferência do Entregável Nutricional Completo"}
            </p>
            {isReadOnly ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                {sourcePlanDraftPreview ? "Rascunho de teste" : "Documento salvo"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {sourcePlanDraftPreview
              ? "Prévia congelada a partir do rascunho reaberto. Imprimir ou baixar não cria versão oficial."
              : isReadOnly
              ? "Visualização congelada. Imprimir ou baixar não cria nova versão nem grava alterações."
              : "Conteúdo completo montado com os registros deste atendimento. A visualização e a impressão da prévia não publicam nem alteram o documento."}
          </p>
          <p className="mt-1 break-all text-[11px] text-slate-400">
            Documento: Relatório Nutricional · Atendimento: {draft.attendanceId}
          </p>
          <p
            aria-live="polite"
            className={`mt-2 text-xs font-bold ${
              exportState === "ERROR" ? "text-red-700" : "text-[#31584b]"
            }`}
            role={exportState === "ERROR" ? "alert" : "status"}
          >
            {message}
          </p>
          {!isReadOnly && !canSaveOfficial ? (
            <p className="mt-2 max-w-2xl text-xs font-bold text-amber-800" role="alert">
              Não é possível gerar um documento fiel: {documentPendings.join("; ")}.{" "}
              <Link
                className="underline underline-offset-2"
                href={backHref}
              >
                Revisar o Plano Alimentar
              </Link>
            </p>
          ) : null}
        </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {printMode && isReadOnly ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8cec5] bg-white px-4 text-xs font-black text-[#0a4938]"
              href={`/clinica/plano-alimentar/entregavel?${new URLSearchParams({
                patientId: draft.patientId,
                attendanceId: draft.attendanceId,
                view: sourcePlanDraftPreview ? "meal-plan-draft" : isFinalizedMealPlan ? "meal-plan" : "nutrition",
                ...(sourcePlanDraftPreview
                  ? { entryId: sourceEntryId ?? "" }
                  : isFinalizedMealPlan
                  ? { entryId: sourceEntryId ?? "", versionId: sourceVersionId ?? "" }
                  : { deliverableId: officialDocumentId ?? "" }),
              }).toString()}`}
            >
              Voltar ao documento
            </Link>
          ) : null}
          {!focused && !isReadOnly ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#b8cec5] bg-white px-4 text-xs font-black text-[#0a4938]"
            href={backHref}
          >
            Voltar ao Plano
          </Link>
          ) : null}

          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0d4f3b] bg-gradient-to-b from-[#1a775c] to-[#0f5d47] px-5 text-xs font-black text-white shadow-[0_5px_0_#0a4938,0_10px_20px_rgba(10,73,56,0.24)] transition-all duration-150 hover:-translate-y-0.5 hover:from-[#218267] hover:to-[#12664f] hover:shadow-[0_7px_0_#0a4938,0_14px_24px_rgba(10,73,56,0.28)] active:translate-y-1 active:shadow-[0_1px_0_#0a4938,0_4px_10px_rgba(10,73,56,0.2)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55 disabled:shadow-none"
            disabled={(!isReadOnly && !canSaveOfficial) || exportState === "GENERATING"}
            onClick={() => {
              if (printMode) window.print();
              else if (isReadOnly) openReadOnlyDocument("PRINT");
              else void persistOfficialReport();
            }}
            type="button"
          >
            {exportState === "GENERATING" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              isReadOnly ? (
                <Printer aria-hidden="true" size={16} />
              ) : (
                <Save aria-hidden="true" size={16} />
              )
            )}
            {exportState === "GENERATING"
              ? "Salvando relatório..."
              : isReadOnly ? "Imprimir" : "Salvar relatório"}
          </button>
          {!isReadOnly && !printMode ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b8cec5] bg-white px-5 text-xs font-black text-[#0a4938]"
              onClick={() => {
                setMessage(
                  "Imprimindo a prévia completa sem publicar ou salvar o relatório.",
                );
                window.print();
              }}
              type="button"
            >
              <Printer aria-hidden="true" size={16} />
              Imprimir prévia completa
            </button>
          ) : null}
          {isReadOnly && !printMode ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b8cec5] bg-white px-5 text-xs font-black text-[#0a4938] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={exportState === "GENERATING"}
              onClick={() => openReadOnlyDocument("SAVE_PDF")}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Salvar em PDF
            </button>
          ) : null}
        </div>
      </div>

      {draft.warnings.length ? (
        <section
          aria-labelledby="nutrition-deliverable-technical-warnings"
          className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 print:hidden"
        >
          <h2
            className="text-xs font-black uppercase tracking-wide"
            id="nutrition-deliverable-technical-warnings"
          >
            Avisos para conferência profissional
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {draft.mealPlan ? (
        <details className="mb-5 rounded-2xl border border-[#d8e4dc] bg-white p-4 text-[#31584b] shadow-sm print:hidden">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17644c]">
            Dados técnicos do plano para conferência profissional
          </summary>
          <div className="mt-4 space-y-4 text-xs leading-5">
            <NutritionCompletenessDetails plan={draft.mealPlan} />
            {draft.mealPlan.meals.map((meal) => (
              <section key={`technical:${meal.id}`}>
                <h3 className="font-black text-[#183029]">
                  {meal.name}{meal.time ? ` · ${meal.time}` : ""}
                </h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">
                  {deliverableMealItems(meal).map((item) => (
                    <li className="break-words" key={`technical:${item.id}`}>
                      {item.itemType === "RECIPE" ? (
                        <>
                          <span className="font-bold">{item.recipeTitle}</span>
                          {` · ${formatHouseholdMeasureQuantity(item.portion.prescribedServings, "porção")} · ${item.portion.description} · snapshot ${item.recipeNutritionSnapshotId} v${item.recipeNutritionSnapshotVersion} · nutrição ${item.nutritionCompleteness === "COMPLETE" ? "completa" : "parcial"}`}
                        </>
                      ) : (
                        <>
                          <span className="font-bold">{item.name}</span>
                          {` · ${formatFoodTechnicalDetails(item)}`}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      ) : null}

      {!isReadOnly ? (
        <section className="mb-5 rounded-2xl border border-[#d8e4dc] bg-white p-4 shadow-sm print:hidden">
          <div>
            <h2 className="text-sm font-black text-[#183029]">
              Considerações e orientações profissionais
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Estes campos pertencem somente a este relatório. Eles não alteram a Estratégia
              Nutricional, o Plano Alimentar ou seus snapshots. Nenhum texto é criado
              automaticamente em nome do profissional.
            </p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-xs font-bold text-[#31584b]" htmlFor="professional-considerations">
              Considerações do profissional
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-[#cbded3] bg-white p-3 text-sm font-normal leading-6 text-[#183029] outline-none focus-visible:ring-2 focus-visible:ring-[#17644c]"
                id="professional-considerations"
                onChange={(event) => updateProfessionalNote("considerations", event.currentTarget.value)}
                placeholder="Nenhuma consideração profissional registrada para este relatório."
                value={draft.professionalNotes?.considerations ?? ""}
              />
            </label>
            <label className="text-xs font-bold text-[#31584b]" htmlFor="professional-orientations">
              Orientações para a paciente
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-[#cbded3] bg-white p-3 text-sm font-normal leading-6 text-[#183029] outline-none focus-visible:ring-2 focus-visible:ring-[#17644c]"
                id="professional-orientations"
                onChange={(event) => updateProfessionalNote("orientations", event.currentTarget.value)}
                placeholder="Nenhuma orientação adicional registrada para este relatório."
                value={draft.professionalNotes?.orientations ?? ""}
              />
            </label>
          </div>
          <button
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#17644c] px-4 text-xs font-black text-[#17644c] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!professionalNotesDirty}
            onClick={saveProfessionalNotesForReview}
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            Salvar textos na conferência
          </button>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Para persistir esses textos no serviço de Entregáveis, use “Salvar relatório”.
            Documentos oficiais existentes permanecem somente leitura.
          </p>
        </section>
      ) : null}

      {!isReadOnly ? (
      <section className="mb-5 rounded-2xl border border-[#d8e4dc] bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ClipboardList
              aria-hidden="true"
              className="text-[#17644c]"
              size={18}
            />
            <h2 className="text-sm font-black text-[#183029]">
              Conteúdo do Relatório
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Defina quais seções opcionais serão incluídas na prévia e no PDF.
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {hasClinicalDiagnosis ? (
            <button
              aria-pressed={Boolean(draft.includeClinicalDiagnosis)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                draft.includeClinicalDiagnosis
                  ? "border-[#b9d5c8] bg-[#eef7f2]"
                  : "border-[#e2e8e5] bg-white hover:bg-[#f8faf9]"
              }`}
              onClick={toggleClinicalDiagnosis}
              type="button"
            >
              <span className="text-xs font-black text-[#31584b]">
                Diagnóstico Clínico
                <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                  Seção opcional deste documento
                </span>
              </span>
              <span className="text-[10px] font-black uppercase text-[#17644c]">
                {draft.includeClinicalDiagnosis ? "Incluir" : "Omitir"}
              </span>
            </button>
          ) : (
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e2e8e5] bg-[#f8faf9] px-3 py-2.5">
              <span className="text-xs font-black text-[#31584b]">
                Diagnóstico Clínico
                <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                  Não registrado; a seção será omitida sem criar revisão clínica
                </span>
              </span>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-600">
                Omitido
              </span>
            </div>
          )}

          {REQUIRED_REPORT_SECTIONS.map((label) => (
            <div
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#dce7e1] bg-[#f6faf8] px-3 py-2.5"
              key={label}
            >
              <span className="text-xs font-black text-[#31584b]">
                {label}
              </span>
              <span className="rounded-full bg-[#dceee5] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#17644c]">
                Obrigatório
              </span>
            </div>
          ))}

          {draft.optionalSectionOrder.map((section) => {
            const enabled = Boolean(draft.enabledSections[section]);

            return (
              <button
                aria-pressed={enabled}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  enabled
                    ? "border-[#b9d5c8] bg-[#eef7f2]"
                    : "border-[#e2e8e5] bg-white hover:bg-[#f8faf9]"
                }`}
                key={section}
                onClick={() => toggleOptionalSection(section)}
                type="button"
              >
                <span
                  className={`text-xs font-black ${
                    enabled ? "text-[#214c3d]" : "text-slate-500"
                  }`}
                >
                  {OPTIONAL_SECTION_LABELS[section]}
                </span>

                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                    enabled ? "bg-[#17644c]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${
                      enabled ? "left-6" : "left-1"
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] leading-5 text-slate-400">
          Se uma seção estiver ativa, mas não possuir conteúdo aprovado,
          ela não será exibida no relatório.
        </p>
      </section>
      ) : null}

      <main
        className={focused
          ? "min-w-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none print:overflow-visible print:bg-white"
          : "min-w-0 overflow-hidden rounded-3xl border border-[#e5ece8] bg-white shadow-[0_6px_24px_rgba(23,60,48,0.06)] print:overflow-visible print:rounded-none print:border-0 print:shadow-none"}
        id="nutrition-deliverable-report"
      >
          <header className="report-cover relative overflow-hidden bg-[#fffefb] px-5 py-8 sm:px-8 sm:py-9">
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 h-full w-[34%] bg-gradient-to-bl from-[#e3ead8] via-[#f0f4e9] to-transparent"
            />
            <div className="relative">
              <DeliverableDocumentHeader
                description={sourcePlanDraftPreview
                  ? "Prévia de conferência gerada diretamente do rascunho salvo e reaberto, sem publicação."
                  : isFinalizedMealPlan
                  ? "Prescrição alimentar oficial conforme a versão finalizada do atendimento."
                  : "Avaliação clínica, composição corporal, estratégia nutricional e plano alimentar integrados."}
                eyebrow={isFinalizedMealPlan ? "Plano Alimentar" : "Relatório Nutricional"}
                theme="nutrition"
                title={isFinalizedMealPlan ? "Individualizado" : "Personalizado"}
              />

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr]">
                <div className="rounded-2xl border border-[#dce7df] bg-white px-4 py-4 shadow-[0_6px_18px_rgba(23,60,48,0.06)]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a07e2c]">
                    Paciente
                  </p>
                  <p className="mt-1 text-xl font-black capitalize text-[#183f31]">
                    {draft.cover.patientName}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#dce7df] bg-[#f1f6ed] px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6d7f74]">
                    Emissão
                  </p>
                  <p className="mt-1 text-sm font-black text-[#183f31]">
                    {date(draft.cover.date)}
                  </p>
                </div>

                {draft.cover.attendanceDate ? (
                  <div className="rounded-2xl border border-[#dce7df] bg-[#f1f6ed] px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6d7f74]">
                      Consulta
                    </p>
                    <p className="mt-1 text-sm font-black text-[#183f31]">
                      {date(draft.cover.attendanceDate)}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-[#dce7df] bg-[#f1f6ed] px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6d7f74]">
                    Atendimento
                  </p>
                  <p className="mt-1 text-sm font-black text-[#183f31]">
                    {draft.cover.attendanceType}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {!isFinalizedMealPlan && draft.includeClinicalDiagnosis ? (
          <Section
            description="Síntese nutricional construída exclusivamente com os dados registrados no atendimento."
            title="Diagnóstico Clínico Geral"
          >
            {diagnosisSections.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {diagnosisSections.map((section) => (
                  <article
                    className={`pdf-avoid-break rounded-2xl border border-[#d8e4dc] bg-white p-4 shadow-[0_7px_20px_rgba(23,60,48,0.05)] sm:p-5 ${
                      section.id === "objective" ||
                      section.id === "clinical-conditions" ||
                      section.id === "approved-strategy"
                        ? "sm:col-span-2"
                        : ""
                    }`}
                    key={section.id}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#a17d2e]">
                      {section.title}
                    </p>
                    <div className="mt-2 h-1 w-12 rounded-full bg-[#c9d9c8]" />
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#40564e]">
                      {section.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : draft.clinicalDiagnosis.content.trim() ? (
              <p className="whitespace-pre-line text-sm leading-7 text-[#40564e]">
                {draft.clinicalDiagnosis.content}
              </p>
            ) : (
              <EmptyMessage>
                A seção foi incluída, mas não possui conteúdo clínico registrado.
              </EmptyMessage>
            )}

            {draft.clinicalDiagnosis.sourceReferences.length ? (
              <p className="source-reference mt-4 text-[11px] text-slate-400">
                Fontes:{" "}
                {draft.clinicalDiagnosis.sourceReferences.join(" · ")}
              </p>
            ) : null}
          </Section>
          ) : null}

          {!isFinalizedMealPlan ? draft.optionalSectionOrder
            .filter((section) => section === "findings")
            .map(renderOptionalSection) : null}

          {!isFinalizedMealPlan ? (
          <Section title="Estratégia Nutricional aprovada">
            {draft.nutritionStrategy ? (
              <div className="strategy-panel rounded-3xl border border-[#c8ddd1] bg-gradient-to-br from-[#e9f3ed] via-[#f6faf7] to-[#e2eee7] p-5 text-[#183f31] shadow-[0_10px_28px_rgba(36,79,61,0.10)] sm:p-6">
                <div className="strategy-metrics grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Objetivo", draft.nutritionStrategy.objective],
                    ["Protocolo", draft.nutritionStrategy.protocol],
                    ["Método", draft.nutritionStrategy.method],
                    [
                      "GET",
                      `${format(
                        draft.nutritionStrategy.totalEnergyExpenditureKcal,
                        0,
                      )} kcal`,
                    ],
                    [
                      "Meta energética",
                      `${format(
                        draft.nutritionStrategy.totalEnergyValueKcal,
                        2,
                      )} kcal`,
                    ],
                    [
                      "Ajuste",
                      `${
                        draft.nutritionStrategy.calorieAdjustmentPercentage > 0
                          ? "+"
                          : ""
                      }${draft.nutritionStrategy.calorieAdjustmentPercentage}%`,
                    ],
                    [
                      "Proteínas",
                      `${format(
                        draft.nutritionStrategy.protein.grams,
                        2,
                      )} g · ${format(
                        draft.nutritionStrategy.protein.percentage,
                      )}%`,
                    ],
                    [
                      "Carboidratos",
                      `${format(
                        draft.nutritionStrategy.carbohydrates.grams,
                        2,
                      )} g · ${format(
                        draft.nutritionStrategy.carbohydrates.percentage,
                      )}%`,
                    ],
                    [
                      "Lipídios",
                      `${format(
                        draft.nutritionStrategy.fats.grams,
                        2,
                      )} g · ${format(
                        draft.nutritionStrategy.fats.percentage,
                      )}%`,
                    ],
                    [
                      "Meta de água",
                      draft.nutritionStrategy.waterMl
                        ? `${format(
                            draft.nutritionStrategy.waterMl,
                            0,
                          )} ml`
                        : "Não informado",
                    ],
                    [
                      "Meta de fibras",
                      draft.nutritionStrategy.fiberGrams
                        ? `${format(
                            draft.nutritionStrategy.fiberGrams,
                            2,
                          )} g`
                        : "Não informado",
                    ],
                    [
                      "Refeições",
                      String(draft.nutritionStrategy.mealCount),
                    ],
                  ].map(([label, value]) => (
                    <div
                      className="strategy-card rounded-2xl border border-[#cbded3] bg-white/80 p-3 shadow-[0_4px_12px_rgba(36,79,61,0.05)]"
                      key={label}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#9a7c2f]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-black text-[#183f31]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <EmptyMessage>
                Estratégia Nutricional aprovada ainda não disponível.
              </EmptyMessage>
            )}
          </Section>
          ) : null}

          <Section title={sourcePlanDraftPreview ? "Plano Alimentar em rascunho" : "Plano Alimentar aprovado"}>
            {draft.mealPlan ? (
              <div className="space-y-4">
                {draft.mealPlan.meals.map((meal) => (
                  <article
                    className="meal-card rounded-xl border border-[#d8e7e0] bg-white p-4 shadow-[0_4px_14px_rgba(23,60,48,0.04)]"
                    key={meal.id}
                  >
                    <div className="meal-header flex items-center justify-between gap-3 rounded-xl bg-[#365f4a] px-4 py-3 text-white">
                      <h3 className="font-black text-white">
                        {meal.name}
                      </h3>
                      {meal.time ? (
                        <time className="rounded-full bg-white/12 px-3 py-1 text-xs font-black text-[#f0d993]">
                          {meal.time}
                        </time>
                      ) : null}
                    </div>

                    <table className="meal-items mt-4 block overflow-hidden rounded-xl border border-[#e5ece8] sm:table">
                      <thead className="meal-table-head hidden bg-[#e7efe5] text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:table-header-group">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            Alimento ou preparação
                          </th>
                          <th className="px-4 py-3 text-right">Quantidade</th>
                        </tr>
                      </thead>

                      <tbody className="meal-table-body block divide-y divide-[#edf2ef] sm:table-row-group">
                        {deliverableMealItems(meal).map((item) => {
                          if (item.itemType === "RECIPE") {
                            return (
                              <tr className="meal-food-row block sm:table-row" key={item.id}>
                                <td className="block px-4 py-4 sm:table-cell" colSpan={2}>
                                  <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
                                    <div>
                                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8a6a25]">
                                        Receita
                                      </span>
                                      <span className="font-bold leading-6 text-[#40564e]">
                                        {item.recipeTitle}
                                      </span>
                                    </div>
                                    <div className="sm:text-right">
                                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400 sm:hidden">
                                        Quantidade
                                      </span>
                                      <span className="whitespace-nowrap font-bold text-[#40564e]">
                                        {formatHouseholdMeasureQuantity(
                                          item.portion.prescribedServings,
                                          "porção",
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          const food = item;
                          return (
                            <tr
                              className="meal-food-row block text-sm sm:table-row"
                              key={food.id}
                            >
                              <td className="block px-4 pb-2 pt-4 align-middle sm:table-cell sm:py-4">
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400 sm:hidden">
                                  Alimento ou preparação
                                </span>
                                <span className="font-bold leading-6 text-[#40564e]">
                                  {food.name}
                                </span>
                                {food.substitutions?.length ? (
                                  <div className="mt-2 rounded-lg border border-[#d8e7e0] bg-[#f4f8f5] px-3 py-2 text-xs leading-5 text-[#40564e]">
                                    <span className="block font-black text-[#31584b]">
                                      Opção de substituição
                                    </span>
                                    {food.substitutions.map((substitution) => (
                                      <span className="block" key={substitution.id}>
                                        {substitution.name} — {formatSubstitutionQuantity(substitution)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </td>

                              <td className="block px-4 pb-4 pt-2 align-middle sm:table-cell sm:py-4 sm:text-right">
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400 sm:hidden">
                                  Quantidade
                                </span>
                                <span className="whitespace-nowrap font-bold text-[#40564e]">
                                  {formatFoodQuantity(food)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {meal.observations ? (
                      <p className="meal-observation mt-2 text-xs italic text-slate-500">
                        {meal.observations}
                      </p>
                    ) : null}
                  </article>
                ))}

                <DeliverableNutritionTotals plan={draft.mealPlan} />
              </div>
            ) : (
              <EmptyMessage>
                Plano Alimentar aprovado ainda não disponível.
              </EmptyMessage>
            )}
          </Section>

          {draft.mealPlan?.recipes?.length ? (
            <Section
              description="Receitas completas congeladas nas versões utilizadas neste plano. Os ingredientes correspondem ao rendimento total, sem redução para a porção prescrita."
              title="Receitas do seu plano"
            >
              <div className="space-y-4">
                {draft.mealPlan.recipes.map((recipe) => (
                  <DeliverableRecipeCard
                    key={`${recipe.recipeId}:${recipe.recipeNutritionSnapshotId}`}
                    recipe={recipe}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {!isFinalizedMealPlan ? draft.optionalSectionOrder
            .filter((section) => section !== "findings")
            .map(renderOptionalSection) : null}

          <footer className="report-footer border-t border-[#cbd9cf] bg-[#f1f5ec] px-5 py-3 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[10px] text-[#486159]">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-[#123f32] text-[9px] font-black tracking-wider text-[#e8cf7e]">
                  SV
                </div>
                <div>
                  <p className="font-black text-[#173c30]">
                    {draft.cover.professionalName}
                  </p>
                  <p>
                    {draft.cover.registrations.length
                      ? draft.cover.registrations.join(" · ")
                      : "Registro profissional não informado"}
                  </p>
                </div>
              </div>

              <InstitutionalDocumentIdentity className="max-w-[118mm]" compact />
            </div>
          </footer>
      </main>
    </div>
  );
}

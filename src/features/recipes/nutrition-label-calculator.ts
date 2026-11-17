import type {
  RecipeNutritionSnapshotDraft,
  ScientificNutrientValue,
} from "./nutrition-calculator";

export const NUTRITION_LABEL_RULES = {
  id: "ANVISA_RDC_429_2020_IN_75_2020",
  verifiedAt: "2026-10-16",
  references: [
    {
      title: "RDC Anvisa nº 429/2020",
      url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/RDC_429_2020_.pdf",
    },
    {
      title: "IN Anvisa nº 75/2020",
      url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/IN%2075_2020_.pdf",
    },
    {
      title: "Retificações publicadas em 13/10/2022",
      url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2022/rotulagem-nutricional-confira-as-retificacoes-das-normas/",
    },
    {
      title: "Orientações oficiais da Anvisa sobre rotulagem nutricional",
      url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/rotulagem/rotulagem-nutricional",
    },
    {
      title: "Perguntas e respostas sobre rotulagem nutricional — 4ª edição",
      url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2024/anvisa-publica-nova-edicao-do-documento-de-perguntas-e-respostas-sobre-rotulagem-nutricional",
    },
  ],
} as const;

export const NUTRITION_LABEL_NUTRIENT_KEYS = [
  "energyKcal",
  "energyKj",
  "carbohydratesGrams",
  "totalSugarsGrams",
  "addedSugarsGrams",
  "proteinGrams",
  "totalFatsGrams",
  "saturatedFatsGrams",
  "transFatsGrams",
  "fiberGrams",
  "sodiumMg",
] as const;

export type NutritionLabelNutrientKey =
  (typeof NUTRITION_LABEL_NUTRIENT_KEYS)[number];
export type NutritionLabelBasisUnit = "GRAM" | "MILLILITER";
export type CommercialProductPhysicalType = "SOLID" | "SEMISOLID" | "LIQUID";
export type CriticalFrontNutrient =
  | "addedSugarsGrams"
  | "saturatedFatsGrams"
  | "sodiumMg";

export type NutritionLabelSnapshotInput = Partial<
  Omit<RecipeNutritionSnapshotDraft, "additionalNutrients">
> & {
  readonly id?: string;
  readonly recipeId?: string;
  readonly version?: number;
  readonly calculatedAt?: string | Date;
  readonly additionalNutrients?:
    | {
        readonly energyKj?: ScientificNutrientValue | number | null;
      }
    | null;
};

export interface NutritionLabelProductInput {
  readonly id?: string;
  readonly physicalType?: CommercialProductPhysicalType | null;
  readonly category?: string | null;
  readonly netContent?: number | null;
  readonly netContentUnit?: NutritionLabelBasisUnit | null;
  readonly servingsPerPackage?: number | null;
  readonly servingSize?: number | null;
  readonly servingSizeUnit?: NutritionLabelBasisUnit | null;
  readonly servingHouseholdMeasure?: string | null;
  /** Confirma como a porção foi definida; a categoria não é inferida pelo calculador. */
  readonly servingReference?: {
    readonly source: "IN_75_ANNEX_V" | "RDC_429_ARTICLE_9";
    readonly reference: string;
    readonly confirmed: boolean;
  } | null;
  /** Revisão das exigências adicionais do art. 5º, II a XIII, da RDC 429/2020. */
  readonly additionalMandatoryNutrientsReview?: {
    readonly reviewed: boolean;
    readonly missingNutrientsOrInformation: readonly string[];
  } | null;
  /** A aplicação de regras especiais nunca é presumida a partir do nome/categoria. */
  readonly nutritionTableContext?:
    | {
        readonly kind: "GENERAL_FOOD";
        readonly calculationBasis: "AS_SOLD";
      }
    | {
        readonly kind: "GENERAL_FOOD";
        readonly calculationBasis: "PREPARED_AS_DIRECTED";
        readonly snapshotIncludesAddedPreparationIngredients: boolean;
      }
    | {
        readonly kind: "SPECIAL_REGULATION";
        readonly reference: string;
      }
    | null;
  /**
   * Confirma as condições adicionais do Anexo IV da IN 75/2020. A chave só
   * precisa ser informada quando o nutriente pode ser expresso como zero.
   */
  readonly nonSignificantZeroEligibility?: Partial<
    Readonly<
      Record<
        | "carbohydratesGrams"
        | "totalSugarsGrams"
        | "addedSugarsGrams"
        | "proteinGrams"
        | "totalFatsGrams",
        boolean
      >
    >
  >;
  readonly frontOfPack?: {
    readonly applicability:
      | "STANDARD"
      | "PROHIBITED"
      | "OPTIONAL"
      | "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6";
    readonly reason: string;
    /** Obrigatório no modo condicional: somente estes nutrientes são avaliáveis. */
    readonly nutrientsAlteredByAddedIngredients?: readonly CriticalFrontNutrient[];
    readonly basis:
      | { readonly kind: "AS_SOLD" }
      | {
          readonly kind: "PREPARED_AS_DIRECTED_EXCLUDING_ADDED_INGREDIENTS";
          readonly nutrientsPer100: Partial<
            Readonly<Record<CriticalFrontNutrient, number | null>>
          >;
        };
  } | null;
}

export interface NutritionLabelCalculationInput {
  readonly snapshot: NutritionLabelSnapshotInput;
  readonly product: NutritionLabelProductInput;
}

export interface NutritionLabelPending {
  readonly code:
    | "INVALID_SNAPSHOT_BASIS"
    | "MISSING_NUTRIENT"
    | "MISSING_PRODUCT_DATA"
    | "UNIT_MISMATCH"
    | "MISSING_SERVING_REFERENCE"
    | "MISSING_ADDITIONAL_MANDATORY_NUTRIENT_REVIEW"
    | "MISSING_HOUSEHOLD_MEASURE"
    | "MISSING_TABLE_CONTEXT"
    | "UNSUPPORTED_SPECIAL_REGULATION"
    | "MISSING_PREPARED_PRODUCT_BASIS"
    | "MISSING_NON_SIGNIFICANT_CONTEXT"
    | "MISSING_FRONT_OF_PACK_CONTEXT"
    | "MISSING_FRONT_OF_PACK_BASIS";
  readonly message: string;
  readonly blockingFor: readonly (
    | "CALCULATION"
    | "LABEL_EMISSION"
    | "FRONT_OF_PACK"
  )[];
  readonly nutrient?: NutritionLabelNutrientKey;
  readonly field?: string;
}

export interface PresentedNutritionValue {
  readonly value: number;
  readonly text: string;
  readonly expressedAsZero: boolean;
}

export interface CalculatedLabelNutrient {
  readonly unit: "kcal" | "kJ" | "g" | "mg";
  readonly sourceTotal: number | null;
  readonly raw: {
    readonly per100: number | null;
    readonly perServing: number | null;
    readonly dailyValuePercent: number | null;
  };
  readonly presentation: {
    readonly per100: PresentedNutritionValue | null;
    readonly perServing: PresentedNutritionValue | null;
    readonly dailyValuePercent: PresentedNutritionValue | null;
  };
  readonly dailyValueReference: number | null;
}

export interface FrontOfPackNutrientAssessment {
  readonly threshold: number;
  readonly unit: "g" | "mg";
  readonly rawPer100: number | null;
  readonly meetsThreshold: boolean | null;
  readonly declaration: "REQUIRED" | "NOT_REQUIRED" | "OPTIONAL" | "PROHIBITED" | "UNDETERMINED";
}

export interface NutritionLabelCalculationResult {
  readonly rules: typeof NUTRITION_LABEL_RULES;
  readonly calculationStatus: "UNAVAILABLE" | "PARTIAL" | "COMPLETE";
  readonly labelEmission: {
    readonly sufficientInformation: boolean;
    readonly regulatoryApproval: false;
  };
  readonly basis: {
    readonly amount: 100;
    readonly unit: NutritionLabelBasisUnit;
    readonly finalYieldAmount: number;
    readonly finalYieldUnit: NutritionLabelBasisUnit;
    readonly servingSize: number;
    readonly servingSizeUnit: NutritionLabelBasisUnit;
    readonly servingsPerPackage: number;
    readonly householdMeasure: string | null;
  } | null;
  readonly nutrients: Readonly<
    Record<NutritionLabelNutrientKey, CalculatedLabelNutrient>
  >;
  readonly frontOfPack: {
    readonly status: "ASSESSED" | "NOT_APPLICABLE" | "UNAVAILABLE";
    readonly applicability:
      | "STANDARD"
      | "PROHIBITED"
      | "OPTIONAL"
      | "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6"
      | null;
    readonly reason: string | null;
    readonly nutrients: Readonly<
      Record<CriticalFrontNutrient, FrontOfPackNutrientAssessment>
    >;
  };
  readonly pendings: readonly NutritionLabelPending[];
  readonly traceability: {
    readonly snapshotId: string | null;
    readonly recipeId: string | null;
    readonly snapshotVersion: number | null;
    readonly snapshotCalculatedAt: string | null;
    readonly productId: string | null;
    readonly ingredientCount: number | null;
    readonly totalIngredientMassGrams: number | null;
    readonly totalIngredientVolumeMilliliters: number | null;
  };
}

const NUTRIENT_META: Readonly<
  Record<
    NutritionLabelNutrientKey,
    {
      readonly unit: CalculatedLabelNutrient["unit"];
      readonly snapshotField?: keyof RecipeNutritionSnapshotDraft;
      readonly dailyValue: number | null;
      readonly insignificantAtOrBelow: number | null;
      readonly zeroRequiresConfirmation: boolean;
    }
  >
> = {
  energyKcal: {
    unit: "kcal",
    snapshotField: "energyKcal",
    dailyValue: 2_000,
    insignificantAtOrBelow: 4,
    zeroRequiresConfirmation: false,
  },
  energyKj: {
    unit: "kJ",
    dailyValue: null,
    insignificantAtOrBelow: null,
    zeroRequiresConfirmation: false,
  },
  carbohydratesGrams: {
    unit: "g",
    snapshotField: "carbohydratesGrams",
    dailyValue: 300,
    insignificantAtOrBelow: 0.5,
    zeroRequiresConfirmation: true,
  },
  totalSugarsGrams: {
    unit: "g",
    snapshotField: "sugarsGrams",
    dailyValue: null,
    insignificantAtOrBelow: 0.5,
    zeroRequiresConfirmation: true,
  },
  addedSugarsGrams: {
    unit: "g",
    snapshotField: "addedSugarsGrams",
    dailyValue: 50,
    insignificantAtOrBelow: 0,
    zeroRequiresConfirmation: true,
  },
  proteinGrams: {
    unit: "g",
    snapshotField: "proteinGrams",
    dailyValue: 50,
    insignificantAtOrBelow: 0.5,
    zeroRequiresConfirmation: true,
  },
  totalFatsGrams: {
    unit: "g",
    snapshotField: "fatsGrams",
    dailyValue: 65,
    insignificantAtOrBelow: 0.5,
    zeroRequiresConfirmation: true,
  },
  saturatedFatsGrams: {
    unit: "g",
    snapshotField: "saturatedFatsGrams",
    dailyValue: 20,
    insignificantAtOrBelow: 0.1,
    zeroRequiresConfirmation: false,
  },
  transFatsGrams: {
    unit: "g",
    snapshotField: "transFatsGrams",
    dailyValue: 2,
    insignificantAtOrBelow: 0.1,
    zeroRequiresConfirmation: false,
  },
  fiberGrams: {
    unit: "g",
    snapshotField: "fiberGrams",
    dailyValue: 25,
    insignificantAtOrBelow: 0.5,
    zeroRequiresConfirmation: false,
  },
  sodiumMg: {
    unit: "mg",
    snapshotField: "sodiumMg",
    dailyValue: 2_000,
    insignificantAtOrBelow: 5,
    zeroRequiresConfirmation: false,
  },
};

const ZERO_CONFIRMATION_KEYS = new Set<NutritionLabelNutrientKey>([
  "carbohydratesGrams",
  "totalSugarsGrams",
  "addedSugarsGrams",
  "proteinGrams",
  "totalFatsGrams",
]);

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nutrientTotal(
  snapshot: NutritionLabelSnapshotInput,
  key: NutritionLabelNutrientKey,
) {
  if (key === "energyKj") {
    const energyKj = snapshot.additionalNutrients?.energyKj;
    if (finiteNonNegative(energyKj)) return energyKj;
    if (
      energyKj &&
      typeof energyKj === "object" &&
      energyKj.status === "VALUE" &&
      finiteNonNegative(energyKj.value)
    ) {
      return energyKj.value;
    }
    return null;
  }

  const field = NUTRIENT_META[key].snapshotField;
  const value = field ? snapshot[field] : null;
  return finiteNonNegative(value) ? value : null;
}

function roundHalfUp(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function presentQuantity(
  value: number,
  unit: CalculatedLabelNutrient["unit"],
  forceZero: boolean,
): PresentedNutritionValue {
  if (forceZero) return { value: 0, text: "0", expressedAsZero: true };

  if (unit === "kcal" || unit === "kJ") {
    const rounded = roundHalfUp(value, 0);
    return { value: rounded, text: String(rounded), expressedAsZero: false };
  }

  if (value >= 10) {
    const rounded = roundHalfUp(value, 0);
    return { value: rounded, text: String(rounded), expressedAsZero: false };
  }

  if (value >= 1) {
    const rounded = roundHalfUp(value, 1);
    return {
      value: rounded,
      text: Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1),
      expressedAsZero: false,
    };
  }

  const rounded = roundHalfUp(value, 2);
  const text =
    unit === "g"
      ? rounded.toFixed(2)
      : rounded * 10 === Math.trunc(rounded * 10)
        ? rounded.toFixed(1)
        : rounded.toFixed(2);
  return { value: rounded, text, expressedAsZero: false };
}

function presentDailyValue(value: number): PresentedNutritionValue {
  const rounded = roundHalfUp(value, 0);
  return { value: rounded, text: String(rounded), expressedAsZero: false };
}

function isoDate(value: string | Date | undefined) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function emptyNutrient(
  key: NutritionLabelNutrientKey,
): CalculatedLabelNutrient {
  return {
    unit: NUTRIENT_META[key].unit,
    sourceTotal: null,
    raw: { per100: null, perServing: null, dailyValuePercent: null },
    presentation: { per100: null, perServing: null, dailyValuePercent: null },
    dailyValueReference: NUTRIENT_META[key].dailyValue,
  };
}

function frontThresholds(physicalType: CommercialProductPhysicalType) {
  const liquid = physicalType === "LIQUID";
  return {
    addedSugarsGrams: { threshold: liquid ? 7.5 : 15, unit: "g" as const },
    saturatedFatsGrams: { threshold: liquid ? 3 : 6, unit: "g" as const },
    sodiumMg: { threshold: liquid ? 300 : 600, unit: "mg" as const },
  };
}

export function calculateNutritionLabel(
  input: NutritionLabelCalculationInput,
): NutritionLabelCalculationResult {
  const { snapshot, product } = input;
  const pendings: NutritionLabelPending[] = [];
  const expectedUnit: NutritionLabelBasisUnit | null =
    product.physicalType === "LIQUID"
      ? "MILLILITER"
      : product.physicalType === "SOLID" || product.physicalType === "SEMISOLID"
        ? "GRAM"
        : null;

  const finalYieldAmount = finitePositive(snapshot.finalYieldAmount)
    ? snapshot.finalYieldAmount
    : null;
  const servingSize = finitePositive(product.servingSize)
    ? product.servingSize
    : null;
  const servingsPerPackage = finitePositive(product.servingsPerPackage)
    ? product.servingsPerPackage
    : null;
  const householdMeasure = product.servingHouseholdMeasure?.trim() || null;
  const basisUnit = snapshot.calculationBasisUnit ?? null;
  const finalYieldUnit = snapshot.finalYieldUnit ?? null;
  const servingSizeUnit = product.servingSizeUnit ?? null;

  if (
    !finalYieldAmount ||
    snapshot.calculationBasisAmount !== 100 ||
    !basisUnit ||
    !finalYieldUnit
  ) {
    pendings.push({
      code: "INVALID_SNAPSHOT_BASIS",
      message: "O snapshot precisa informar rendimento final positivo e base explícita de 100 g ou 100 ml.",
      blockingFor: ["CALCULATION", "LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }

  if (!expectedUnit) {
    pendings.push({
      code: "MISSING_PRODUCT_DATA",
      field: "physicalType",
      message: "Informe o tipo físico do produto; sólido, semissólido ou líquido não é inferido.",
      blockingFor: ["CALCULATION", "LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }

  if (!servingSize || !servingSizeUnit || !servingsPerPackage) {
    pendings.push({
      code: "MISSING_PRODUCT_DATA",
      field: "servingSize/servingSizeUnit/servingsPerPackage",
      message: "Informe porção, unidade da porção e número de porções por embalagem.",
      blockingFor: ["CALCULATION", "LABEL_EMISSION"],
    });
  }

  if (!finitePositive(product.netContent) || !product.netContentUnit) {
    pendings.push({
      code: "MISSING_PRODUCT_DATA",
      field: "netContent/netContentUnit",
      message: "Informe o conteúdo líquido e sua unidade.",
      blockingFor: ["LABEL_EMISSION"],
    });
  }

  const units = [basisUnit, finalYieldUnit, servingSizeUnit].filter(Boolean);
  if (expectedUnit && units.some((unit) => unit !== expectedUnit)) {
    pendings.push({
      code: "UNIT_MISMATCH",
      message: "As unidades da base, do rendimento e da porção devem corresponder ao tipo físico; nenhuma conversão entre massa e volume foi presumida.",
      blockingFor: ["CALCULATION", "LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }
  if (
    expectedUnit &&
    product.netContentUnit &&
    product.netContentUnit !== expectedUnit
  ) {
    pendings.push({
      code: "UNIT_MISMATCH",
      field: "netContentUnit",
      message: "A unidade do conteúdo líquido deve corresponder ao tipo físico; densidade não foi presumida.",
      blockingFor: ["LABEL_EMISSION"],
    });
  }

  if (!householdMeasure) {
    pendings.push({
      code: "MISSING_HOUSEHOLD_MEASURE",
      field: "servingHouseholdMeasure",
      message: "Informe a medida caseira correspondente à porção.",
      blockingFor: ["LABEL_EMISSION"],
    });
  }

  if (!product.category?.trim() || !product.servingReference?.confirmed) {
    pendings.push({
      code: "MISSING_SERVING_REFERENCE",
      field: "category/servingReference",
      message: "Confirme a categoria e a origem regulatória usada para definir a porção.",
      blockingFor: ["LABEL_EMISSION"],
    });
  }

  if (!product.additionalMandatoryNutrientsReview?.reviewed) {
    pendings.push({
      code: "MISSING_ADDITIONAL_MANDATORY_NUTRIENT_REVIEW",
      field: "additionalMandatoryNutrientsReview",
      message: "Revise se a categoria, ingredientes, alegações ou regras específicas exigem nutrientes adicionais.",
      blockingFor: ["LABEL_EMISSION"],
    });
  } else {
    for (const missing of product.additionalMandatoryNutrientsReview
      .missingNutrientsOrInformation) {
      pendings.push({
        code: "MISSING_ADDITIONAL_MANDATORY_NUTRIENT_REVIEW",
        field: missing,
        message: `Informação adicional obrigatória pendente: ${missing}.`,
        blockingFor: ["LABEL_EMISSION"],
      });
    }
  }

  if (!product.nutritionTableContext) {
    pendings.push({
      code: "MISSING_TABLE_CONTEXT",
      message: "Informe a aplicabilidade da tabela e se os valores representam o produto tal como exposto à venda ou pronto para consumo.",
      blockingFor: ["LABEL_EMISSION"],
    });
  } else if (product.nutritionTableContext.kind === "SPECIAL_REGULATION") {
    pendings.push({
      code: "UNSUPPORTED_SPECIAL_REGULATION",
      message: `A regra especial ${product.nutritionTableContext.reference} exige tratamento próprio antes da emissão.`,
      blockingFor: ["LABEL_EMISSION"],
    });
  } else if (
    product.nutritionTableContext.calculationBasis === "PREPARED_AS_DIRECTED" &&
    !product.nutritionTableContext.snapshotIncludesAddedPreparationIngredients
  ) {
    pendings.push({
      code: "MISSING_PREPARED_PRODUCT_BASIS",
      message: "O snapshot do alimento preparado deve incluir os nutrientes dos ingredientes adicionados conforme as instruções de preparo.",
      blockingFor: ["LABEL_EMISSION"],
    });
  }

  const canCalculate = Boolean(
    finalYieldAmount &&
      servingSize &&
      servingSizeUnit &&
      servingsPerPackage &&
      expectedUnit &&
      basisUnit === expectedUnit &&
      finalYieldUnit === expectedUnit &&
      servingSizeUnit === expectedUnit &&
      snapshot.calculationBasisAmount === 100,
  );
  const totals = Object.fromEntries(
    NUTRITION_LABEL_NUTRIENT_KEYS.map((key) => [key, nutrientTotal(snapshot, key)]),
  ) as Record<NutritionLabelNutrientKey, number | null>;

  for (const key of NUTRITION_LABEL_NUTRIENT_KEYS) {
    if (totals[key] === null) {
      pendings.push({
        code: "MISSING_NUTRIENT",
        nutrient: key,
        message: `${key} está ausente no snapshot; o valor não foi substituído por zero.`,
        blockingFor: ["LABEL_EMISSION"],
      });
    }
  }

  const rawValues = Object.fromEntries(
    NUTRITION_LABEL_NUTRIENT_KEYS.map((key) => {
      const total = totals[key];
      return [
        key,
        total !== null && canCalculate
          ? {
              per100: (total * 100) / finalYieldAmount!,
              perServing: (total * servingSize!) / finalYieldAmount!,
            }
          : { per100: null, perServing: null },
      ];
    }),
  ) as Record<
    NutritionLabelNutrientKey,
    { per100: number | null; perServing: number | null }
  >;

  const zeroExpression = new Map<NutritionLabelNutrientKey, boolean>();
  const canApplyGeneralZeroRules =
    product.nutritionTableContext?.kind === "GENERAL_FOOD";
  for (const key of NUTRITION_LABEL_NUTRIENT_KEYS) {
    const meta = NUTRIENT_META[key];
    const raw = rawValues[key];
    if (
      !canApplyGeneralZeroRules ||
      meta.insignificantAtOrBelow === null ||
      raw.per100 === null ||
      raw.perServing === null
    ) {
      zeroExpression.set(key, false);
      continue;
    }
    const candidate =
      raw.per100 <= meta.insignificantAtOrBelow &&
      raw.perServing <= meta.insignificantAtOrBelow;
    if (!candidate) {
      zeroExpression.set(key, false);
      continue;
    }
    if (!meta.zeroRequiresConfirmation) {
      zeroExpression.set(key, true);
      continue;
    }

    const confirmed = product.nonSignificantZeroEligibility?.[
      key as keyof NonNullable<
        NutritionLabelProductInput["nonSignificantZeroEligibility"]
      >
    ];
    zeroExpression.set(key, confirmed === true);
    if (confirmed === undefined && ZERO_CONFIRMATION_KEYS.has(key)) {
      pendings.push({
        code: "MISSING_NON_SIGNIFICANT_CONTEXT",
        nutrient: key,
        message: `Confirme as condições adicionais do Anexo IV antes de expressar ${key} como zero.`,
        blockingFor: ["LABEL_EMISSION"],
      });
    }
  }
  if (zeroExpression.get("energyKcal")) zeroExpression.set("energyKj", true);

  const nutrients = Object.fromEntries(
    NUTRITION_LABEL_NUTRIENT_KEYS.map((key) => {
      const total = totals[key];
      const raw = rawValues[key];
      if (total === null || raw.per100 === null || raw.perServing === null) {
        const unavailable = emptyNutrient(key);
        return [
          key,
          total === null ? unavailable : { ...unavailable, sourceTotal: total },
        ];
      }
      const forceZero = zeroExpression.get(key) === true;
      const per100 = presentQuantity(raw.per100, NUTRIENT_META[key].unit, forceZero);
      const perServing = presentQuantity(
        raw.perServing,
        NUTRIENT_META[key].unit,
        forceZero,
      );
      const dailyReference = NUTRIENT_META[key].dailyValue;
      const dailyValuePercent =
        dailyReference === null
          ? null
          : forceZero
            ? 0
            : (perServing.value / dailyReference) * 100;
      return [
        key,
        {
          unit: NUTRIENT_META[key].unit,
          sourceTotal: total,
          raw: {
            per100: raw.per100,
            perServing: raw.perServing,
            dailyValuePercent,
          },
          presentation: {
            per100,
            perServing,
            dailyValuePercent:
              dailyValuePercent === null
                ? null
                : presentDailyValue(dailyValuePercent),
          },
          dailyValueReference: dailyReference,
        },
      ];
    }),
  ) as unknown as Readonly<
    Record<NutritionLabelNutrientKey, CalculatedLabelNutrient>
  >;

  const frontContext = product.frontOfPack;
  if (!frontContext) {
    pendings.push({
      code: "MISSING_FRONT_OF_PACK_CONTEXT",
      message: "Classifique explicitamente a aplicabilidade e as exceções da rotulagem frontal.",
      blockingFor: ["LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }

  const thresholds = frontThresholds(product.physicalType ?? "SOLID");
  const conditionalEligible = new Set(
    frontContext?.applicability === "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6"
      ? frontContext.nutrientsAlteredByAddedIngredients ?? []
      : [],
  );
  if (
    frontContext?.applicability === "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6" &&
    !frontContext.nutrientsAlteredByAddedIngredients
  ) {
    pendings.push({
      code: "MISSING_FRONT_OF_PACK_CONTEXT",
      message: "Informe quais nutrientes críticos foram significativamente alterados pelos ingredientes adicionados.",
      blockingFor: ["LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }

  const frontNutrients = Object.fromEntries(
    (Object.keys(thresholds) as CriticalFrontNutrient[]).map((key) => {
      const threshold = thresholds[key];
      const rawPer100 =
        frontContext?.basis.kind ===
        "PREPARED_AS_DIRECTED_EXCLUDING_ADDED_INGREDIENTS"
          ? frontContext.basis.nutrientsPer100[key] ?? null
          : rawValues[key].per100;
      const prohibited =
        frontContext?.applicability === "PROHIBITED" ||
        (frontContext?.applicability ===
          "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6" &&
          !conditionalEligible.has(key));
      const meetsThreshold =
        prohibited || rawPer100 === null
          ? null
          : rawPer100 >= threshold.threshold;
      let declaration: FrontOfPackNutrientAssessment["declaration"] =
        "UNDETERMINED";
      if (prohibited) declaration = "PROHIBITED";
      else if (meetsThreshold !== null) {
        if (frontContext?.applicability === "OPTIONAL") declaration = "OPTIONAL";
        else declaration = meetsThreshold ? "REQUIRED" : "NOT_REQUIRED";
      }
      return [
        key,
        { ...threshold, rawPer100, meetsThreshold, declaration },
      ];
    }),
  ) as Readonly<
    Record<CriticalFrontNutrient, FrontOfPackNutrientAssessment>
  >;

  if (
    frontContext &&
    (Object.keys(frontNutrients) as CriticalFrontNutrient[]).some(
      (key) =>
        frontNutrients[key].declaration !== "PROHIBITED" &&
        frontNutrients[key].rawPer100 === null,
    )
  ) {
    pendings.push({
      code: "MISSING_FRONT_OF_PACK_BASIS",
      message:
        frontContext.basis.kind ===
        "PREPARED_AS_DIRECTED_EXCLUDING_ADDED_INGREDIENTS"
          ? "Informe os teores não arredondados do alimento pronto, excluindo os nutrientes dos ingredientes adicionados no preparo."
          : "Os teores não arredondados dos nutrientes críticos são necessários para avaliar a rotulagem frontal.",
      blockingFor: ["LABEL_EMISSION", "FRONT_OF_PACK"],
    });
  }

  const missingNutrients = NUTRITION_LABEL_NUTRIENT_KEYS.some(
    (key) => totals[key] === null,
  );
  const calculationStatus = !canCalculate
    ? "UNAVAILABLE"
    : missingNutrients
      ? "PARTIAL"
      : "COMPLETE";
  const labelEmissionBlocked = pendings.some((pending) =>
    pending.blockingFor.includes("LABEL_EMISSION"),
  );
  const frontUnavailable = pendings.some((pending) =>
    pending.blockingFor.includes("FRONT_OF_PACK"),
  );
  const frontStatus = !frontContext || frontUnavailable
    ? "UNAVAILABLE"
    : frontContext.applicability === "PROHIBITED"
      ? "NOT_APPLICABLE"
      : "ASSESSED";

  return {
    rules: NUTRITION_LABEL_RULES,
    calculationStatus,
    labelEmission: {
      sufficientInformation: calculationStatus === "COMPLETE" && !labelEmissionBlocked,
      regulatoryApproval: false,
    },
    basis: canCalculate
      ? {
          amount: 100,
          unit: expectedUnit!,
          finalYieldAmount: finalYieldAmount!,
          finalYieldUnit: finalYieldUnit!,
          servingSize: servingSize!,
          servingSizeUnit: servingSizeUnit!,
          servingsPerPackage: servingsPerPackage!,
          householdMeasure,
        }
      : null,
    nutrients,
    frontOfPack: {
      status: frontStatus,
      applicability: frontContext?.applicability ?? null,
      reason: frontContext?.reason ?? null,
      nutrients: frontNutrients,
    },
    pendings,
    traceability: {
      snapshotId: snapshot.id ?? null,
      recipeId: snapshot.recipeId ?? null,
      snapshotVersion: snapshot.version ?? null,
      snapshotCalculatedAt: isoDate(snapshot.calculatedAt),
      productId: product.id ?? null,
      ingredientCount: snapshot.ingredientCount ?? null,
      totalIngredientMassGrams: snapshot.totalIngredientMassGrams ?? null,
      totalIngredientVolumeMilliliters:
        snapshot.totalIngredientVolumeMilliliters ?? null,
    },
  };
}

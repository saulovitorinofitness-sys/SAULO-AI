export type NutritionSourceKind =
  | "TACO"
  | "TBCA"
  | "IBGE"
  | "PHILIPPI"
  /** @deprecated Use PHILIPPI. Mantido para registros legados. */
  | "PHILIPS"
  | "USDA"
  | "CLINIC_SV"
  | "EVONUT";

export type FoodDataOrigin =
  | "OFFICIAL"
  | "PROFESSIONAL"
  | "DEMONSTRATIVE";

export type FoodStatus = "ACTIVE" | "INACTIVE";

export type FoodNutrientValueQualifier =
  | "VALUE"
  | "TRACE"
  | "NOT_ANALYZED"
  | "NOT_APPLICABLE"
  | "MISSING";

/**
 * Representação usada pelo schema Prisma enquanto o contrato público adota
 * VALUE para valores quantitativos.
 */
export type FoodNutrientStorageStatus =
  | "NUMERIC"
  | Exclude<FoodNutrientValueQualifier, "VALUE">;

export const FOOD_NUTRIENT_QUALIFIER_TO_STORAGE_STATUS = {
  VALUE: "NUMERIC",
  TRACE: "TRACE",
  NOT_ANALYZED: "NOT_ANALYZED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  MISSING: "MISSING",
} as const satisfies Readonly<
  Record<FoodNutrientValueQualifier, FoodNutrientStorageStatus>
>;

export const FOOD_NUTRIENT_STORAGE_STATUS_TO_QUALIFIER = {
  NUMERIC: "VALUE",
  TRACE: "TRACE",
  NOT_ANALYZED: "NOT_ANALYZED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  MISSING: "MISSING",
} as const satisfies Readonly<
  Record<FoodNutrientStorageStatus, FoodNutrientValueQualifier>
>;

export type FoodReviewStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type FoodImportBatchStatus =
  | "DRAFT"
  | "VALIDATED"
  | "IMPORTED"
  | "FAILED"
  | "CANCELLED";

export type FoodImportItemAction =
  | "CREATED"
  | "UPDATED"
  | "UNCHANGED"
  | "CONFLICT"
  | "REJECTED";

export type FoodAssetOrigin =
  | "SOURCE_IMPORT"
  | "PROFESSIONAL"
  | "LEGACY";

export type FoodNutrientUnit =
  | "kcal"
  | "kJ"
  | "g"
  | "mg"
  | "mcg"
  | "µg"
  | "IU"
  | `source:${string}`;

export const HOUSEHOLD_MEASURE_REFERENCE_NAMES = [
  "grama",
  "unidade",
  "colher de sopa",
  "colher de chá",
  "colher de servir",
  "concha",
  "escumadeira",
  "xícara",
  "copo",
  "fatia",
  "pedaço",
  "prato",
  "porção",
] as const;

export const FOOD_CATEGORY_FILTER_OPTIONS = [
  "Cereais e tubérculos",
  "Frutas",
  "Carnes",
  "Ovos",
  "Laticínios",
  "Leguminosas",
  "Verduras e legumes",
  "Bebidas",
  "Oleaginosas",
] as const;

export interface FoodNutrientsPer100g {
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
  readonly fiberGrams: number | null;
  readonly sugarsGrams: number | null;
  readonly cholesterolMg: number | null;
  readonly saturatedFatsGrams: number | null;
  /** Opcional para produtores históricos; o Plano Alimentar normaliza ausência para null. */
  readonly transFatsGrams?: number | null;
  readonly monounsaturatedFatsGrams: number | null;
  readonly polyunsaturatedFatsGrams: number | null;
  readonly sodiumMg: number | null;
  readonly calciumMg: number | null;
  readonly ironMg: number | null;
  readonly magnesiumMg: number | null;
  readonly phosphorusMg: number | null;
  readonly potassiumMg: number | null;
  readonly zincMg: number | null;
  readonly copperMg: number | null;
  readonly manganeseMg: number | null;
  readonly seleniumMcg: number | null;
  readonly vitaminAMcg: number | null;
  readonly vitaminCMg: number | null;
  readonly vitaminDMcg: number | null;
  readonly vitaminEMg: number | null;
  readonly vitaminKMcg: number | null;
  readonly thiamineMg: number | null;
  readonly riboflavinMg: number | null;
  readonly niacinMg: number | null;
  readonly vitaminB6Mg: number | null;
  readonly folateMcg: number | null;
  readonly vitaminB12Mcg: number | null;
}

export type VitaminAForm = "RAE" | "RE" | "RETINOL" | "UNSPECIFIED";
export type FolateForm = "DFE" | "FOOD_FOLATE" | "FOLIC_ACID" | "UNSPECIFIED";

export interface FoodNutrientForms {
  readonly vitaminAMcg: VitaminAForm;
  readonly folateMcg: FolateForm;
}

export type FoodNutrientKey = keyof FoodNutrientsPer100g;

export type FoodNutrientIdentifier =
  | FoodNutrientKey
  | `additional:${string}`;

interface FoodNutrientObservationMetadata {
  readonly nutrientKey: FoodNutrientIdentifier;
  readonly sourceNutrientName?: string;
  readonly rawValue?: string;
  readonly unit?: FoodNutrientUnit;
  readonly analyticalMethod?: string;
  readonly dataOrigin?: string;
  readonly sourceReference?: string;
}

export type FoodNutrientObservationDraft = FoodNutrientObservationMetadata &
  (
    | {
        readonly qualifier: "VALUE";
        readonly numericValue: number;
      }
    | {
        readonly qualifier: Exclude<FoodNutrientValueQualifier, "VALUE">;
        readonly numericValue: null;
      }
  );

export type FoodNutrientObservation = FoodNutrientObservationDraft & {
  readonly id: string;
  readonly foodId: string;
  readonly importBatchId?: string;
  readonly storageStatus: FoodNutrientStorageStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export interface FoodSourceLicense {
  readonly name?: string;
  readonly url?: string;
  readonly text?: string;
}

export interface FoodSourceReference {
  readonly id?: string;
  readonly title: string;
  readonly authors?: string;
  readonly publisher?: string;
  readonly edition?: string;
  readonly publicationYear?: number;
  readonly citation?: string;
  readonly url?: string;
  readonly doi?: string;
  readonly isbn?: string;
  readonly license?: FoodSourceLicense;
}

export interface FoodImportFile {
  readonly name: string;
  readonly hash: string;
  readonly hashAlgorithm: string;
  readonly parserVersion: string;
}

export interface FoodImportSourceDescriptor {
  readonly kind: NutritionSourceKind;
  readonly name: string;
  readonly version?: string;
  readonly seriesKey?: string;
  readonly reference?: string;
  readonly references?: readonly FoodSourceReference[];
  readonly license?: FoodSourceLicense;
  readonly origin: Exclude<FoodDataOrigin, "DEMONSTRATIVE">;
  readonly supersedesSourceId?: string;
}

export interface FoodImportReview {
  readonly status: FoodReviewStatus;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly notes?: string;
}

export interface FoodImportBatchBase {
  readonly id: string;
  readonly source: FoodSource;
  readonly sourceVersion?: string;
  readonly file: FoodImportFile;
  readonly status: FoodImportBatchStatus;
  readonly review: FoodImportReview;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly importedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FoodImportBatch =
  | (FoodImportBatchBase & {
      readonly offlineAvailable: false;
      readonly offlinePublishedAt?: string;
    })
  | (FoodImportBatchBase & {
      readonly status: "IMPORTED";
      readonly review: FoodImportReview & { readonly status: "APPROVED" };
      readonly offlineAvailable: true;
      readonly offlinePublishedAt: string;
    });

export interface FoodImportPreviewCounts {
  readonly created: number;
  readonly updated: number;
  /** Registros mantidos sem alteração (ação UNCHANGED). */
  readonly unchanged: number;
  readonly conflicts: number;
  readonly rejected: number;
  readonly total: number;
}

export interface FoodImportPreviewIssue {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly sourceRow?: number;
  readonly severity: "WARNING" | "ERROR";
}

export interface FoodImportPreviewItem {
  readonly action: FoodImportItemAction;
  readonly sourceCode?: string;
  readonly sourceOriginalName: string;
  readonly normalizedName: string;
  readonly professionalName?: string;
  readonly sourceRow?: number;
  readonly existingFoodId?: string;
  readonly contentHash?: string;
  readonly nutrientObservations: readonly FoodNutrientObservationDraft[];
  readonly issues: readonly FoodImportPreviewIssue[];
}

export interface FoodImportBatchItem {
  readonly id: string;
  readonly batchId: string;
  readonly foodId?: string;
  readonly sourceCode?: string;
  readonly sourceOriginalName: string;
  readonly sourceRow?: number;
  readonly action: FoodImportItemAction;
  readonly contentHash?: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface FoodImportPreviewReport {
  readonly generatedAt: string;
  readonly source: FoodImportSourceDescriptor;
  readonly sourceVersion?: string;
  readonly file: FoodImportFile;
  readonly counts: FoodImportPreviewCounts;
  readonly items: readonly FoodImportPreviewItem[];
  readonly issues: readonly FoodImportPreviewIssue[];
  readonly eligibleForImport: boolean;
}

export interface FoodImportDryRunResult extends FoodImportPreviewReport {
  readonly dryRun: true;
  readonly databaseAccessed: false;
  readonly persisted: false;
}

export interface FoodImportResult extends FoodImportPreviewReport {
  readonly dryRun: false;
  readonly persisted: true;
  readonly batch: FoodImportBatch;
}

export interface FoodHouseholdMeasure {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly variation?: string;
  readonly quantity: number;
  readonly grams: number;
  readonly source: string;
  readonly importBatchId?: string;
  readonly dataOrigin?: FoodAssetOrigin;
  readonly sourceRecordKey?: string;
  readonly isDefault: boolean;
  readonly active: boolean;
}

export interface FoodSource {
  readonly id: string;
  readonly kind: NutritionSourceKind;
  readonly name: string;
  readonly version?: string;
  readonly seriesKey?: string;
  readonly reference?: string;
  readonly references?: readonly FoodSourceReference[];
  readonly license?: FoodSourceLicense;
  readonly supersedesSourceId?: string;
  readonly supersededBySourceIds?: readonly string[];
  readonly origin: FoodDataOrigin;
  readonly editable: boolean;
}

export interface ProfessionalFood {
  readonly id: string;
  readonly officialName: string;
  readonly sourceOriginalName?: string;
  readonly professionalName?: string;
  readonly normalizedName: string;
  readonly description?: string;
  readonly category: string;
  readonly categoryId: string;
  readonly foodGroup: string;
  readonly nutrientForms?: FoodNutrientForms;
  readonly source: FoodSource;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly preparationMethod?: string;
  readonly foodState?: string;
  readonly presentation?: string;
  readonly referenceServingGrams: number;
  readonly referenceServingUnit?: string;
  readonly status: FoodStatus;
  readonly reviewStatus?: FoodReviewStatus;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly reviewNotes?: string;
  readonly importBatch?: FoodImportBatch;
  readonly nutrients: FoodNutrientsPer100g | null;
  readonly nutrientObservations?: readonly FoodNutrientObservation[];
  readonly householdMeasures: readonly FoodHouseholdMeasure[];
  readonly synonyms: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FoodSearchInput {
  readonly query?: string;
  readonly category?: string;
  readonly source?: NutritionSourceKind | "ALL";
  /** Nome real da fonte cadastrada, usado por filtros montados a partir do banco. */
  readonly sourceName?: string;
  readonly status?: FoodStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface FoodSearchSourceOption {
  readonly value: string;
  readonly label: string;
  readonly activeFoods: number;
}

export interface FoodSearchResult {
  readonly items: readonly ProfessionalFood[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly sourceOptions?: readonly FoodSearchSourceOption[];
}

export interface FoodDuplicateCandidate {
  readonly id: string;
  readonly officialName: string;
  readonly source: FoodSource;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly reason: string;
}

export interface ClinicFoodDraft {
  readonly officialName: string;
  readonly sourceOriginalName?: string;
  readonly professionalName?: string;
  readonly description?: string;
  readonly category: string;
  readonly foodGroup: string;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly preparationMethod?: string;
  readonly foodState?: string;
  readonly presentation?: string;
  readonly referenceServingGrams: number;
  readonly referenceServingUnit?: string;
  readonly nutrients: FoodNutrientsPer100g;
  readonly nutrientObservations?: readonly FoodNutrientObservationDraft[];
  readonly householdMeasures: readonly Omit<
    FoodHouseholdMeasure,
    "id" | "normalizedName" | "source"
  >[];
  readonly synonyms: readonly string[];
  readonly status: FoodStatus;
  readonly reviewStatus?: FoodReviewStatus;
}

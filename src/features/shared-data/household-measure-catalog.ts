export const HOUSEHOLD_MEASURE_CATALOG = {
  COFFEE_SPOON: { id: "coffee-spoon", name: "colher de café" },
  TEASPOON: { id: "teaspoon", name: "colher de chá" },
  DESSERT_SPOON: { id: "dessert-spoon", name: "colher de sobremesa" },
  TABLESPOON: { id: "tablespoon", name: "colher de sopa" },
  SERVING_SPOON: { id: "serving-spoon", name: "colher de servir" },
  SMALL_LADLE: { id: "small-ladle", name: "concha pequena" },
  MEDIUM_LADLE: { id: "medium-ladle", name: "concha média" },
  LARGE_LADLE: { id: "large-ladle", name: "concha grande" },
  CUP: { id: "cup", name: "xícara" },
  HALF_CUP: { id: "half-cup", name: "meia xícara" },
  SMALL_GLASS: { id: "small-glass", name: "copo pequeno" },
  MEDIUM_GLASS: { id: "medium-glass", name: "copo médio" },
  LARGE_GLASS: { id: "large-glass", name: "copo grande" },
  SMALL_UNIT: { id: "small-unit", name: "unidade pequena" },
  MEDIUM_UNIT: { id: "medium-unit", name: "unidade média" },
  LARGE_UNIT: { id: "large-unit", name: "unidade grande" },
  HALF_UNIT: { id: "half-unit", name: "meia unidade" },
  THIN_SLICE: { id: "thin-slice", name: "fatia fina" },
  MEDIUM_SLICE: { id: "medium-slice", name: "fatia média" },
  THICK_SLICE: { id: "thick-slice", name: "fatia grossa" },
  SMALL_PIECE: { id: "small-piece", name: "pedaço pequeno" },
  MEDIUM_PIECE: { id: "medium-piece", name: "pedaço médio" },
  LARGE_PIECE: { id: "large-piece", name: "pedaço grande" },
  TONGS: { id: "tongs", name: "pegador" },
  SKIMMER: { id: "skimmer", name: "escumadeira" },
  SHALLOW_PLATE: { id: "shallow-plate", name: "prato raso" },
  DEEP_PLATE: { id: "deep-plate", name: "prato fundo" },
  SAUCER: { id: "saucer", name: "pires" },
  SCOOP: { id: "scoop", name: "scoop" },
  SACHET: { id: "sachet", name: "sachê" },
  CAPSULE: { id: "capsule", name: "cápsula" },
  MANUAL_GRAMS: { id: "manual-grams", name: "gramas/peso manual" },
  MANUAL_MILLILITERS: {
    id: "manual-milliliters",
    name: "mililitros/volume manual",
  },
} as const;

export type HouseholdMeasureType = keyof typeof HOUSEHOLD_MEASURE_CATALOG;
export type DemonstrativeMeasureUnit = "g" | "ml";
export type DemonstrativeMeasureSpec = readonly [
  type: HouseholdMeasureType,
  equivalentAmount: number | null,
  unit: DemonstrativeMeasureUnit,
];

export interface DemonstrativeMeasureAssociation {
  readonly id: string;
  readonly measureTypeId: string;
  readonly name: string;
  readonly equivalentAmount: number | null;
  readonly unit: DemonstrativeMeasureUnit;
  readonly demonstrative: true;
  readonly officialSource: string | null;
}

export function createDemonstrativeMeasureAssociations(
  itemId: string,
  specs: readonly DemonstrativeMeasureSpec[],
): readonly DemonstrativeMeasureAssociation[] {
  return specs.map(([type, equivalentAmount, unit]) => {
    const measure = HOUSEHOLD_MEASURE_CATALOG[type];
    return {
      id: `${itemId}-${measure.id}`,
      measureTypeId: measure.id,
      name: measure.name,
      equivalentAmount,
      unit,
      demonstrative: true,
      officialSource: null,
    };
  });
}

export function serializeDemonstrativeMeasureAssociations(
  itemId: string,
  specs: readonly DemonstrativeMeasureSpec[],
) {
  return JSON.stringify(createDemonstrativeMeasureAssociations(itemId, specs));
}

export function parseDemonstrativeMeasureAssociations(
  value: string,
): readonly DemonstrativeMeasureAssociation[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DemonstrativeMeasureAssociation =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.measureTypeId === "string" &&
        typeof item.name === "string" &&
        (typeof item.equivalentAmount === "number" ||
          item.equivalentAmount === null) &&
        (item.unit === "g" || item.unit === "ml") &&
        item.demonstrative === true &&
        (typeof item.officialSource === "string" ||
          item.officialSource === null),
    );
  } catch {
    return [];
  }
}

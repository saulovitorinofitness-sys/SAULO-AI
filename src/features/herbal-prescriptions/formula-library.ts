import type { ScientificLibraryItem } from "@/features/scientific-library/contracts";
import type { ScientificLibraryDraft } from "@/features/scientific-library/management-contracts";

import type {
  HerbalPrescriptionItem,
  PrescriptionItemCategory,
} from "./contracts";

export const FORMULA_MODEL_ATTRIBUTE = {
  category: "Tipo de formulação",
  components: "Componentes e quantidades",
  presentation: "Apresentação",
  use: "Forma de uso",
  care: "Cuidados essenciais",
  sourcePage: "Página de origem",
  importReview: "Revisão da importação",
  ambiguities: "Informações ausentes ou ambíguas",
} as const;

export interface FormulaModelDraft {
  readonly name: string;
  readonly category: PrescriptionItemCategory;
  readonly purpose: string;
  readonly components: string;
  readonly presentation: string;
  readonly use: string;
  readonly care: string;
  readonly source?: string;
  readonly sourcePage?: string;
  readonly ambiguities?: string;
}

export function formulaModelDisplayName(value: string) {
  return value
    .replace(/\s+\u00b7\s+PDF p\.\s*\d+\s*$/iu, "")
    .replace(/^\s*\d+\s*[-\u2013\u2014]\s+/u, "")
    .replace(/\*+\s*$/u, "")
    .trim();
}

function attribute(item: ScientificLibraryItem, key: string) {
  const value = item.attributes[key];
  return typeof value === "string" ? value : value?.join("\n") ?? "";
}

export function isFormulaModel(item: ScientificLibraryItem) {
  return item.area === "NUTRITION" && (
    item.domain === "FORMULATION" ||
    (item.domain === "SUPPLEMENT" && Boolean(attribute(item, FORMULA_MODEL_ATTRIBUTE.category)))
  );
}

export function formulaModelCategory(item: ScientificLibraryItem): PrescriptionItemCategory {
  const stored = attribute(item, FORMULA_MODEL_ATTRIBUTE.category);
  if (stored === "SUPPLEMENT") return "SUPPLEMENT";
  if (stored === "OTHER_FORMULATION") return "OTHER_FORMULATION";
  return item.domain === "SUPPLEMENT" ? "SUPPLEMENT" : "HERBAL";
}

export function formulaModelSearchText(item: ScientificLibraryItem) {
  return [
    item.name,
    item.description,
    item.professionalApplication,
    attribute(item, FORMULA_MODEL_ATTRIBUTE.components),
  ].join(" ").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

export function formulaModelToPrescriptionItem(item: ScientificLibraryItem): HerbalPrescriptionItem {
  const components = attribute(item, FORMULA_MODEL_ATTRIBUTE.components)
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => ({ identification: line }));
  const use = attribute(item, FORMULA_MODEL_ATTRIBUTE.use);
  const care = attribute(item, FORMULA_MODEL_ATTRIBUTE.care);
  return {
    category: formulaModelCategory(item),
    identification: item.name,
    ...(attribute(item, FORMULA_MODEL_ATTRIBUTE.presentation)
      ? { presentation: attribute(item, FORMULA_MODEL_ATTRIBUTE.presentation) }
      : {}),
    ...(use || care
      ? { orientations: [use, care].filter(Boolean).join("\n\n") }
      : {}),
    components,
  };
}

export function formulaModelDraft(input: FormulaModelDraft): ScientificLibraryDraft {
  return {
    area: "NUTRITION",
    domain: input.category === "SUPPLEMENT" ? "SUPPLEMENT" : "FORMULATION",
    name: input.name,
    description: input.purpose,
    tags: ["modelo de prescrição", input.category],
    source: input.source ?? "Cadastro manual na Biblioteca Científica",
    professionalNotes: input.ambiguities ?? "",
    status: "DRAFT",
    externalCode: "",
    classificationSystem: "",
    sourceVersion: "",
    dataNature: "OPERATIONAL",
    editorialStatus: "DRAFT",
    publicationType: "UNCLASSIFIED",
    evidenceCategory: "UNCLASSIFIED",
    professionalApplication: input.purpose,
    precautions: input.care,
    limitations: input.ambiguities ?? "",
    attributes: {
      [FORMULA_MODEL_ATTRIBUTE.category]: input.category,
      [FORMULA_MODEL_ATTRIBUTE.components]: input.components,
      [FORMULA_MODEL_ATTRIBUTE.presentation]: input.presentation,
      [FORMULA_MODEL_ATTRIBUTE.use]: input.use,
      [FORMULA_MODEL_ATTRIBUTE.care]: input.care,
      ...(input.sourcePage ? { [FORMULA_MODEL_ATTRIBUTE.sourcePage]: input.sourcePage } : {}),
      ...(input.ambiguities ? { [FORMULA_MODEL_ATTRIBUTE.ambiguities]: input.ambiguities } : {}),
    },
    references: [],
  };
}

export function importedFormulaModelDraft(input: FormulaModelDraft & {
  readonly sourcePage: string;
  readonly sourceFileName?: string;
  readonly ambiguities: string;
}): ScientificLibraryDraft {
  const draft = formulaModelDraft({
    ...input,
    source: input.sourceFileName ?? "Guia Magistral (Editora Plenitude)(1).pdf",
  });
  return {
    ...draft,
    dataNature: "LEGACY",
    editorialStatus: "UNDER_REVIEW",
    status: "REVIEW",
    publicationType: "TECHNICAL_BOOK_OR_MANUAL",
    evidenceCategory: "TECHNICAL_REFERENCE",
    limitations: [
      "Importado — pendente de revisão",
      input.ambiguities,
      "A presença no guia não comprova validação clínica da formulação.",
    ].filter(Boolean).join("\n"),
    attributes: {
      ...draft.attributes,
      [FORMULA_MODEL_ATTRIBUTE.sourcePage]: input.sourcePage,
      [FORMULA_MODEL_ATTRIBUTE.importReview]: "Importado — pendente de revisão",
      ...(input.ambiguities
        ? { [FORMULA_MODEL_ATTRIBUTE.ambiguities]: input.ambiguities }
        : {}),
    },
  };
}

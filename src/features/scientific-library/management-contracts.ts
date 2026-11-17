import { z } from "zod";

import {
  SCIENTIFIC_LIBRARY_DATA_NATURES,
  SCIENTIFIC_LIBRARY_DOMAINS,
  SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES,
  SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES,
  SCIENTIFIC_LIBRARY_PUBLICATION_TYPES,
  type ScientificLibraryDomain,
} from "./contracts";
import {
  SCIENTIFIC_LIBRARY_AREAS,
  scientificLibraryAreaDomains,
  type ScientificLibraryArea,
} from "./organization";
import {
  EXERCISE_BODY_REGIONS,
  EXERCISE_CLASSIFICATIONS,
  EXERCISE_DIFFICULTIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_MODALITIES,
  EXERCISE_MOVEMENT_PATTERNS,
  EXERCISE_OBJECTIVES,
} from "./exercise-metadata";

export const SCIENTIFIC_LIBRARY_STATUSES = [
  "DRAFT",
  "REVIEW",
  "ACTIVE",
  "INACTIVE",
] as const;
export type ScientificLibraryStatus =
  (typeof SCIENTIFIC_LIBRARY_STATUSES)[number];

export const scientificLibraryStatusLabels: Readonly<
  Record<ScientificLibraryStatus, string>
> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

export const SCIENTIFIC_LIBRARY_ORIGINS = [
  "MANUAL",
  "IMPORT",
  "EXTERNAL",
] as const;
export type ScientificLibraryOrigin =
  (typeof SCIENTIFIC_LIBRARY_ORIGINS)[number];

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().default("");

const optionalReferenceText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

const optionalOfficialUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Informe uma URL oficial HTTP ou HTTPS válida.")
  .optional();

const optionalDoi = z
  .string()
  .trim()
  .max(255)
  .regex(
    /^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i,
    "Informe um DOI no formato 10.<registrante>/<sufixo>.",
  )
  .optional();

const optionalPmid = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,8}$/, "Informe um PMID numérico válido.")
  .optional();

function hasValidIsbnChecksum(value: string) {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(normalized)) {
    const total = [...normalized].reduce(
      (sum, character, index) =>
        sum + (character === "X" ? 10 : Number(character)) * (10 - index),
      0,
    );
    return total % 11 === 0;
  }
  if (/^\d{13}$/.test(normalized)) {
    const total = [...normalized].slice(0, 12).reduce(
      (sum, character, index) =>
        sum + Number(character) * (index % 2 === 0 ? 1 : 3),
      0,
    );
    return (10 - (total % 10)) % 10 === Number(normalized[12]);
  }
  return false;
}

const optionalIsbn = z
  .string()
  .trim()
  .max(32)
  .refine(
    hasValidIsbnChecksum,
    "Informe um ISBN-10 ou ISBN-13 com formato e dígito verificador válidos.",
  )
  .optional();

export const scientificLibraryReferenceDraftSchema = z.object({
  sourceTitle: z.string().trim().min(2).max(500),
  fullCitation: optionalReferenceText(4000),
  authors: optionalReferenceText(2000),
  institutionOrJournal: optionalReferenceText(500),
  publicationYear: z
    .number()
    .int()
    .min(1000)
    .max(new Date().getUTCFullYear() + 1)
    .optional(),
  doi: optionalDoi,
  pmid: optionalPmid,
  isbn: optionalIsbn,
  officialUrl: optionalOfficialUrl,
  publicationType: z
    .enum(SCIENTIFIC_LIBRARY_PUBLICATION_TYPES)
    .default("UNCLASSIFIED"),
  evidenceCategory: z
    .enum(SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES)
    .default("UNCLASSIFIED"),
  language: optionalReferenceText(80),
  notes: optionalReferenceText(3000),
});

export type ScientificLibraryReferenceDraft = z.infer<
  typeof scientificLibraryReferenceDraftSchema
>;

const scientificLibraryStructuredFields = {
  dataNature: z.enum(SCIENTIFIC_LIBRARY_DATA_NATURES).default("DEMONSTRATIVE"),
  editorialStatus: z
    .enum(SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES)
    .default("DRAFT"),
  publicationType: z
    .enum(SCIENTIFIC_LIBRARY_PUBLICATION_TYPES)
    .default("UNCLASSIFIED"),
  evidenceCategory: z
    .enum(SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES)
    .default("UNCLASSIFIED"),
  technicalContent: optionalText(30000),
  professionalApplication: optionalText(10000),
  targetPopulation: optionalText(5000),
  indications: optionalText(10000),
  contraindications: optionalText(10000),
  precautions: optionalText(10000),
  limitations: optionalText(10000),
  editorialVersion: z.number().int().positive().max(1_000_000).default(1),
  references: z.array(scientificLibraryReferenceDraftSchema).max(50).default([]),
} as const;

export const scientificLibraryDraftSchema = z
  .object({
    area: z.enum(SCIENTIFIC_LIBRARY_AREAS),
    domain: z.enum(SCIENTIFIC_LIBRARY_DOMAINS),
    name: z.string().trim().min(2).max(200),
    description: optionalText(3000),
    tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    source: optionalText(500),
    professionalNotes: optionalText(3000),
    status: z.enum(SCIENTIFIC_LIBRARY_STATUSES).default("DRAFT"),
    externalCode: optionalText(120),
    classificationSystem: optionalText(160),
    sourceVersion: optionalText(120),
    attributes: z
      .record(
        z.string(),
        z.union([
          z.string(),
          z.array(z.string().trim().min(1).max(3000)).max(100),
        ]),
      )
      .default({}),
    ...scientificLibraryStructuredFields,
  })
  .superRefine((value, context) => {
    if (!scientificLibraryAreaDomains[value.area].includes(value.domain)) {
      context.addIssue({
        code: "custom",
        path: ["domain"],
        message: "O domínio não pertence à área profissional selecionada.",
      });
    }
    if (value.editorialStatus === "APPROVED") {
      context.addIssue({
        code: "custom",
        path: ["editorialStatus"],
        message:
          "A aprovação editorial exige transição controlada pela API, com responsável, data e histórico; este comando aceita apenas estados não aprovados.",
      });
    }
  });

export const scientificLibraryImportDraftSchema =
  scientificLibraryDraftSchema.superRefine((value, context) => {
    if (value.domain !== "EXERCISE") return;
    if (!value.source) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Informe a fonte/origem de cada exercício importado.",
      });
    }
    const singleChoice = (
      key: string,
      options: readonly string[],
    ) => {
      const selected = value.attributes[key];
      if (typeof selected === "string" && selected && !options.includes(selected)) {
        context.addIssue({
          code: "custom",
          path: ["attributes", key],
          message: `${key}: valor não reconhecido na taxonomia de exercícios.`,
        });
      }
    };
    const multipleChoice = (
      key: string,
      options: readonly string[],
    ) => {
      const selected = value.attributes[key];
      if (!Array.isArray(selected)) return;
      const invalid = selected.filter((entry) => !options.includes(entry));
      if (invalid.length) {
        context.addIssue({
          code: "custom",
          path: ["attributes", key],
          message: `${key}: valor(es) não reconhecido(s): ${invalid.join(", ")}.`,
        });
      }
    };
    singleChoice("Modalidade", EXERCISE_MODALITIES);
    singleChoice("Padrão de movimento", EXERCISE_MOVEMENT_PATTERNS);
    singleChoice("Nível de dificuldade", EXERCISE_DIFFICULTIES);
    multipleChoice("Classificações", EXERCISE_CLASSIFICATIONS);
    multipleChoice("Grupos musculares / regiões", EXERCISE_BODY_REGIONS);
    multipleChoice("Objetivos / aplicações", EXERCISE_OBJECTIVES);
    multipleChoice("Equipamentos", EXERCISE_EQUIPMENT);
    for (const key of [
      "URL de vídeo demonstrativo",
      "URL de imagem demonstrativa",
    ]) {
      const url = value.attributes[key];
      if (typeof url !== "string" || !url) continue;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("INVALID_PROTOCOL");
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["attributes", key],
          message: `${key}: informe uma URL HTTP ou HTTPS válida.`,
        });
      }
    }
  });

type ParsedScientificLibraryDraft = z.infer<
  typeof scientificLibraryDraftSchema
>;
type ScientificLibraryStructuredField =
  keyof typeof scientificLibraryStructuredFields;

/**
 * Os campos científicos permanecem opcionais para quem constrói o comando.
 * O schema os materializa com defaults conservadores depois da validação.
 */
export type ScientificLibraryDraft = Omit<
  ParsedScientificLibraryDraft,
  ScientificLibraryStructuredField
> &
  Partial<
    Pick<ParsedScientificLibraryDraft, ScientificLibraryStructuredField>
  >;

export interface ScientificLibraryImportRow {
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, string>>;
}

export interface ScientificLibraryColumnMapping {
  readonly name?: string;
  readonly description?: string;
  readonly tags?: string;
  readonly source?: string;
  readonly professionalNotes?: string;
  readonly externalCode?: string;
  readonly classificationSystem?: string;
  readonly sourceVersion?: string;
  readonly modality?: string;
  readonly movementPattern?: string;
  readonly classifications?: string;
  readonly difficulty?: string;
  readonly bodyRegion?: string;
  readonly primaryMuscles?: string;
  readonly secondaryMuscles?: string;
  readonly objectives?: string;
  readonly equipment?: string;
  readonly complementaryEquipment?: string;
  readonly startPosition?: string;
  readonly execution?: string;
  readonly commonErrors?: string;
  readonly cautions?: string;
  readonly regressions?: string;
  readonly progressions?: string;
  readonly alternatives?: string;
  readonly videoUrl?: string;
  readonly imageUrl?: string;
  readonly applicableView?: string;
  readonly relevance?: string;
}

export interface ScientificLibraryImportAnalysis {
  readonly fileName: string;
  readonly format: "CSV" | "XLSX" | "JSON";
  readonly headers: readonly string[];
  readonly rows: readonly ScientificLibraryImportRow[];
}

export interface ScientificLibraryImportPreviewRow {
  readonly rowNumber: number;
  readonly draft?: ScientificLibraryDraft;
  readonly status: "VALID" | "INVALID" | "DUPLICATE";
  readonly issues: readonly string[];
}

export interface ScientificLibraryImportPreview {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly duplicates: number;
  readonly unrecognizedFields: readonly string[];
  readonly rows: readonly ScientificLibraryImportPreviewRow[];
}

export function isDomainAvailableForArea(
  area: ScientificLibraryArea,
  domain: ScientificLibraryDomain,
) {
  return scientificLibraryAreaDomains[area].includes(domain);
}

export function normalizeScientificLibraryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

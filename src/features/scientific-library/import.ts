import type { ScientificLibraryItem } from "./contracts";
import {
  scientificLibraryImportDraftSchema,
  type ScientificLibraryColumnMapping,
  type ScientificLibraryDraft,
  type ScientificLibraryImportAnalysis,
  type ScientificLibraryImportPreview,
  type ScientificLibraryStatus,
  normalizeScientificLibraryName,
} from "./management-contracts";
import {
  scientificLibraryAreaForItem,
  type ScientificLibraryArea,
} from "./organization";
import type { ScientificLibraryDomain } from "./contracts";

type Cell = string | number | boolean | null | undefined;

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function uniqueHeaders(values: readonly unknown[]) {
  const used = new Map<string, number>();
  return values.map((value, index) => {
    const base = cellText(value) || `Coluna ${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

function matrixAnalysis(
  fileName: string,
  format: "CSV" | "XLSX",
  matrix: readonly (readonly Cell[])[],
): ScientificLibraryImportAnalysis {
  const headers = uniqueHeaders(matrix[0] ?? []);
  const rows = matrix.slice(1).flatMap((row, rowIndex) => {
    const values = Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        cellText(row[columnIndex]),
      ]),
    );
    return Object.values(values).some(Boolean)
      ? [{ rowNumber: rowIndex + 2, values }]
      : [];
  });
  return { fileName, format, headers, rows };
}

function jsonAnalysis(fileName: string, text: string): ScientificLibraryImportAnalysis {
  const parsed: unknown = JSON.parse(text);
  const source =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null;
  if (!source) {
    throw new Error("O JSON deve conter uma lista de objetos ou uma propriedade items.");
  }
  const objects = source.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  );
  const headers = Array.from(
    new Set(objects.flatMap((entry) => Object.keys(entry))),
  );
  return {
    fileName,
    format: "JSON",
    headers,
    rows: objects.map((entry, index) => ({
      rowNumber: index + 1,
      values: Object.fromEntries(
        headers.map((header) => [header, cellText(entry[header])]),
      ),
    })),
  };
}

export async function analyzeScientificLibraryFile(
  file: File,
): Promise<ScientificLibraryImportAnalysis> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("O arquivo deve possuir no máximo 10 MB.");
  }
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  if (extension === "json") {
    return jsonAnalysis(file.name, await file.text());
  }
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Formato não suportado. Utilize CSV, XLSX ou JSON.");
  }
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    raw: true,
    codepage: 65001,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("O arquivo não possui planilha legível.");
  const matrix = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: false,
  });
  return matrixAnalysis(
    file.name,
    extension === "csv" ? "CSV" : "XLSX",
    matrix,
  );
}

function normalizedHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLocaleLowerCase("pt-BR");
}

const aliases: Readonly<Record<keyof ScientificLibraryColumnMapping, readonly string[]>> = {
  name: ["nome", "titulo", "name", "title"],
  description: ["descricao", "description"],
  tags: ["tags", "etiquetas", "palavraschave"],
  source: ["fonte", "origem", "fonteorigem", "source"],
  professionalNotes: ["observacoes", "observacaoprofissional", "observacoesprofissionais", "notes"],
  externalCode: ["codigoexterno", "codigo", "externalcode"],
  classificationSystem: ["sistemadeclassificacao", "classificationsystem"],
  sourceVersion: ["versao", "versaodafonte", "sourceversion"],
  modality: ["modalidade", "modality"],
  movementPattern: ["padraodemovimento", "movementpattern"],
  classifications: ["classificacao", "classificacoes", "exerciseclassification", "classifications"],
  difficulty: ["niveldedificuldade", "dificuldade", "difficulty"],
  bodyRegion: ["regiaocorporal", "regioescorporais", "grupomuscular", "gruposmuscularesregioes", "regiao", "bodyregion", "bodyregions"],
  primaryMuscles: ["musculosprimarios", "primarymuscles"],
  secondaryMuscles: ["musculossecundarios", "musculossecundariossinergistas", "secondarymuscles", "synergists"],
  objectives: ["objetivos", "objetivosaplicacoes", "objectives", "applications"],
  equipment: ["equipamento", "equipamentos", "equipment"],
  complementaryEquipment: ["equipamentocomplementar", "complementaryequipment"],
  startPosition: ["posicaoinicial", "startposition"],
  execution: ["execucao", "execucaotecnica", "descricaodeexecucao", "execution", "technicalexecution"],
  commonErrors: ["erroscomuns", "commonerrors"],
  cautions: ["cuidados", "restricoesprofissionais", "cuidadosrestricoesprofissionais", "cautions", "professionalrestrictions"],
  regressions: ["regressoes", "regressions"],
  progressions: ["progressoes", "progressions"],
  alternatives: ["alternativas", "alternativassubstituicoes", "alternatives", "substitutions"],
  videoUrl: ["urldevideo", "urldevideodemonstrativo", "videourl"],
  imageUrl: ["urldeimagem", "urldeimagemdemonstrativa", "imageurl"],
  applicableView: ["plano", "vista", "planovista", "applicableview"],
  relevance: ["relevancia", "relevance"],
};

export function suggestScientificLibraryMapping(
  headers: readonly string[],
): ScientificLibraryColumnMapping {
  return Object.fromEntries(
    Object.entries(aliases).flatMap(([field, candidates]) => {
      const header = headers.find((entry) =>
        candidates.includes(normalizedHeader(entry)),
      );
      return header ? [[field, header]] : [];
    }),
  );
}

function tags(value: string) {
  return value
    .split(/[;,|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function list(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return [];
  if (cleaned.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    } catch {
      // CSV e valores textuais continuam pelo separador documentado.
    }
  }
  return cleaned
    .split(/\r?\n|[;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildScientificLibraryImportPreview(input: {
  analysis: ScientificLibraryImportAnalysis;
  mapping: ScientificLibraryColumnMapping;
  area: ScientificLibraryArea;
  domain: ScientificLibraryDomain;
  status: ScientificLibraryStatus;
  currentItems: readonly ScientificLibraryItem[];
}): ScientificLibraryImportPreview {
  const mappedColumns = new Set(Object.values(input.mapping).filter(Boolean));
  const unrecognizedFields = input.analysis.headers.filter(
    (header) => !mappedColumns.has(header),
  );
  const existing = new Set(
    input.currentItems.map(
      (item) =>
        `${item.area ?? scientificLibraryAreaForItem(item) ?? ""}|${item.domain}|${normalizeScientificLibraryName(item.name)}`,
    ),
  );
  const seen = new Set<string>();
  const rows = input.analysis.rows.map((row) => {
    const value = (field: keyof ScientificLibraryColumnMapping) => {
      const column = input.mapping[field];
      return column ? row.values[column] ?? "" : "";
    };
    const candidate: ScientificLibraryDraft = {
      area: input.area,
      domain: input.domain,
      name: value("name"),
      description: value("description"),
      tags: tags(value("tags")),
      source: value("source"),
      professionalNotes: value("professionalNotes"),
      status: input.status,
      externalCode: value("externalCode"),
      classificationSystem: value("classificationSystem"),
      sourceVersion: value("sourceVersion"),
      attributes:
        input.domain === "EXERCISE"
          ? {
              Modalidade: value("modality"),
              "Padrão de movimento": value("movementPattern"),
              Classificações: list(value("classifications")),
              "Nível de dificuldade": value("difficulty"),
              "Grupos musculares / regiões": list(value("bodyRegion")),
              "Músculos primários": list(value("primaryMuscles")),
              "Músculos secundários / sinergistas": list(value("secondaryMuscles")),
              "Objetivos / aplicações": list(value("objectives")),
              Equipamentos: list(value("equipment")),
              "Equipamento complementar": value("complementaryEquipment"),
              "Posição inicial": value("startPosition"),
              "Execução técnica": value("execution"),
              "Erros comuns": list(value("commonErrors")),
              "Cuidados / restrições profissionais": value("cautions"),
              Regressões: list(value("regressions")),
              Progressões: list(value("progressions")),
              "Alternativas / substituições": list(value("alternatives")),
              "URL de vídeo demonstrativo": value("videoUrl"),
              "URL de imagem demonstrativa": value("imageUrl"),
            }
          : input.domain === "POSTURAL_CHANGE"
            ? {
                "Região corporal": value("bodyRegion"),
                "Plano ou vista": value("applicableView"),
                Relevância: value("relevance"),
              }
            : {},
    };
    const parsed = scientificLibraryImportDraftSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        rowNumber: row.rowNumber,
        status: "INVALID" as const,
        issues: parsed.error.issues.map((issue) => issue.message),
      };
    }
    const key = `${parsed.data.area}|${parsed.data.domain}|${normalizeScientificLibraryName(parsed.data.name)}`;
    if (existing.has(key) || seen.has(key)) {
      return {
        rowNumber: row.rowNumber,
        draft: parsed.data,
        status: "DUPLICATE" as const,
        issues: ["Nome já existente na mesma área e domínio."],
      };
    }
    seen.add(key);
    return {
      rowNumber: row.rowNumber,
      draft: parsed.data,
      status: "VALID" as const,
      issues: [],
    };
  });
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === "VALID").length,
    invalid: rows.filter((row) => row.status === "INVALID").length,
    duplicates: rows.filter((row) => row.status === "DUPLICATE").length,
    unrecognizedFields,
    rows,
  };
}

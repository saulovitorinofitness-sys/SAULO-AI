import { readFile } from "node:fs/promises";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { normalizeFoodSearchText } from "./normalization";

export const IBGE_MEASURE_SOURCE_VERSION = "POF 2008-2009 (2011)";
export const IBGE_TABLE_FIRST_PAGE = 35;
export const IBGE_TABLE_LAST_PAGE = 536;

const PREPARATIONS = new Map<string, string>([
  ["1", "Cru(a)"],
  ["2", "Cozido(a)"],
  ["3", "Grelhado(a)/Brasa/Churrasco"],
  ["4", "Assado(a)"],
  ["5", "Frito(a)"],
  ["6", "Empanado(a)/à milanesa"],
  ["7", "Refogado(a)"],
  ["8", "Molho vermelho"],
  ["9", "Molho branco"],
  ["10", "Ao alho e óleo"],
  ["11", "Com manteiga/Óleo"],
  ["12", "Ao vinagrete"],
  ["13", "Ensopado"],
  ["14", "Mingau"],
  ["15", "Sopa"],
  ["99", "Não se aplica"],
]);

const MEASURES = new Map<string, string>([
  ["1", "Asa"], ["2", "Bago"], ["3", "Banda"], ["4", "Barra"],
  ["5", "Bife"], ["6", "Bisnaga"], ["7", "Bola"], ["8", "Cacho"],
  ["9", "Caneca"], ["10", "Caneco"], ["11", "Casquinha"],
  ["12", "Colher de arroz/servir"], ["13", "Colher de café"],
  ["14", "Colher de chá"], ["15", "Colher de sobremesa"],
  ["16", "Colher de sopa"], ["17", "Concha"], ["18", "Copo americano"],
  ["19", "Copo de cafezinho"], ["20", "Copo de requeijão"],
  ["21", "Copo grande"], ["22", "Copo médio"], ["23", "Copo tulipa"],
  ["24", "Costela"], ["25", "Coxa"], ["26", "Cumbuca"], ["27", "Dose"],
  ["28", "Escumadeira"], ["29", "Espetinho"], ["30", "Espeto"],
  ["31", "Espiga"], ["32", "Fatia"], ["33", "Filé"], ["34", "Folha"],
  ["35", "Garfada"], ["36", "Garrafa (200 ml)"], ["37", "Garrafa (237 ml)"],
  ["38", "Garrafa (248 ml)"], ["39", "Garrafa (250 ml)"],
  ["40", "Garrafa (275 ml)"], ["41", "Garrafa (284 ml)"],
  ["42", "Garrafa (290 ml)"], ["43", "Garrafa (300 ml)"],
  ["44", "Garrafa (320 ml)"], ["45", "Garrafa (330 ml)"],
  ["46", "Garrafa (350 ml)"], ["47", "Garrafa (355 ml)"],
  ["48", "Garrafa (400 ml)"], ["49", "Garrafa (450 ml)"],
  ["50", "Garrafa (500 ml)"], ["51", "Garrafa (510 ml)"],
  ["52", "Garrafa (550 ml)"], ["53", "Garrafa (591 ml)"],
  ["54", "Garrafa (600 ml)"], ["55", "Garrafa (650 ml)"],
  ["56", "Garrafa (900 ml)"], ["57", "Garrafa (910 ml)"],
  ["58", "Garrafa (980 ml)"], ["59", "Garrafa (1 l)"],
  ["60", "Garrafa (1,25 l)"], ["61", "Garrafa (1,5 l)"],
  ["62", "Garrafa (1,75 l)"], ["63", "Garrafa (2 l)"],
  ["64", "Garrafa (2,25 l)"], ["65", "Garrafa (2,5 l)"],
  ["66", "Garrafa (não especificada)"], ["67", "Gomo"], ["68", "Grama"],
  ["69", "Lata (250 ml)"], ["70", "Lata (335 ml)"], ["71", "Lata (340 ml)"],
  ["72", "Lata (350 ml)"], ["73", "Lata (354 ml)"], ["74", "Lata (473 ml)"],
  ["75", "Lata não especificada"], ["76", "Litro"], ["77", "Maço"],
  ["78", "Metade"], ["79", "Mililitro"], ["80", "Pacote"],
  ["81", "Pedaço"], ["82", "Pegador"], ["83", "Peito"], ["84", "Pescoço"],
  ["85", "Pires"], ["86", "Ponta de faca"], ["87", "Porção"],
  ["88", "Punhado"], ["89", "Posta"], ["90", "Pote"],
  ["91", "Prato de sobremesa"], ["92", "Prato fundo"], ["93", "Prato raso"],
  ["94", "Quilo"], ["95", "Ramo"], ["96", "Rodela"], ["97", "Sachê"],
  ["98", "Saco"], ["99", "Sobrecoxa"], ["100", "Tablete"], ["101", "Taça"],
  ["102", "Tigela"], ["103", "Unidade"], ["104", "Unidade pequena"],
  ["105", "Xícara de café"], ["106", "Xícara de chá"],
]);

type PdfTextItem = { str: string; transform: number[] };

export type IbgeHouseholdMeasureRow = {
  sourceFoodCode: string;
  foodName: string;
  normalizedFoodName: string;
  preparationCode: string;
  preparationName: string;
  measureCode: string;
  measureName: string;
  standardMeasureCode: string;
  standardMeasureName: string;
  quantityValue: number;
  quantityUnit: "g" | "ml";
  referenceCode: string | null;
  referenceDescription: string | null;
  sourceVersion: string;
  sourcePage: number;
};

export type IbgeMeasureRejection = {
  sourcePage: number;
  rawText: string;
  reason: string;
};

export type IbgeMeasureExtraction = {
  rows: IbgeHouseholdMeasureRow[];
  rejected: IbgeMeasureRejection[];
  pagesRead: number;
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function catalogMatchKey(value: string) {
  return normalizeFoodSearchText(value.replace(/-\s+/g, ""))
    .replace(/\blitros?\b/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogEntry(value: string, catalog: Map<string, string>) {
  const normalized = catalogMatchKey(compact(value));
  for (const [code, name] of catalog) {
    if (normalized === catalogMatchKey(`${code} ${name}`)) {
      return { code, name };
    }
  }
  return null;
}

function consumeCatalog(parts: readonly string[], start: number, catalog: Map<string, string>) {
  for (let length = 1; length <= 4 && start + length <= parts.length; length++) {
    const match = catalogEntry(parts.slice(start, start + length).join(" "), catalog);
    if (match) return { ...match, next: start + length };
  }
  return null;
}

function parseRecord(
  items: readonly PdfTextItem[],
  sourcePage: number,
): { row: IbgeHouseholdMeasureRow } | { rejection: IbgeMeasureRejection } {
  const rawText = compact(items.map((item) => item.str).join(" "));
  const first = items[0];
  if (!first) return { rejection: { sourcePage, rawText, reason: "Registro vazio." } };

  const rowAxis = first.transform[4];
  const parts = items
    .filter((item) => Math.abs(item.transform[4] - rowAxis) <= 16)
    .map((item) => compact(item.str))
    .filter(Boolean);
  const foodStart = parts[0]?.match(/^(\d{7})\s+(.+)$/);
  if (!foodStart) {
    return { rejection: { sourcePage, rawText, reason: "Código ou nome do alimento inválido." } };
  }

  let preparation: ReturnType<typeof consumeCatalog> = null;
  let preparationStart = -1;
  for (let index = 1; index < Math.min(parts.length, 8); index++) {
    const candidate = consumeCatalog(parts, index, PREPARATIONS);
    if (candidate) {
      preparation = candidate;
      preparationStart = index;
      break;
    }
  }
  if (!preparation) {
    return { rejection: { sourcePage, rawText, reason: "Forma de preparação não reconhecida." } };
  }

  const foodName = compact([
    foodStart[2],
    ...parts.slice(1, preparationStart),
  ].join(" "));
  const measure = consumeCatalog(parts, preparation.next, MEASURES);
  if (!measure) {
    return { rejection: { sourcePage, rawText, reason: "Medida caseira não reconhecida." } };
  }
  const standardMeasure = consumeCatalog(parts, measure.next, MEASURES);
  if (!standardMeasure) {
    return { rejection: { sourcePage, rawText, reason: "Medida padronizada não reconhecida." } };
  }

  const rawQuantity = parts[standardMeasure.next];
  if (!rawQuantity || !/^\d+(?:[,.]\d+)?$/.test(rawQuantity)) {
    return { rejection: { sourcePage, rawText, reason: "Quantidade ausente ou inválida; valor não convertido para zero." } };
  }
  const quantityValue = Number(rawQuantity.replace(",", "."));
  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    return { rejection: { sourcePage, rawText, reason: "Quantidade não positiva ou inválida." } };
  }

  const referenceText = compact(parts.slice(standardMeasure.next + 1).join(" "));
  const referenceMatch = referenceText.match(/^(\d{1,2})\s+(.+)$/);
  const explicitVolumeCodes = new Set([
    ...Array.from({ length: 30 }, (_, index) => String(index + 36)),
    "69", "70", "71", "72", "73", "74", "76", "79",
  ]);
  const quantityUnit = explicitVolumeCodes.has(measure.code) ? "ml" : "g";

  return {
    row: {
      sourceFoodCode: foodStart[1],
      foodName,
      normalizedFoodName: normalizeFoodSearchText(foodName),
      preparationCode: preparation.code,
      preparationName: preparation.name,
      measureCode: measure.code,
      measureName: measure.name,
      standardMeasureCode: standardMeasure.code,
      standardMeasureName: standardMeasure.name,
      quantityValue,
      quantityUnit,
      referenceCode: referenceMatch?.[1] ?? null,
      referenceDescription: referenceMatch?.[2] ?? (referenceText || null),
      sourceVersion: IBGE_MEASURE_SOURCE_VERSION,
      sourcePage,
    } satisfies IbgeHouseholdMeasureRow,
  };
}

export async function readIbgeHouseholdMeasures(
  filePath: string,
  options: { firstPage?: number; lastPage?: number } = {},
): Promise<IbgeMeasureExtraction> {
  const firstPage = options.firstPage ?? IBGE_TABLE_FIRST_PAGE;
  const lastPage = options.lastPage ?? IBGE_TABLE_LAST_PAGE;
  const loadingTask = getDocument({ data: new Uint8Array(await readFile(filePath)) });
  const document = await loadingTask.promise;
  const rows: IbgeHouseholdMeasureRow[] = [];
  const rejected: IbgeMeasureRejection[] = [];
  const seen = new Set<string>();

  try {
    if (firstPage < 1 || lastPage > document.numPages || firstPage > lastPage) {
      throw new Error(`Intervalo de páginas inválido: ${firstPage}-${lastPage} de ${document.numPages}.`);
    }
    for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items.flatMap((item): PdfTextItem[] =>
        "str" in item && Array.isArray(item.transform)
          ? [{ str: item.str, transform: item.transform }]
          : [],
      );
      let current: PdfTextItem[] = [];
      const records: PdfTextItem[][] = [];
      for (const item of textItems) {
        if (/^\d{7}\s+\S/.test(compact(item.str))) {
          if (current.length) records.push(current);
          current = [item];
        } else if (current.length) {
          current.push(item);
        }
      }
      if (current.length) records.push(current);

      for (const record of records) {
        const parsed = parseRecord(record, pageNumber);
        if ("rejection" in parsed) {
          rejected.push(parsed.rejection);
          continue;
        }
        const key = [
          parsed.row.sourceFoodCode,
          parsed.row.preparationCode,
          parsed.row.measureCode,
        ].join(":");
        if (seen.has(key)) {
          rejected.push({
            sourcePage: pageNumber,
            rawText: compact(record.map((item) => item.str).join(" ")),
            reason: `Chave duplicada no documento: ${key}.`,
          });
          continue;
        }
        seen.add(key);
        rows.push(parsed.row);
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return { rows, rejected, pagesRead: lastPage - firstPage + 1 };
}

export const ibgeMeasureCatalogs = {
  preparations: PREPARATIONS,
  measures: MEASURES,
} as const;

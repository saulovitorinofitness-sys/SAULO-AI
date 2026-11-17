import "dotenv/config";

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  importedFormulaModelDraft,
  isFormulaModel,
} from "@/features/herbal-prescriptions/formula-library";
import type { PrescriptionItemCategory } from "@/features/herbal-prescriptions/contracts";
import { normalizeScientificLibraryName } from "@/features/scientific-library/management-contracts";
import { scientificLibraryRepository } from "@/features/scientific-library/repository";
import { prisma } from "@/lib/database/prisma";

const SOURCE_FILE = "Guia Magistral (Editora Plenitude).pdf";
const SOURCE_PATH = resolve(process.cwd(), "data", "imports", "guia magistral", SOURCE_FILE);
const MIN_FORMULAS_PER_PAGE = 4;
const COLUMN_PIVOT = { left: 200, right: 460 } as const;
const COLUMN_CENTER = { left: 160, right: 440 } as const;
const EXCLUDED_TITLE = /^(Guia de|Custo da|\*|Voltar|sumário|Clique aqui|EDITORA|Posologia|Associar com|Pode ser associado|Tomar|T omar|tomar|Diluir|Dissolver|antes de|de água|água filtrada|ao dia|vontade de|principais refeições)/iu;

type PdfSide = "left" | "right";

interface PdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly font: string;
}

interface PdfRow {
  readonly y: number;
  readonly items: readonly PdfTextItem[];
}

interface ParsedFormula {
  readonly pdfPage: number;
  readonly printedPage: string;
  readonly side: PdfSide;
  readonly title: string;
  readonly components: readonly { readonly name: string; readonly amount: string }[];
  readonly uses: readonly string[];
}

function rows(items: readonly PdfTextItem[]) {
  const result: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = result.find((entry) => Math.abs(entry.y - item.y) <= 1.5);
    if (!row) {
      row = { y: item.y, items: [] };
      result.push(row);
    }
    row.items.push(item);
  }
  return result
    .sort((a, b) => b.y - a.y)
    .map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }));
}

function rowText(row: PdfRow) {
  return row.items.map((item) => item.text).join(" ").replace(/\s+/gu, " ").trim();
}

function cleanTitle(title: string, pdfPage: number) {
  return pdfPage >= 138 && pdfPage <= 140
    ? title.replace(/\s+1\s*-\s*SONO\*$/iu, "").trim()
    : title;
}

function titleBlocks(
  items: readonly PdfTextItem[],
  printedPageFont: string,
  markerFonts: ReadonlySet<string>,
  centerX: number,
) {
  const lines = rows(items.filter((item) => {
    const isPrintedPageFont = item.font === printedPageFont && item.height >= 9.5;
    const isMarkerFont = markerFonts.has(item.font) && item.height >= 11;
    const centered = Math.abs(item.x + item.width / 2 - centerX) <= 55;
    return (isPrintedPageFont || isMarkerFont) && centered && !EXCLUDED_TITLE.test(item.text);
  })).map((row) => ({ ...row, text: rowText(row) }));
  const blocks: { y: number; bottomY: number; text: string }[] = [];
  for (const line of lines) {
    const previous = blocks.at(-1);
    if (previous && previous.bottomY - line.y <= 22) {
      previous.bottomY = line.y;
      previous.text = `${previous.text} ${line.text}`;
    } else {
      blocks.push({ y: line.y, bottomY: line.y, text: line.text });
    }
  }
  return blocks;
}

function splitCombinedComponent(text: string) {
  const match = text.match(/^(.+?)\s+((?:qsp\s*)?\d[\d.,]*(?:\s*(?:a|–|-)\s*\d[\d.,]*)?\s*(?:mg|g|mcg|µg|UI|UFC|blh\s*UFC|bilh(?:ão|ões)?\s*UFC|gramas?|ml|%|dose|cápsulas?)(?:\s+.*)?)$/iu);
  return match ? { name: match[1].trim(), amount: match[2].trim() } : null;
}

function componentRows(bodyRows: readonly PdfRow[], pivot: number) {
  return bodyRows.flatMap((row) => {
    const text = rowText(row);
    if (/^(?:Posologia|Associar com|Pode ser associado)/iu.test(text)) return [];
    const names = row.items.filter((item) => item.x < pivot);
    const amounts = row.items.filter((item) => item.x >= pivot);
    if (names.length && amounts.some((item) => /\d/u.test(item.text))) {
      return [{
        name: names.map((item) => item.text).join(" "),
        amount: amounts.map((item) => item.text).join(" "),
      }];
    }
    if (row.items.length !== 1) return [];
    const combined = splitCombinedComponent(text);
    return combined ? [combined] : [];
  });
}

function collectUse(
  bodyRows: readonly PdfRow[],
  startIndex: number,
  pivot: number,
  removeLabel: boolean,
) {
  const first = rowText(bodyRows[startIndex]);
  const useLines = [removeLabel ? first.replace(/^Posologia\s*:\s*/iu, "") : first];
  let previousY = bodyRows[startIndex].y;
  for (let index = startIndex + 1; index < bodyRows.length; index += 1) {
    const next = bodyRows[index];
    const nextText = rowText(next);
    if (previousY - next.y > 18 || /^(?:Posologia|Associar com|Pode ser associado)/iu.test(nextText)) break;
    const names = next.items.filter((item) => item.x < pivot);
    const amounts = next.items.filter((item) => item.x >= pivot);
    if ((names.length && amounts.some((item) => /\d/u.test(item.text))) || splitCombinedComponent(nextText)) break;
    useLines.push(nextText);
    previousY = next.y;
  }
  return useLines.filter(Boolean).join(" ").replace(/\s+/gu, " ").trim();
}

function extractUsage(bodyRows: readonly PdfRow[], pivot: number) {
  const marked = bodyRows.flatMap((row, index) =>
    /^Posologia\s*:/iu.test(rowText(row)) ? [collectUse(bodyRows, index, pivot, true)] : []
  ).filter(Boolean);
  if (marked.length) return marked;
  return bodyRows.flatMap((row, index) =>
    /^(?:Tomar|T omar|tomar|Diluir|Dissolver|\d+\s+borrifadas)/iu.test(rowText(row))
      ? [collectUse(bodyRows, index, pivot, false)]
      : []
  ).filter(Boolean);
}

async function parseFormulas() {
  const document = await getDocument({ data: new Uint8Array(await readFile(SOURCE_PATH)) }).promise;
  const formulas: ParsedFormula[] = [];
  const processedPages: number[] = [];
  for (let pdfPage = 1; pdfPage <= document.numPages; pdfPage += 1) {
    const page = await document.getPage(pdfPage);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items.flatMap((entry) => {
      if (!("str" in entry) || !entry.str.trim()) return [];
      return [{
        text: entry.str.trim(),
        x: entry.transform[4],
        y: entry.transform[5],
        width: entry.width,
        height: entry.height,
        font: entry.fontName,
      }];
    });
    const posologies = items.filter((item) => /^Posologia\s*:/iu.test(item.text));
    if (posologies.length < MIN_FORMULAS_PER_PAGE) continue;
    const printedPageItem = items.find((item) => /^\d{2}$/u.test(item.text) && item.y < 35);
    if (!printedPageItem) throw new Error(`Página física ${pdfPage}: número impresso não identificado.`);
    processedPages.push(pdfPage);
    const markerFonts = new Set(posologies.map((item) => item.font));
    for (const side of ["left", "right"] as const) {
      const minX = side === "left" ? 20 : 300;
      const maxX = side === "left" ? 299 : 580;
      const sideItems = items.filter((item) => item.x >= minX && item.x <= maxX && item.y > 38 && item.y < 805);
      const titles = titleBlocks(sideItems, printedPageItem.font, markerFonts, COLUMN_CENTER[side]);
      for (let index = 0; index < titles.length; index += 1) {
        const title = titles[index];
        const lowerY = titles[index + 1]?.y ?? 40;
        const body = rows(sideItems.filter((item) => item.y < title.bottomY - 4 && item.y > lowerY + 4));
        const components = componentRows(body, COLUMN_PIVOT[side]);
        const uses = extractUsage(body, COLUMN_PIVOT[side]);
        if (!components.length || !uses.length) {
          throw new Error(`Página física ${pdfPage}, ${side}, “${title.text}”: composição ou modo de uso não identificado.`);
        }
        formulas.push({
          pdfPage,
          printedPage: printedPageItem.text,
          side,
          title: cleanTitle(title.text, pdfPage),
          components,
          uses,
        });
      }
    }
  }
  return { formulas, processedPages };
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

const BOTANICAL = /(?:ashwagandha|withania|whitania|passiflora|mulungu|camomil|matricaria|melissa|crocus|croccus|rhodiola|bacopa|panax|ginseng|griffonia|glycyrrhiza|cinnamon|canela|gymnema|garcinia|berber|propolis|alecrim|alho|coco|trifolium|taraxacum|morus|amora|angelica|redclover|yam|vitex|agnus|cranberry|cramberry|abacate|epimedium|lepidium|mucuna|feno grego|ginkgo|marapu|euryc|curcuma|curcumina|piperina|resveratrol|polipodium|pinus|pinnus|camellia|cha verde|vitis|avena|centella|cavalinha|hibisco|citrus|laranja|capsicum|guarana|cafeina|cha branco|cha preto|gengibre|alcachofra|boldo|cardo mariano|silybum|silimarina|dente de leao|uva ursi|saw palmetto|serenoa|pygeum|tribulus|maca peruana|boswellia|harpagophytum|harpago|garra do diabo|salix|salgueiro|arnica|equisetum|castanha da india|aescullus|hamamelis|ruscus|ginkgo|glicine max|soja|isoflavona|oleo de primula|oleo de borragem|oleo de linhaca|oleo de gergelim|oleo de girassol)/u;
const SUPPLEMENT = /(?:^l\.?\s|^d[- ]|lactobac|bifidobacter|bificobacter|saccharomyces|bacillus|streptococcus|probiot|vitamina|retinol|betacaroteno|biotina|tiamina|riboflavina|niacina|nicotinamida|piridox|metilcobalamina|cianocobalamina|metilfolato|acido folico|folato|pantoten|ascorbi|zinco|selenio|magnesio|calcio|ferro|cobre|manganes|cromo|vanadio|molibdenio|iodo|potassio|fosforo|silicio|aminoacid|glicina|prolina|lisina|arginina|ornitina|citrulina|glutamina|glutationa|cisteina|cistina|metionina|taurina|triptofano|tirosina|theanina|nac\b|n-acetil|creatina|carnitina|beta alanina|bcaa|leucina|isoleucina|valina|colageno|verisol|peptideo|proteina|whey|coenzima|q10|inositol|omega|dha|epa|fosfatidil|melatonina|quercetina|glucosamina|condroitina|acido hialuronico|alfa[- ]?lipoico|alpha[- ]?lipoico|picolinato|bromelina|papaina|pancreatina|pepsina|amilase|lipase|protease|lactase|celulase|enzima|psyllium|inulina|frutooligossacarideo|fos\b|goma guar|pectina|fibra|ubiqsome|incell|siliciumax|exynutriment|exsynutriment|dimpless|glycoxil|bio-arct|cerasomides|cactinea|mioquiron|myoquiron|drenow|biointestil|isb care|pqq\b|same\b|5-htp|dim\b|indol|egcg|gaba\b|nad\b|nadh\b|atp\b|qsp\b)/u;

function classifyFormula(formula: ParsedFormula): { category: PrescriptionItemCategory; conservative: boolean } {
  const kinds = formula.components.map((component) => {
    const name = normalized(component.name);
    if (BOTANICAL.test(name)) return "BOTANICAL";
    if (SUPPLEMENT.test(name)) return "SUPPLEMENT";
    return "UNKNOWN";
  });
  const botanical = kinds.filter((kind) => kind === "BOTANICAL").length;
  const supplement = kinds.filter((kind) => kind === "SUPPLEMENT").length;
  const unknown = kinds.length - botanical - supplement;
  if (botanical === kinds.length) return { category: "HERBAL", conservative: false };
  if (supplement === kinds.length) return { category: "SUPPLEMENT", conservative: false };
  return { category: "OTHER_FORMULATION", conservative: unknown > 0 || botanical > 0 };
}

function repeatedTitles(formulas: readonly ParsedFormula[]) {
  const counts = new Map<string, number>();
  for (const formula of formulas) {
    const key = normalizeScientificLibraryName(formula.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function toDraft(formula: ParsedFormula, repeated: ReadonlySet<string>) {
  const classification = classifyFormula(formula);
  const repeatedTitle = repeated.has(normalizeScientificLibraryName(formula.title));
  const name = repeatedTitle ? `${formula.title} · PDF p. ${formula.pdfPage}` : formula.title;
  const ambiguities = [
    "Apresentação e cuidados essenciais não informados no quadro de origem.",
    "Grafias, quantidades e unidades foram preservadas literalmente e requerem revisão profissional.",
    formula.uses.length > 1
      ? "O quadro contém mais de um modo de uso; a associação foi preservada no mesmo modelo e na ordem impressa."
      : "",
    repeatedTitle
      ? "Título repetido no guia; a página física foi acrescentada ao nome apenas para distinção cadastral."
      : "",
    classification.category === "OTHER_FORMULATION" && classification.conservative
      ? "Classificada conservadoramente como Outras formulações por conter composição mista ou componente sem enquadramento inequívoco."
      : "",
    formula.title.includes("*")
      ? "O asterisco do título pertence à faixa de custo do guia e não representa classificação de evidência."
      : "",
  ].filter(Boolean).join("\n");
  return importedFormulaModelDraft({
    name,
    category: classification.category,
    purpose: formula.title,
    components: formula.components.map((component) => `${component.name} — ${component.amount}`).join("\n"),
    presentation: "",
    use: formula.uses.join("\n"),
    care: "",
    sourcePage: `${formula.printedPage} (página ${formula.pdfPage} do PDF)`,
    sourceFileName: SOURCE_FILE,
    ambiguities,
  });
}

async function main() {
  await access(SOURCE_PATH);
  const professional = await prisma.user.findFirstOrThrow({
    where: { fullName: "Saulo Xavier Vitorino", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const { formulas, processedPages } = await parseFormulas();
  const repeated = repeatedTitles(formulas);
  const drafts = formulas.map((formula) => toDraft(formula, repeated));
  let created = 0;
  let duplicates = 0;
  for (const pdfPage of processedPages) {
    const pageDrafts = drafts.filter((_, index) => formulas[index].pdfPage === pdfPage);
    const result = await scientificLibraryRepository.createMany({
      professionalUserId: professional.id,
      drafts: pageDrafts,
      importFileName: SOURCE_FILE,
    });
    created += result.created.length;
    duplicates += result.duplicates;
  }
  const persisted = (await scientificLibraryRepository.list(professional.id))
    .filter((item) => item.importFileName === SOURCE_FILE && isFormulaModel(item));
  const expectedNames = new Set(drafts.map((draft) => normalizeScientificLibraryName(draft.name)));
  const persistedNames = new Set(persisted.map((item) => normalizeScientificLibraryName(item.name)));
  const unexpected = persisted.filter((item) => !expectedNames.has(normalizeScientificLibraryName(item.name)));
  const missing = drafts.filter((draft) => !persistedNames.has(normalizeScientificLibraryName(draft.name)));
  const totals = persisted.reduce<Record<PrescriptionItemCategory, number>>((result, item) => {
    const stored = item.attributes["Tipo de formulação"];
    const category = typeof stored === "string" ? stored as PrescriptionItemCategory : "OTHER_FORMULATION";
    result[category] += 1;
    return result;
  }, { HERBAL: 0, SUPPLEMENT: 0, OTHER_FORMULATION: 0 });
  console.log(JSON.stringify({
    source: SOURCE_PATH,
    pagesProcessed: processedPages,
    parsed: formulas.length,
    attempted: drafts.length,
    created,
    duplicates,
    persisted: persisted.length,
    unexpected: unexpected.map((item) => item.name),
    missing: missing.map((item) => item.name),
    totals,
  }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

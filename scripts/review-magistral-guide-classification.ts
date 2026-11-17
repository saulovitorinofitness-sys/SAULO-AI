import "dotenv/config";

import { FORMULA_MODEL_ATTRIBUTE } from "@/features/herbal-prescriptions/formula-library";
import type { PrescriptionItemCategory } from "@/features/herbal-prescriptions/contracts";
import { prisma } from "@/lib/database/prisma";

const SOURCE_FILE = "Guia Magistral (Editora Plenitude).pdf";
const APPLY = process.argv.includes("--apply");
const GENERIC_CLASSIFICATION_NOTE = /^Classificada conservadoramente como Outras formulações.+$/u;

type ComponentKind = "HERBAL" | "SUPPLEMENT" | "AMBIGUOUS";

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/gu, " ")
    .trim();
}

const HERBAL_COMPONENT = /(?:abacateiro|aesculus|agnus castus|alcachofra|alecrim|angelica sinensis|ashwagandha|ashwaganda|withania|whitania|whitamia|astragalus|avena sativa|bacopa|beet root|beta vulgaris|bulbine natalensis|cacau|theobroma|cafe verde|green coffee|camellia|cha verde|camomila|matricaria|canela|cinnamon|castanha da india|cavalinha|centella|centelha asiatica|cissus quadr|citrus aurantium|citrus ?sinensis|coleos|coleus|colleus|cordyceps|cranberry|cramberry|crocus|croccus|curcuma longa|curcumis melo|epimedium|equisetum|euryc|ext(?:rato)? seco (?:alho|gengibre|propolis)|ext alho|extrato de roma|feno grego|ganoderma|garcinia|gengibre|ginkgo|ginseng|glycyrrhiza|goji berry|griffonia|groselha negra|guarana|gymnema|gymnostema|hamamelis|hibisc|laminaria|lepidium|magnolia|marapu|melissa|morus nigra|mucuna|mulungu|oleo de (?:abacate|borago|primula|semente de abobora)|\bol coco\b|opuntia|opunta|panax|passiflora|pepper nigr|phelodendron|pinus|pinnus|polypod|propolis|prunus africana|punica|pomegranate|pycnogenol|redclover|rhodiola|sceletium|silimarina|taraxacum|tint(?:berberis|propolis| alecrim)|trifolium|vaccinium|vitex|vitis|yam mexicano)/u;

const SUPPLEMENT_COMPONENT = /(?:^3-indol|^5[- ]?htp$|\barginina\b|\bprolina\b|alfa[- ]?lipo|alpha[- ]?lipo|ac lip[oó]ico|acido malico|berberina|curcumina|fosfatid|hialur[oô]nico|urs[oó]lico|carnitina|carntina|aspartico|f[oó]lico|pantot[eê]nico|amido resistente|amilase|alpha gpc|astaxantina|beta caroteno|betacaroteno|beta glucan|beta[- ]alanina|beta[ií]na|bifid|bificobacter|bifidubacter|bifobacter|bacillus clausii|biotina|boro quel|bromelina|cafe[ií]na|c[aá]lcio|capsiate|ciste[ií]na|cistina|citicolina|citrulina|cobre quel|cobamamida|coenzima|col[aá]geno|colina|condroitina|crisina|cromo|d mannose|d ribose|dha|dmae|egcg|faseolamina|fenilalanina|ferro quel|ferrin|fibergum|fibergrum|\bfos\b|fucoxantina|\bgaba\b|glucoman|glutamina|glutationa|goma acacia|goma guar|herbatonin|hexanicotinato|\bhmb\b|hidroxitirosol|inositol|inulina|kaempferol|l\s*[-–]?\s*(?:arginina|cisteina|cistina|glicina|glutationa|prolina|teanina|theanina|tirosina|tyrosina|triptofano)|^l (?:acidophillus|crispatus|rhamnosus)$|lacota|lactase|lactobac|lactobacil|lactococ|lactooc|lactoferrina|libifem|licopeno|lipase|lisina|luteina|magn[eé]sio|mangan[eê]s|melatonina|metilcobalamina|metilfolato|metionina|molibd[eê]nio|\bmsm\b|myo-inositol|n acetil|\bnac\b|niacina|nicotinamida|omega|p5p|\bpaba\b|palmitato de ascorbila|pancreatina|papaina|pectina|pepsina|picolinato|picolanato|piperina|piridox|pot[aá]ssio|\bpqq\b|proantocian|prontaciandina|protease|psyllium|quercetina|queratina|quitosana|resveratrol|riboflavina|rutina|\bsame\b|saccharomyces|sacharomyces|sais biliares|selenio|seleniometionina|selenometionina|serrapeptidase|silicio|siliciumax|spirulina|streptococ|sulfato de glucosamina|sulfato de magn[eé]sio|taurina|teacrine|theanina|tiamina|trans-resveratrol|triptofano|turkesterone|\buc ?2\b|van[aá]dio|verisol|viatmina|vit(?:\.|amina|amin )? ?b\d|vitamina|zeaxantina|zinco)/u;

function componentName(line: string) {
  return line.split(" — ")[0]?.trim() ?? "";
}

function classifyComponent(name: string): ComponentKind {
  const value = normalized(name);
  if (HERBAL_COMPONENT.test(value)) return "HERBAL";
  if (SUPPLEMENT_COMPONENT.test(value)) return "SUPPLEMENT";
  return "AMBIGUOUS";
}

function classifyFormula(componentLines: readonly string[]) {
  const components = componentLines.map(componentName).filter(Boolean);
  const classified = components.map((name) => ({ name, kind: classifyComponent(name) }));
  const kinds = new Set(classified.map((component) => component.kind));
  const ambiguous = classified.filter((component) => component.kind === "AMBIGUOUS").map((component) => component.name);
  let category: PrescriptionItemCategory;
  if (ambiguous.length || kinds.size > 1) category = "OTHER_FORMULATION";
  else if (kinds.has("HERBAL")) category = "HERBAL";
  else category = "SUPPLEMENT";
  return { category, ambiguous, kinds: [...kinds] };
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function revisedAmbiguities(current: unknown, ambiguous: readonly string[], mixed: boolean) {
  const retained = (typeof current === "string" ? current : "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !GENERIC_CLASSIFICATION_NOTE.test(line));
  if (mixed) retained.push("Classificação mantida em Outras formulações por associar componentes fitoterápicos e de suplementação no mesmo quadro.");
  if (ambiguous.length) retained.push(`Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: ${ambiguous.join(", ")}.`);
  return [...new Set(retained)].join("\n");
}

async function main() {
  const professional = await prisma.user.findFirstOrThrow({
    where: { fullName: "Saulo Xavier Vitorino", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const records = await prisma.scientificLibraryRecord.findMany({
    where: { createdByUserId: professional.id, importFileName: SOURCE_FILE },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      domain: true,
      tags: true,
      metadata: true,
      limitations: true,
      professionalNotes: true,
    },
  });
  const reviewed = records.map((record) => {
    const metadata = objectValue(record.metadata);
    const attributes = objectValue(metadata.attributes);
    const components = typeof attributes[FORMULA_MODEL_ATTRIBUTE.components] === "string"
      ? attributes[FORMULA_MODEL_ATTRIBUTE.components].split(/\r?\n/u).filter(Boolean)
      : [];
    const classification = classifyFormula(components);
    const previous = typeof attributes[FORMULA_MODEL_ATTRIBUTE.category] === "string"
      ? attributes[FORMULA_MODEL_ATTRIBUTE.category] as PrescriptionItemCategory
      : "OTHER_FORMULATION";
    const sourcePage = typeof attributes[FORMULA_MODEL_ATTRIBUTE.sourcePage] === "string"
      ? attributes[FORMULA_MODEL_ATTRIBUTE.sourcePage]
      : "";
    const mixed = classification.kinds.includes("HERBAL") && classification.kinds.includes("SUPPLEMENT");
    const ambiguities = revisedAmbiguities(
      attributes[FORMULA_MODEL_ATTRIBUTE.ambiguities],
      classification.ambiguous,
      mixed,
    );
    const nextAttributes = {
      ...attributes,
      [FORMULA_MODEL_ATTRIBUTE.category]: classification.category,
      [FORMULA_MODEL_ATTRIBUTE.ambiguities]: ambiguities,
      [FORMULA_MODEL_ATTRIBUTE.importReview]: "Importado — pendente de revisão",
    };
    const tags = stringArray(record.tags).filter((tag) => !["HERBAL", "SUPPLEMENT", "OTHER_FORMULATION"].includes(tag));
    return {
      record,
      previous,
      sourcePage,
      category: classification.category,
      ambiguous: classification.ambiguous,
      mixed,
      metadata: { ...metadata, attributes: nextAttributes },
      tags: [...tags, classification.category],
      domain: classification.category === "SUPPLEMENT" ? "SUPPLEMENT" : "FORMULATION",
      ambiguities,
    };
  });

  if (APPLY) {
    await prisma.$transaction(async (transaction) => {
      for (const item of reviewed) {
        await transaction.scientificLibraryRecord.update({
          where: { id: item.record.id },
          data: {
            domain: item.domain,
            tags: item.tags,
            metadata: JSON.parse(JSON.stringify(item.metadata)),
            professionalNotes: item.ambiguities || null,
            limitations: [
              "Importado — pendente de revisão",
              item.ambiguities,
              "A presença no guia não comprova validação clínica da formulação.",
            ].filter(Boolean).join("\n"),
            updatedByUserId: professional.id,
            changeReason: "Conferência de classificação por composição do PDF de origem; sem validação clínica.",
          },
        });
      }
    });
  }

  const totals = reviewed.reduce<Record<PrescriptionItemCategory, number>>((result, item) => {
    result[item.category] += 1;
    return result;
  }, { HERBAL: 0, SUPPLEMENT: 0, OTHER_FORMULATION: 0 });
  const changes = reviewed.filter((item) => item.previous !== item.category);
  const ambiguous = reviewed.filter((item) => item.ambiguous.length);
  const mixed = reviewed.filter((item) => item.mixed);
  const reasonCounts = {
    mixedOnly: reviewed.filter((item) => item.mixed && !item.ambiguous.length).length,
    ambiguousOnly: reviewed.filter((item) => !item.mixed && item.ambiguous.length).length,
    mixedAndAmbiguous: reviewed.filter((item) => item.mixed && item.ambiguous.length).length,
  };
  console.log(JSON.stringify({
    mode: APPLY ? "APPLY" : "DRY_RUN",
    reviewed: reviewed.length,
    totals,
    changed: changes.length,
    changes: changes.map((item) => ({ name: item.record.name, from: item.previous, to: item.category })),
    mixed: mixed.length,
    ambiguous: ambiguous.length,
    reasonCounts,
    ambiguousItems: ambiguous.map((item) => ({ name: item.record.name, sourcePage: item.sourcePage, components: item.ambiguous })),
  }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

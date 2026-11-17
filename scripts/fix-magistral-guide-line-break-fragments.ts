import "dotenv/config";

import { FORMULA_MODEL_ATTRIBUTE } from "@/features/herbal-prescriptions/formula-library";
import type { PrescriptionItemCategory } from "@/features/herbal-prescriptions/contracts";
import { prisma } from "@/lib/database/prisma";

const SOURCE_FILE = "Guia Magistral (Editora Plenitude).pdf";
const APPLY = process.argv.includes("--apply");
const IMPORT_REVIEW = "Importado — pendente de revisão";
const CHANGE_REASON = "Correção de transcrição de fragmentos de quebra de linha conferida no PDF de origem; sem aprovação clínica.";
const BASE_AMBIGUITIES = [
  "Apresentação e cuidados essenciais não informados no quadro de origem.",
  "Grafias, quantidades e unidades foram preservadas literalmente e requerem revisão profissional.",
] as const;
const SOURCE_LIMITATION = "A presença no guia não comprova validação clínica da formulação.";

type Correction = {
  readonly name: string;
  readonly sourcePage: string;
  readonly before: {
    readonly components: string;
    readonly use: string;
    readonly ambiguities: string;
    readonly category: PrescriptionItemCategory;
  };
  readonly after: {
    readonly components: string;
    readonly use: string;
    readonly ambiguities: string;
    readonly category: PrescriptionItemCategory;
  };
  readonly adjustment: string;
  readonly pending: readonly string[];
};

function lines(...values: readonly (string | readonly string[])[]) {
  return values.flat().join("\n");
}

const corrections: readonly Correction[] = [
  {
    name: "ANSIEDADE – RELACIONADA A DOENÇAS NEURODEGENERATIVAS**",
    sourcePage: "05 (página 22 do PDF)",
    before: {
      components: lines("padronizado) — 8mg", "Gomas sabor á escolher qsp — 1 un"),
      use: "Comer 1 goma, diariamente.",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "O asterisco do título pertence à faixa de custo do guia e não representa classificação de evidência.",
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: padronizado), Gomas sabor á escolher qsp.",
      ),
      category: "OTHER_FORMULATION",
    },
    after: {
      components: lines(
        "Zembrim (Sceletium tortuosum, extrato padronizado) — 8mg",
        "Gomas sabor á escolher qsp — 1 un",
      ),
      use: "Comer 1 goma, diariamente.",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "O asterisco do título pertence à faixa de custo do guia e não representa classificação de evidência.",
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Gomas sabor á escolher qsp.",
      ),
      category: "OTHER_FORMULATION",
    },
    adjustment: "Recomposto o componente Zembrim; “padronizado)” deixou de ser componente independente.",
    pending: ["Apresentação e cuidados essenciais ausentes; “Gomas sabor á escolher qsp” permanece ambíguo."],
  },
  {
    name: "Fertilidade / libido - 2",
    sourcePage: "11 (página 54 do PDF)",
    before: {
      components: lines(
        "Feno Grego — 200 mg",
        "Ginseng coreano vermelho — 200 mg",
        "Ginkgo biloba — 200 mg",
        "Marapuana — 200 mg",
        "Mucuna pruriens — 200 mg",
        "Eurycima longifólia — 150 mg",
        "Tomar — 1 dose antes do treino.",
      ),
      use: lines(
        "Tomar 1 dose antes do treino. Tomar 1 dose, diariamente",
        "Tomar 1 dose, diariamente",
      ),
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "O quadro contém mais de um modo de uso; a associação foi preservada no mesmo modelo e na ordem impressa.",
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Tomar.",
      ),
      category: "OTHER_FORMULATION",
    },
    after: {
      components: lines(
        "Feno Grego — 200 mg",
        "Ginseng coreano vermelho — 200 mg",
        "Ginkgo biloba — 200 mg",
        "Marapuana — 200 mg",
        "Mucuna pruriens — 200 mg",
        "Eurycima longifólia — 150 mg",
      ),
      use: lines("Tomar 1 dose antes do treino.", "Tomar 1 dose, diariamente"),
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "O quadro contém mais de um modo de uso; a associação foi preservada no mesmo modelo e na ordem impressa.",
      ),
      category: "HERBAL",
    },
    adjustment: "Removido “Tomar” dos componentes e recompostas, sem duplicação, as duas linhas de modo de uso.",
    pending: ["Apresentação e cuidados essenciais ausentes; os dois modos de uso seguem pendentes de revisão profissional."],
  },
  {
    name: "Prevenção flacidez durante a gestação",
    sourcePage: "12 (página 55 do PDF)",
    before: {
      components: lines(
        "Colágeno hidrolisado — 8 g",
        "Exynutriment® — 100 mg",
        "Vitamina C — 100 mg",
        "Diluir 1 sachê em — 200ml de água fria/gelada",
      ),
      use: "Tomar 1 dose, diariamente, antes de dormir.",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Exynutriment®, Diluir 1 sachê em.",
      ),
      category: "OTHER_FORMULATION",
    },
    after: {
      components: lines(
        "Colágeno hidrolisado — 8 g",
        "Exynutriment® — 100 mg",
        "Vitamina C — 100 mg",
      ),
      use: lines(
        "Tomar 1 dose, diariamente, antes de dormir.",
        "Diluir 1 sachê em 200ml de água fria/gelada",
      ),
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Exynutriment®.",
      ),
      category: "OTHER_FORMULATION",
    },
    adjustment: "Movida a linha “Diluir 1 sachê em 200ml de água fria/gelada” dos componentes para o modo de uso.",
    pending: ["Apresentação e cuidados essenciais ausentes; Exynutriment® permanece sem enquadramento inequívoco."],
  },
  {
    name: "2 - QUEDA DE CABELOS (AUMENTO DA RESISTÊNCIA E ESPESSURA CAPILAR) E FORTALECEDOR DE UNHAS",
    sourcePage: "06 (página 112 do PDF)",
    before: {
      components: lines(
        "Exynutriment — 150 mg",
        "Queratina — 60 mg",
        "Pantotenato de cálcio — 50 mg",
        "Biotina — 3 mg",
        "L-Cistina — 50 mg",
        "L-cisteína — 100 mg",
        "Zinco quelado — 15 mg",
        "Ferro Quelado* — 15 mg",
        "Vitamina C — 200 mg",
        "Vitamina D — 4.000 UI",
        "Verisol — 5 gramas",
        "em — 200 ml de água.",
      ),
      use: "Tomar 1 sachê pela manhã diluído",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Exynutriment, em.",
      ),
      category: "OTHER_FORMULATION",
    },
    after: {
      components: lines(
        "Exynutriment — 150 mg",
        "Queratina — 60 mg",
        "Pantotenato de cálcio — 50 mg",
        "Biotina — 3 mg",
        "L-Cistina — 50 mg",
        "L-cisteína — 100 mg",
        "Zinco quelado — 15 mg",
        "Ferro Quelado* — 15 mg",
        "Vitamina C — 200 mg",
        "Vitamina D — 4.000 UI",
        "Verisol — 5 gramas",
      ),
      use: "Tomar 1 sachê pela manhã diluído em 200 ml de água.",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: Exynutriment.",
      ),
      category: "OTHER_FORMULATION",
    },
    adjustment: "Incorporado “em 200 ml de água.” ao modo de uso; “em” deixou de ser componente independente.",
    pending: ["Apresentação e cuidados essenciais ausentes; Exynutriment permanece sem enquadramento inequívoco."],
  },
  {
    name: "PROBIÓTICO 2 – ALOPECIA",
    sourcePage: "06 (página 112 do PDF)",
    before: {
      components: lines(
        "Lactobacillus Rhamnosus — 3 blh UFC",
        "Lactobacillus Paracasei — 2 blh UFC",
        "Bifidobacterium Bifidum — 2 blh UFC",
        "Bifidobacterium Gasseri — 3 blh UFC",
        "Lactobacillus Lactis — 1 blh UFC",
        "Amido Resistente — 2 gramas",
        "Fibergum B — 3 gramas",
        "em — 200 ml de água.",
      ),
      use: "Tomar 1 sachê pela manhã diluído",
      ambiguities: lines(
        BASE_AMBIGUITIES,
        "Classificação mantida em Outras formulações por componente(s) sem enquadramento inequívoco no PDF: em.",
      ),
      category: "OTHER_FORMULATION",
    },
    after: {
      components: lines(
        "Lactobacillus Rhamnosus — 3 blh UFC",
        "Lactobacillus Paracasei — 2 blh UFC",
        "Bifidobacterium Bifidum — 2 blh UFC",
        "Bifidobacterium Gasseri — 3 blh UFC",
        "Lactobacillus Lactis — 1 blh UFC",
        "Amido Resistente — 2 gramas",
        "Fibergum B — 3 gramas",
      ),
      use: "Tomar 1 sachê pela manhã diluído em 200 ml de água.",
      ambiguities: lines(BASE_AMBIGUITIES),
      category: "SUPPLEMENT",
    },
    adjustment: "Incorporado “em 200 ml de água.” ao modo de uso; “em” deixou de ser componente independente.",
    pending: ["Apresentação e cuidados essenciais ausentes; grafias, quantidades e unidades seguem pendentes de revisão profissional."],
  },
] as const;

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function categoryDomain(category: PrescriptionItemCategory) {
  return category === "SUPPLEMENT" ? "SUPPLEMENT" : "FORMULATION";
}

function revisedTags(value: unknown, category: PrescriptionItemCategory) {
  return [
    ...stringArray(value).filter((tag) => !["HERBAL", "SUPPLEMENT", "OTHER_FORMULATION"].includes(tag)),
    category,
  ];
}

function limitations(ambiguities: string) {
  return lines(IMPORT_REVIEW, ambiguities, SOURCE_LIMITATION);
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const professional = await prisma.user.findFirstOrThrow({
    where: { fullName: "Saulo Xavier Vitorino", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const totalBefore = await prisma.scientificLibraryRecord.count({
    where: { createdByUserId: professional.id, importFileName: SOURCE_FILE },
  });
  if (totalBefore !== 234) {
    throw new Error(`Contagem inesperada antes da correção: ${totalBefore}; esperado: 234.`);
  }

  const results = await prisma.$transaction(async (transaction) => {
    const output: Array<Record<string, unknown>> = [];
    for (const correction of corrections) {
      const matches = await transaction.scientificLibraryRecord.findMany({
        where: {
          createdByUserId: professional.id,
          importFileName: SOURCE_FILE,
          name: correction.name,
        },
        select: {
          id: true,
          name: true,
          domain: true,
          tags: true,
          metadata: true,
          professionalNotes: true,
          limitations: true,
          status: true,
          editorialStatus: true,
          editorialVersion: true,
          changeReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const records = matches.filter((record) => {
        const attributes = objectValue(objectValue(record.metadata).attributes);
        return attributes[FORMULA_MODEL_ATTRIBUTE.sourcePage] === correction.sourcePage;
      });
      if (records.length !== 1) {
        throw new Error(`${correction.name}: esperado um registro em ${correction.sourcePage}; encontrados ${records.length}.`);
      }

      const record = records[0];
      const metadata = objectValue(record.metadata);
      const attributes = objectValue(metadata.attributes);
      const current = {
        components: attributes[FORMULA_MODEL_ATTRIBUTE.components],
        use: attributes[FORMULA_MODEL_ATTRIBUTE.use],
        ambiguities: attributes[FORMULA_MODEL_ATTRIBUTE.ambiguities],
        category: attributes[FORMULA_MODEL_ATTRIBUTE.category],
      };
      const matchesState = (state: Correction["before"] | Correction["after"]) =>
        current.components === state.components &&
        current.use === state.use &&
        current.ambiguities === state.ambiguities &&
        current.category === state.category;
      const alreadyCorrected = matchesState(correction.after);
      if (!alreadyCorrected && !matchesState(correction.before)) {
        throw new Error(`${correction.name}: conteúdo divergiu tanto do estado original sinalizado quanto da correção esperada.`);
      }
      if (attributes[FORMULA_MODEL_ATTRIBUTE.importReview] !== IMPORT_REVIEW || record.status !== "REVIEW" || record.editorialStatus !== "UNDER_REVIEW") {
        throw new Error(`${correction.name}: status de revisão inesperado; a correção foi interrompida.`);
      }

      if (APPLY && !alreadyCorrected) {
        await transaction.scientificLibraryRevision.create({
          data: {
            recordId: record.id,
            version: record.editorialVersion,
            snapshot: json({
              record,
              traceability: {
                sourceFile: SOURCE_FILE,
                sourcePage: correction.sourcePage,
                originalComponents: correction.before.components,
                originalUse: correction.before.use,
                adjustment: correction.adjustment,
              },
            }),
            editorialStatus: record.editorialStatus,
            changedByUserId: professional.id,
            changeReason: CHANGE_REASON,
          },
        });
        const nextAttributes = {
          ...attributes,
          [FORMULA_MODEL_ATTRIBUTE.components]: correction.after.components,
          [FORMULA_MODEL_ATTRIBUTE.use]: correction.after.use,
          [FORMULA_MODEL_ATTRIBUTE.ambiguities]: correction.after.ambiguities,
          [FORMULA_MODEL_ATTRIBUTE.category]: correction.after.category,
          [FORMULA_MODEL_ATTRIBUTE.importReview]: IMPORT_REVIEW,
        };
        await transaction.scientificLibraryRecord.update({
          where: { id: record.id },
          data: {
            domain: categoryDomain(correction.after.category),
            tags: json(revisedTags(record.tags, correction.after.category)),
            metadata: json({ ...metadata, attributes: nextAttributes }),
            professionalNotes: correction.after.ambiguities,
            limitations: limitations(correction.after.ambiguities),
            updatedByUserId: professional.id,
            editorialVersion: record.editorialVersion + 1,
            changeReason: CHANGE_REASON,
          },
        });
      }
      output.push({
        name: correction.name,
        sourcePage: correction.sourcePage,
        result: alreadyCorrected ? "UNCHANGED" : APPLY ? "CORRECTED" : "WOULD_CORRECT",
        adjustment: correction.adjustment,
        pending: correction.pending,
      });
    }
    return output;
  });

  const persisted = await prisma.scientificLibraryRecord.findMany({
    where: { createdByUserId: professional.id, importFileName: SOURCE_FILE },
    select: {
      name: true,
      domain: true,
      metadata: true,
      status: true,
      editorialStatus: true,
      revisions: {
        where: { changeReason: CHANGE_REASON },
        select: { id: true },
      },
    },
  });
  const suspicious = persisted.flatMap((record) => {
    const attributes = objectValue(objectValue(record.metadata).attributes);
    const components = typeof attributes[FORMULA_MODEL_ATTRIBUTE.components] === "string"
      ? attributes[FORMULA_MODEL_ATTRIBUTE.components]
      : "";
    return components.split(/\r?\n/u).flatMap((line) =>
      /^(?:Tomar|Diluir 1 sachê em|em|padronizado\))\s*—/iu.test(line)
        ? [{ name: record.name, line }]
        : []
    );
  });
  const invalidReviewStatus = persisted.flatMap((record) => {
    const attributes = objectValue(objectValue(record.metadata).attributes);
    return attributes[FORMULA_MODEL_ATTRIBUTE.importReview] === IMPORT_REVIEW &&
      record.status === "REVIEW" &&
      record.editorialStatus === "UNDER_REVIEW"
      ? []
      : [record.name];
  });
  if (persisted.length !== 234 || invalidReviewStatus.length) {
    throw new Error(`Verificação final falhou: total=${persisted.length}, status inválido=${invalidReviewStatus.length}.`);
  }
  if (APPLY && suspicious.length) {
    throw new Error(`Ainda existem fragmentos independentes: ${JSON.stringify(suspicious)}.`);
  }
  const verification = corrections.map((correction) => {
    const matches = persisted.filter((record) => {
      const attributes = objectValue(objectValue(record.metadata).attributes);
      return record.name === correction.name &&
        attributes[FORMULA_MODEL_ATTRIBUTE.sourcePage] === correction.sourcePage;
    });
    if (matches.length !== 1) {
      throw new Error(`${correction.name}: verificação final não encontrou exatamente um registro.`);
    }
    const record = matches[0];
    const attributes = objectValue(objectValue(record.metadata).attributes);
    const valid =
      attributes[FORMULA_MODEL_ATTRIBUTE.components] === correction.after.components &&
      attributes[FORMULA_MODEL_ATTRIBUTE.use] === correction.after.use &&
      attributes[FORMULA_MODEL_ATTRIBUTE.ambiguities] === correction.after.ambiguities &&
      attributes[FORMULA_MODEL_ATTRIBUTE.category] === correction.after.category &&
      attributes[FORMULA_MODEL_ATTRIBUTE.importReview] === IMPORT_REVIEW &&
      record.domain === categoryDomain(correction.after.category) &&
      record.status === "REVIEW" &&
      record.editorialStatus === "UNDER_REVIEW";
    if (APPLY && (!valid || record.revisions.length !== 1)) {
      throw new Error(`${correction.name}: estado final ou rastreabilidade inválidos.`);
    }
    return {
      name: correction.name,
      valid,
      traceRevisions: record.revisions.length,
      category: correction.after.category,
    };
  });

  console.log(JSON.stringify({
    mode: APPLY ? "APPLY" : "DRY_RUN",
    totalBefore,
    totalAfter: persisted.length,
    corrected: results.filter((result) => result.result === "CORRECTED").length,
    unchanged: results.filter((result) => result.result === "UNCHANGED").length,
    suspiciousFragmentsAfter: suspicious,
    verification,
    results,
  }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

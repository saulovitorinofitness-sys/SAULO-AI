import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HerbalPrescriptionDocument } from "../../components/herbal-prescriptions/herbal-prescription-document";
import { moveHerbalPrescriptionItem } from "../../components/herbal-prescriptions/herbal-prescription-workspace";
import type { HerbalPrescriptionView } from "./contracts";
import {
  FORMULA_MODEL_ATTRIBUTE,
  formulaModelDisplayName,
  formulaModelSearchText,
  formulaModelToPrescriptionItem,
  importedFormulaModelDraft,
} from "./formula-library";
import { normalizeScientificLibraryName } from "@/features/scientific-library/management-contracts";
import { parseHerbalPrescriptionMetadata } from "./repository";
import {
  HerbalPrescriptionValidationError,
  normalizeHerbalPrescriptionContent,
} from "./service";

test("preserva todos os campos antigos ao normalizar, salvar e reabrir", () => {
  const original = {
    items: [{
      category: "OTHER_FORMULATION",
      identification: "F\u00f3rmula de teste",
      scientificName: "Nome cient\u00edfico de teste",
      plantPart: "Parte de teste",
      presentation: "Apresenta\u00e7\u00e3o de teste",
      concentrationStandardization: "Padroniza\u00e7\u00e3o de teste",
      dose: "Dose de teste",
      route: "Via de teste",
      frequency: "Frequ\u00eancia de teste",
      duration: "Dura\u00e7\u00e3o de teste",
      quantity: "Quantidade de teste",
      orientations: "Modo de usar de teste",
      components: [{
        identification: "Componente de teste",
        scientificName: "Nome cient\u00edfico do componente",
        plantPart: "Parte do componente",
        concentrationStandardization: "Padroniza\u00e7\u00e3o do componente",
      }],
    }],
  };
  const saved = normalizeHerbalPrescriptionContent(original);
  const reopened = normalizeHerbalPrescriptionContent(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reopened, saved);
  assert.deepEqual(reopened, original);
});

test("limpa enumeracao e asteriscos somente na apresentacao do titulo", () => {
  const original = "12 \u2014 F\u00f3rmula de teste*";
  assert.equal(formulaModelDisplayName(original), "F\u00f3rmula de teste");
  assert.equal(original, "12 \u2014 F\u00f3rmula de teste*");
  assert.equal(formulaModelDisplayName("5-HTP"), "5-HTP");
});

const testView: HerbalPrescriptionView = {
  id: "internal-document-id",
  masterRecordId: "internal-master-record-id",
  status: "DRAFT",
  version: 1,
  title: "Prescrição de fitoterápicos",
  content: {
    items: [{
      category: "HERBAL",
      identification: "TESTE — SEM VALIDADE CLÍNICA",
      scientificName: "NOME CIENTÍFICO FICTÍCIO",
      presentation: "APRESENTAÇÃO FICTÍCIA",
      dose: "UNIDADE-FICTÍCIA TESTE",
      orientations: "CONTEÚDO DE TESTE SEM USO TERAPÊUTICO.",
      components: [],
    }],
  },
  history: [],
  patient: {
    id: "internal-patient-id",
    clinicalCode: "SVTESTE",
    fullName: "Pessoa de Teste",
    birthDate: "1990-01-01",
  },
  responsibleProfessional: {
    userId: "internal-user-id",
    fullName: "Profissional de Teste",
    nutritionTitle: "Nutricionista",
    crnRegistration: "CRN TESTE",
  },
  createdAt: "2026-10-29T12:00:00.000Z",
  updatedAt: "2026-10-29T12:00:00.000Z",
};

test("preserva exatamente textos e unidades informados sem completar conteúdo", () => {
  const content = normalizeHerbalPrescriptionContent({
    items: [{
      identification: "  TESTE — SEM VALIDADE CLÍNICA  ",
      scientificName: "Nome fictício  ",
      plantPart: "Parte TESTE",
      presentation: "Apresentação 10 unid. TESTE",
      concentrationStandardization: "PADRÃO-FICTÍCIO 7 TESTE",
      dose: "  3 unidade-teste  ",
      route: "via-fictícia",
      frequency: "frequência-teste",
      duration: "duração-teste",
      quantity: "quantidade-teste",
      orientations: "  orientação fictícia  ",
      components: [],
    }],
  });
  assert.equal(content.items[0]?.identification, "  TESTE — SEM VALIDADE CLÍNICA  ");
  assert.equal(content.items[0]?.dose, "  3 unidade-teste  ");
  assert.equal(content.items[0]?.orientations, "  orientação fictícia  ");
  assert.equal(content.items[0]?.components.length, 0);
});

test("aceita composição manual com múltiplos componentes e não inventa campos", () => {
  const content = normalizeHerbalPrescriptionContent({
    items: [{
      identification: "TESTE — SEM VALIDADE CLÍNICA",
      components: [
        { identification: "Componente fictício A", scientificName: "Espécie fictícia A" },
        { identification: "Componente fictício B", concentrationStandardization: "Padrão fictício B" },
      ],
    }],
  });
  assert.equal(content.items[0]?.components.length, 2);
  assert.equal(content.items[0]?.components[0]?.scientificName, "Espécie fictícia A");
  assert.equal(content.items[0]?.dose, undefined);
  assert.equal(content.items[0]?.components[1]?.plantPart, undefined);
});

test("itens podem ser reordenados sem alterar seu conteúdo", () => {
  const items = [{ name: "A" }, { name: "B" }, { name: "C" }];
  assert.deepEqual(moveHerbalPrescriptionItem(items, 2, -1), [{ name: "A" }, { name: "C" }, { name: "B" }]);
  assert.deepEqual(moveHerbalPrescriptionItem(items, 0, -1), items);
});

test("modelo da Biblioteca é pesquisável e copiado sem vínculo mutável", () => {
  const model = {
    id: "model-1",
    area: "NUTRITION",
    domain: "SUPPLEMENT",
    name: "MODELO TESTE SEM VALIDADE CLÍNICA",
    category: "Suplementos",
    description: "Finalidade fictícia para validação",
    source: "Fonte de teste",
    tags: [],
    attributes: {
      [FORMULA_MODEL_ATTRIBUTE.category]: "SUPPLEMENT",
      [FORMULA_MODEL_ATTRIBUTE.components]: "Componente inerte TESTE — 1 unidade-fictícia",
      [FORMULA_MODEL_ATTRIBUTE.use]: "Modo fictício sem aplicação terapêutica",
    },
    reusableBy: [],
    initiallyFavorite: false,
  } as const;
  assert.match(formulaModelSearchText(model), /componente inerte teste/u);
  assert.match(formulaModelSearchText(model), /finalidade ficticia/u);
  const copy = formulaModelToPrescriptionItem(model);
  assert.equal(copy.category, "SUPPLEMENT");
  assert.equal(copy.orientations, "Modo fict\u00edcio sem aplica\u00e7\u00e3o terap\u00eautica");
  assert.equal(copy.components[0]?.identification, "Componente inerte TESTE — 1 unidade-fictícia");
  const edited = { ...copy, identification: "CÓPIA EDITADA" };
  assert.equal(model.name, "MODELO TESTE SEM VALIDADE CLÍNICA");
  assert.equal(edited.identification, "CÓPIA EDITADA");
});

test("modelos previnem variações de nome e importação fica pendente de revisão", () => {
  assert.equal(
    normalizeScientificLibraryName("  Fórmula   TESTE "),
    normalizeScientificLibraryName("formula teste"),
  );
  const draft = importedFormulaModelDraft({
    name: "TESTE — MODELO IMPORTADO",
    category: "OTHER_FORMULATION",
    purpose: "",
    components: "Componente exatamente transcrito — 1 unidade-teste",
    presentation: "",
    use: "Modo exatamente transcrito",
    care: "",
    sourcePage: "12",
    ambiguities: "Finalidade ausente no original.",
  });
  assert.equal(draft.editorialStatus, "UNDER_REVIEW");
  assert.equal(draft.attributes[FORMULA_MODEL_ATTRIBUTE.importReview], "Importado — pendente de revisão");
  assert.equal(draft.attributes[FORMULA_MODEL_ATTRIBUTE.sourcePage], "12");
  assert.match(draft.limitations ?? "", /não comprova validação clínica/u);
});

test("emissão exige conteúdo identificado sem criar regra clínica adicional", async () => {
  const service = await readFile(new URL("./service.ts", import.meta.url), "utf8");
  assert.match(service, /ITEMS_REQUIRED_TO_ISSUE/);
  assert.match(service, /ITEM_IDENTIFICATION_REQUIRED/);
  assert.doesNotMatch(service, /indicação|contraindicação|posologia recomendada|dose recomendada/iu);
  assert.throws(
    () => normalizeHerbalPrescriptionContent({ items: "inválido" }),
    (error) => error instanceof HerbalPrescriptionValidationError && error.code === "INVALID_CONTENT",
  );
});

test("persistência reutiliza Deliverable, MasterRecord, histórico, snapshot e isolamento por pessoa", async () => {
  const repository = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  assert.match(repository, /prisma\.deliverable\.findMany/);
  assert.match(repository, /masterRecord:\s*\{[\s\S]*patientId/);
  assert.match(repository, /kind: HERBAL_PRESCRIPTION_KIND/);
  assert.match(repository, /history: \[\.\.\.metadata\.history/);
  assert.match(repository, /issuedSnapshot/);
  assert.match(repository, /clinicInstitutionalDocumentIdentity\(\)/);
  assert.match(repository, /updateMany\([\s\S]*version: current\.version[\s\S]*status: "DRAFT"/);
  assert.doesNotMatch(repository, /prisma\.patient\.create|prisma\.masterRecord\.create/);
});

test("metadados reabrem rascunho e preservam revisão emitida", () => {
  const metadata = parseHerbalPrescriptionMetadata({
    schemaVersion: 1,
    prescriptionKey: "key",
    content: testView.content,
    history: [{
      revision: 1,
      action: "CREATED",
      occurredAt: testView.createdAt,
      actorUserId: "actor",
      actorName: "Profissional de Teste",
      content: testView.content,
    }, {
      revision: 2,
      action: "ISSUED",
      occurredAt: testView.updatedAt,
      actorUserId: "actor",
      actorName: "Profissional de Teste",
      content: testView.content,
    }],
  });
  assert.ok(metadata);
  assert.equal(metadata.history.length, 2);
  assert.equal(metadata.history[1]?.action, "ISSUED");
  assert.equal(metadata.content.items[0]?.dose, "UNIDADE-FICTÍCIA TESTE");
});

test("prévia transitória não salva, não emite e usa o conteúdo atual", async () => {
  const workspace = await readFile(
    new URL("../../components/herbal-prescriptions/herbal-prescription-workspace.tsx", import.meta.url),
    "utf8",
  );
  const document = await readFile(
    new URL("../../components/herbal-prescriptions/herbal-prescription-document.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspace, /transientPreview/);
  assert.match(workspace, /content: contentFromItems\(items\)/);
  assert.match(workspace, /Visualizar prévia/);
  assert.match(workspace, /Imprimir \/ Salvar PDF/);
  assert.doesNotMatch(document, /fetch\(|saveDraft|\.issue\(/);
});

test("documento usa identidade central, rascunho, paciente, carimbo e omite campos vazios", () => {
  const html = renderToStaticMarkup(createElement(HerbalPrescriptionDocument, {
    autoPrint: false,
    prescription: testView,
    preview: true,
  }));
  assert.match(html, /TESTE — SEM VALIDADE CLÍNICA/u);
  assert.match(html, /Rascunho - documento não emitido/u);
  assert.match(html, /Rua Raimundo Saraiva Coelho, 281/u);
  assert.match(html, /\(88\) 98884-7746/u);
  assert.match(html, /\(88\) 99999-1074/u);
  assert.match(html, /www\.saulovitorino\.com\.br/u);
  assert.match(html, /Pessoa de Teste/u);
  assert.match(html, /SVTESTE/u);
  assert.match(html, /Profissional de Teste/u);
  assert.match(html, /CRN TESTE/u);
  assert.doesNotMatch(html, /internal-document-id|internal-master-record-id|internal-user-id/u);
  assert.doesNotMatch(html, /Fundamentação|Lei nº 8\.234|Resolução CFN/u);
  assert.doesNotMatch(html, />Quantidade</u);
});

test("menu e Entregáveis apontam para a rota existente com as permissões atuais", async () => {
  const [menu, deliverables, page] = await Promise.all([
    readFile(new URL("../../components/auth/authenticated-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(authenticated)/entregaveis/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(authenticated)/entregaveis/fitoterapicos/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(menu, /id: "herbal-prescriptions"[\s\S]*href: "\/entregaveis\/fitoterapicos"[\s\S]*label: "Fitoterápicos"/u);
  assert.match(menu, /moduleKey: "MASTER_RECORD"[\s\S]*moduleKey: "DELIVERABLES"/u);
  assert.match(deliverables, /href="\/entregaveis\/fitoterapicos"/u);
  assert.match(page, /canAccess\(access, "MASTER_RECORD", "READ"\)/u);
  assert.match(page, /canAccess\(access, "DELIVERABLES", "READ"\)/u);
});

test("API aplica permissão de criação e exige revisão explícita antes da emissão", async () => {
  const [api, workspace] = await Promise.all([
    readFile(new URL("../../app/api/herbal-prescriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../components/herbal-prescriptions/herbal-prescription-workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /canAccess\(access, "DELIVERABLES", "CREATE"\)/u);
  assert.match(api, /body\.action === "ISSUE"/u);
  assert.match(workspace, /Revisar para emitir/u);
  assert.match(workspace, /Confirmar emissão/u);
  assert.match(workspace, /selected\.status === "DRAFT"/u);
});

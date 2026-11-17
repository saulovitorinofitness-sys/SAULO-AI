import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  addExamWithoutDuplicate,
  matchesCatalogSearch,
  moveExam,
} from "../../components/exam-requests/exam-request-workspace";
import { InstitutionalDocumentIdentity } from "../../components/documents/institutional-document-identity";
import {
  clinicInstitutionalDocumentIdentity,
  formatInstitutionalAddress,
} from "../../config/institution";
import { LABORATORY_EXAM_CATALOG } from "./laboratory-exam-catalog";
import { parseExamRequestMetadata } from "./repository";
import {
  ExamRequestValidationError,
  normalizeExamRequestContent,
} from "./service";

test("normaliza somente os campos clínicos aprovados e não sugere exames", () => {
  assert.deepEqual(normalizeExamRequestContent({
    requestedExams: ["  Exame informado pelo profissional  ", ""],
    justification: "  Justificativa opcional  ",
    orientations: "   ",
    result: "não pertence à solicitação",
  }), {
    requestedExams: ["Exame informado pelo profissional"],
    justification: "Justificativa opcional",
    orientations: undefined,
  });
});

test("impede emissão sem exame solicitado", async () => {
  const source = await readFile(new URL("./service.ts", import.meta.url), "utf8");
  assert.match(source, /EXAMS_REQUIRED_TO_ISSUE/);
  assert.doesNotMatch(source, /hemograma|glicemia|colesterol/iu);
});

test("documento de impressão é somente leitura e não expõe UUID", async () => {
  const source = await readFile(
    new URL("../../components/exam-requests/exam-request-document.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /window\.print\(\)/);
  assert.doesNotMatch(source, /fetch\(|request\.id|masterRecordId|userId/);
  assert.match(source, /Código clínico/);
});

test("conteúdo inválido produz erro de validação explícito", () => {
  assert.throws(
    () => normalizeExamRequestContent({ requestedExams: "texto" }),
    (error) => error instanceof ExamRequestValidationError && error.code === "INVALID_CONTENT",
  );
});

test("catálogo não duplica por clique e a lista pode ser reorganizada", () => {
  const initial = addExamWithoutDuplicate([], "Hemograma");
  assert.deepEqual(addExamWithoutDuplicate(initial, "  hemógrama "), initial);
  assert.deepEqual(
    addExamWithoutDuplicate(["Hormônio estimulante da tireoide"], "  HORMONIO   ESTIMULANTE DA TIREOIDE  "),
    ["Hormônio estimulante da tireoide"],
  );
  const withSecond = addExamWithoutDuplicate(initial, "Glicemia");
  assert.deepEqual(moveExam(withSecond, 1, -1), ["Glicemia", "Hemograma"]);
});

test("catálogo persistido localiza por nome, sinônimo e categoria", () => {
  const tsh = LABORATORY_EXAM_CATALOG.find((item) => item.name === "Hormônio estimulante da tireoide");
  assert.ok(tsh);
  const persistedItem = { id: "catalog-item", ...tsh, source: "PERSISTED" as const };
  assert.equal(matchesCatalogSearch(persistedItem, "tsh"), true);
  assert.equal(matchesCatalogSearch(persistedItem, "tireoide"), true);
  assert.equal(matchesCatalogSearch(persistedItem, "hemograma"), false);
});

test("normalização do servidor remove duplicações e ignora CPF neste fluxo", () => {
  assert.deepEqual(normalizeExamRequestContent({
    requestedExams: ["TSH", " tsh ", "Hemograma"],
    includePatientCpf: true,
  }), {
    requestedExams: ["TSH", "Hemograma"],
    justification: undefined,
    orientations: undefined,
  });
});

test("documento novo usa snapshot, assinatura manuscrita e fundamentação sem CREF", async () => {
  const source = await readFile(
    new URL("../../components/exam-requests/exam-request-document.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /issuedSnapshot/);
  assert.match(source, /Espaço em branco reservado para assinatura manuscrita/);
  assert.match(source, /Lei nº 8\.234\/1991/);
  assert.doesNotMatch(source, />CPF</u);
  assert.doesNotMatch(source, /issuedSnapshot\.professional[\s\S]{0,300}CREF/u);
});

test("rascunho possui prévia somente leitura sem emissão", async () => {
  const source = await readFile(
    new URL("../../app/(authenticated)/entregaveis/solicitacoes-exames/[requestId]/imprimir/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /preview && request\.status === "DRAFT"/u);
  assert.doesNotMatch(source, /saveDraft|\.issue\(/u);
});

test("solicitação nova oferece prévia e PDF com o estado transitório do editor", async () => {
  const source = await readFile(
    new URL("../../components/exam-requests/exam-request-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Visualizar prévia/u);
  assert.match(source, /Imprimir \/ Salvar PDF/u);
  assert.match(source, /transientPreview/u);
  assert.match(source, /requestedExams: \[\.\.\.requestedExams\]/u);
  assert.match(source, /Lei nº 8\.234\/1991, art\. 4º, VIII/u);
});

test("catálogo cadastra exame na Biblioteca sem adicioná-lo automaticamente ao pedido", async () => {
  const source = await readFile(
    new URL("../../components/exam-requests/exam-request-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Cadastrar exame/u);
  assert.match(source, /mode: "MANUAL"/u);
  assert.match(source, /domain: "LABORATORY_EXAM"/u);
  assert.match(source, /dataNature: "OPERATIONAL"/u);
  assert.match(source, /O cadastro não inclui o exame automaticamente/u);
  assert.match(source, /onCatalogCreated\(item\)/u);
  assert.match(source, /Use “\+ Adicionar” para incluí-lo na solicitação/u);
});

test("menu Atendimento aponta para a rota existente de solicitações", async () => {
  const source = await readFile(
    new URL("../../components/auth/authenticated-shell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /id: "exam-requests"[\s\S]*href: "\/entregaveis\/solicitacoes-exames"[\s\S]*label: "Solicitações de exames"/u);
  assert.match(source, /moduleKey: "MASTER_RECORD"[\s\S]*moduleKey: "DELIVERABLES"/u);
});

test("identificação institucional compartilhada apresenta endereço, WhatsApps e site confirmados", () => {
  const identity = clinicInstitutionalDocumentIdentity();
  assert.equal(
    formatInstitutionalAddress(identity.address),
    "Rua Raimundo Saraiva Coelho, 281 · Aeroporto · Juazeiro do Norte/CE · CEP 63020-730",
  );
  const html = renderToStaticMarkup(createElement(InstitutionalDocumentIdentity));
  assert.match(html, /Rua Raimundo Saraiva Coelho, 281/u);
  assert.match(html, /\(88\) 98884-7746/u);
  assert.match(html, /\(88\) 99999-1074/u);
  assert.match(html, /www\.saulovitorino\.com\.br/u);
});

test("snapshot legado v2 continua legível sem identidade institucional", () => {
  const metadata = parseExamRequestMetadata({
    schemaVersion: 2,
    requestKey: "legacy-request",
    content: { requestedExams: ["Exame existente"] },
    history: [],
    issuedSnapshot: {
      patient: {
        id: "patient-existing",
        clinicalCode: "SV-EXISTING",
        fullName: "Pessoa existente",
        birthDate: "1990-01-01",
      },
      professional: { fullName: "Profissional existente" },
    },
  });
  assert.ok(metadata);
  assert.equal(metadata.issuedSnapshot?.institution, undefined);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "dotenv/config";

import type { NutritionDeliverableDraft } from "./contracts";
import { parseNutritionReportMetadata } from "./persistence";

const snapshot = {
  deliverableId: "nutrition-deliverable:attendance-1:approved",
  patientId: "patient-1",
  attendanceId: "attendance-1",
  status: "APPROVED",
  approvedAt: "2026-10-24T12:00:00.000Z",
  cover: { patientName: "Paciente Teste" },
  clinicalDiagnosis: { content: "Diagnóstico revisado." },
  nutritionStrategy: { strategyId: "strategy-1" },
  mealPlan: { planId: "entry-1" },
  optionalSectionOrder: [],
} as unknown as NutritionDeliverableDraft;

const metadata = {
  schemaVersion: 1,
  attendanceId: "attendance-1",
  sourceEntryId: "entry-1",
  sourceVersionId: "source-version-4",
  sourceVersion: 4,
  approvedAt: "2026-10-24T12:00:00.000Z",
  approvedByUserId: "user-1",
  snapshot,
};

test("aceita somente snapshot oficial coerente com atendimento e plano de origem", () => {
  const parsed = parseNutritionReportMetadata(metadata);
  assert.equal(parsed?.attendanceId, "attendance-1");
  assert.equal(parsed?.sourceVersion, 4);
  assert.equal(parsed?.snapshot.status, "APPROVED");

  assert.equal(parseNutritionReportMetadata({
    ...metadata,
    attendanceId: "attendance-2",
  }), null);
  assert.equal(parseNutritionReportMetadata({
    ...metadata,
    sourceEntryId: "entry-2",
  }), null);
});

test("não promove prévia, rascunho local ou metadata incompleta a documento oficial", () => {
  assert.equal(parseNutritionReportMetadata({
    ...metadata,
    snapshot: { ...snapshot, status: "DRAFT", approvedAt: undefined },
  }), null);
  assert.equal(parseNutritionReportMetadata({
    ...metadata,
    sourceVersionId: undefined,
  }), null);
  assert.equal(parseNutritionReportMetadata(null), null);
});

test("persistência não executa consultas concorrentes na mesma transação", async () => {
  const source = await readFile(new URL("./persistence.ts", import.meta.url), "utf8");
  const transactionBody = source.slice(source.indexOf("prisma.$transaction"));

  assert.doesNotMatch(transactionBody, /Promise\.all/);
  assert.match(transactionBody, /existingInTransaction/);
  assert.match(transactionBody, /sourceVersionId/);
});

test("interface separa publicação de relatório das ações de leitura e impressão", async () => {
  const [source, printPageSource, styles] = await Promise.all([
    readFile(
      new URL("../../components/deliverables/nutrition-deliverable-preview.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../app/(authenticated)/clinica/plano-alimentar/entregavel/imprimir/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /action:\s*"SAVE_OFFICIAL_REPORT"/);
  assert.doesNotMatch(source, /SAVE_AND_PRINT/);
  assert.match(source, /Salvar relatório/);
  assert.doesNotMatch(source, /Salvar e imprimir/);
  assert.doesNotMatch(source, /Imprimir novamente/);
  assert.match(source, /Salvar em PDF/);
  assert.match(source, /Imprimir prévia completa/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /Este relatório ainda não foi publicado/);
  assert.match(source, /openReadOnlyDocument/);
  assert.match(source, /Visualização da versão oficial congelada/);
  const readOnlyAction = source.slice(
    source.indexOf("function openReadOnlyDocument"),
    source.indexOf("async function persistOfficialReport"),
  );
  assert.doesNotMatch(readOnlyAction, /fetch\(|method:\s*"POST"/);
  assert.match(readOnlyAction, /window\.location\.assign/);
  assert.match(source, /documentType === "meal-plan"/);
  assert.match(source, /!isFinalizedMealPlan && draft\.includeClinicalDiagnosis/);
  assert.match(source, /!isFinalizedMealPlan \? draft\.optionalSectionOrder/);
  assert.match(source, /Section title="Estrat.gia Nutricional aprovada"/);
  assert.match(source, /sourcePlanDraftPreview \? "Plano Alimentar em rascunho" : "Plano Alimentar aprovado"/);
  assert.match(source, /draft\.mealPlan\?\.recipes\?\.length/);
  assert.match(source, /recipe=\{recipe\}/);
  assert.match(source, /sourceVersionId/);
  assert.match(source, /entregavel\/imprimir/);
  assert.match(source, /printMode[\s\S]*window\.print\(\)/);
  assert.match(source, /Salvando o relatório oficial/);
  assert.match(source, /Relatório oficial salvo/);
  assert.doesNotMatch(source, /window\.open\(/);
  assert.doesNotMatch(source, /document\.write\(/);
  assert.match(printPageSource, /"meal-plan"/);
  assert.match(printPageSource, /"nutrition"/);
  assert.match(printPageSource, /"postural"/);
  assert.match(printPageSource, /"performance"/);
  assert.match(printPageSource, /source:/);
  assert.match(printPageSource, /print: "1"/);
  assert.doesNotMatch(source, /persistência no banco será ligada/);
  assert.doesNotMatch(source, /Aprovar e gerar PDF/);
  assert.doesNotMatch(source, /nutritionDeliverableDraftStorage\.save\(next\)[\s\S]{0,250}status:\s*"APPROVED"/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1\.4fr\) repeat\(3, minmax\(0, 0\.8fr\)\)/);
  assert.match(styles, /\.report-section:has\(\.recipe-appendix-card\)[\s\S]*break-inside: avoid/);
  assert.match(styles, /\.report-section-title[\s\S]*break-after: avoid/);
});

test("totais da paciente resumem dados incompletos e preservam o detalhamento profissional", async () => {
  const source = await readFile(
    new URL("../../components/deliverables/nutrition-deliverable-preview.tsx", import.meta.url),
    "utf8",
  );
  const patientTotals = source.slice(
    source.indexOf("function DeliverableNutritionTotals"),
    source.indexOf("function NutritionCompletenessDetails"),
  );
  const professionalDetails = source.slice(
    source.indexOf("function NutritionCompletenessDetails"),
    source.indexOf("function DeliverableRecipeCard"),
  );

  for (const label of ["Energia", "Proteínas", "Carboidratos", "Gorduras", "Fibras"]) {
    assert.match(patientTotals, new RegExp(`label="${label}"`));
  }
  assert.match(patientTotals, /identificados como “parcial” consideram apenas as informações disponíveis/);
  assert.doesNotMatch(patientTotals, /missingContributions\.map|partialContributions\.map/);
  assert.match(professionalDetails, /missingContributions\.map/);
  assert.match(professionalDetails, /partialContributions\.map/);
  assert.match(source, /print:hidden[\s\S]*NutritionCompletenessDetails plan=\{draft\.mealPlan\}/);
});

test("textos profissionais são explícitos, persistíveis no relatório e somente leitura após publicação", async () => {
  const source = await readFile(
    new URL("../../components/deliverables/nutrition-deliverable-preview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Considerações e orientações profissionais/);
  assert.match(source, /Considerações do profissional/);
  assert.match(source, /Orientações para a paciente/);
  assert.match(source, /Nenhum texto é criado[\s\S]*automaticamente em nome do profissional/);
  assert.match(source, /function saveProfessionalNotesForReview/);
  assert.match(source, /nutritionDeliverableDraftStorage\.save\(next\)/);
  assert.match(source, /Para persistir esses textos no serviço de Entregáveis, use “Salvar relatório”/);
  assert.match(source, /\{!isReadOnly \? \([\s\S]*professional-considerations/);
  assert.match(source, /professionalNotes:[\s\S]*considerations:[\s\S]*orientations:/);
  assert.match(source, /if \(assigned\.has\(item\.id\)\) return false/);
});

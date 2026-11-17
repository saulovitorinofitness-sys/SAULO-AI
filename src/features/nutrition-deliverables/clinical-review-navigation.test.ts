import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewPath = new URL(
  "../../components/deliverables/nutrition-deliverable-preview.tsx",
  import.meta.url,
);
const anamnesisPagePath = new URL(
  "../../app/(authenticated)/pacientes/[patientId]/anamnese/page.tsx",
  import.meta.url,
);
const anamnesisComponentPath = new URL(
  "../../components/clinical-anamnesis/clinical-anamnesis.tsx",
  import.meta.url,
);
const clinicalPanelPagePath = new URL(
  "../../app/(authenticated)/pacientes/[patientId]/atendimentos/[attendanceId]/painel-clinico/page.tsx",
  import.meta.url,
);
const diagnosisReviewRepositoryPath = new URL(
  "../nutrition-diagnosis-review/repository.ts",
  import.meta.url,
);
const diagnosisReviewRoutePath = new URL(
  "../../app/api/patients/[patientId]/attendances/[attendanceId]/nutrition-diagnosis-review/route.ts",
  import.meta.url,
);
const diagnosisReviewFormPath = new URL(
  "../../components/nutrition-strategy/nutrition-diagnosis-review.tsx",
  import.meta.url,
);
const nutritionPanelRepositoryPath = new URL(
  "../nutrition-strategy/clinical-panel-repository.ts",
  import.meta.url,
);

test("a conferencia resolve a decisao documental sem desviar para revisao clinica", async () => {
  const source = await readFile(previewPath, "utf8");

  assert.match(source, /includeClinicalDiagnosis/);
  assert.match(source, /Se..o opcional deste documento/);
  assert.match(source, /ser. omitida sem criar revis.o cl.nica/);
  assert.match(source, /Salvar relatório/);
  assert.doesNotMatch(source, /Salvar e imprimir/);
  assert.match(source, /Imprimir/);
  assert.match(source, /Salvar em PDF/);
  assert.doesNotMatch(source, /painel-clinico\?section=diagnosis-review/);
  assert.doesNotMatch(source, /Registrar revis.o diagn.stica deste atendimento/);
  assert.doesNotMatch(source, /\/anamnese\?attendanceId=/);
});

test("a anamnese preserva o atendimento na reidratacao e valida o retorno ao entregavel", async () => {
  const [page, component] = await Promise.all([
    readFile(anamnesisPagePath, "utf8"),
    readFile(anamnesisComponentPath, "utf8"),
  ]);

  assert.match(component, /attendanceId: initialView\.attendanceId/);
  assert.match(component, /initialSection = "CONSULTA"/);
  assert.match(page, /url\.pathname !== "\/clinica\/plano-alimentar\/entregavel"/);
  assert.match(page, /url\.searchParams\.get\("patientId"\) !== patientId/);
  assert.match(page, /url\.searchParams\.get\("attendanceId"\) !== attendanceId/);
  assert.match(page, /initialSection=\{query\.section === "clinical-history" \? "HISTORICO" : undefined\}/);
  assert.match(page, /Voltar ao Entreg.vel/);
});

test("o painel clinico usa o repositorio persistido quando o gateway demonstrativo nao resolve", async () => {
  const source = await readFile(clinicalPanelPagePath, "utf8");

  assert.match(source, /nutritionClinicalPanelRepository\.get\(/);
  assert.match(source, /nutritionStrategyService\.canAccess\(access\.user\)/);
  assert.match(source, /if \(!nutritionPanel\) notFound\(\)/);
  assert.match(source, /este atendimento n.o possui diagn.stico revisado/);
});

test("a revisao diagnostica e persistida separadamente e retorna somente depois de salvar", async () => {
  const [repository, route, form, panelRepository] = await Promise.all([
    readFile(diagnosisReviewRepositoryPath, "utf8"),
    readFile(diagnosisReviewRoutePath, "utf8"),
    readFile(diagnosisReviewFormPath, "utf8"),
    readFile(nutritionPanelRepositoryPath, "utf8"),
  ]);

  assert.match(repository, /NUTRITION_DIAGNOSIS_REVIEW/);
  assert.match(repository, /id: input\.attendanceId/);
  assert.match(repository, /status: "IN_PROGRESS"/);
  assert.match(repository, /recordVersion\.create/);
  assert.match(repository, /auditEvent\.create/);
  assert.match(repository, /NO_DIAGNOSIS_ESTABLISHED/);
  assert.match(repository, /DIAGNOSES_CONFIRMED/);
  assert.match(repository, /existingView\.outcome === input\.outcome/);
  assert.match(repository, /JSON\.stringify\(existingPayload\.data\.diagnoses\)/);
  assert.doesNotMatch(repository, /CLINICAL_ANAMNESIS/);
  assert.doesNotMatch(repository, /MEAL_PLAN/);

  assert.match(route, /action: z\.literal\("SAVE_REVIEW"\)/);
  assert.match(route, /z\.discriminatedUnion\("outcome"/);
  assert.match(route, /canAccess\(access, "MASTER_RECORD", "UPDATE"\)/);
  assert.match(route, /nutritionStrategyService\.canAccess\(access\.user\)/);
  assert.match(form, /Esta a..o n.o[\s\S]*altera nem reabre a/);
  assert.match(form, /sem diagn.stico estabelecido neste atendimento/);
  assert.match(form, /com diagn.sticos confirmados/);
  assert.match(form, /n.o presume[\s\S]*paciente esteja saud.vel/);
  assert.match(form, /router\.push\(returnHref\)/);
  assert.match(form, /Salvar revis.o e voltar ao Entreg.vel/);
  assert.match(panelRepository, /collection\.anamnesis\?\.attendanceId === collection\.attendanceId/);
  assert.match(panelRepository, /diagnosisReview\?\.diagnoses \?\? currentAttendanceDiagnoses/);
});

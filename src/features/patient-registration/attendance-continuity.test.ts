import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { InitialConsultationProgress } from "../../components/patients/initial-consultation-progress";
import {
  buildNutritionClinicalFlow,
  nutritionClinicalFlowProgress,
} from "../nutrition-clinical-flow";
import { clinicalAttendanceTypeLabel } from "./attendance-presentation";
import type { RegisteredPatientEntry } from "./contracts";

const patient: RegisteredPatientEntry = {
  patientId: "patient-current",
  clinicalCode: "SV000123",
  fullName: "Maria Gilvania dos Santos",
  birthDate: "1980-01-01",
  age: 46,
  sex: "FEMALE",
  phone: "(00) 00000-0000",
  masterRecordId: "master-record-existing",
  activeAttendance: {
    id: "attendance-return-open",
    status: "IN_PROGRESS",
    clinicalType: "RETURN",
    preparedAt: "2026-10-06T12:00:00.000Z",
    startedAt: "2026-10-06T12:00:00.000Z",
  },
  historicalAttendance: {
    id: "attendance-previous-completed",
    status: "COMPLETED",
    clinicalType: "FIRST_CONSULTATION",
    preparedAt: "2026-09-01T12:00:00.000Z",
    startedAt: "2026-09-01T12:00:00.000Z",
    endedAt: "2026-09-01T13:00:00.000Z",
  },
  canEdit: true,
  steps: [],
};

const flow = buildNutritionClinicalFlow(
  {
    patientId: patient.patientId,
    attendanceId: patient.activeAttendance!.id,
    scenario: "complete",
  },
  { PATIENT_REGISTRATION: "COMPLETED" },
);

test("tipo RETORNO usa Attendance.clinicalType e não infere consulta inicial", () => {
  assert.equal(clinicalAttendanceTypeLabel("RETURN"), "Retorno");
  const html = renderToStaticMarkup(
    createElement(InitialConsultationProgress, {
      patient,
      registered: false,
      flow,
    }),
  );
  assert.match(html, /Atendimento atual/);
  assert.match(html, /Retorno/);
  assert.doesNotMatch(html, /Consulta inicial/);
});

test("navegação clínica real não propaga scenario=complete", async () => {
  assert.ok(flow.every((step) => !step.href.includes("scenario=")));
  const masterRecordPage = await readFile(
    new URL(
      "../../app/(authenticated)/pacientes/[patientId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(masterRecordPage, /if \(query\.scenario\) \{\s*redirect\(/);
});

test("cabeçalho e painel reutilizam o mesmo percentual do fluxo", async () => {
  assert.equal(nutritionClinicalFlowProgress(flow), 0);
  const html = renderToStaticMarkup(
    createElement(InitialConsultationProgress, {
      patient,
      registered: false,
      flow,
    }),
  );
  assert.match(html, /0% concluído/);

  const [headerSource, panelSource] = await Promise.all([
    readFile(
      new URL(
        "../../components/nutrition-clinical-flow/clinical-flow-navigation.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/patients/initial-consultation-progress.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(headerSource, /nutritionClinicalFlowProgress\(flow\)/);
  assert.match(panelSource, /nutritionClinicalFlowProgress\(flow\)/);
});

test("retorno remove Cadastro da sequência e calcula posição pelo fluxo aplicável", async () => {
  const [masterRecordPage, navigation, stepper] = await Promise.all([
    readFile(
      new URL(
        "../../app/(authenticated)/pacientes/[patientId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/nutrition-clinical-flow/clinical-flow-navigation.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/clinical-collection/clinical-flow-stepper.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(masterRecordPage, /clinicalType === "RETURN"/);
  assert.match(
    masterRecordPage,
    /flow\.flow\.filter\(\(step\) => step\.id !== "PATIENT_REGISTRATION"\)/,
  );
  assert.match(masterRecordPage, /step\.id === flow\.resumeStep\.id/);
  assert.match(masterRecordPage, /: flow\.flow;/);
  assert.match(navigation, /activeStepPosition/);
  assert.match(navigation, /visibleFlow\.length/);
  assert.doesNotMatch(navigation, /\{definition\.order\} de/);
  assert.match(stepper, /stepIndex \+ 1/);
  assert.doesNotMatch(stepper, /\{\s*step\.order\s*\}/);
});

test("atendimento anterior permanece separado e somente leitura", () => {
  const html = renderToStaticMarkup(
    createElement(InitialConsultationProgress, {
      patient,
      registered: false,
      flow,
    }),
  );
  assert.match(html, /Histórico anterior/);
  assert.match(html, /Primeira consulta · Atendimento concluído/);
  assert.match(html, /registro anterior permanece preservado/);
});

test("Continuar atendimento resolve somente o atendimento iniciado atual", async () => {
  const source = await readFile(
    new URL(
      "../../app/(authenticated)/pacientes/[patientId]/continuar/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /findOpenAttendance\(patientId\)/);
  assert.match(source, /attendance\.status === "DRAFT"/);
  assert.doesNotMatch(source, /historicalAttendance|status:\s*["']COMPLETED["']/);
});

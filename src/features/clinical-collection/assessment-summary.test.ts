import assert from "node:assert/strict";
import test from "node:test";

import type { ClinicalAnamnesisData } from "@/features/clinical-anamnesis/contracts";

import {
  assessmentConditionLabels,
  assessmentSummaryIntegrityIssues,
  assessmentSummaryMissingInformation,
  assessmentSummarySourceDates,
} from "./assessment-summary";
import type { ClinicalCollectionView } from "./contracts";

function anamnesisData(): ClinicalAnamnesisData {
  return {
    chiefComplaint: "",
    currentIllness: {
      onset: "",
      duration: "",
      evolution: "",
      previousTreatments: "",
      currentSituation: "",
    },
    primaryObjective: "",
    secondaryObjectives: [],
    clinicalHistory: [],
    clinicalHistoryNotes: "",
    familyHistory: [],
    surgeries: [],
    injuries: [],
    medications: [],
    supplements: [],
    allergyStatus: "NOT_INFORMED",
    allergies: [],
    sleep: { hours: "", quality: "", awakenings: "" },
    stressLevel: 0,
    physicalActivity: { frequency: "", duration: "", modality: "" },
    habits: { alcohol: "", smoking: "", others: "" },
    nutrition: {
      mealsPerDay: "",
      water: "",
      restrictions: "",
      preferences: "",
    },
    generalNotes: "",
  };
}

function collection(): ClinicalCollectionView {
  const audit = {
    professionalUserId: "professional-1",
    professionalName: "Profissional real",
    updatedAt: "2026-07-31T12:00:00.000Z",
    version: 1,
  };
  const emptyView = { state: "NOT_ASSESSED" as const };

  return {
    patientId: "patient-1",
    patientName: "Paciente real",
    patientCode: "P-1",
    patientSex: "MALE",
    attendanceId: "attendance-1",
    attendanceStartedAt: "2026-07-31T09:00:00.000Z",
    masterRecordId: "master-1",
    consultationType: "INITIAL",
    connectedProfessional: audit,
    records: {
      anthropometry: {
        status: "NOT_STARTED",
        data: {},
        missingRequiredFields: [],
      },
      perimetry: {
        status: "NOT_STARTED",
        data: {},
        missingRequiredFields: [],
      },
      bioimpedance: {
        status: "NOT_STARTED",
        data: {},
        missingRequiredFields: [],
      },
      posturalAssessment: {
        status: "NOT_STARTED",
        data: {
          views: {
            ANTERIOR: emptyView,
            POSTERIOR: emptyView,
            RIGHT_LATERAL: emptyView,
            LEFT_LATERAL: emptyView,
          },
          identifiedChanges: "NOT_ASSESSED",
          functionalLimitations: "NOT_ASSESSED",
        },
        missingRequiredFields: [],
      },
    },
    progressPercent: 0,
    nutritionFlowReady: false,
    firstIncompleteStep: "ANTHROPOMETRY",
    canRead: true,
    canEdit: true,
    completed: false,
    scenario: "complete",
  };
}

test("fontes do resumo mantêm as datas do atendimento atual", () => {
  const current = collection();
  const withSources: ClinicalCollectionView = {
    ...current,
    anthropometryMeasuredAt: "2026-07-31T10:00:00.000Z",
    perimetryMeasuredAt: "2026-07-31T10:30:00.000Z",
    bioimpedanceMeasuredAt: "2026-07-31T11:00:00.000Z",
    posturalAssessedAt: "2026-07-31T11:30:00.000Z",
    anamnesis: {
      entryId: "anamnesis-1",
      masterRecordId: current.masterRecordId,
      attendanceId: current.attendanceId,
      occurredAt: "2026-07-31T09:30:00.000Z",
      data: anamnesisData(),
      audit: current.connectedProfessional,
    },
  };

  assert.deepEqual(
    assessmentSummarySourceDates(withSources).map((source) => source.value),
    [
      "2026-07-31T09:00:00.000Z",
      "2026-07-31T09:30:00.000Z",
      "2026-07-31T10:00:00.000Z",
      "2026-07-31T10:30:00.000Z",
      "2026-07-31T11:00:00.000Z",
      "2026-07-31T11:30:00.000Z",
    ],
  );
});

test("dados ausentes são descritos sem usar zero como valor clínico", () => {
  const messages = assessmentSummaryMissingInformation(collection());

  assert.ok(messages.includes("Anamnese não registrada neste atendimento."));
  assert.ok(
    messages.includes("Peso e altura não informados; IMC indisponível."),
  );
  assert.ok(
    messages.includes("Bioimpedância não registrada neste atendimento."),
  );
  assert.equal(messages.some((message) => /\b0\b/.test(message)), false);
});

test("diagnóstico histórico incompatível é preservado e sinalizado", () => {
  const current = collection();
  const withLegacyDiagnosis: ClinicalCollectionView = {
    ...current,
    anamnesis: {
      entryId: "anamnesis-1",
      masterRecordId: current.masterRecordId,
      attendanceId: current.attendanceId,
      occurredAt: "2026-07-31T12:00:00.000Z",
      data: {
        ...anamnesisData(),
        clinicalHistory: ["DIABETES"],
        clinicalHistoryNotes: "endometriose",
      },
      audit: current.connectedProfessional,
    },
  };

  assert.deepEqual(assessmentConditionLabels(withLegacyDiagnosis), [
    "Diabetes",
    "endometriose",
  ]);
  assert.match(
    assessmentSummaryIntegrityIssues(withLegacyDiagnosis).join(" "),
    /endometriose.*incompatível/i,
  );
});

test("anamnese de outro atendimento não é aceita silenciosamente", () => {
  const current = collection();
  const mixed: ClinicalCollectionView = {
    ...current,
    anamnesis: {
      entryId: "anamnesis-old",
      masterRecordId: current.masterRecordId,
      attendanceId: "attendance-old",
      occurredAt: "2025-01-01T10:00:00.000Z",
      data: anamnesisData(),
      audit: current.connectedProfessional,
    },
  };

  assert.match(
    assessmentSummaryIntegrityIssues(mixed).join(" "),
    /não pertence ao atendimento atual/i,
  );
});

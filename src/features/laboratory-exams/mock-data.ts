import { BUILT_IN_IDS } from "@/modules/permissions";
import type { LaboratoryExamHistoryEntry, LaboratoryExamRecord, LaboratoryExamsView } from "./contracts";

const masterRecordId = "demo-master-record-001";
const patientId = "demo-patient-001";

export const laboratoryExamMockRecords: readonly LaboratoryExamRecord[] = [
  { id: "lab-hemogram-2026", masterRecordId, patientId, category: "BLOOD", name: "Hemograma", result: "Registro demonstrativo 2026", unit: "conforme laudo", referenceValue: "conforme laudo", collectedAt: "2026-07-01", laboratory: "Laboratório demonstrativo", notes: "Resultado mockado apenas para organização visual.", status: "ACTIVE", version: 1, createdAt: "2026-07-02T09:00:00-03:00", updatedAt: "2026-07-02T09:00:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "lab-glucose-2026", masterRecordId, patientId, category: "GLYCEMIA", name: "Glicemia", result: "Registro demonstrativo 2026", unit: "mg/dL", referenceValue: "conforme laudo", collectedAt: "2026-07-01", laboratory: "Laboratório demonstrativo", notes: "Sem interpretação clínica.", status: "ACTIVE", version: 1, createdAt: "2026-07-02T09:03:00-03:00", updatedAt: "2026-07-02T09:03:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "lab-hemogram-2025", masterRecordId, patientId, category: "BLOOD", name: "Hemograma", result: "Registro demonstrativo 2025", unit: "conforme laudo", referenceValue: "conforme laudo", collectedAt: "2025-12-10", laboratory: "Laboratório demonstrativo", notes: "Registro anterior preservado para comparação.", status: "ACTIVE", version: 1, createdAt: "2025-12-11T08:15:00-03:00", updatedAt: "2025-12-11T08:15:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "lab-glucose-2025", masterRecordId, patientId, category: "GLYCEMIA", name: "Glicemia", result: "Registro demonstrativo 2025", unit: "mg/dL", referenceValue: "conforme laudo", collectedAt: "2025-12-10", laboratory: "Laboratório demonstrativo", notes: "Registro anterior preservado para comparação.", status: "ACTIVE", version: 1, createdAt: "2025-12-11T08:18:00-03:00", updatedAt: "2025-12-11T08:18:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "lab-tsh-2026", masterRecordId, patientId, category: "THYROID", name: "TSH", result: "Registro demonstrativo", unit: "conforme laudo", referenceValue: "conforme laudo", collectedAt: "2026-07-01", laboratory: "Laboratório demonstrativo", notes: "Sem classificação ou diagnóstico.", status: "ACTIVE", version: 1, createdAt: "2026-07-02T09:05:00-03:00", updatedAt: "2026-07-02T09:05:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
];

export const laboratoryExamMockHistory: readonly LaboratoryExamHistoryEntry[] = laboratoryExamMockRecords.map((record) => ({ id: `history-${record.id}`, examId: record.id, action: "CREATED", occurredAt: record.createdAt, professionalName: record.recordedBy, summary: `${record.name} adicionado ao Prontuário Mestre.` }));

export const laboratoryExamMockView: LaboratoryExamsView = {
  patientId, patientName: "Paciente de demonstração", patientCode: "DEMO-001", masterRecordId,
  scenario: "complete", records: laboratoryExamMockRecords, history: laboratoryExamMockHistory,
  canRead: true, canEdit: true, connectedProfessionalName: "Saulo Xavier Vitorino",
};

export function laboratoryExamProfessional(scenario: string) {
  return scenario === "maria-continuity" || scenario === "previous-comparison"
    ? { id: BUILT_IN_IDS.users.mariaDeLourdesGomes, name: "Maria de Lourdes Gomes" }
    : { id: BUILT_IN_IDS.users.sauloXavierVitorino, name: "Saulo Xavier Vitorino" };
}

